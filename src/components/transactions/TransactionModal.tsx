'use client'

import { useState, useEffect, KeyboardEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2, Tag } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@/lib/transactions'
import { DEFAULT_GASTO_CATEGORIES, DEFAULT_INGRESO_CATEGORIES, SHARED_USER_ID, SHARED_USERS } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Transaction, Currency, TransactionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface UserOption {
  id: string
  nombre: string
}

export default function TransactionModal() {
  const { isTransactionModalOpen, editingTransaction, closeTransactionModal } = useUIStore()
  const { settings } = useSettingsStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [tipo, setTipo] = useState<TransactionType>('egreso')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>('ARS')
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [nota, setNota] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [creadoPor, setCreadoPor] = useState('')
  const [ejecutado, setEjecutado] = useState(false)
  const [recurrente, setRecurrente] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Hardcoded users
  useEffect(() => { setUsers(SHARED_USERS) }, [])

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
      setNota(editingTransaction.nota ?? '')
      setTags(editingTransaction.tags ?? [])
      const d = editingTransaction.fecha.toDate()
      setFecha(d.toISOString().split('T')[0])
      setCreadoPor(editingTransaction.creadoPor)
      setEjecutado(editingTransaction.ejecutado)
      setRecurrente(editingTransaction.recurrente ?? false)
    } else {
      setTipo('egreso')
      setMonto('')
      setMoneda('ARS')
      setCategoria('')
      setDescripcion('')
      setNota('')
      setTags([])
      setTagInput('')
      setFecha(new Date().toISOString().split('T')[0])
      setCreadoPor('')
      setEjecutado(false)
      setRecurrente(false)
    }
  }, [isTransactionModalOpen, editingTransaction])

  const gastoCategories = s.categoriasGasto.length > 0 ? s.categoriasGasto : DEFAULT_GASTO_CATEGORIES.map((c) => ({ ...c, activa: true }))
  const ingresoCategories = s.categoriasIngreso.length > 0 ? s.categoriasIngreso : DEFAULT_INGRESO_CATEGORIES.map((c) => ({ ...c, activa: true }))
  const categories = (tipo === 'egreso' ? gastoCategories : ingresoCategories).filter((c) => c.activa)

  function addTag() {
    const t = tagInput.trim().replace(/,/g, '')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t))
  }

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
        nota: nota.trim(),
        tags,
        fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
        ejecutado,
        asignadoA: editingTransaction?.asignadoA ?? null,
        creadoPor: creadoPor || SHARED_USER_ID,
        recurrente,
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
          <div className="px-5 pt-4 pb-8 space-y-5 overflow-y-auto max-h-[78vh]">
            {/* Tipo toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setCategoria('') }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
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

            {/* Monto */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Monto
              </label>
              <div className="flex items-center gap-2">
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

            {/* Categoría */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Categoría
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoria(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      categoria === cat.id
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={
                      categoria === cat.id
                        ? { backgroundColor: cat.color, borderColor: cat.color }
                        : {}
                    }
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Descripción
              </label>
              <Input
                placeholder="¿En qué fue?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {/* Nota */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Nota
              </label>
              <textarea
                placeholder="Detalle adicional (opcional)"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Tag size={11} /> Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] border border-gray-200 rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-[#534AB7]">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 bg-[#534AB7]/10 text-[#534AB7] text-xs font-medium px-2 py-0.5 rounded-full"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder={tags.length === 0 ? 'Escribí y presioná Enter...' : ''}
                  className="flex-1 min-w-[100px] text-xs outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Fecha + Persona */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Fecha
                </label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Persona
                </label>
                <select
                  value={creadoPor}
                  onChange={(e) => setCreadoPor(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#534AB7]"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ejecutado + Recurrente toggles */}
            <div className="flex gap-3">
              {/* Ejecutado */}
              <button
                type="button"
                onClick={() => setEjecutado((v) => !v)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  ejecutado
                    ? 'bg-green-50 border-green-500 text-green-600'
                    : 'border-gray-200 text-gray-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${ejecutado ? 'bg-green-500' : 'bg-gray-300'}`} />
                {ejecutado ? 'Ejecutado' : 'Pendiente'}
              </button>

              {/* Recurrente */}
              <button
                type="button"
                onClick={() => setRecurrente((v) => !v)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  recurrente
                    ? 'bg-[#534AB7]/10 border-[#534AB7] text-[#534AB7]'
                    : 'border-gray-200 text-gray-400'
                }`}
              >
                <span className="text-base leading-none">↺</span>
                Recurrente
              </button>
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
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex-1 h-11 text-base font-semibold"
              >
                {saving ? 'Guardando...' : editingTransaction ? 'Guardar cambios' : 'Agregar'}
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
