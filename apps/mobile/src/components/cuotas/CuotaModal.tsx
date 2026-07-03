'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import { addCompraCuotas, updateCompraCuotas, deleteCompraCuotas } from '@finanzas/core/lib/cuotas'
import { getCurrentMonth, SHARED_USERS } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency } from '@finanzas/core/types'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Props {
  open: boolean
  editing: CompraCuotas | null
  onClose: () => void
}

export default function CuotaModal({ open, editing, onClose }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface rounded-t-3xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          {open && <Form key={editing?.id ?? 'new'} editing={editing} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Form({ editing, onClose }: { editing: CompraCuotas | null; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [tarjeta, setTarjeta]         = useState(editing?.tarjeta ?? '')
  const [moneda, setMoneda]           = useState<Currency>(editing?.moneda ?? 'ARS')
  const [montoCuota, setMontoCuota]   = useState(editing ? String(editing.montoCuota) : '')
  const [totalCuotas, setTotalCuotas] = useState(editing ? String(editing.totalCuotas) : '')
  const [primerMes, setPrimerMes]     = useState(editing?.primerMes ?? getCurrentMonth())
  const [creadoPor, setCreadoPor]     = useState(editing?.creadoPor ?? SHARED_USERS[0].id)
  const [saving, setSaving]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const monto  = parseFloat(montoCuota.replace(',', '.'))
  const total  = parseInt(totalCuotas, 10)
  const canSave = descripcion.trim().length > 0 && monto > 0 && total >= 1 && /^\d{4}-\d{2}$/.test(primerMes)

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      const data: Omit<CompraCuotas, 'id'> = {
        descripcion: descripcion.trim(),
        tarjeta: tarjeta.trim(),
        moneda,
        montoCuota: monto,
        totalCuotas: total,
        primerMes,
        creadoPor,
      }
      if (editing?.id) await updateCompraCuotas(editing.id, data)
      else await addCompraCuotas(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setSaving(true)
    try {
      await deleteCompraCuotas(editing.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-9 h-1 bg-gray-200 rounded-full" />
      </div>

      <div className="flex items-center justify-between px-5 pb-3">
        <Dialog.Title className="text-base font-bold text-gray-900">
          {editing ? 'Editar compra en cuotas' : 'Nueva compra en cuotas'}
        </Dialog.Title>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
        >
          <X size={15} className="text-gray-600" />
        </button>
      </div>

      <div className="px-5 pb-6 space-y-3.5 overflow-y-auto max-h-[70vh]">
        <input
          type="text"
          placeholder="¿Qué compraste?"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300"
        />

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Tarjeta (Visa, Master…)"
            value={tarjeta}
            onChange={(e) => setTarjeta(e.target.value)}
            className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300"
          />
          <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5 flex-shrink-0">
            {SHARED_USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setCreadoPor(u.id)}
                className={`px-2.5 rounded-[10px] text-xs font-bold transition-all ${
                  creadoPor === u.id ? 'bg-primary text-white' : 'text-gray-400'
                }`}
              >
                {u.nombre.charAt(0)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Monto por cuota</p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={montoCuota}
              onChange={(e) => setMontoCuota(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 tabular-nums outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300"
            />
          </div>
          <div className="w-24 flex-shrink-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cuotas</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="12"
              value={totalCuotas}
              onChange={(e) => setTotalCuotas(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 tabular-nums outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mes de la primera cuota</p>
            <input
              type="month"
              value={primerMes}
              onChange={(e) => setPrimerMes(e.target.value)}
              className="w-full h-10 bg-gray-50 rounded-xl px-3 text-sm text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="w-24 flex-shrink-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Moneda</p>
            <div className="flex flex-col gap-0.5">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMoneda(c)}
                  className={`w-full py-1 rounded-lg text-[11px] font-bold transition-all ${
                    moneda === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-400">{error}</div>
        )}
        {deleteConfirm && (
          <p className="text-[11px] text-red-400">Tocá el ícono rojo de nuevo para confirmar</p>
        )}

        <div className="flex gap-2 pt-1">
          {editing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl border-2 transition-all ${
                deleteConfirm ? 'bg-red-400 border-red-400 text-white' : 'border-red-100 text-red-400 hover:bg-red-50'
              }`}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 h-12 rounded-2xl bg-primary text-white text-sm font-bold disabled:opacity-40"
          >
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar compra'}
          </button>
        </div>
      </div>
    </>
  )
}
