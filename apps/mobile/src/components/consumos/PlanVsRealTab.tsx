'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lightbulb, Lock } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { useConsumos } from '@finanzas/core/lib/useConsumos'
import { calcularDesvios, ultimosMeses, DesvioCategoria } from '@finanzas/core/lib/planVsReal'
import { mesCorto, montoCorto } from '@finanzas/core/lib/resumenAnalisis'
import { Currency, Settings, Transaction } from '@finanzas/core/types'
import Card from '@/components/ui/Card'
import { Money } from '@/components/ui/AnimatedNumber'
import CierreMesSheet from '@/components/consumos/CierreMesSheet'
import { monthLabel } from '@finanzas/core/lib/constants'
import { haptic } from '@/lib/haptics'

const MESES = 6

/** Pestaña "Plan vs real" de Análisis: desvío mes a mes por categoría y metas sugeridas */
export default function PlanVsRealTab() {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const base = useAuthStore((st) => st.monedaBase) as Currency
  const { transactions, currentMonth } = useTransactionStore()
  const meses = useMemo(() => ultimosMeses(currentMonth, MESES), [currentMonth])
  const consumos = useConsumos(meses[0])
  const [historico, setHistorico] = useState<Record<string, Transaction[]> | null>(null)
  const [cierreAbierto, setCierreAbierto] = useState(false)
  const cerrado = (s.mesesCerrados ?? []).includes(currentMonth)

  useEffect(() => {
    let cancel = false
    fetchLastNMonths(MESES, currentMonth).then((g) => { if (!cancel) setHistorico(g) }).catch(() => { if (!cancel) setHistorico({}) })
    return () => { cancel = true }
  }, [currentMonth])

  const desvios = useMemo(() => {
    if (!historico || !consumos) return null
    // El mes visible usa los movimientos en vivo del store
    return calcularDesvios({ ...historico, [currentMonth]: transactions }, consumos, meses, base, s)
  }, [historico, consumos, transactions, currentMonth, meses, base, s])

  const delMes = (desvios ?? []).map((d) => d.meses.find((m) => m.mes === currentMonth)).filter((m): m is NonNullable<typeof m> => !!m)
  const planMes = delMes.reduce((a, m) => a + m.planBase, 0)
  const realMes = delMes.reduce((a, m) => a + m.realBase, 0)
  const sugerencias = (desvios ?? []).filter((d) => d.sugerencia)

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-1 pb-28 space-y-3 no-scrollbar">
      <button type="button" onClick={() => { haptic(); setCierreAbierto(true) }}
        className="w-full glass rounded-[22px] px-4 py-3 flex items-center gap-3 text-left">
        <span className="h-9 w-9 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center shrink-0"><Lock size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-gray-900">Cierre de {monthLabel(currentMonth).replace(/ de \d{4}$/, '')}</span>
          <span className="block text-[11px] text-gray-500">{cerrado ? 'Cerrado · ver planificado contra real' : 'Planificado contra real y plan del mes siguiente'}</span>
        </span>
        <span className="text-[11px] font-bold text-primary shrink-0">Revisar</span>
      </button>
      <CierreMesSheet mes={currentMonth} open={cierreAbierto} onClose={() => setCierreAbierto(false)} />
      {desvios === null ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-[24px]" />)}</div>
      ) : desvios.length === 0 ? (
        <Card className="text-center !py-8">
          <p className="text-[15px] font-bold text-gray-900">Todavía no hay consumos registrados</p>
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
            Desde el inicio, «Registrar consumo» (a mano, foto o captura). Cada consumo llena el cupo de lo planificado en su
            categoría; acá verá el desvío mes a mes y qué metas conviene fijar.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <p className="eyebrow">Este mes, en las categorías que sigue</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[22px] font-bold text-gray-900"><Money value={realMes} currency={base} /></p>
              <p className="text-xs text-gray-500">de <Money value={planMes} currency={base} animated={false} /> planificado</p>
            </div>
            <p className={`text-[11px] font-semibold ${realMes > planMes ? 'text-rose-500' : 'text-emerald-600'}`}>
              {planMes > 0 ? (realMes > planMes
                ? <>Se pasó por <Money value={realMes - planMes} currency={base} animated={false} /></>
                : <>Quedan <Money value={planMes - realMes} currency={base} animated={false} /></>) : 'Sin planificado en estas categorías'}
            </p>
          </Card>

          {sugerencias.length > 0 && (
            <Card title="Metas posibles" delay={0.03}>
              {sugerencias.map((d) => (
                <p key={d.categoria} className="flex items-start gap-2 py-1.5 text-xs text-gray-600 leading-relaxed border-b border-hairline last:border-0">
                  <Lightbulb size={13} className="shrink-0 mt-0.5 text-amber-500" />
                  <span><b className="text-gray-900">{d.nombre}:</b> {d.sugerencia}</span>
                </p>
              ))}
            </Card>
          )}

          {desvios.map((d, i) => <CategoriaDesvio key={d.categoria} d={d} meses={meses} base={base} delay={0.05 + i * 0.02} />)}
        </>
      )}
    </div>
  )
}

function CategoriaDesvio({ d, meses, base, delay }: { d: DesvioCategoria; meses: string[]; base: Currency; delay: number }) {
  const porMes = new Map(d.meses.map((m) => [m.mes, m]))
  const max = Math.max(...d.meses.flatMap((m) => [m.planBase, m.realBase]), 1)
  return (
    <Card title={d.nombre} delay={delay}>
      <p className="-mt-1 mb-2 text-[11px] text-gray-500">
        {d.evaluados > 0
          ? <>Se pasó {d.excedidos} de {d.evaluados} {d.evaluados === 1 ? 'mes' : 'meses'}{d.desvioPromPct !== null && <> · desvío promedio {d.desvioPromPct > 0 ? '+' : ''}{Math.round(d.desvioPromPct)} %</>}</>
          : 'Primer mes con consumos registrados'}
      </p>
      <div className="flex items-end gap-1.5 h-24">
        {meses.map((mes) => {
          const m = porMes.get(mes)
          const pasa = m && m.planBase > 0 && m.realBase > m.planBase
          return (
            <div key={mes} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5">
              <span className={`text-[9px] font-bold tnum ${pasa ? 'text-rose-500' : 'text-gray-500'}`}>{m ? montoCorto(m.realBase) : ''}</span>
              <div className="relative w-full flex-1 flex items-end justify-center">
                {m && m.planBase > 0 && (
                  <div className="absolute bottom-0 w-full rounded-t-md border border-dashed border-gray-400/70" style={{ height: `${(m.planBase / max) * 100}%` }} />
                )}
                {m && <div className="relative w-3/5 rounded-t-md" style={{ height: `${Math.max((m.realBase / max) * 100, 3)}%`, background: pasa ? '#f43f5e' : '#10b981' }} />}
              </div>
              <span className="text-[9px] text-gray-400">{mesCorto(mes).split(' ')[0]}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 flex gap-3 text-[10px] text-gray-400">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-gray-400" /> Planificado</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Real</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" /> Real sobre el plan</span>
      </p>
    </Card>
  )
}
