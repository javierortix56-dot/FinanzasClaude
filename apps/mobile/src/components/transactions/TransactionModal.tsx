'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2, Repeat, Copy, ArrowRight, Check, CheckCircle2, Camera } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { addTransaction, updateTransaction, deleteTransaction, cloneTransactionToMonth, moveTransactionToMonth } from '@finanzas/core/lib/transactions'
import { SHARED_USER_ID, SHARED_USERS, formatAmount, getParentGroup, getCatFromSettings, toLocalDateString, DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { adjustAssetSaldo } from '@finanzas/core/lib/assets'
import { toBase } from '@finanzas/core/lib/currency'
import { parseTicket } from '@finanzas/core/lib/ticket'
import { ocrImagen } from '@/lib/ocr'
import { Transaction, Currency, TransactionType, CategoryGroup, Asignacion } from '@finanzas/core/types'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

/** Borrador de asignación mientras se edita (monto como string del input) */
interface AsigDraft {
  ingresoId: string
  monto: string
}

function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function toInputStr(v: number): string {
  return String(Math.round(v * 100) / 100)
}

export default function TransactionModal() {
  const { isTransactionModalOpen, editingTransaction, closeTransactionModal, showToast } = useUIStore()
  const { settings, hideAmounts } = useSettingsStore()
  const { transactions } = useTransactionStore()
  const { monedaBase } = useAuthStore()
  const { assets } = useAssetStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [tipo, setTipo] = useState<TransactionType>('egreso')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>('ARS')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(toLocalDateString())
  const [creadoPor, setCreadoPor] = useState(SHARED_USERS[0].id)
  const [ejecutado, setEjecutado] = useState(false)
  const [asigs, setAsigs] = useState<AsigDraft[]>([])
  const [recurrente, setRecurrente] = useState(false)
  const [ahorroAssetId, setAhorroAssetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [cloneMonth, setCloneMonth] = useState('')
  const [cloneAction, setCloneAction] = useState<'clone' | 'move' | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanPct, setScanPct] = useState(0)

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setDeleteConfirm(false)
      setSaveError(null)
      setCloneMonth('')
      setCloneAction(null)
      return
    }
    if (editingTransaction) {
      setTipo(editingTransaction.tipo)
      setMonto(String(editingTransaction.monto))
      setMoneda(editingTransaction.moneda)
      setDescripcion(editingTransaction.descripcion)
      const d = editingTransaction.fecha.toDate()
      setFecha(toLocalDateString(d))
      setCreadoPor(editingTransaction.creadoPor || SHARED_USERS[0].id)
      setEjecutado(editingTransaction.ejecutado)
      setAsigs(editingTransaction.asignaciones.map((a) => ({ ingresoId: a.ingresoId, monto: toInputStr(a.monto) })))
      setRecurrente(editingTransaction.recurrente ?? false)
      setAhorroAssetId(editingTransaction.ahorroAssetId ?? '')
      const catId = editingTransaction.categoria
      const allGroups = editingTransaction.tipo === 'egreso'
        ? (settings?.categoriasGasto ?? DEFAULT_GASTO_CATEGORY_GROUPS)
        : (settings?.categoriasIngreso ?? DEFAULT_INGRESO_CATEGORY_GROUPS)
      const parentGrp = getParentGroup(catId, allGroups)
      if (parentGrp) { setSelectedGroup(parentGrp.id); setSelectedSub(catId) }
      else { setSelectedGroup(catId); setSelectedSub('') }
    } else {
      setTipo('egreso'); setMonto(''); setMoneda('ARS')
      setSelectedGroup(''); setSelectedSub(''); setDescripcion('')
      setFecha(toLocalDateString())
      setCreadoPor(SHARED_USERS[0].id); setEjecutado(false); setAsigs([]); setRecurrente(false); setAhorroAssetId('')
    }
  }, [isTransactionModalOpen, editingTransaction, settings])

  // Auto-fill cuenta de ahorro from ahorroLinks config when category changes (new transactions only)
  useEffect(() => {
    if (editingTransaction || !isTransactionModalOpen) return
    const cat = selectedSub || selectedGroup
    const link = (s.ahorroLinks ?? []).find((l) => l.categoriaId === cat)
    if (link) setAhorroAssetId(link.assetId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSub, selectedGroup])

  const parsedMonto  = num(monto)
  const montoValido  = parsedMonto > 0
  const montoInvalid = !!monto.trim() && !montoValido

  // Mantener las asignaciones en sync cuando cambia el monto total:
  // 1 seleccionada → asignación completa; 2 → la segunda absorbe el resto.
  useEffect(() => {
    if (!isTransactionModalOpen || !montoValido) return
    setAsigs((prev) => {
      if (prev.length === 1) {
        if (num(prev[0].monto) === parsedMonto) return prev
        return [{ ...prev[0], monto: toInputStr(parsedMonto) }]
      }
      if (prev.length === 2) {
        const first = num(prev[0].monto)
        const resto = Math.max(parsedMonto - first, 0)
        if (num(prev[1].monto) === resto) return prev
        return [prev[0], { ...prev[1], monto: toInputStr(resto) }]
      }
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedMonto, isTransactionModalOpen])

  const categoryGroups: CategoryGroup[] = tipo === 'egreso'
    ? (s.categoriasGasto.length > 0 ? s.categoriasGasto : DEFAULT_GASTO_CATEGORY_GROUPS)
    : (s.categoriasIngreso.length > 0 ? s.categoriasIngreso : DEFAULT_INGRESO_CATEGORY_GROUPS)

  const activeGroups = categoryGroups.filter((g) => g.activa)
  const currentGroup = activeGroups.find((g) => g.id === selectedGroup)
  const activeSubs   = currentGroup?.subcategorias.filter((c) => c.activa) ?? []
  const categoria    = selectedSub || selectedGroup

  const sugerencias = useMemo(() => {
    const catId = selectedSub || selectedGroup
    if (!catId) return []
    return [...new Set(
      transactions
        .filter((t) => t.categoria === catId && t.descripcion && t.descripcion !== descripcion)
        .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
        .map((t) => t.descripcion),
    )].slice(0, 5)
  }, [transactions, selectedSub, selectedGroup, descripcion])

  // Ingresos del mes con su disponible (excluyendo lo asignado por ESTE movimiento)
  const ingresoOptions = useMemo(() => {
    return transactions
      .filter((t) => t.tipo === 'ingreso')
      .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
      .map((ing) => {
        const incBase = toBase(ing.monto, ing.moneda, base, s)
        const usedBase = transactions
          .filter((t) => t.tipo === 'egreso' && t.id !== editingTransaction?.id)
          .reduce((sum, t) => sum + t.asignaciones
            .filter((a) => a.ingresoId === ing.id)
            .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s), 0), 0)
        return { ing, remaining: incBase - usedBase }
      })
  }, [transactions, base, s, editingTransaction])

  // ── Lógica de asignación dividida ────────────────────────────────────────────
  const isSplit  = asigs.length >= 2
  const asigSum  = asigs.reduce((sum, a) => sum + num(a.monto), 0)
  const asigOk   = asigs.length === 0 ||
    (asigs.every((a) => num(a.monto) > 0) && Math.abs(asigSum - parsedMonto) < 0.01)

  function toggleIngreso(id: string) {
    setAsigs((prev) => {
      const exists = prev.some((a) => a.ingresoId === id)
      if (exists) {
        const next = prev.filter((a) => a.ingresoId !== id)
        // Si queda una sola, vuelve a ser asignación completa
        return next.length === 1 ? [{ ...next[0], monto: toInputStr(parsedMonto) }] : next
      }
      if (prev.length === 0) return [{ ingresoId: id, monto: toInputStr(parsedMonto) }]
      // División: el nuevo ingreso absorbe lo que falta cubrir
      const usado = prev.reduce((sum, a) => sum + num(a.monto), 0)
      const resto = Math.max(parsedMonto - usado, 0)
      return [...prev, { ingresoId: id, monto: toInputStr(resto) }]
    })
  }

  function setAsigMonto(id: string, value: string) {
    setAsigs((prev) => {
      const next = prev.map((a) => (a.ingresoId === id ? { ...a, monto: value } : a))
      // Con exactamente 2 ingresos, el otro absorbe el resto automáticamente
      if (next.length === 2) {
        const otherIdx = next.findIndex((a) => a.ingresoId !== id)
        const resto = Math.max(parsedMonto - num(value), 0)
        next[otherIdx] = { ...next[otherIdx], monto: toInputStr(resto) }
      }
      return next
    })
  }

  const canSave = montoValido && (tipo === 'ingreso' || asigOk)

  // ── Escanear ticket con la cámara (OCR en el dispositivo) ───────────────────
  async function handleScanTicket(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanPct(0)
    setSaveError(null)
    try {
      const texto = await ocrImagen(file, setScanPct)
      const parsed = parseTicket(texto)
      if (parsed.total === null && !parsed.comercio) {
        showToast('No se pudo leer el ticket — probá con más luz', 'error')
        return
      }
      if (parsed.total !== null) setMonto(String(parsed.total))
      if (parsed.comercio && !descripcion.trim()) setDescripcion(parsed.comercio)
      if (parsed.fecha) setFecha(parsed.fecha)
      showToast('Ticket leído — revisá los datos 📸')
    } catch (err) {
      console.error('[scan] OCR error:', err)
      showToast('Error al leer el ticket', 'error')
    } finally {
      setScanning(false)
      if (scanInputRef.current) scanInputRef.current.value = ''
    }
  }

  const accentColor = tipo === 'egreso' ? '#f87171' : '#22c55e'
  const accentBg    = tipo === 'egreso' ? 'bg-red-400' : 'bg-green-500'

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const asignaciones: Asignacion[] = tipo === 'egreso'
        ? asigs.map((a) => ({ ingresoId: a.ingresoId, monto: num(a.monto) }))
        : []
      const data: Omit<Transaction, 'id'> = {
        userId: SHARED_USER_ID, tipo, monto: parsedMonto, moneda, categoria,
        descripcion: descripcion.trim(),
        nota: editingTransaction?.nota ?? '', tags: editingTransaction?.tags ?? [],
        fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
        ejecutado,
        asignaciones,
        creadoPor: creadoPor || SHARED_USER_ID,
        recurrente,
      }

      // Use the explicitly selected cuenta de ahorro
      data.ahorroAssetId = ahorroAssetId || null

      if (editingTransaction?.id) {
        await updateTransaction(editingTransaction.id, data)
        showToast('Movimiento actualizado')
      } else {
        await addTransaction(data)
        showToast('Movimiento guardado')
      }

      // Sync asset saldo (non-blocking, fetches asset from DB directly)
      try {
        const txMonth = fecha.slice(0, 7)
        const oldAssetId = editingTransaction?.ahorroAssetId ?? ''
        const newAssetId = ahorroAssetId
        if (editingTransaction?.id) {
          if (oldAssetId && oldAssetId !== newAssetId) {
            // Asset changed — reverse the old one
            const oldMonth = editingTransaction.fecha.toDate().toISOString().slice(0, 7)
            await adjustAssetSaldo(oldAssetId, -editingTransaction.monto, oldMonth)
          }
          if (newAssetId) {
            const delta = oldAssetId === newAssetId
              ? parsedMonto - editingTransaction.monto   // same asset: only the diff
              : parsedMonto                              // new asset: full amount
            if (delta !== 0) await adjustAssetSaldo(newAssetId, delta, txMonth)
          }
        } else if (newAssetId) {
          await adjustAssetSaldo(newAssetId, parsedMonto, txMonth)
        }
      } catch (syncErr) {
        console.error('[handleSave] asset sync error:', syncErr)
      }

      closeTransactionModal()
    } catch (err) {
      console.error('[handleSave] error:', err)
      let msg = 'Error desconocido'
      if (err instanceof Error) {
        msg = err.message
      } else if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>
        const parts: string[] = []
        if (e.message) parts.push(String(e.message))
        if (e.details) parts.push(String(e.details))
        if (e.hint)    parts.push(`Hint: ${e.hint}`)
        if (e.code)    parts.push(`Code: ${e.code}`)
        msg = parts.length > 0 ? parts.join(' — ') : JSON.stringify(err)
      }
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editingTransaction?.id) return
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setSaving(true)
    try {
      if (editingTransaction.ahorroAssetId) {
        try {
          const txMonth = editingTransaction.fecha.toDate().toISOString().slice(0, 7)
          await adjustAssetSaldo(editingTransaction.ahorroAssetId, -editingTransaction.monto, txMonth)
        } catch (syncErr) {
          console.error('[handleDelete] asset sync error:', syncErr)
        }
      }
      await deleteTransaction(editingTransaction.id)
      closeTransactionModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleCloneMove() {
    if (!editingTransaction?.id || !cloneMonth) return
    setSaving(true)
    setSaveError(null)
    try {
      if (cloneAction === 'clone') {
        await cloneTransactionToMonth(editingTransaction.id, cloneMonth)
        showToast('Movimiento clonado')
      } else {
        await moveTransactionToMonth(editingTransaction.id, cloneMonth)
        showToast('Movimiento movido')
      }
      closeTransactionModal()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={isTransactionModalOpen}
      onOpenChange={(open) => { if (!open) closeTransactionModal() }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface rounded-t-3xl z-50 shadow-2xl outline-none flex flex-col max-h-[92dvh]"
          aria-describedby={undefined}
        >
          {/* ── Header fijo: handle + tipo/título + cerrar ── */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2.5">
            <div className="flex justify-center pb-2.5">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              {editingTransaction ? (
                <Dialog.Title className="flex-1 text-base font-bold text-gray-900 pl-1">
                  Editar {tipo === 'egreso' ? 'egreso' : 'ingreso'}
                </Dialog.Title>
              ) : (
                <>
                  <Dialog.Title className="sr-only">Nuevo movimiento</Dialog.Title>
                  <div className="flex-1 flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
                    {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTipo(t); setSelectedGroup(''); setSelectedSub(''); setAsigs([]) }}
                        className={`flex-1 py-2 rounded-[10px] text-sm font-bold transition-all ${
                          tipo === t
                            ? t === 'egreso' ? 'bg-red-400 text-white shadow-sm' : 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-400'
                        }`}
                      >
                        {t === 'egreso' ? '↓ Egreso' : '↑ Ingreso'}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button
                onClick={closeTransactionModal}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X size={15} className="text-gray-600" />
              </button>
            </div>
          </div>

          {/* ── Cuerpo scrolleable ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">

            {/* Monto + moneda en un solo bloque */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: accentColor + '12' }}
            >
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                autoFocus={!editingTransaction}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className={`flex-1 min-w-0 text-4xl font-bold bg-transparent border-0 outline-none placeholder:text-gray-300 tabular-nums ${
                  montoInvalid ? 'text-red-400' : 'text-gray-900'
                }`}
                style={{ caretColor: accentColor }}
              />
              <div className="flex flex-col gap-1 flex-shrink-0">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setMoneda(c)}
                    className={`w-14 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      moneda === c ? 'text-white shadow-sm' : 'bg-surface/70 text-gray-400'
                    }`}
                    style={moneda === c ? { backgroundColor: accentColor } : {}}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Escanear ticket — solo egresos nuevos */}
            {tipo === 'egreso' && !editingTransaction && (
              <>
                <button
                  type="button"
                  onClick={() => scanInputRef.current?.click()}
                  disabled={scanning}
                  className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-gray-400 text-xs font-semibold hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-70"
                >
                  <Camera size={14} />
                  {scanning
                    ? scanPct > 0 ? `Leyendo ticket… ${scanPct}%` : 'Preparando lector…'
                    : 'Escanear ticket con la cámara'}
                </button>
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleScanTicket}
                />
              </>
            )}

            {/* Descripción */}
            <div>
              <input
                type="text"
                placeholder={montoValido && !descripcion.trim() ? '¿En qué fue? (recomendado)' : '¿En qué fue?'}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={`w-full bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${
                  montoValido && !descripcion.trim()
                    ? 'ring-1 ring-amber-200 focus:ring-amber-300 placeholder:text-amber-300'
                    : 'focus:ring-primary/30 focus:bg-surface'
                }`}
              />
              {sugerencias.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sugerencias.map((sg) => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => setDescripcion(sg)}
                      className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {sg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Categoría */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Categoría
                {montoValido && !categoria && (
                  <span className="ml-1.5 text-amber-400 font-semibold normal-case tracking-normal">· recomendado</span>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeGroups.map((g) => {
                  const isSelected = selectedGroup === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setSelectedGroup(g.id); setSelectedSub('') }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                      style={isSelected
                        ? { backgroundColor: g.color, color: '#fff' }
                        : { backgroundColor: g.color + '15', color: g.color }
                      }
                    >
                      {g.nombre}
                    </button>
                  )
                })}
              </div>
              {selectedGroup && activeSubs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pl-3 border-l-2 border-gray-100">
                  {activeSubs.map((sub) => {
                    const isSelected = selectedSub === sub.id
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedSub(isSelected ? '' : sub.id)}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
                        style={isSelected
                          ? { backgroundColor: sub.color, color: '#fff' }
                          : { backgroundColor: sub.color + '15', color: sub.color }
                        }
                      >
                        {sub.nombre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fecha + persona */}
            <div className="flex gap-2">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="flex-1 min-w-0 h-10 bg-gray-50 rounded-xl px-3 text-sm text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface"
              />
              <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5 flex-shrink-0">
                {SHARED_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setCreadoPor(u.id)}
                    className={`px-3.5 h-9 rounded-[10px] text-xs font-bold transition-all ${
                      creadoPor === u.id ? 'bg-primary text-white shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    {u.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Estado + recurrente */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEjecutado((v) => !v)}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  ejecutado
                    ? 'bg-green-50 border-green-300 text-green-600'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {ejecutado ? <CheckCircle2 size={14} /> : <span className="w-3 h-3 rounded-full border border-gray-300" />}
                {ejecutado ? 'Ejecutado' : 'Pendiente'}
              </button>
              <button
                type="button"
                onClick={() => setRecurrente((v) => !v)}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  recurrente
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <Repeat size={14} />
                Recurrente
              </button>
            </div>

            {/* ── Asignar a ingreso(s) — solo egresos ── */}
            {tipo === 'egreso' && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Asignar a ingreso
                  <span className="ml-1 font-normal normal-case tracking-normal text-gray-300">
                    — tocá otro para dividir
                  </span>
                </p>
                {ingresoOptions.length === 0 ? (
                  <p className="text-xs text-gray-300 italic px-1">No hay ingresos este mes</p>
                ) : (
                  <div className="space-y-1.5">
                    {ingresoOptions.map(({ ing, remaining }) => {
                      const cat = getCatFromSettings(ing.categoria, settings ?? null)
                      const nombre = ing.descripcion?.trim() || cat?.nombre || ing.categoria
                      const dateStr = ing.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                      const draft = asigs.find((a) => a.ingresoId === ing.id)
                      const isSel = !!draft
                      // Disponible proyectado: lo que le quedaría restando lo que este movimiento le asigna
                      const draftBase = draft ? toBase(num(draft.monto), moneda, base, s) : 0
                      const projected = remaining - draftBase
                      const overAfter = isSel && projected < 0

                      return (
                        <div
                          key={ing.id}
                          className={`rounded-xl border transition-all ${
                            isSel ? 'border-primary/50 bg-primary/5' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleIngreso(ing.id!)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                          >
                            <span className={`w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                              isSel ? 'bg-primary border-primary' : 'border-gray-300 bg-surface'
                            }`}>
                              {isSel && <Check size={11} color="white" strokeWidth={3.5} />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-semibold text-gray-800 truncate">{nombre}</span>
                              <span className="block text-[11px] text-gray-400">{dateStr}</span>
                            </span>
                            <span className="flex-shrink-0 text-right">
                              <span className={`block text-[11px] font-semibold tabular-nums ${
                                overAfter ? 'text-red-400' : remaining < 0 ? 'text-red-400' : 'text-green-600'
                              } ${hideAmounts ? 'blur-sm' : ''}`}>
                                {isSel
                                  ? `quedan ${formatAmount(projected, base)}`
                                  : `disp. ${formatAmount(remaining, base)}`
                                }
                              </span>
                            </span>
                          </button>

                          {/* Input de monto parcial — solo cuando está dividido */}
                          {isSel && isSplit && (
                            <div className="flex items-center gap-2 px-3 pb-2.5 pl-[42px]">
                              <span className="text-[11px] text-gray-400 flex-shrink-0">Parte:</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={draft!.monto}
                                onChange={(e) => setAsigMonto(ing.id!, e.target.value)}
                                className="flex-1 min-w-0 h-9 bg-surface border border-gray-200 rounded-lg px-2.5 text-sm font-semibold text-gray-900 tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <span className="text-[11px] text-gray-400 flex-shrink-0">{moneda}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Resumen de la división */}
                    {isSplit && (
                      <div className={`flex items-center gap-1.5 px-1 text-[11px] font-semibold ${
                        asigOk ? 'text-green-600' : 'text-red-400'
                      }`}>
                        {asigOk ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                        <span className={hideAmounts ? 'blur-sm' : ''}>
                          Dividido: {asigs.map((a) => formatAmount(num(a.monto), moneda)).join(' + ')}
                          {asigOk ? '' : ` — deben sumar ${formatAmount(parsedMonto, moneda)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Destino de ahorro — solo egresos ── */}
            {tipo === 'egreso' && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Destino de ahorro
                  <span className="ml-1 font-normal normal-case tracking-normal text-gray-300">— opcional</span>
                </p>
                <select
                  value={ahorroAssetId}
                  onChange={(e) => setAhorroAssetId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface"
                >
                  <option value="">Sin destino de ahorro</option>
                  {assets.filter((a) => a.clase === 'activo').map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.moneda})</option>
                  ))}
                </select>
                {ahorroAssetId && (
                  <p className="text-[11px] text-primary mt-1">El saldo de esta cuenta se actualizará al guardar</p>
                )}
              </div>
            )}

            {/* ── Clonar / Mover — solo al editar ── */}
            {editingTransaction && (
              <div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCloneAction(cloneAction === 'clone' ? null : 'clone')}
                    className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      cloneAction === 'clone'
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <Copy size={13} />Clonar a otro mes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloneAction(cloneAction === 'move' ? null : 'move')}
                    className={`flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      cloneAction === 'move'
                        ? 'bg-amber-50 border-amber-300 text-amber-600'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <ArrowRight size={13} />Mover de mes
                  </button>
                </div>
                {cloneAction && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="month"
                      value={cloneMonth}
                      onChange={(e) => setCloneMonth(e.target.value)}
                      className="flex-1 h-9 bg-gray-50 rounded-xl px-3 text-sm text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={handleCloneMove}
                      disabled={!cloneMonth || saving}
                      className={`px-4 h-9 rounded-xl text-xs font-bold text-white disabled:opacity-40 ${cloneAction === 'move' ? 'bg-amber-400' : 'bg-primary'}`}
                    >
                      {saving ? '…' : cloneAction === 'move' ? 'Mover' : 'Clonar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer fijo: siempre visible, sin scrollear ── */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 pt-3 pb-5 bg-surface">
            {montoInvalid && (
              <p className="text-[11px] text-red-400 mb-2">Ingresá un monto mayor a 0</p>
            )}
            {tipo === 'egreso' && !asigOk && montoValido && (
              <p className="text-[11px] text-red-400 mb-2">
                Las partes asignadas deben sumar el total del egreso
              </p>
            )}
            {saveError && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-400 font-medium break-all">
                Error: {saveError}
              </div>
            )}
            {deleteConfirm && (
              <p className="text-[11px] text-red-400 mb-2">
                Tocá el ícono rojo de nuevo para confirmar la eliminación
              </p>
            )}
            <div className="flex gap-2">
              {editingTransaction && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl border-2 transition-all ${
                    deleteConfirm
                      ? 'bg-red-400 border-red-400 text-white'
                      : 'border-red-100 text-red-400 hover:bg-red-50'
                  }`}
                  title={deleteConfirm ? 'Confirmar eliminación' : 'Eliminar'}
                >
                  <Trash2 size={17} />
                </button>
              )}
              <button
                onClick={closeTransactionModal}
                disabled={saving}
                className="h-12 px-4 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className={`flex-1 h-12 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 ${accentBg}`}
              >
                {saving ? 'Guardando…' : editingTransaction ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
