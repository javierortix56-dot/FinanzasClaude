'use client'

import { useEffect, useState } from 'react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { fetchMonthTransactions, fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { shiftMonth, monthLabel } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { Transaction, Currency } from '@finanzas/core/types'
import SummaryComparison from './SummaryComparison'
import CategoryDonut from './CategoryDonut'
import MultiLineChart, { LineSeries } from './MultiLineChart'

const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function HistoricoTab() {
  const { transactions, currentMonth } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const { setBudgets } = useBudgetStore()
  const s    = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [prevTxs,    setPrevTxs]    = useState<Transaction[]>([])
  const [monthlyData, setMonthlyData] = useState<Record<string, Transaction[]>>({})
  const [loadingChart, setLoadingChart] = useState(true)

  const prevMonth = shiftMonth(currentMonth, -1)

  // Fetch previous month for comparison
  useEffect(() => {
    fetchMonthTransactions(prevMonth).then(setPrevTxs)
  }, [prevMonth])

  // Fetch last 6 months for line chart
  useEffect(() => {
    setLoadingChart(true)
    fetchLastNMonths(6, currentMonth)
      .then(setMonthlyData)
      .finally(() => setLoadingChart(false))
  }, [currentMonth])

  // Subscribe to budgets for current month
  useEffect(() => {
    const unsub = subscribeToBudgets(currentMonth, setBudgets)
    return () => unsub()
  }, [currentMonth, setBudgets])

  // Build line chart series (last 6 months)
  const chartMonths: string[] = []
  const ingresosVals: number[] = []
  const egresosVals:  number[] = []
  const balanceVals:  number[] = []

  for (let i = 5; i >= 0; i--) {
    const m     = shiftMonth(currentMonth, -i)
    const txs   = i === 0 ? transactions : (monthlyData[m] ?? [])
    const [, mon] = m.split('-')
    chartMonths.push(MONTH_ABBR[parseInt(mon) - 1])

    const inc = txs.filter((t) => t.tipo === 'ingreso').reduce(
      (s, t) => s + toBase(t.monto, t.moneda, base, settings ?? DEFAULT_SETTINGS), 0
    )
    const exp = txs.filter((t) => t.tipo === 'egreso').reduce(
      (s, t) => s + toBase(t.monto, t.moneda, base, settings ?? DEFAULT_SETTINGS), 0
    )
    ingresosVals.push(inc)
    egresosVals.push(exp)
    balanceVals.push(inc - exp)
  }

  const lineSeries: LineSeries[] = [
    { label: 'Ingresos', color: '#10b981', values: ingresosVals },
    { label: 'Egresos',  color: '#f43f5e', values: egresosVals  },
    { label: 'Balance',  color: '#a78bfa', values: balanceVals, dashed: true },
  ]

  return (
    <div className="h-full overflow-y-auto pb-8">
      {/* Section 1: Comparison */}
      <div className="border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-0.5">
          Resumen — vs {monthLabel(prevMonth)}
        </p>
        <SummaryComparison
          current={transactions}
          previous={prevTxs}
          settings={s}
          monedaBase={base}
        />
      </div>

      {/* Section 2: Donut by category */}
      <div className="border-b border-gray-50">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-0">
          Por categoría
        </p>
        <CategoryDonut
          transactions={transactions}
          settings={s}
          monedaBase={base}
          mes={currentMonth}
        />
      </div>

      {/* Section 3: Line chart */}
      <div className="pb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
          Evolución 6 meses
        </p>
        {loadingChart ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MultiLineChart months={chartMonths} series={lineSeries} currency={base} />
        )}
      </div>
    </div>
  )
}
