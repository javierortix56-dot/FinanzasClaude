'use client'

import { useState, useEffect, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/transactions'
import { DEFAULT_GASTO_CATEGORIES, DEFAULT_INGRESO_CATEGORIES, SHARED_USER_ID, SHARED_USERS, formatAmount } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Transaction, Currency, TransactionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

export default function TransactionModal() {
  const { isTransactionModalOpen, editingTransaction, closeTransactionModal } = useUIStore()
  const { settings, hideAmounts } = useSettingsStore()
  const { transactions } = useTransactionStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [tipo, setTipo] = useState<TransactionType>('egreso')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>('ARS')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [creadoPor, setCreadoPor] = useState(SHARED_USERS[0].id)
  const [ejecutado, setEjecutado] = useState(false)
  const [asignadoA, setAsignadoA] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Populate form on open
  useEffect(() => {
    if (!isTransactionModalOpen) {
      setDeleteConfirm(false)
      return
    }
    if (editingTransaction) {
      setTipo(editingTransaction.tipo)
      setMonto(String(editingTransaction.monto))
      setMoneda(editingTransaction.moneda)
      setCategoria(editingTransaction.categoria)
      setDescripcion(editingTransaction.descripcion)
      const d = editingTransaction.fecha.toDate()
      setFecha(d.toISOString().split('T')[0])
      setCreadoPor(editingTransaction.creadoPor || SHARED_USERS[0].id)
      setEjecutado(editingTransaction.ejecutado)
      setAsignadoA(editingTransaction.asignadoA ?? null)
    } else {
      setTipo('egreso')
      setMonto('')
      setMoneda('ARS')
      setCategoria('')
      setDescripcion('')
      setFecha(new Date().toISOString().split('T')[0])
      setCreadoPor(SHARED_USERS[0].id)
      setEjecutado(false)
      setAsignadoA(null)
    }
  }, [isTransactionModalOpen, editingTransaction])

  const gastoCategories = s.categoriasGasto.length > 0
    ? s.categoriasGasto
    : DEFAULT_GASTO_CATEGORIES.map((c) => ({ ...c, activa: true }))
  const ingresoCategories = s.categoriasIngreso.length > 0
    ? s.categoriasIngreso
    : DEFAULT_INGRESO_CATEGORIES.map((c) => ({ ...c, activa: true }))
  const categories = (tipo === 'egreso' ? gastoCategories : ingresoCategories).filter((c) => c.activa)

  // Sugerencias: últimas descripciones únicas de la misma categoría
  const sugerencias = useMemo(() => {
    if (!categoria) return []
    return [
      ...new Set(
        transactions
          .filter((t) => t.categoria === categoria && t.descripcion && t.descripcion !== descripcion)
          .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
          .map((t) => t.descripcion)
      ),
    ].slice(0, 5)
  }, [transactions, categoria, descripcion])

  // Ingresos disponibles para asignar (todos los meses)
  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso'),
    [transactions]
  )

  async function handleSave() {
    if (!monto || !categoria) return
    setSaving(true)
    try {
      const data: Omit<Transaction, 'id'> = {
        userId: SHARED_USER_ID,
        tipo,
        monto: parseFloat(monto.replace(',', '.')),
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
      } else {
        await addTransaction(data)
      }
      closeTransactionModal()
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

  const canSave = !!monto && parseFloat(monto) > 0 && !!categoria

  const selectedCat = categories.find((c) => c.id === categoria)

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
                    onClick={() => { setTipo(t); setCategoria(''); setAsignadoA(null) }}
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
                  placeholder="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="flex-1 text-3xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7] focus:bg-white transition-colors"
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
            </div>

            {/* Concepto / Descripción */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Concepto / Descripción
              </label>
              <Input
                className="mt-1.5"
                placeholder="¿En qué fue?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {/* Categoría dropdown */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Categoría
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="mt-1.5 w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
                style={selectedCat ? { color: selectedCat.color, borderColor: selectedCat.color + '80' } : {}}
              >
                <option value="">Seleccionar categoría…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
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
                  {ingresos.map((ing) => {
                    const user = SHARED_USERS.find((u) => u.id === ing.creadoPor)
                    const label = `${user?.nombre ?? ing.creadoPor} — ${
                      hideAmounts ? '$ ****' : formatAmount(ing.monto, ing.moneda)
                    } (${ing.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })})`
                    return (
                      <option key={ing.id} value={ing.id}>
                        {label}
                      </option>
                    )
                  })}
                </select>
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

            {/* Persona */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Persona
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
