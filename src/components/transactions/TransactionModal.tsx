'use client'

import { useState, useEffect, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useAuthStore } from '@/store/useAuthStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/transactions'
import { SHARED_USER_ID, SHARED_USERS, formatAmount, getParentGroup, DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { toBase } from '@/lib/currency'
import { Transaction, Currency, TransactionType, CategoryGroup } from '@/types'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

export default function TransactionModal() {
  const { isTransactionModalOpen, editingTransaction, closeTransactionModal, showToast } = useUIStore()
  const { settings, hideAmounts } = useSettingsStore()
  const { transactions } = useTransactionStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [tipo, setTipo] = useState<TransactionType>('egreso')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>('ARS')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedSub, setSelectedSub] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [creadoPor, setCreadoPor] = useState(SHARED_USERS[0].id)
  const [ejecutado, setEjecutado] = useState(false)
  const [asignadoA, setAsignadoA] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setDeleteConfirm(false)
      setSaveError(null)
      return
    }
    if (editingTransaction) {
      setTipo(editingTransaction.tipo)
      setMonto(String(editingTransaction.monto))
      setMoneda(editingTransaction.moneda)
      setDescripcion(editingTransaction.descripcion)
      const d = editingTransaction.fecha.toDate()
      setFecha(d.toISOString().split('T')[0])
      setCreadoPor(editingTransaction.creadoPor || SHARED_USERS[0].id)
      setEjecutado(editingTransaction.ejecutado)
      setAsignadoA(editingTransaction.asignadoA ?? null)
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
      setFecha(new Date().toISOString().split('T')[0])
      setCreadoPor(SHARED_USERS[0].id); setEjecutado(false); setAsignadoA(null)
    }
  }, [isTransactionModalOpen, editingTransaction, settings])

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

  const ingresoOptions = useMemo(() => {
    const montoExp = parseFloat(monto.replace(',', '.')) || 0
    const expBase = toBase(montoExp, moneda, base, s)
    return transactions
      .filter((t) => t.tipo === 'ingreso')
      .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
      .map((ing) => {
        const incBase = toBase(ing.monto, ing.moneda, base, s)
        const usedBase = transactions
          .filter((t) => t.tipo === 'egreso' && t.asignadoA === ing.id && t.id !== editingTransaction?.id)
          .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
        const remaining = incBase - usedBase
        const wouldExceed = expBase > 0 && expBase > remaining
        return { ing, remaining, wouldExceed }
      })
  }, [transactions, monto, moneda, base, s, editingTransaction])

  const parsedMonto  = parseFloat(monto.replace(',', '.'))
  const montoValido  = Number.isFinite(parsedMonto) && parsedMonto > 0
  const montoInvalid = !!monto.trim() && !montoValido
  const canSave      = montoValido

  const accentColor  = tipo === 'egreso' ? '#ef4444' : '#22c55e'
  const accentBg     = tipo === 'egreso' ? 'bg-red-500' : 'bg-green-500'

  async function handleSave() {
    if (!montoValido) return
    setSaving(true)
    setSaveError(null)
    try {
      const data: Omit<Transaction, 'id'> = {
        userId: SHARED_USER_ID, tipo, monto: parsedMonto, moneda, categoria,
        descripcion: descripcion.trim(),
        nota: editingTransaction?.nota ?? '', tags: editingTransaction?.tags ?? [],
        fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
        ejecutado, asignadoA: tipo === 'egreso' ? (asignadoA || null) : null,
        creadoPor: creadoPor || SHARED_USER_ID,
        recurrente: editingTransaction?.recurrente ?? false,
      }
      if (editingTransaction?.id) {
        await updateTransaction(editingTransaction.id, data)
        showToast('Movimiento actualizado')
      } else {
        await addTransaction(data)
        showToast('Movimiento guardado')
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
      await deleteTransaction(editingTransaction.id)
      closeTransactionModal()
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
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-3xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-9 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {editingTransaction ? 'Editar movimiento' : 'Nuevo movimiento'}
            </Dialog.Title>
            <button
              onClick={closeTransactionModal}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X size={15} className="text-gray-600" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[80vh] pb-8">

            {/* ── Tipo + Monto (bloque con accent color) ── */}
            <div className="px-5 pb-4">
              {/* Tipo toggle */}
              {!editingTransaction && (
                <div className="flex rounded-2xl bg-gray-100 p-1 gap-1 mb-4">
                  {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTipo(t); setSelectedGroup(''); setSelectedSub(''); setAsignadoA(null) }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        tipo === t
                          ? t === 'egreso' ? 'bg-red-500 text-white shadow' : 'bg-green-500 text-white shadow'
                          : 'text-gray-400'
                      }`}
                    >
                      {t === 'egreso' ? '↓ Egreso' : '↑ Ingreso'}
                    </button>
                  ))}
                </div>
              )}

              {/* Monto grande */}
              <div
                className="rounded-2xl px-4 pt-3 pb-4"
                style={{ backgroundColor: accentColor + '10' }}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={`w-full text-4xl font-bold bg-transparent border-0 outline-none placeholder:text-gray-300 ${
                    montoInvalid ? 'text-red-400' : 'text-gray-900'
                  }`}
                  style={{ caretColor: accentColor }}
                />
                {/* Selector de moneda — horizontal pill */}
                <div className="flex gap-1.5 mt-3">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMoneda(c)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        moneda === c
                          ? 'text-white shadow-sm'
                          : 'bg-white/60 text-gray-500'
                      }`}
                      style={moneda === c ? { backgroundColor: accentColor } : {}}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {montoInvalid && (
                  <p className="text-[10px] text-red-500 mt-1.5">Ingresá un monto mayor a 0</p>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-100 mx-5" />

            {/* ── Descripción ── */}
            <div className="px-5 py-4">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Descripción
                {montoValido && !descripcion.trim() && (
                  <span className="ml-1.5 text-amber-400 font-semibold normal-case tracking-normal">· recomendado</span>
                )}
              </label>
              <input
                type="text"
                placeholder="¿En qué fue?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={`mt-2 w-full bg-gray-50 rounded-xl px-3.5 py-3 text-sm text-gray-900 outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${
                  montoValido && !descripcion.trim()
                    ? 'ring-1 ring-amber-200 focus:ring-amber-300'
                    : 'focus:ring-[#534AB7]/30 focus:bg-white'
                }`}
              />
              {/* Sugerencias */}
              {sugerencias.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sugerencias.map((sg) => (
                    <button
                      key={sg}
                      type="button"
                      onClick={() => setDescripcion(sg)}
                      className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-500 hover:bg-[#534AB7]/10 hover:text-[#534AB7] transition-colors"
                    >
                      {sg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 mx-5" />

            {/* ── Categoría ── */}
            <div className="px-5 py-4">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Categoría
                {montoValido && !categoria && (
                  <span className="ml-1.5 text-amber-400 font-semibold normal-case tracking-normal">· recomendado</span>
                )}
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeGroups.map((g) => {
                  const isSelected = selectedGroup === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setSelectedGroup(g.id); setSelectedSub('') }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
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
                <div className="flex flex-wrap gap-1.5 mt-2.5 pl-3 border-l-2 border-gray-100">
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

            {/* ── Asignar a Ingreso (solo egresos) ── */}
            {tipo === 'egreso' && (
              <>
                <div className="h-px bg-gray-100 mx-5" />
                <div className="px-5 py-4">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Asignar a Ingreso
                    <span className="ml-1 font-normal normal-case tracking-normal text-gray-300">— opcional</span>
                  </label>
                  <select
                    value={asignadoA ?? ''}
                    onChange={(e) => setAsignadoA(e.target.value || null)}
                    className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 focus:bg-white"
                  >
                    <option value="">Sin asignar</option>
                    {ingresoOptions.map(({ ing, remaining, wouldExceed }) => {
                      const user = SHARED_USERS.find((u) => u.id === ing.creadoPor)
                      const dateStr = ing.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                      const remainStr = hideAmounts ? '$ ****' : formatAmount(remaining, base)
                      return (
                        <option key={ing.id} value={ing.id} disabled={wouldExceed}>
                          {wouldExceed ? '🚫 ' : ''}{user?.nombre ?? ing.creadoPor} — {remainStr} ({dateStr})
                        </option>
                      )
                    })}
                  </select>
                  {asignadoA && ingresoOptions.find((o) => o.ing.id === asignadoA)?.wouldExceed && (
                    <p className="text-[10px] text-red-500 mt-1.5">Excede la capacidad del ingreso seleccionado</p>
                  )}
                </div>
              </>
            )}

            <div className="h-px bg-gray-100 mx-5" />

            {/* ── Fecha + Estado (grid 2 cols, sin superposición) ── */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="mt-2 w-full h-11 bg-gray-50 rounded-xl px-3 text-sm text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 focus:bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Estado</label>
                <button
                  type="button"
                  onClick={() => setEjecutado((v) => !v)}
                  className={`mt-2 w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    ejecutado
                      ? 'bg-green-50 border-green-400 text-green-600'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ejecutado ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {ejecutado ? 'Ejecutado' : 'Pendiente'}
                </button>
              </div>
            </div>

            {/* ── Error ── */}
            {saveError && (
              <div className="mx-5 mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600 font-medium break-all">
                Error: {saveError}
              </div>
            )}

            {/* ── Acciones ── */}
            <div className="px-5 pb-2 flex gap-2.5">
              {editingTransaction && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl border-2 transition-all ${
                    deleteConfirm
                      ? 'bg-red-500 border-red-500 text-white'
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
                className="h-12 px-5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
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

            {deleteConfirm && (
              <p className="text-[11px] text-red-500 text-center pb-3 -mt-1">
                Tocá el ícono rojo de nuevo para confirmar
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
