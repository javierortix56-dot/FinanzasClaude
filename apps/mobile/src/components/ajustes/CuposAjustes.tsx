'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { categoriasCupo, guardarCategoriasCupo } from '@finanzas/core/lib/modoGasto'
import { Settings } from '@finanzas/core/types'
import { haptic } from '@/lib/haptics'

/**
 * Qué categorías de gasto se controlan con cupo: lo planificado es un tope que
 * se llena con cada gasto registrado (Mercado, Uber, Salud…). El resto son
 * pagos únicos: se marcan como pagados con el monto real.
 */
export default function CuposAjustes({ s }: { s: Settings }) {
  const [sel, setSel] = useState<Set<string>>(() => categoriasCupo(s))
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const grupos = s.categoriasGasto.filter((g) => g.activa)

  function alternar(id: string) {
    haptic('light')
    setEstado('idle')
    setSel((st) => { const n = new Set(st); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function guardar() {
    setEstado('guardando')
    try { await guardarCategoriasCupo([...sel]); setEstado('ok'); haptic('success') }
    catch { setEstado('error') }
  }

  return (
    <div className="space-y-3 pt-1">
      <p className="text-[11px] text-gray-500 leading-snug">
        <b>Con cupo:</b> lo planificado es un tope que se va llenando con cada gasto que registra (ej.: Mercado, Uber, Salud).
        {' '}<b>Sin cupo:</b> es un pago único; al marcarlo pagado se pide el monto real. Si marca un grupo, vale para todas sus subcategorías.
      </p>
      <div className="space-y-2">
        {grupos.map((g) => {
          const grupoOn = sel.has(g.id)
          return (
            <div key={g.id} className="rounded-2xl bg-gray-500/[0.05] p-2">
              <Fila nombre={g.nombre} on={grupoOn} bold onClick={() => alternar(g.id)} />
              {(g.subcategorias ?? []).filter((c) => c.activa).map((c) => (
                <Fila key={c.id} nombre={c.nombre} on={grupoOn || sel.has(c.id)} disabled={grupoOn} onClick={() => alternar(c.id)} />
              ))}
            </div>
          )
        })}
      </div>
      <button onClick={guardar} disabled={estado === 'guardando'}
        className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-soft disabled:opacity-60 ${estado === 'ok' ? 'bg-emerald-500' : 'bg-brand'}`}>
        {estado === 'ok' ? <><Check size={14} /> Guardado</> : estado === 'guardando' ? 'Guardando…' : `Guardar (${sel.size})`}
      </button>
      {estado === 'error' && <p className="text-xs text-rose-500">No se pudo guardar.</p>}
    </div>
  )
}

function Fila({ nombre, on, bold, disabled, onClick }: { nombre: string; on: boolean; bold?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-1.5 py-1.5 text-left disabled:opacity-60 ${bold ? '' : 'pl-5'}`}>
      <span className={`h-4 w-4 shrink-0 rounded-[5px] border inline-flex items-center justify-center ${on ? 'bg-primary border-primary' : 'border-gray-300'}`}>
        {on && <Check size={10} strokeWidth={3.5} className="text-white" />}
      </span>
      <span className={`text-[13px] ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{nombre}</span>
    </button>
  )
}
