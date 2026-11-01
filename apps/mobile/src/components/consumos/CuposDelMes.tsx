'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { useConsumos } from '@finanzas/core/lib/useConsumos'
import { borrarConsumo } from '@finanzas/core/lib/consumos'
import { calcularCupos, Cupo } from '@finanzas/core/lib/planVsReal'
import { Currency, Transaction } from '@finanzas/core/types'
import ProgressBar from '@/components/ui/ProgressBar'
import Collapse from '@/components/ui/Collapse'
import { Money } from '@/components/ui/AnimatedNumber'
import ConsumoSheet from '@/components/consumos/ConsumoSheet'
import { haptic } from '@/lib/haptics'

const COLOR = { ok: '#10b981', atento: '#f59e0b', excedido: '#f43f5e', sin_plan: '#94a3b8' } as const

/**
 * Planificado contra real del mes: cada consumo registrado llena el cupo de su
 * categoría (lo planificado en ese mes). Avisa si a este ritmo se pasa.
 */
export default function CuposDelMes({ transactions, month, base }: { transactions: Transaction[]; month: string; base: Currency }) {
  const s = useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS
  const consumos = useConsumos(month)
  const cupos = useMemo(() => calcularCupos(transactions, consumos ?? [], month, base, s), [transactions, consumos, month, base, s])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [registrar, setRegistrar] = useState<{ categoria: string | null } | null>(null)

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 glass rounded-[22px] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Planificado vs real</p>
        <button onClick={() => { haptic(); setRegistrar({ categoria: null }) }}
          className="h-7 px-2.5 rounded-full bg-primary/12 text-primary text-[11px] font-bold inline-flex items-center gap-1">
          <Plus size={12} /> Registrar consumo
        </button>
      </div>
      {consumos !== null && cupos.length === 0 && (
        <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
          Registre lo que va gastando (a mano, foto o captura) y verá cuánto le queda de lo planificado en cada categoría.
        </p>
      )}
      <div className="mt-1.5 space-y-2">
        {cupos.map((c) => (
          <CupoFila key={c.categoria} c={c} base={base} abierto={abierto === c.categoria}
            onToggle={() => { haptic('light'); setAbierto(abierto === c.categoria ? null : c.categoria) }}
            onRegistrar={() => { haptic(); setRegistrar({ categoria: c.categoria }) }} />
        ))}
      </div>
      <ConsumoSheet open={registrar !== null} onClose={() => setRegistrar(null)} existentes={consumos ?? []} categoriaInicial={registrar?.categoria} />
    </motion.section>
  )
}

function CupoFila({ c, base, abierto, onToggle, onRegistrar }: {
  c: Cupo; base: Currency; abierto: boolean; onToggle: () => void; onRegistrar: () => void
}) {
  const quedan = c.planBase - c.realBase
  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13px] font-semibold text-gray-900 flex items-center gap-1">
            {c.nombre}
            <ChevronDown size={12} className={`text-gray-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </p>
          <p className="shrink-0 text-[12px] text-gray-500">
            <b className="text-gray-900"><Money value={c.realBase} currency={base} animated={false} /></b>
            {c.planBase > 0 && <> / <Money value={c.planBase} currency={base} animated={false} /></>}
          </p>
        </div>
        <ProgressBar value={c.planBase > 0 ? c.pct : 100} className="mt-1.5" height={6} color={COLOR[c.nivel]} />
        <p className="mt-1 text-[10.5px] flex items-center gap-1" style={{ color: c.nivel === 'ok' ? undefined : COLOR[c.nivel] }}>
          {c.nivel !== 'ok' && <AlertTriangle size={11} />}
          <span className={c.nivel === 'ok' ? 'text-gray-400' : 'font-semibold'}>
            {c.nivel === 'sin_plan' ? <>Sin planificar este mes</>
              : c.nivel === 'excedido' ? <>Se pasó por <Money value={-quedan} currency={base} animated={false} /></>
              : <>Quedan <Money value={quedan} currency={base} animated={false} />
                  {c.porDiaBase !== null && <> · <Money value={c.porDiaBase} currency={base} animated={false} />/día</>}
                  {c.nivel === 'atento' && <> · proyección <Money value={c.proyeccionBase} currency={base} animated={false} /></>}</>}
          </span>
        </p>
      </button>
      <Collapse open={abierto}>
        <div className="mt-1.5 rounded-xl bg-gray-500/[0.05] px-2.5 py-1">
          {c.consumos.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-hairline last:border-0">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-gray-800">{x.comercio || 'Sin comercio'}</p>
                <p className="text-[10px] text-gray-400">
                  {new Date(x.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  {x.fuente !== 'manual' && ` · ${x.fuente}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[12px] font-semibold text-gray-900"><Money value={x.monto} currency={x.moneda} animated={false} /></span>
                <button onClick={() => { haptic('warning'); borrarConsumo(x) }} aria-label={`Eliminar ${x.comercio}`} className="p-1 text-gray-400">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={onRegistrar} className="w-full py-1.5 text-[11px] font-bold text-primary inline-flex items-center justify-center gap-1">
            <Plus size={11} /> Registrar en {c.nombre}
          </button>
        </div>
      </Collapse>
    </div>
  )
}
