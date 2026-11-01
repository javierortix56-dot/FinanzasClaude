'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { esCupo, esPendiente } from '@finanzas/core/lib/modoGasto'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { txToBase } from '@finanzas/core/lib/currency'
import { Currency, Transaction } from '@finanzas/core/types'
import { Money } from '@/components/ui/AnimatedNumber'
import { alternarEjecutado } from '@/components/consumos/MarcarPagado'
import { haptic } from '@/lib/haptics'

/**
 * Pagos únicos del mes (lo que no tiene cupo): los pendientes con "Pagar"
 * (pide el monto real) y el desvío de los ya pagados.
 */
export default function PagosDelMes({ transactions, base }: { transactions: Transaction[]; base: Currency }) {
  const s = useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS
  const { pendientes, pagados, desvio } = useMemo(() => {
    const unicos = transactions.filter((t) => t.tipo === 'egreso' && !t.pagoTarjeta && !t.noPlanificado && !esCupo(t.categoria, s))
    const pend = unicos.filter(esPendiente).sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime())
    const pag = unicos.filter((t) => t.ejecutado)
    const d = pag.reduce((acc, t) => {
      if (t.montoPlanificado == null) return acc
      const plan = txToBase({ ...t, monto: t.montoPlanificado }, base, s)
      return acc + txToBase(t, base, s) - plan
    }, 0)
    return { pendientes: pend, pagados: pag, desvio: d }
  }, [transactions, base, s])

  if (pendientes.length === 0 && pagados.length === 0) return null

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 glass rounded-[22px] px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">Pagos del mes</p>
        <p className="text-[11px] text-gray-500">
          {pagados.length} de {pagados.length + pendientes.length} pagados
          {Math.abs(desvio) >= 1 && (
            <span className={`font-semibold ${desvio > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
              {' · '}{desvio > 0 ? '+' : '−'}<Money value={Math.abs(desvio)} currency={base} animated={false} />
            </span>
          )}
        </p>
      </div>
      {pendientes.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1"><Check size={12} /> Todo pagado</p>
      ) : (
        <div className="mt-1">
          {pendientes.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-hairline last:border-0">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-gray-800">{t.descripcion || getCatFromSettings(t.categoria, s)?.nombre || '-'}</p>
                <p className="text-[10px] text-gray-400">
                  {t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  {' · '}<Money value={t.monto} currency={t.moneda} animated={false} />
                </p>
              </div>
              <button onClick={() => { haptic(); alternarEjecutado(t, s) }}
                className="shrink-0 h-7 px-3 rounded-full bg-primary/12 text-primary text-[11px] font-bold">
                Pagar
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  )
}
