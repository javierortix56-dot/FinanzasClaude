'use client'

import { useEffect, useState } from 'react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { fetchMonthTransactions, fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { shiftMonth, monthLabel, formatAmount, getCurrentMonth, getParentGroup, getCatFromSettings } from '@finanzas/core/lib/constants'
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
  // Derivado en vez de setState síncrono en el effect: cargando = todavía no
  // llegaron los datos del mes que se está mostrando.
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const loadingChart = loadedMonth !== currentMonth

  const prevMonth = shiftMonth(currentMonth, -1)

  // Fetch previous month for comparison
  useEffect(() => {
    let cancelled = false
    fetchMonthTransactions(prevMonth).then((txs) => { if (!cancelled) setPrevTxs(txs) })
    return () => { cancelled = true }
  }, [prevMonth])

  // Fetch last 6 months for line chart (cacheado en analytics)
  useEffect(() => {
    let cancelled = false
    fetchLastNMonths(6, currentMonth).then((data) => {
      if (cancelled) return
      setMonthlyData(data)
      setLoadedMonth(currentMonth)
    })
    return () => { cancelled = true }
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

  // ── Insights del mes ──────────────────────────────────────────────────────
  const incMes = ingresosVals[ingresosVals.length - 1]
  const expMes = egresosVals[egresosVals.length - 1]
  const tasaAhorro = incMes > 0 ? ((incMes - expMes) / incMes) * 100 : null
  const esMesActual = currentMonth === getCurrentMonth()
  const diasTranscurridos = esMesActual
    ? new Date().getDate()
    : new Date(...(currentMonth.split('-').map(Number) as [number, number]), 0).getDate()
  const promDiario = diasTranscurridos > 0 ? expMes / diasTranscurridos : 0

  // Gasto por grupo de categoría (mes visible) para "top categoría"
  const gruposMes = new Map<string, number>()
  for (const t of transactions) {
    if (t.tipo !== 'egreso') continue
    const grp = getParentGroup(t.categoria, s.categoriasGasto)
    const id = grp?.id ?? t.categoria
    gruposMes.set(id, (gruposMes.get(id) ?? 0) + toBase(t.monto, t.moneda, base, s))
  }
  const topGrupo = [...gruposMes.entries()].sort((a, b) => b[1] - a[1])[0]
  const topGrupoNombre = topGrupo ? (getCatFromSettings(topGrupo[0], s)?.nombre ?? topGrupo[0]) : null
  const topGrupoPct = topGrupo && expMes > 0 ? Math.round((topGrupo[1] / expMes) * 100) : 0

  // ── Evolución de gasto por grupo de categoría (6 meses) ───────────────────
  const gruposSeries: LineSeries[] = (() => {
    const porGrupo = new Map<string, number[]>()
    for (let i = 5; i >= 0; i--) {
      const m   = shiftMonth(currentMonth, -i)
      const txs = i === 0 ? transactions : (monthlyData[m] ?? [])
      const idx = 5 - i
      for (const t of txs) {
        if (t.tipo !== 'egreso') continue
        const grp = getParentGroup(t.categoria, s.categoriasGasto)
        const id = grp?.id ?? t.categoria
        if (!porGrupo.has(id)) porGrupo.set(id, Array(6).fill(0))
        porGrupo.get(id)![idx] += toBase(t.monto, t.moneda, base, s)
      }
    }
    return [...porGrupo.entries()]
      .map(([id, values]) => ({ id, values, total: values.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(({ id, values }) => ({
        label: getCatFromSettings(id, s)?.nombre ?? id,
        color: getCatFromSettings(id, s)?.color ?? '#94a3b8',
        values,
      }))
  })()

  // ── Top 5 gastos del mes ──────────────────────────────────────────────────
  const topGastos = [...transactions]
    .filter((t) => t.tipo === 'egreso')
    .map((t) => ({ t, montoBase: toBase(t.monto, t.moneda, base, s) }))
    .sort((a, b) => b.montoBase - a.montoBase)
    .slice(0, 5)

  return (
    <div className="h-full overflow-y-auto pb-8">
      {/* Section 1: Comparison */}
      <div className="border-b border-gray-50">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-0.5">
          Resumen — vs {monthLabel(prevMonth)}
        </p>
        <SummaryComparison
          current={transactions}
          previous={prevTxs}
          settings={s}
          monedaBase={base}
        />

        {/* Insights rápidos */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
          <div className={`rounded-xl px-2.5 py-2 ${tasaAhorro !== null && tasaAhorro >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-[10px] text-gray-400 font-medium leading-tight">Tasa de ahorro</p>
            <p className={`text-sm font-bold tabular-nums ${tasaAhorro !== null && tasaAhorro >= 0 ? 'text-green-600' : 'text-red-400'}`}>
              {tasaAhorro === null ? '—' : `${Math.round(tasaAhorro)}%`}
            </p>
          </div>
          <div className="rounded-xl px-2.5 py-2 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-medium leading-tight">
              {esMesActual ? 'Gasto x día' : 'Prom. diario'}
            </p>
            <p className="text-sm font-bold text-gray-900 tabular-nums truncate">
              {formatAmount(Math.round(promDiario), base)}
            </p>
          </div>
          <div className="rounded-xl px-2.5 py-2 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-medium leading-tight truncate">
              Top: {topGrupoNombre ?? '—'}
            </p>
            <p className="text-sm font-bold text-gray-900 tabular-nums">
              {topGrupo ? `${topGrupoPct}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Donut by category */}
      <div className="border-b border-gray-50">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-0">
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
      <div className="border-b border-gray-50 pb-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
          Evolución 6 meses
        </p>
        {loadingChart ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MultiLineChart months={chartMonths} series={lineSeries} currency={base} />
        )}
      </div>

      {/* Section 4: Evolución de gasto por categoría */}
      {!loadingChart && gruposSeries.length > 0 && (
        <div className="border-b border-gray-50 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
            Gasto por categoría — 6 meses
          </p>
          <MultiLineChart months={chartMonths} series={gruposSeries} currency={base} />
        </div>
      )}

      {/* Section 5: Mayores gastos del mes */}
      {topGastos.length > 0 && (
        <div className="pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1.5">
            Mayores gastos del mes
          </p>
          <div className="px-4 space-y-1">
            {topGastos.map(({ t, montoBase }, i) => {
              const cat = getCatFromSettings(t.categoria, s)
              return (
                <div key={t.id} className="flex items-center gap-2.5 py-1.5">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat?.color ?? '#94a3b8' }}
                  />
                  <p className="flex-1 min-w-0 text-xs text-gray-700 truncate">
                    {t.descripcion || cat?.nombre || t.categoria}
                  </p>
                  <p className="text-xs font-semibold text-red-400 tabular-nums flex-shrink-0">
                    -{formatAmount(montoBase, base)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
