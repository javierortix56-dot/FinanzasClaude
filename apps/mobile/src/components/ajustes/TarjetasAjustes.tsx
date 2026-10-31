'use client'

import { useState } from 'react'
import { CreditCard, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { agregarTarjeta, renombrarTarjeta, eliminarTarjeta } from '@finanzas/core/lib/tarjetas'
import { monthLabel } from '@finanzas/core/lib/constants'
import { Settings } from '@finanzas/core/types'

const inputCls = 'flex-1 min-w-0 bg-gray-500/[0.06] rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-primary/25'

/** Alta, renombre y baja de tarjetas de crédito */
export default function TarjetasAjustes({ s }: { s: Settings }) {
  const showToast = useUIStore((st) => st.showToast)
  const tarjetas = s.tarjetas ?? []
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    try {
      await fn()
      showToast(ok)
      return true
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : 'Error al guardar', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs text-gray-500">
        Un egreso asignado a una tarjeta se paga el mes siguiente: su pago se genera solo e incluye las cuotas cargadas con el mismo nombre de tarjeta.
      </p>
      {tarjetas.map((t) => (
        <div key={t.id} className="flex items-center gap-2.5 rounded-2xl bg-gray-500/[0.06] p-2.5">
          <span className="h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-white" style={{ background: t.color }}>
            <CreditCard size={15} />
          </span>
          {editando?.id === t.id ? (
            <>
              <input autoFocus value={editando.nombre} onChange={(e) => setEditando({ id: t.id, nombre: e.target.value })} className={inputCls} />
              <button disabled={busy || !editando.nombre.trim()} aria-label="Guardar"
                onClick={async () => { if (await run(() => renombrarTarjeta(s, t.id, editando.nombre), 'Tarjeta renombrada')) setEditando(null) }}
                className="p-1.5 text-primary disabled:opacity-40"><Check size={16} /></button>
              <button onClick={() => setEditando(null)} aria-label="Cancelar" className="p-1.5 text-gray-400"><X size={16} /></button>
            </>
          ) : borrando === t.id ? (
            <>
              <span className="flex-1 min-w-0 text-xs text-gray-600">
                ¿Eliminar <b>{t.nombre}</b>? Sus gastos quedan sin asignar y se borran sus pagos pendientes.
              </span>
              <button disabled={busy} onClick={async () => { setBorrando(null); await run(() => eliminarTarjeta(s, t.id), `${t.nombre} eliminada`) }}
                className="px-2.5 h-8 rounded-lg bg-rose-500 text-white text-xs font-semibold">Eliminar</button>
              <button onClick={() => setBorrando(null)} className="px-2 h-8 text-xs text-gray-500 font-semibold">No</button>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{t.nombre}</p>
                <p className="text-[11px] text-gray-500">Cuotas desde {monthLabel(t.desde)}</p>
              </div>
              <button onClick={() => setEditando({ id: t.id, nombre: t.nombre })} aria-label="Renombrar" className="p-1.5 text-gray-400"><Pencil size={14} /></button>
              <button onClick={() => setBorrando(t.id)} aria-label="Eliminar" className="p-1.5 text-red-400"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={async (e) => { e.preventDefault(); if (await run(() => agregarTarjeta(s, nombre), 'Tarjeta agregada')) setNombre('') }}
      >
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva tarjeta (p. ej. Visa Galicia)"
          className="flex-1 min-w-0 border border-dashed border-gray-300 rounded-xl px-3 h-10 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary/25" />
        <button type="submit" disabled={busy || !nombre.trim()} className="px-3 h-10 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-40">
          <Plus size={14} /> Agregar
        </button>
      </form>
    </div>
  )
}
