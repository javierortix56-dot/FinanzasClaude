'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { useConsumos } from '@finanzas/core/lib/useConsumos'
import { calcularDesvios, ultimosMeses } from '@finanzas/core/lib/planVsReal'
import { mesCorto } from '@finanzas/core/lib/resumenAnalisis'
import { Currency, Settings, Transaction } from '@finanzas/core/types'
import { Card } from '@/components/ui/card'
import { MoneyText } from '@/components/MoneyText'
import { cn } from '@finanzas/core/lib/utils'

const MESES = 6

/** Desvío mes a mes (planificado vs consumos reales) por categoría, con metas sugeridas */
export function PlanVsRealSeccion({ base, delay = 0.26 }: { base: Currency; delay?: number }) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const { transactions, currentMonth } = useTransactionStore()
  const meses = useMemo(() => ultimosMeses(currentMonth, MESES), [currentMonth])
  const consumos = useConsumos(meses[0])
  const [historico, setHistorico] = useState<Record<string, Transaction[]> | null>(null)
  useEffect(() => {
    let cancel = false
    fetchLastNMonths(MESES, currentMonth).then((g) => { if (!cancel) setHistorico(g) }).catch(() => { if (!cancel) setHistorico({}) })
    return () => { cancel = true }
  }, [currentMonth])
  const desvios = useMemo(
    () => (historico && consumos ? calcularDesvios({ ...historico, [currentMonth]: transactions }, consumos, meses, base, s) : null),
    [historico, consumos, transactions, currentMonth, meses, base, s],
  )
  if (!desvios || desvios.length === 0) return null
  const sugerencias = desvios.filter((d) => d.sugerencia)

  return (
    <Card delay={delay} className="px-6 py-5">
      <div className="text-[15px] font-semibold">Planificado vs real</div>
      <div className="text-xs text-muted mt-0.5 mb-4">Consumos registrados contra lo planificado en cada categoría, últimos {MESES} meses</div>
      {sugerencias.length > 0 && (
        <div className="mb-4 space-y-1.5 rounded-xl bg-unassigned-tint px-4 py-3">
          {sugerencias.map((d) => (
            <div key={d.categoria} className="flex items-start gap-2 text-sm">
              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-unassigned" />
              <span><b>{d.nombre}:</b> {d.sugerencia}</span>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tnum">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.06em] text-muted-2">
              <th className="py-2 pr-3 text-left font-semibold">Categoría</th>
              {meses.map((m) => <th key={m} className="py-2 px-2 text-right font-semibold">{mesCorto(m)}</th>)}
              <th className="py-2 pl-3 text-right font-semibold">Desvío prom.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {desvios.map((d) => {
              const porMes = new Map(d.meses.map((m) => [m.mes, m]))
              return (
                <tr key={d.categoria}>
                  <td className="py-2.5 pr-3 font-medium">{d.nombre}</td>
                  {meses.map((mes) => {
                    const m = porMes.get(mes)
                    if (!m) return <td key={mes} className="py-2.5 px-2 text-right text-muted-2">—</td>
                    const pasa = m.planBase > 0 && m.realBase > m.planBase
                    return (
                      <td key={mes} className="py-2.5 px-2 text-right">
                        <div className={cn('font-semibold', pasa ? 'text-expense' : 'text-foreground')}><MoneyText amount={m.realBase} currency={base} /></div>
                        <div className="text-[11px] text-muted-2">{m.planBase > 0 ? <>de <MoneyText amount={m.planBase} currency={base} /></> : 'sin plan'}</div>
                      </td>
                    )
                  })}
                  <td className={cn('py-2.5 pl-3 text-right font-semibold', (d.desvioPromPct ?? 0) > 0 ? 'text-expense' : 'text-income')}>
                    {d.desvioPromPct === null ? '—' : `${d.desvioPromPct > 0 ? '+' : ''}${Math.round(d.desvioPromPct)} %`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
