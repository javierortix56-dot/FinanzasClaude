'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { Transaction, Settings, Currency } from '@finanzas/core/types'
import { toBase } from '@finanzas/core/lib/currency'
import { formatAmount } from '@finanzas/core/lib/constants'

interface Props {
  current:  Transaction[]
  previous: Transaction[]
  settings: Settings
  monedaBase: Currency
}

function sum(txs: Transaction[], tipo: 'ingreso' | 'egreso', s: Settings, base: Currency) {
  return txs.filter((t) => t.tipo === tipo).reduce(
    (acc, t) => acc + toBase(t.monto, t.moneda, base, s),
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
    ? <ArrowUp  size={10} className="text-green-500" />
    : <ArrowDown size={10} className="text-red-400"  />

  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-bold text-gray-900 leading-tight tabular-nums">
        {typeof value === 'string' ? value : formatAmount(value, currency)}
      </p>
      <div className="flex items-center gap-0.5 mt-0.5 h-3">
        {diff !== 0 && (
          <>
            {arrow}
            <span className={`text-[10px] font-semibold ${improved ? 'text-green-500' : 'text-red-400'}`}>
              {Math.abs(diff).toFixed(0)}%
            </span>
          </>
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
    <div className="grid grid-cols-2 gap-2 px-4 py-2.5">
      <Metric label="Balance"      value={cBalance}   prev={pBalance}   curr={cBalance}   currency={monedaBase} higherIsBetter />
      <Metric label="Ingresos"     value={cIngresos}  prev={pIngresos}  curr={cIngresos}  currency={monedaBase} higherIsBetter />
      <Metric label="Egresos"      value={cEgresos}   prev={pEgresos}   curr={cEgresos}   currency={monedaBase} higherIsBetter={false} />
      <Metric label="Movimientos"  value={String(current.length)} prev={previous.length} curr={current.length} higherIsBetter />
    </div>
  )
}
