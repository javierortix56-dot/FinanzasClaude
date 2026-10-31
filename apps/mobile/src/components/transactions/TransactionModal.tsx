'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Trash2, Repeat, Copy, ArrowRight, Check, Camera, ScanLine, CreditCard } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { addTransaction, updateTransaction, cloneTransactionToMonth, moveTransactionToMonth } from '@finanzas/core/lib/transactions'
import { SHARED_USER_ID, SHARED_USERS, formatAmount, getParentGroup, getCatFromSettings, toLocalDateString, monthLabel, shiftMonth, DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS } from '@finanzas/core/lib/constants'
import { tarjetaDe } from '@finanzas/core/lib/tarjetas'
import PagoTarjetaSheet from '@/components/transactions/PagoTarjetaSheet'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { adjustAssetSaldo } from '@finanzas/core/lib/assets'
import { toBase, txToBase, txMonth } from '@finanzas/core/lib/currency'
import { parseTicket } from '@finanzas/core/lib/ticket'
import { ocrImagen } from '@/lib/ocr'
import { deleteTransactionsWithUndo } from '@/lib/undo'
import { evalExpr, isExpression } from '@finanzas/core/lib/calc'
import { CategoryIcon } from '@/lib/categoryIcons'
import { haptic } from '@/lib/haptics'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import Segmented from '@/components/ui/Segmented'
import Collapse from '@/components/ui/Collapse'
import { springPop, pulse } from '@/components/ui/motion'
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
  // Tarjeta con la que se paga (excluye asignar a ingresos)
  const [tarjetaId, setTarjetaId] = useState('')
  const [recurrente, setRecurrente] = useState(false)
  const [ahorroAssetId, setAhorroAssetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [cloneMonth, setCloneMonth] = useState('')
  const [cloneAction, setCloneAction] = useState<'clone' | 'move' | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const montoRef = useRef<HTMLInputElement>(null)
  // Posición del cursor a restaurar tras insertar un operador. Se aplica en
  // el mismo commit (layout effect) para no pisar lo que se tipee después.
  const caretRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caretRef.current === null) return
    const el = montoRef.current
    el?.focus()
    el?.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  }, [monto])

  // Inserta un operador donde está el cursor (el teclado decimal no los tiene)
  function insertarOperador(op: string) {
    const el = montoRef.current
    const start = el?.selectionStart ?? monto.length
    const end = el?.selectionEnd ?? monto.length
    caretRef.current = start + op.length
    setMonto(monto.slice(0, start) + op + monto.slice(end))
    haptic('light')
  }

  // Al salir del campo, una cuenta válida se reemplaza por su resultado
  function resolverCuenta() {
    if (!isExpression(monto)) return
    const r = evalExpr(monto)
    if (r !== null) setMonto(String(r))
  }
  const [scanning, setScanning] = useState(false)
  const [scanPct, setScanPct] = useState(0)

  useEffect(() => {
    if (!isTransactionModalOpen) {
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
      setTarjetaId(tarjetaDe(editingTransaction.tarjetaId, settings) ? editingTransaction.tarjetaId! : '')
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
      setCreadoPor(SHARED_USERS[0].id); setEjecutado(false); setAsigs([]); setTarjetaId(''); setRecurrente(false); setAhorroAssetId('')
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

  // El monto admite operaciones ("1500+320"): se evalúa sin eval()
  const parsedMonto  = evalExpr(monto) ?? 0
  const montoEsCuenta = isExpression(monto)
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
        const incBase = txToBase(ing, base, s)
        const usedBase = transactions
          .filter((t) => t.tipo === 'egreso' && t.id !== editingTransaction?.id)
          .reduce((sum, t) => sum + t.asignaciones
            .filter((a) => a.ingresoId === ing.id)
            .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s, txMonth(t)), 0), 0)
        return { ing, remaining: incBase - usedBase }
      })
  }, [transactions, base, s, editingTransaction])

  // ── Lógica de asignación dividida ────────────────────────────────────────────
  const isSplit  = asigs.length >= 2
  const asigSum  = asigs.reduce((sum, a) => sum + num(a.monto), 0)
  const asigOk   = asigs.length === 0 ||
    (asigs.every((a) => num(a.monto) > 0) && Math.abs(asigSum - parsedMonto) < 0.01)

  function toggleIngreso(id: string) {
    setTarjetaId('')
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

  const accentColor = tipo === 'egreso' ? '#f43f5e' : '#10b981'
  const accentGrad  = tipo === 'egreso'
    ? 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)'
    : 'linear-gradient(135deg, #34d399 0%, #059669 100%)'

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const conTarjeta = tipo === 'egreso' && tarjetaId ? tarjetaId : null
      const asignaciones: Asignacion[] = tipo === 'egreso' && !conTarjeta
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
        tarjetaId: conTarjeta,
      }

      // Use the explicitly selected cuenta de ahorro
      data.ahorroAssetId = ahorroAssetId || null

      if (editingTransaction?.id) {
        await updateTransaction(editingTransaction.id, data)
        haptic('success')
        showToast('Movimiento actualizado')
      } else {
        await addTransaction(data)
        haptic('success')
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

  // Borra al instante y ofrece "Deshacer" (revierte también el saldo de ahorro)
  async function handleDelete() {
    if (!editingTransaction?.id) return
    setSaving(true)
    try {
      await deleteTransactionsWithUndo([editingTransaction])
      closeTransactionModal()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al eliminar')
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

  const footer = (
    <>
      <AnimatePresence initial={false}>
        {(montoInvalid || (tipo === 'egreso' && !asigOk && montoValido) || saveError) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-2 space-y-1">
              {montoInvalid && (
                <p className="text-[11px] text-rose-500">{montoEsCuenta ? 'Completá la cuenta (el resultado debe ser mayor a 0)' : 'Ingresá un monto mayor a 0'}</p>
              )}
              {tipo === 'egreso' && !asigOk && montoValido && (
                <p className="text-[11px] text-rose-500">
                  Las partes asignadas deben sumar el total del egreso
                </p>
              )}
              {saveError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-xs text-rose-500 font-medium break-all">
                  Error: {saveError}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-2">
        {editingTransaction && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleDelete}
            disabled={saving}
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors bg-rose-500/10 text-rose-500 hover:bg-rose-500/15"
            title="Eliminar"
            aria-label="Eliminar movimiento"
          >
            <Trash2 size={17} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={closeTransactionModal}
          disabled={saving}
          className="h-12 px-4 rounded-2xl bg-gray-500/10 text-sm font-semibold text-gray-600 hover:bg-gray-500/15 transition-colors"
        >
          Cancelar
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || !canSave}
          className="flex-1 h-12 rounded-2xl text-sm font-bold text-white transition-opacity disabled:opacity-40 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.35)]"
          style={{ background: accentGrad }}
        >
          {saving ? 'Guardando…' : editingTransaction ? 'Guardar cambios' : 'Agregar'}
        </motion.button>
      </div>
    </>
  )

  // El pago automático de una tarjeta tiene su propia hoja (abono, ingreso, pagado)
  if (editingTransaction?.pagoTarjeta) {
    return <PagoTarjetaSheet open={isTransactionModalOpen} pago={editingTransaction} onClose={closeTransactionModal} />
  }

  return (
    <Sheet
      open={isTransactionModalOpen}
      onClose={closeTransactionModal}
      title={editingTransaction ? `Editar ${tipo === 'egreso' ? 'egreso' : 'ingreso'}` : 'Nuevo movimiento'}
      hideTitle={!editingTransaction}
      headerContent={!editingTransaction && (
        <Segmented
          id="tx-tipo"
          size="lg"
          value={tipo}
          onChange={(t) => { setTipo(t); setSelectedGroup(''); setSelectedSub(''); setAsigs([]) }}
          options={[
            { value: 'egreso',  label: '↓ Egreso',  activeColor: 'linear-gradient(135deg, #fb7185, #e11d48)' },
            { value: 'ingreso', label: '↑ Ingreso', activeColor: 'linear-gradient(135deg, #34d399, #059669)' },
          ]}
        />
      )}
      footer={footer}
      bodyClassName="px-5 pb-5 space-y-5"
    >
      {/* Monto + moneda */}
      <motion.div
        className="rounded-[22px] px-4 pt-3 pb-3"
        animate={{ backgroundColor: accentColor + '14' }}
        transition={{ duration: 0.3 }}
      >
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          autoFocus={!editingTransaction}
          value={monto}
          ref={montoRef}
          onChange={(e) => setMonto(e.target.value)}
          onBlur={resolverCuenta}
          aria-label="Monto (admite cuentas, por ejemplo 1500+320)"
          className={`amount-input-xl w-full leading-tight font-bold tracking-tight bg-transparent border-0 outline-none placeholder:text-gray-300 tabular-nums ${
            montoInvalid ? 'text-rose-500' : 'text-gray-900'
          }`}
          style={{ caretColor: accentColor }}
        />
        <Segmented
          id="tx-moneda"
          size="sm"
          value={moneda}
          onChange={setMoneda}
          options={CURRENCIES.map((c) => ({ value: c, label: c, activeColor: accentColor }))}
          className="mt-1"
        />

        {/* Calculadora: operadores + resultado en vivo */}
        <div className="flex items-center gap-1.5 mt-2">
          {['+', '−', '×', '÷'].map((op) => (
            <motion.button
              key={op}
              type="button"
              whileTap={{ scale: 0.85 }}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => insertarOperador(op)}
              className="w-10 h-9 rounded-xl bg-surface/70 text-base font-semibold text-gray-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              aria-label={`Insertar ${op}`}
            >
              {op}
            </motion.button>
          ))}
          <AnimatePresence>
            {montoEsCuenta && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className={`ml-auto text-sm font-bold tabular-nums ${evalExpr(monto) === null ? 'text-gray-400' : ''}`}
                style={evalExpr(monto) === null ? undefined : { color: accentColor }}
              >
                {evalExpr(monto) === null ? '…' : `= ${formatAmount(parsedMonto, moneda)}`}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Escanear ticket — solo egresos nuevos */}
      {tipo === 'egreso' && !editingTransaction && (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => scanInputRef.current?.click()}
            disabled={scanning}
            className="relative w-full h-11 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-xs font-semibold hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-80 overflow-hidden"
          >
            {scanning && (
              <motion.span
                className="absolute inset-y-0 left-0 bg-primary/10"
                initial={{ width: 0 }}
                animate={{ width: `${scanPct}%` }}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              {scanning ? <ScanLine size={15} className="animate-pulse" /> : <Camera size={15} />}
              {scanning
                ? scanPct > 0 ? `Leyendo ticket… ${scanPct}%` : 'Preparando lector…'
                : 'Escanear ticket con la cámara'}
            </span>
          </motion.button>
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
          className={`${fieldClass} ${
            montoValido && !descripcion.trim() ? 'border-amber-300/70 placeholder:text-amber-500/70' : ''
          }`}
        />
        <AnimatePresence initial={false}>
          {sugerencias.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 pt-2 overflow-x-auto no-scrollbar">
                {sugerencias.map((sg, i) => (
                  <motion.button
                    key={sg}
                    type="button"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setDescripcion(sg)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gray-500/[0.08] rounded-full text-xs text-gray-600 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {sg}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Categoría */}
      <div>
        <FieldLabel hint={montoValido && !categoria ? <span className="text-amber-500">· recomendado</span> : undefined}>
          Categoría
        </FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {activeGroups.map((g) => {
            const isSelected = selectedGroup === g.id
            return (
              <motion.button
                key={g.id}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => { setSelectedGroup(g.id); setSelectedSub('') }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                animate={isSelected
                  ? { backgroundColor: g.color, color: '#ffffff', boxShadow: `0 6px 14px -6px ${g.color}` }
                  : { backgroundColor: g.color + '18', color: g.color, boxShadow: '0 0 0 0 rgba(0,0,0,0)' }
                }
                transition={{ duration: 0.18 }}
              >
                <CategoryIcon cat={g} size={13} />
                {g.nombre}
              </motion.button>
            )
          })}
        </div>
        <Collapse open={!!selectedGroup && activeSubs.length > 0}>
          <div className="flex flex-wrap gap-1.5 mt-2.5 pl-3 border-l-2" style={{ borderColor: (currentGroup?.color ?? '#e5e7eb') + '55' }}>
            {activeSubs.map((sub) => {
              const isSelected = selectedSub === sub.id
              return (
                <motion.button
                  key={sub.id}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelectedSub(isSelected ? '' : sub.id)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                  animate={isSelected
                    ? { backgroundColor: sub.color, color: '#ffffff' }
                    : { backgroundColor: sub.color + '18', color: sub.color }
                  }
                  transition={{ duration: 0.18 }}
                >
                  <CategoryIcon cat={sub} size={12} />
                  {sub.nombre}
                </motion.button>
              )
            })}
          </div>
        </Collapse>
      </div>

      {/* Fecha + persona */}
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-label="Fecha"
          className={`${fieldClass} flex-1 min-w-0`}
        />
        <Segmented
          id="tx-user"
          size="md"
          value={creadoPor}
          onChange={setCreadoPor}
          options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre }))}
          variant="solid"
          className="flex-shrink-0 w-[150px]"
        />
      </div>

      {/* Estado + recurrente */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setEjecutado((v) => !v)}
          className={`h-11 flex items-center justify-center gap-2 rounded-2xl text-xs font-semibold transition-colors ${
            ejecutado
              ? 'bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/30'
              : 'bg-gray-500/[0.07] text-gray-500'
          }`}
        >
          <motion.span
            className={`w-4 h-4 rounded-full flex items-center justify-center border ${ejecutado ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}
            animate={{ scale: ejecutado ? [1, 1.25, 1] : 1 }}
            transition={pulse}
          >
            {ejecutado && <Check size={10} strokeWidth={3.5} className="text-white" />}
          </motion.span>
          {ejecutado ? 'Ejecutado' : 'Pendiente'}
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setRecurrente((v) => !v)}
          className={`h-11 flex items-center justify-center gap-2 rounded-2xl text-xs font-semibold transition-colors ${
            recurrente
              ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
              : 'bg-gray-500/[0.07] text-gray-500'
          }`}
        >
          <motion.span animate={{ rotate: recurrente ? 180 : 0 }} transition={{ duration: 0.4 }} className="inline-flex">
            <Repeat size={14} />
          </motion.span>
          Recurrente
        </motion.button>
      </div>

      {/* ── Asignar a ingreso(s) — solo egresos ── */}
      {tipo === 'egreso' && (
        <div>
          <FieldLabel hint="— tocá otro para dividir">Asignar a ingreso</FieldLabel>
          {ingresoOptions.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">No hay ingresos este mes</p>
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
                  <motion.div
                    key={ing.id}
                    layout
                    className={`rounded-2xl transition-colors ${
                      isSel ? 'bg-primary/[0.07] ring-1 ring-primary/35' : 'bg-gray-500/[0.06]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleIngreso(ing.id!)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                    >
                      <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSel ? 'bg-primary border-primary' : 'border-gray-300'
                      }`}>
                        <AnimatePresence>
                          {isSel && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springPop} className="inline-flex">
                              <Check size={11} color="white" strokeWidth={3.5} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-gray-800 truncate">{nombre}</span>
                        <span className="block text-[11px] text-gray-400">{dateStr}</span>
                      </span>
                      <span className="flex-shrink-0 text-right">
                        <span className={`block text-[11px] font-semibold tabular-nums ${
                          overAfter ? 'text-rose-500' : remaining < 0 ? 'text-rose-500' : 'text-emerald-600'
                        } ${hideAmounts ? 'blur-sm' : ''}`}>
                          {isSel
                            ? `quedan ${formatAmount(projected, base)}`
                            : `disp. ${formatAmount(remaining, base)}`
                          }
                        </span>
                      </span>
                    </button>

                    {/* Input de monto parcial — solo cuando está dividido */}
                    <Collapse open={isSel && isSplit}>
                      <div className="flex items-center gap-2 px-3 pb-2.5 pl-[42px]">
                        <span className="text-[11px] text-gray-400 flex-shrink-0">Parte:</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draft?.monto ?? ''}
                          onChange={(e) => setAsigMonto(ing.id!, e.target.value)}
                          className="flex-1 min-w-0 h-9 bg-surface rounded-xl px-2.5 text-sm font-semibold text-gray-900 tabular-nums text-right outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{moneda}</span>
                      </div>
                    </Collapse>
                  </motion.div>
                )
              })}

              {/* Resumen de la división */}
              <AnimatePresence>
                {isSplit && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-1.5 px-1 text-[11px] font-semibold ${
                      asigOk ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {asigOk ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    <span className={hideAmounts ? 'blur-sm' : ''}>
                      Dividido: {asigs.map((a) => formatAmount(num(a.monto), moneda)).join(' + ')}
                      {asigOk ? '' : ` — deben sumar ${formatAmount(parsedMonto, moneda)}`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {(s.tarjetas ?? []).length > 0 && (
            <div className="mt-3">
              <FieldLabel hint="— se paga el mes siguiente">O pagar con tarjeta</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {(s.tarjetas ?? []).map((t) => {
                  const sel = tarjetaId === t.id
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { haptic('light'); setTarjetaId(sel ? '' : t.id); if (!sel) setAsigs([]) }}
                      className={`flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-colors ${
                        sel ? 'text-white' : 'bg-gray-500/[0.08] text-gray-600'
                      }`}
                      style={sel ? { background: t.color } : undefined}
                    >
                      <CreditCard size={13} /> {t.nombre}
                    </motion.button>
                  )
                })}
              </div>
              {tarjetaId && (
                <p className="mt-1.5 px-1 text-[11px] text-gray-500">
                  Se suma al pago de {monthLabel(shiftMonth(fecha.slice(0, 7), 1))}; no descuenta de los ingresos de este mes.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Destino de ahorro — solo egresos ── */}
      {tipo === 'egreso' && (
        <div>
          <FieldLabel hint="— opcional">Destino de ahorro</FieldLabel>
          <select
            value={ahorroAssetId}
            onChange={(e) => setAhorroAssetId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Sin destino de ahorro</option>
            {assets.filter((a) => a.clase === 'activo').map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} ({a.moneda})</option>
            ))}
          </select>
          {ahorroAssetId && (
            <p className="text-[11px] text-primary mt-1.5">El saldo de esta cuenta se actualizará al guardar</p>
          )}
        </div>
      )}

      {/* ── Clonar / Mover — solo al editar ── */}
      {editingTransaction && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setCloneAction(cloneAction === 'clone' ? null : 'clone')}
              className={`h-10 flex items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold transition-colors ${
                cloneAction === 'clone'
                  ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
                  : 'bg-gray-500/[0.07] text-gray-500'
              }`}
            >
              <Copy size={13} />Clonar a otro mes
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setCloneAction(cloneAction === 'move' ? null : 'move')}
              className={`h-10 flex items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold transition-colors ${
                cloneAction === 'move'
                  ? 'bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/30'
                  : 'bg-gray-500/[0.07] text-gray-500'
              }`}
            >
              <ArrowRight size={13} />Mover de mes
            </motion.button>
          </div>
          <Collapse open={!!cloneAction}>
            <div className="flex gap-2 mt-2">
              <input
                type="month"
                value={cloneMonth}
                onChange={(e) => setCloneMonth(e.target.value)}
                className={`${fieldClass} flex-1`}
              />
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleCloneMove}
                disabled={!cloneMonth || saving}
                className={`px-4 h-11 rounded-2xl text-xs font-bold text-white disabled:opacity-40 ${cloneAction === 'move' ? 'bg-amber-500' : 'bg-primary'}`}
              >
                {saving ? '…' : cloneAction === 'move' ? 'Mover' : 'Clonar'}
              </motion.button>
            </div>
          </Collapse>
        </div>
      )}
    </Sheet>
  )
}
