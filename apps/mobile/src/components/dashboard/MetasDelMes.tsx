'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Target } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { evaluarMetasEnVivo } from '@finanzas/core/lib/metasVivo'
import { Currency, Transaction } from '@finanzas/core/types'
import ProgressBar from '@/components/ui/ProgressBar'
import { Money } from '@/components/ui/AnimatedNumber'

const COLOR = { ok: '#10b981', atento: '#f59e0b', excedida: '#f43f5e' } as const

/**
 * Metas de Ajustes → Metas de resúmenes seguidas con lo registrado en el mes
 * (todos los medios de pago): avance, proyección al cierre y cuánto queda por
 * día. Solo aparece si hay metas.
 */
export default function MetasDelMes({ transactions, month, base }: { transactions: Transaction[]; month: string; base: Currency }) {
  const s = useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS
  const metas = useMemo(() => evaluarMetasEnVivo(transactions, month, base, s), [transactions, month, base, s])
  if (metas.length === 0) return null
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 glass rounded-[22px] px-3.5 py-3">
      <p className="eyebrow flex items-center gap-1.5"><Target size={12} /> Metas del mes</p>
      <div className="mt-1.5 space-y-2">
        {metas.map((m) => (
          <div key={m.meta.id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-gray-900">{m.meta.nombre}</p>
              <p className="shrink-0 text-[12px] text-gray-500">
                <b className="text-gray-900"><Money value={m.actualBase} currency={base} animated={false} /></b> / <Money value={m.topeBase} currency={base} animated={false} />
              </p>
            </div>
            <ProgressBar value={m.topeBase > 0 ? m.pct : 100} className="mt-1.5" height={6} color={COLOR[m.nivel]} />
            {m.nivel !== 'ok' && (
            <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold" style={{ color: COLOR[m.nivel] }}>
              <AlertTriangle size={11} />
              <span>
                {m.nivel === 'excedida' ? <>Se pasó por <Money value={m.actualBase - m.topeBase} currency={base} animated={false} /></>
                  : <>Proyección <Money value={m.proyeccionBase} currency={base} animated={false} />{m.motivo ? ` · ${m.motivo}` : ''}</>}
                {m.porDiaBase !== null && <> · le quedan <Money value={m.porDiaBase} currency={base} animated={false} />/día</>}
              </span>
            </p>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  )
}
