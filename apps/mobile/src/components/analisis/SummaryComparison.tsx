'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { Transaction, Settings, Currency } from '@finanzas/core/types'
import { txToBase } from '@finanzas/core/lib/currency'
import { Money } from '@/components/ui/AnimatedNumber'

interface Props {
  current:  Transaction[]
  previous: Transaction[]
  settings: Settings
  monedaBase: Currency
}

function sum(txs: Transaction[], tipo: 'ingreso' | 'egreso', s: Settings, base: Currency) {
  return txs.filter((t) => t.tipo === tipo).reduce(
    (acc, t) => acc + txToBase(t, base, s),
    0
  )
}

interface MetricProps {
  label: string
  value: number | string
  prev:  number
  curr:  number
  currency?: string
  higherIsBetter?: boolean
}

function Metric({ label, value, prev, curr, currency = '', higherIsBetter = true }: MetricProps) {
  const diff = prev === 0 ? 0 : ((curr - prev) / prev) * 100
  const improved = higherIsBetter ? curr >= prev : curr <= prev
  const arrow = diff === 0 ? null : improved
    ? <ArrowUp  size={10} />
    : <ArrowDown size={10} />

  return (
    <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[15px] font-bold text-gray-900 leading-tight tabular-nums truncate">
        {typeof value === 'string' ? value : <Money value={value} currency={currency} />}
      </p>
      <div className="flex items-center mt-1 h-4">
        {diff !== 0 && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 rounded-full text-[10px] font-bold ${
            improved ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-500'
          }`}>
            {arrow}
            {Math.abs(diff).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function SummaryComparison({ current, previous, settings, monedaBase }: Props) {
  const cIngresos = sum(current,  'ingreso', settings, monedaBase)
  const pIngresos = sum(previous, 'ingreso', settings, monedaBase)
  const cEgresos  = sum(current,  'egreso',  settings, monedaBase)
  const pEgresos  = sum(previous, 'egreso',  settings, monedaBase)
  const cBalance  = cIngresos - cEgresos
  const pBalance  = pIngresos - pEgresos

  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-2">
      <Metric label="Balance"      value={cBalance}   prev={pBalance}   curr={cBalance}   currency={monedaBase} higherIsBetter />
      <Metric label="Ingresos"     value={cIngresos}  prev={pIngresos}  curr={cIngresos}  currency={monedaBase} higherIsBetter />
      <Metric label="Egresos"      value={cEgresos}   prev={pEgresos}   curr={cEgresos}   currency={monedaBase} higherIsBetter={false} />
      <Metric label="Movimientos"  value={String(current.length)} prev={previous.length} curr={current.length} higherIsBetter />
    </div>
  )
}
