'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { addCompraCuotas, updateCompraCuotas, deleteCompraCuotas, restoreCompraCuotas } from '@finanzas/core/lib/cuotas'
import { offerUndo } from '@/lib/undo'
import { getCurrentMonth, SHARED_USERS } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency } from '@finanzas/core/types'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import Segmented from '@/components/ui/Segmented'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Props {
  open: boolean
  editing: CompraCuotas | null
  onClose: () => void
}

export default function CuotaModal({ open, editing, onClose }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar compra en cuotas' : 'Nueva compra en cuotas'}
      bodyClassName="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      {/* El formulario se monta al abrir: el estado se inicializa desde props */}
      <Form key={editing?.id ?? 'new'} editing={editing} onClose={onClose} />
    </Sheet>
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
    const borrada = editing
    setSaving(true)
    try {
      await deleteCompraCuotas(borrada.id!)
      onClose()
      offerUndo(`"${borrada.descripcion}" eliminada`, () => restoreCompraCuotas(borrada))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="¿Qué compraste?"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        className={fieldClass}
      />

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Tarjeta (Visa, Master…)"
          value={tarjeta}
          onChange={(e) => setTarjeta(e.target.value)}
          className={`${fieldClass} flex-1 min-w-0`}
        />
        <Segmented
          id="cuota-user"
          size="lg"
          value={creadoPor}
          onChange={setCreadoPor}
          options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre.charAt(0) }))}
          variant="solid"
          className="flex-shrink-0 w-[96px]"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <FieldLabel>Monto por cuota</FieldLabel>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={montoCuota}
            onChange={(e) => setMontoCuota(e.target.value)}
            className={`${fieldClass} font-semibold tabular-nums`}
          />
        </div>
        <div className="w-24 flex-shrink-0">
          <FieldLabel>Cuotas</FieldLabel>
          <input
            type="text"
            inputMode="numeric"
            placeholder="12"
            value={totalCuotas}
            onChange={(e) => setTotalCuotas(e.target.value)}
            className={`${fieldClass} font-semibold tabular-nums`}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Moneda</FieldLabel>
        <Segmented
          id="cuota-moneda"
          size="sm"
          value={moneda}
          onChange={setMoneda}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          variant="solid"
        />
      </div>

      <div>
        <FieldLabel>Mes de la primera cuota</FieldLabel>
        <input
          type="month"
          value={primerMes}
          onChange={(e) => setPrimerMes(e.target.value)}
          className={fieldClass}
        />
      </div>

      {error && (
        <div className="bg-rose-500/10 ring-1 ring-rose-500/20 rounded-2xl px-3 py-2 text-xs text-rose-500">{error}</div>
      )}

      <div className="flex gap-2 pt-1">
        {editing && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleDelete}
            disabled={saving}
            className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors bg-rose-500/10 text-rose-500 hover:bg-rose-500/15"
            aria-label="Eliminar compra"
          >
            <Trash2 size={17} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || !canSave}
          className="flex-1 h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar compra'}
        </motion.button>
      </div>
    </div>
  )
}
