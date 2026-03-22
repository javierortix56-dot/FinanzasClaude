'use client'

import { useEffect, useState } from 'react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { subscribeToBudgets } from '@/lib/budgets'
import { fetchMonthTransactions, fetchLastNMonths } from '@/lib/analytics'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { shiftMonth, monthLabel } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { Transaction, Currency } from '@/types'
import SummaryComparison from './SummaryComparison'
import CategoryDonut from './CategoryDonut'
import MultiLineChart, { LineSeries } from './MultiLineChart'

const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function HistoricoTab() {
  const { transactions, currentMonth } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { user, monedaBase } = useAuthStore()
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
    if (!user) return
    const unsub = subscribeToBudgets(user.uid, currentMonth, setBudgets)
    return () => unsub()
  }, [user, currentMonth, setBudgets])

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
    { label: 'Ingresos', color: '#22c55e', values: ingresosVals },
    { label: 'Egresos',  color: '#ef4444', values: egresosVals  },
    { label: 'Balance',  color: '#534AB7', values: balanceVals, dashed: true },
  ]

  return (
    <div className="overflow-y-auto pb-8">
      {/* Section 1: Comparison */}
      <div className="border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-1">
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-0">
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
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">
          Evolución 6 meses
        </p>
        {loadingChart ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MultiLineChart months={chartMonths} series={lineSeries} currency={base} />
        )}
      </div>
    </div>
  )
}
