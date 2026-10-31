'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Trash2, Copy, ArrowRight, Check, Camera, ScanLine, Calculator, ChevronDown } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { addTransaction, updateTransaction, cloneTransactionToMonth, moveTransactionToMonth } from '@finanzas/core/lib/transactions'
import { SHARED_USER_ID, SHARED_USERS, formatAmount, getParentGroup, getCatFromSettings, toLocalDateString, monthLabel, shiftMonth, DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS } from '@finanzas/core/lib/constants'
import { tarjetaDe, esConsumoTarjeta } from '@finanzas/core/lib/tarjetas'
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
import { springPop } from '@/components/ui/motion'
import { Transaction, Currency, TransactionType, CategoryGroup, Asignacion } from '@finanzas/core/types'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

type PayTab = 'ingreso' | 'tarjeta' | 'despues'
const PAY_TABS: { value: PayTab; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'despues', label: 'Después' },
]

/** Fila de lista con interruptor (estilo ajustes de iOS) */
function SwitchRow({ label, hint, checked, onChange, color = '#4e7d5b' }: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  color?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => { haptic('light'); onChange(!checked) }}
      className="w-full min-h-12 flex items-center justify-between gap-3 px-3.5 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] text-gray-800">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
      </span>
      <span
        className="relative h-6 w-10 flex-shrink-0 rounded-full transition-colors"
        style={{ background: checked ? color : 'rgba(120,120,140,0.28)' }}
      >
        <motion.span
          layout
          transition={springPop}
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

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
  const [payTab, setPayTab] = useState<PayTab>('ingreso')
  const [calcOpen, setCalcOpen] = useState(false)
  const [masOpen, setMasOpen] = useState(false)
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
      const conTarjeta = !!tarjetaDe(editingTransaction.tarjetaId, settings)
      setTarjetaId(conTarjeta ? editingTransaction.tarjetaId! : '')
      setPayTab(conTarjeta ? 'tarjeta' : 'ingreso')
      setCalcOpen(false)
      setMasOpen(!!editingTransaction.recurrente || !!editingTransaction.ahorroAssetId)
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
      setPayTab('ingreso'); setCalcOpen(false); setMasOpen(false)
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

  // Consumos del mes ya cargados por tarjeta (sin contar este movimiento)
  const acumuladoTarjeta = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) {
      if (!esConsumoTarjeta(t) || t.id === editingTransaction?.id) continue
      m.set(t.tarjetaId!, (m.get(t.tarjetaId!) ?? 0) + txToBase(t, base, s))
    }
    return m
  }, [transactions, editingTransaction, base, s])

  // Cambiar de pestaña descarta la elección de las otras: lo que se ve es lo que se guarda
  function cambiarPago(t: PayTab) {
    haptic('light')
    setPayTab(t)
    if (t !== 'tarjeta') setTarjetaId('')
    if (t !== 'ingreso') setAsigs([])
  }

  const resumenMas = [recurrente && 'recurrente', ahorroAssetId && 'con ahorro'].filter(Boolean).join(', ')

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

  const canSave = montoValido && (tipo === 'ingreso' || payTab !== 'ingreso' || asigOk)

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

  const accentColor = tipo === 'egreso' ? '#b4533f' : '#4e7d5b'
  const accentGrad  = tipo === 'egreso'
    ? 'linear-gradient(135deg, #c86f5c 0%, #9c4434 100%)'
    : 'linear-gradient(135deg, #6e9e7b 0%, #3f6b4b 100%)'

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      const conTarjeta = tipo === 'egreso' && payTab === 'tarjeta' && tarjetaId ? tarjetaId : null
      const asignaciones: Asignacion[] = tipo === 'egreso' && payTab === 'ingreso'
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
        {(montoInvalid || (tipo === 'egreso' && payTab === 'ingreso' && !asigOk && montoValido) || saveError) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-2 space-y-1">
              {montoInvalid && (
                <p className="text-[11px] text-rose-500">{montoEsCuenta ? 'Completá la cuenta (el resultado debe ser mayor a 0)' : 'Ingresá un monto mayor a 0'}</p>
              )}
              {tipo === 'egreso' && payTab === 'ingreso' && !asigOk && montoValido && (
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
          {saving
            ? 'Guardando…'
            : `${editingTransaction ? 'Guardar' : 'Agregar'}${montoValido && !hideAmounts ? ` · ${formatAmount(parsedMonto, moneda)}` : ''}`}
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
            { value: 'egreso',  label: '↓ Egreso',  activeColor: 'linear-gradient(135deg, #c86f5c, #9c4434)' },
            { value: 'ingreso', label: '↑ Ingreso', activeColor: 'linear-gradient(135deg, #6e9e7b, #3f6b4b)' },
          ]}
        />
      )}
      footer={footer}
      bodyClassName="px-5 pb-5 space-y-5"
    >
      {/* ── Monto: protagonista, con la moneda al lado ── */}
      <div className="text-center pt-1">
        <div className="flex items-center justify-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => { haptic('light'); setMoneda(CURRENCIES[(CURRENCIES.indexOf(moneda) + 1) % CURRENCIES.length]) }}
            className="flex-shrink-0 h-8 pl-2.5 pr-2 rounded-full bg-gray-500/[0.08] text-xs font-bold text-gray-600 inline-flex items-center gap-0.5"
            aria-label={`Moneda ${moneda}: tocá para cambiar`}
          >
            {moneda}<ChevronDown size={12} />
          </motion.button>
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
            className={`amount-input-xl min-w-0 leading-tight font-bold tracking-tight bg-transparent border-0 outline-none placeholder:text-gray-300 tabular-nums ${
              montoInvalid ? 'text-rose-500' : 'text-gray-900'
            }`}
            style={{ caretColor: accentColor, width: `${Math.max(monto.length, 1) + 0.6}ch`, maxWidth: 'calc(100% - 72px)' }}
          />
        </div>

        {/* Acciones secundarias: la calculadora no ocupa lugar hasta que se pide */}
        <div className="mt-1.5 flex items-center justify-center gap-1">
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => { haptic('light'); setCalcOpen((v) => !v); montoRef.current?.focus() }}
            className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              calcOpen || montoEsCuenta ? 'bg-primary/10 text-primary' : 'text-gray-400'
            }`}
          >
            <Calculator size={13} /> Calculadora
          </button>
          {tipo === 'egreso' && !editingTransaction && (
            <button
              type="button"
              onClick={() => scanInputRef.current?.click()}
              disabled={scanning}
              className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${scanning ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}
            >
              {scanning ? <ScanLine size={13} className="animate-pulse" /> : <Camera size={13} />}
              {scanning ? (scanPct > 0 ? `Leyendo… ${scanPct}%` : 'Preparando…') : 'Escanear ticket'}
            </button>
          )}
        </div>
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleScanTicket}
        />
        <Collapse open={calcOpen || montoEsCuenta}>
          <div className="pt-2 flex items-center justify-center gap-1.5">
            {['+', '−', '×', '÷'].map((op) => (
              <motion.button
                key={op}
                type="button"
                whileTap={{ scale: 0.85 }}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insertarOperador(op)}
                className="w-11 h-9 rounded-xl bg-gray-500/[0.08] text-base font-semibold text-gray-600"
                aria-label={`Insertar ${op}`}
              >
                {op}
              </motion.button>
            ))}
          </div>
          <p
            className={`h-5 mt-1.5 text-sm font-bold tabular-nums ${montoEsCuenta && evalExpr(monto) === null ? 'text-gray-400' : ''}`}
            style={montoEsCuenta && evalExpr(monto) !== null ? { color: accentColor } : undefined}
          >
            {montoEsCuenta ? (evalExpr(monto) === null ? '…' : `= ${formatAmount(parsedMonto, moneda)}`) : ''}
          </p>
        </Collapse>
      </div>

      {/* ── Categoría: grupos en tiles, subcategorías en grilla ── */}
      <div>
        <div className="flex items-baseline justify-between mb-2 gap-2">
          <span className="eyebrow">Categoría</span>
          {currentGroup && (
            <span className="text-[11px] font-semibold text-primary truncate">
              {currentGroup.nombre}{selectedSub ? ` › ${activeSubs.find((x) => x.id === selectedSub)?.nombre ?? ''}` : ''}
            </span>
          )}
        </div>
        <div className="-mx-5 px-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {activeGroups.map((g) => {
            const sel = selectedGroup === g.id
            return (
              <motion.button
                key={g.id}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => { haptic('light'); setSelectedGroup(g.id); setSelectedSub('') }}
                className={`flex-shrink-0 w-[78px] h-[74px] rounded-2xl flex flex-col items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors ${
                  sel ? 'text-white' : 'bg-gray-500/[0.07] text-gray-600'
                }`}
                style={sel ? { background: g.color, boxShadow: `0 8px 18px -10px ${g.color}` } : undefined}
              >
                <span
                  className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${sel ? 'bg-white/20' : 'bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]'}`}
                  style={sel ? undefined : { color: g.color }}
                >
                  <CategoryIcon cat={g} size={16} />
                </span>
                <span className="max-w-full px-1.5 truncate">{g.nombre}</span>
              </motion.button>
            )
          })}
        </div>
        <Collapse open={!!selectedGroup && activeSubs.length > 0}>
          <div className="grid grid-cols-3 gap-1.5 pt-2.5">
            {activeSubs.map((sub) => {
              const sel = selectedSub === sub.id
              return (
                <motion.button
                  key={sub.id}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { haptic('light'); setSelectedSub(sel ? '' : sub.id) }}
                  className={`h-10 px-2 rounded-xl flex items-center gap-1.5 text-xs text-left border transition-colors ${
                    sel ? 'font-semibold' : 'border-hairline text-gray-700'
                  }`}
                  style={sel ? { borderColor: sub.color, backgroundColor: sub.color + '14', color: sub.color } : undefined}
                >
                  <span className="flex-shrink-0 inline-flex" style={sel ? undefined : { color: sub.color }}>
                    <CategoryIcon cat={sub} size={13} />
                  </span>
                  <span className="truncate">{sub.nombre}</span>
                </motion.button>
              )
            })}
          </div>
        </Collapse>
      </div>

      {/* ── Descripción ── */}
      <div>
        <input
          type="text"
          placeholder="¿En qué fue?"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className={fieldClass}
        />
        <AnimatePresence initial={false}>
          {sugerencias.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 pt-2 overflow-x-auto no-scrollbar">
                {sugerencias.map((sg) => (
                  <motion.button
                    key={sg}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setDescripcion(sg)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gray-500/[0.08] rounded-full text-xs text-gray-600"
                  >
                    {sg}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Se paga con: ingreso, tarjeta o después ── */}
      {tipo === 'egreso' && (
        <div>
          <span className="eyebrow block mb-2">Se paga con</span>
          <div className="rounded-[18px] ring-1 ring-hairline overflow-hidden">
            <div role="tablist" className="grid grid-cols-3 border-b border-hairline">
              {PAY_TABS.map((t) => {
                const on = payTab === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => cambiarPago(t.value)}
                    className={`relative h-10 text-[12.5px] font-semibold transition-colors ${on ? 'text-gray-900' : 'text-gray-400'}`}
                  >
                    {t.label}
                    {on && <motion.span layoutId="tx-pay-tab" transition={springPop} className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />}
                  </button>
                )
              })}
            </div>
            <div className="p-2">
              {payTab === 'ingreso' && (
                <>
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
                </>
              )}
              {payTab === 'tarjeta' && (
                (s.tarjetas ?? []).length === 0 ? (
                  <p className="px-2 py-3 text-xs text-gray-400">
                    Todavía no hay tarjetas. Agregalas en Ajustes → Tarjetas de crédito.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {(s.tarjetas ?? []).map((t) => {
                      const sel = tarjetaId === t.id
                      return (
                        <motion.button
                          key={t.id}
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { haptic('light'); setTarjetaId(sel ? '' : t.id) }}
                          className={`w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                            sel ? 'bg-primary/[0.07] ring-1 ring-primary/35' : 'bg-gray-500/[0.06]'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${sel ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                            {sel && <Check size={11} color="white" strokeWidth={3.5} />}
                          </span>
                          <span
                            className="relative w-8 h-[22px] rounded-[5px] flex-shrink-0 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.3)]"
                            style={{ background: `linear-gradient(135deg, ${t.color}bb, ${t.color})` }}
                          >
                            <span className="absolute left-1.5 top-[7px] w-[7px] h-[6px] rounded-[1.5px] bg-amber-200/90" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-gray-800 truncate">{t.nombre}</span>
                            <span className={`block text-[11px] text-gray-400 ${hideAmounts ? 'blur-sm' : ''}`}>
                              Acumulado del mes · {formatAmount(acumuladoTarjeta.get(t.id) ?? 0, base)}
                            </span>
                          </span>
                        </motion.button>
                      )
                    })}
                  </div>
                )
              )}
              {payTab === 'despues' && (
                <p className="px-2 py-3 text-xs text-gray-500">
                  Queda sin asignar. Podés asignarlo más tarde desde Asignaciones.
                </p>
              )}
            </div>
            {payTab === 'tarjeta' && tarjetaId && (
              <p className="px-3.5 py-2.5 text-[11.5px] text-gray-500 bg-gray-500/[0.05] border-t border-hairline">
                Se suma al pago de <b className="text-gray-700">{monthLabel(shiftMonth(fecha.slice(0, 7), 1))}</b>; no descuenta de los ingresos de este mes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Detalles ── */}
      <div className="rounded-[18px] bg-gray-500/[0.06] divide-y divide-hairline">
        <label className="flex items-center justify-between h-12 px-3.5 gap-3">
          <span className="text-[13.5px] text-gray-800">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-transparent text-right text-[13.5px] text-gray-500 outline-none min-w-0"
          />
        </label>
        <div className="flex items-center justify-between h-12 px-3.5 gap-3">
          <span className="text-[13.5px] text-gray-800">Cargado por</span>
          <Segmented
            id="tx-user"
            size="sm"
            value={creadoPor}
            onChange={setCreadoPor}
            options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre }))}
            variant="solid"
            className="w-[140px] flex-shrink-0"
          />
        </div>
        <SwitchRow label={tipo === 'ingreso' ? 'Recibido' : 'Pagado'} checked={ejecutado} onChange={setEjecutado} />
      </div>

      {/* ── Más opciones ── */}
      <div>
        <button
          type="button"
          onClick={() => setMasOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1 text-xs font-semibold text-primary"
          aria-expanded={masOpen}
        >
          Más opciones{!masOpen && resumenMas ? ` · ${resumenMas}` : ''}
          <ChevronDown size={14} className={`transition-transform ${masOpen ? 'rotate-180' : ''}`} />
        </button>
        <Collapse open={masOpen}>
          <div className="pt-2 space-y-3">
            <div className="rounded-[18px] bg-gray-500/[0.06]">
              <SwitchRow
                label="Recurrente"
                hint="Se copia al mes siguiente con “Crear recurrentes”"
                checked={recurrente}
                onChange={setRecurrente}
                color="var(--color-primary)"
              />
            </div>
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
          </div>
        </Collapse>
      </div>

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
