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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const [selectedSub, setSelectedSub]     = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [creadoPor, setCreadoPor] = useState(SHARED_USERS[0].id)
  const [ejecutado, setEjecutado] = useState(false)
  const [asignadoA, setAsignadoA] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Populate form on open
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
      // Resolver grupo + subcategoría del tx editado
      const catId = editingTransaction.categoria
      const allGroups = editingTransaction.tipo === 'egreso'
        ? (settings?.categoriasGasto ?? DEFAULT_GASTO_CATEGORY_GROUPS)
        : (settings?.categoriasIngreso ?? DEFAULT_INGRESO_CATEGORY_GROUPS)
      const parentGrp = getParentGroup(catId, allGroups)
      if (parentGrp) {
        setSelectedGroup(parentGrp.id)
        setSelectedSub(catId)
      } else {
        // catId es un grupo directamente
        setSelectedGroup(catId)
        setSelectedSub('')
      }
    } else {
      setTipo('egreso')
      setMonto('')
      setMoneda('ARS')
      setSelectedGroup('')
      setSelectedSub('')
      setDescripcion('')
      setFecha(new Date().toISOString().split('T')[0])
      setCreadoPor(SHARED_USERS[0].id)
      setEjecutado(false)
      setAsignadoA(null)
    }
  }, [isTransactionModalOpen, editingTransaction, settings])

  const categoryGroups: CategoryGroup[] = tipo === 'egreso'
    ? (s.categoriasGasto.length > 0 ? s.categoriasGasto : DEFAULT_GASTO_CATEGORY_GROUPS)
    : (s.categoriasIngreso.length > 0 ? s.categoriasIngreso : DEFAULT_INGRESO_CATEGORY_GROUPS)

  const activeGroups   = categoryGroups.filter((g) => g.activa)
  const currentGroup   = activeGroups.find((g) => g.id === selectedGroup)
  const activeSubs     = currentGroup?.subcategorias.filter((c) => c.activa) ?? []
  const categoria      = selectedSub || selectedGroup

  // Sugerencias: últimas descripciones únicas de la misma categoría o subcategoría
  const sugerencias = useMemo(() => {
    const catId = selectedSub || selectedGroup
    if (!catId) return []
    return [
      ...new Set(
        transactions
          .filter((t) => t.categoria === catId && t.descripcion && t.descripcion !== descripcion)
          .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
          .map((t) => t.descripcion)
      ),
    ].slice(0, 5)
  }, [transactions, selectedSub, selectedGroup, descripcion])

  // Ingresos con capacidad restante calculada
  const ingresoOptions = useMemo(() => {
    const montoExp = parseFloat(monto.replace(',', '.')) || 0
    const expBase = toBase(montoExp, moneda, base, s)

    return transactions
      .filter((t) => t.tipo === 'ingreso')
      .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
      .map((ing) => {
        const incBase = toBase(ing.monto, ing.moneda, base, s)
        const usedBase = transactions
          .filter(
            (t) =>
              t.tipo === 'egreso' &&
              t.asignadoA === ing.id &&
              t.id !== editingTransaction?.id // excluir el tx actual al editar
          )
          .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
        const remaining = incBase - usedBase
        const wouldExceed = expBase > 0 && expBase > remaining
        return { ing, remaining, wouldExceed }
      })
  }, [transactions, monto, moneda, base, s, editingTransaction])

  const parsedMonto = parseFloat(monto.replace(',', '.'))
  const montoValido = Number.isFinite(parsedMonto) && parsedMonto > 0

  async function handleSave() {
    if (!montoValido) return
    setSaving(true)
    setSaveError(null)
    try {
      const data: Omit<Transaction, 'id'> = {
        userId: SHARED_USER_ID,
        tipo,
        monto: parsedMonto,
        moneda,
        categoria,
        descripcion: descripcion.trim(),
        nota: editingTransaction?.nota ?? '',
        tags: editingTransaction?.tags ?? [],
        fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
        ejecutado,
        asignadoA: tipo === 'egreso' ? (asignadoA || null) : null,
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
        if (e.hint) parts.push(`Hint: ${e.hint}`)
        if (e.code) parts.push(`Code: ${e.code}`)
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

  const canSave = montoValido
  const montoInvalid = !!monto.trim() && !montoValido

  return (
    <Dialog.Root
      open={isTransactionModalOpen}
      onOpenChange={(open) => { if (!open) closeTransactionModal() }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {editingTransaction ? 'Editar movimiento' : 'Nuevo movimiento'}
            </Dialog.Title>
            <button
              onClick={closeTransactionModal}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="px-5 pt-4 pb-8 space-y-4 overflow-y-auto max-h-[78vh]">

            {/* Tipo toggle (solo al crear) */}
            {!editingTransaction && (
              <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTipo(t); setSelectedGroup(''); setSelectedSub(''); setAsignadoA(null) }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tipo === t
                        ? t === 'egreso'
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-green-500 text-white shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    {t === 'egreso' ? 'Egreso' : 'Ingreso'}
                  </button>
                ))}
              </div>
            )}

            {/* Monto */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Monto
              </label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={`flex-1 text-3xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:bg-white transition-colors ${
                    montoInvalid ? 'ring-2 ring-red-300 focus:ring-red-400' : 'focus:ring-[#534AB7]'
                  }`}
                />
                <div className="flex flex-col gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMoneda(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        moneda === c
                          ? 'bg-[#534AB7] text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {montoInvalid && (
                <p className="text-[10px] text-red-500 mt-1.5">
                  Ingresá un monto mayor a 0
                </p>
              )}
            </div>

            {/* Concepto / Descripción */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Concepto / Descripción
                {montoValido && !descripcion.trim() && (
                  <span className="ml-1.5 text-amber-400 font-normal normal-case tracking-normal">
                    · recomendado
                  </span>
                )}
              </label>
              <Input
                className={`mt-1.5 transition-colors ${
                  montoValido && !descripcion.trim()
                    ? 'border-amber-200 focus-visible:ring-amber-300'
                    : ''
                }`}
                placeholder="¿En qué fue?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {/* Categoría — chips de dos niveles */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Categoría
                {montoValido && !categoria && (
                  <span className="ml-1.5 text-amber-400 font-normal normal-case tracking-normal">
                    · recomendado
                  </span>
                )}
              </label>

              {/* Nivel 1: grupos */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {activeGroups.map((g) => {
                  const isSelected = selectedGroup === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(g.id)
                        setSelectedSub('')
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                      style={isSelected
                        ? { backgroundColor: g.color, color: '#fff' }
                        : { backgroundColor: g.color + '18', color: g.color }
                      }
                    >
                      {g.nombre}
                    </button>
                  )
                })}
              </div>

              {/* Nivel 2: subcategorías del grupo seleccionado */}
              {selectedGroup && activeSubs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pl-2 border-l-2 border-gray-100">
                  {activeSubs.map((sub) => {
                    const isSelected = selectedSub === sub.id
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedSub(isSelected ? '' : sub.id)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
                        style={isSelected
                          ? { backgroundColor: sub.color, color: '#fff' }
                          : { backgroundColor: sub.color + '18', color: sub.color }
                        }
                      >
                        {sub.nombre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sugerencias */}
            {sugerencias.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Sugerencias
                </label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {sugerencias.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDescripcion(s)}
                      className="px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-600 hover:bg-[#534AB7]/10 hover:text-[#534AB7] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Asignar a Ingreso (solo egresos) */}
            {tipo === 'egreso' && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Asignar a Ingreso (Opcional)
                </label>
                <select
                  value={asignadoA ?? ''}
                  onChange={(e) => setAsignadoA(e.target.value || null)}
                  className="mt-1.5 w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
                >
                  <option value="">Sin asignar</option>
                  {ingresoOptions.map(({ ing, remaining, wouldExceed }) => {
                    const user = SHARED_USERS.find((u) => u.id === ing.creadoPor)
                    const dateStr = ing.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                    const remainStr = hideAmounts ? '$ ****' : formatAmount(remaining, base)
                    const label = wouldExceed
                      ? `🚫 ${user?.nombre ?? ing.creadoPor} — disp: ${remainStr} (${dateStr})`
                      : `${user?.nombre ?? ing.creadoPor} — disp: ${remainStr} (${dateStr})`
                    return (
                      <option key={ing.id} value={ing.id} disabled={wouldExceed}>
                        {label}
                      </option>
                    )
                  })}
                </select>
                {asignadoA && ingresoOptions.find((o) => o.ing.id === asignadoA)?.wouldExceed && (
                  <p className="text-[10px] text-red-500 mt-1">
                    Este egreso excede la capacidad del ingreso seleccionado
                  </p>
                )}
              </div>
            )}

            {/* Fecha + Ejecutado */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Fecha
                </label>
                <Input
                  className="mt-1.5"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="flex-shrink-0 pb-1">
                <button
                  type="button"
                  onClick={() => setEjecutado((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    ejecutado
                      ? 'bg-green-50 border-green-500 text-green-600'
                      : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${ejecutado ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {ejecutado ? 'Ejecutado' : 'Pendiente'}
                </button>
              </div>
            </div>

            {/* Registrado por */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Registrado por
              </label>
              <select
                value={creadoPor}
                onChange={(e) => setCreadoPor(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
              >
                {SHARED_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Error de guardado */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600 font-medium break-all">
                Error al guardar: {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {editingTransaction && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-colors ${
                    deleteConfirm
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'border-red-100 text-red-500 hover:bg-red-50'
                  }`}
                  title={deleteConfirm ? 'Confirmar eliminación' : 'Eliminar'}
                >
                  <Trash2 size={17} />
                </button>
              )}
              <button
                onClick={closeTransactionModal}
                disabled={saving}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex-1 h-11 text-base font-semibold"
              >
                {saving ? 'Guardando...' : editingTransaction ? 'Guardar' : 'Agregar'}
              </Button>
            </div>

            {deleteConfirm && (
              <p className="text-xs text-red-500 text-center -mt-2">
                Tocá el ícono rojo de nuevo para confirmar la eliminación
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
