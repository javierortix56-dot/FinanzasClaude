'use client'

import { useEffect, useState } from 'react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { fetchMonthTransactions, fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { shiftMonth, monthLabel, getCurrentMonth, getParentGroup, getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { txToBase } from '@finanzas/core/lib/currency'
import { Transaction, Currency } from '@finanzas/core/types'
import SummaryComparison from './SummaryComparison'
import CategoryDonut from './CategoryDonut'
import MultiLineChart, { LineSeries } from './MultiLineChart'
import { motion } from 'motion/react'
import { PiggyBank, CalendarDays, Crown, TrendingUp, TrendingDown, AlertTriangle, Clock, Gauge, Lightbulb } from 'lucide-react'
import Card from '@/components/ui/Card'
import { computeInsights, InsightIcon } from '@finanzas/core/lib/insights'

const INSIGHT_ICONS: Record<InsightIcon, React.ReactNode> = {
  up: <TrendingUp size={15} />,
  down: <TrendingDown size={15} />,
  piggy: <PiggyBank size={15} />,
  gauge: <Gauge size={15} />,
  alert: <AlertTriangle size={15} />,
  clock: <Clock size={15} />,
}
import { CategoryIcon } from '@/lib/categoryIcons'
import { cuentaEnCaja, cuentaEnCategorias } from '@finanzas/core/lib/tarjetas'
import { Money } from '@/components/ui/AnimatedNumber'

const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function HistoricoTab() {
  const { transactions, currentMonth } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const { setBudgets, budgets } = useBudgetStore()
  const hideAmounts = useSettingsStore((st) => st.hideAmounts)
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
      (s, t) => s + txToBase(t, base, settings ?? DEFAULT_SETTINGS), 0
    )
    // Caja: los consumos con tarjeta se cuentan en el pago del mes siguiente
    const exp = txs.filter((t) => t.tipo === 'egreso' && cuentaEnCaja(t)).reduce(
      (s, t) => s + txToBase(t, base, settings ?? DEFAULT_SETTINGS), 0
    )
    ingresosVals.push(inc)
    egresosVals.push(exp)
    balanceVals.push(inc - exp)
  }

  const lineSeries: LineSeries[] = [
    { label: 'Ingresos', color: '#10b981', values: ingresosVals },
    { label: 'Egresos',  color: '#f43f5e', values: egresosVals  },
    { label: 'Balance',  color: '#8b7bff', values: balanceVals, dashed: true },
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
  // Por categoría: los consumos con tarjeta sí, los pagos de tarjeta no
  let gastoCatMes = 0
  for (const t of transactions) {
    if (t.tipo !== 'egreso' || !cuentaEnCategorias(t)) continue
    const grp = getParentGroup(t.categoria, s.categoriasGasto)
    const id = grp?.id ?? t.categoria
    gastoCatMes += txToBase(t, base, s)
    gruposMes.set(id, (gruposMes.get(id) ?? 0) + txToBase(t, base, s))
  }
  const topGrupo = [...gruposMes.entries()].sort((a, b) => b[1] - a[1])[0]
  const topGrupoNombre = topGrupo ? (getCatFromSettings(topGrupo[0], s)?.nombre ?? topGrupo[0]) : null
  const topGrupoPct = topGrupo && gastoCatMes > 0 ? Math.round((topGrupo[1] / gastoCatMes) * 100) : 0

  // ── Evolución de gasto por grupo de categoría (6 meses) ───────────────────
  const gruposSeries: LineSeries[] = (() => {
    const porGrupo = new Map<string, number[]>()
    for (let i = 5; i >= 0; i--) {
      const m   = shiftMonth(currentMonth, -i)
      const txs = i === 0 ? transactions : (monthlyData[m] ?? [])
      const idx = 5 - i
      for (const t of txs) {
        if (t.tipo !== 'egreso' || !cuentaEnCategorias(t)) continue
        const grp = getParentGroup(t.categoria, s.categoriasGasto)
        const id = grp?.id ?? t.categoria
        if (!porGrupo.has(id)) porGrupo.set(id, Array(6).fill(0))
        porGrupo.get(id)![idx] += txToBase(t, base, s)
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
    .filter((t) => t.tipo === 'egreso' && cuentaEnCategorias(t))
    .map((t) => ({ t, montoBase: txToBase(t, base, s) }))
    .sort((a, b) => b.montoBase - a.montoBase)
    .slice(0, 5)

  const ahorroOk = tasaAhorro !== null && tasaAhorro >= 0

  // ── Insights en lenguaje natural (cálculo compartido en core) ─────────────
  const insights = computeInsights({
    transactions, prevTransactions: prevTxs, budgets, settings: s, base, month: currentMonth,
  })

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-1 pb-28 space-y-3 no-scrollbar">
      {/* Section 0: Insights */}
      {insights.length > 0 && (
        <Card title={<span className="inline-flex items-center gap-1.5"><Lightbulb size={12} /> Lo más importante</span>}>
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const tone = ins.tone === 'good'
                ? 'bg-emerald-500/12 text-emerald-600'
                : ins.tone === 'bad' ? 'bg-rose-500/12 text-rose-500' : 'bg-primary/10 text-primary'
              return (
                <motion.div
                  key={ins.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="flex items-start gap-2.5"
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>{INSIGHT_ICONS[ins.icon]}</span>
                  <p className="text-[13px] text-gray-700 leading-snug pt-1">
                    {ins.segments.map((seg, j) =>
                      typeof seg === 'string' ? seg
                        : 'bold' in seg ? <b key={j}>{seg.bold}</b>
                          : (
                            <span key={j} className={`font-semibold tabular-nums ${hideAmounts ? 'blur-[4px] select-none' : ''}`}>
                              {formatAmount(Math.round(seg.money), base)}
                            </span>
                          ),
                    )}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Section 1: Comparison + insights */}
      <Card title={`Resumen · vs ${monthLabel(prevMonth).replace(' de ', ' ')}`} padded={false}>
        <SummaryComparison
          current={transactions}
          previous={prevTxs}
          settings={s}
          monedaBase={base}
        />

        {/* Insights rápidos */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          <Insight
            icon={<PiggyBank size={14} />}
            tone={ahorroOk ? 'good' : 'bad'}
            label="Tasa de ahorro"
            value={tasaAhorro === null ? '—' : `${Math.round(tasaAhorro)}%`}
          />
          <Insight
            icon={<CalendarDays size={14} />}
            label={esMesActual ? 'Gasto x día' : 'Prom. diario'}
            value={<Money value={Math.round(promDiario)} currency={base} />}
          />
          <Insight
            icon={<Crown size={14} />}
            label={`Top: ${topGrupoNombre ?? '—'}`}
            value={topGrupo ? `${topGrupoPct}%` : '—'}
          />
        </div>
      </Card>

      {/* Section 2: Donut by category */}
      <Card title="Por categoría" padded={false} delay={0.05}>
        <CategoryDonut
          transactions={transactions}
          settings={s}
          monedaBase={base}
          mes={currentMonth}
        />
      </Card>

      {/* Section 3: Line chart */}
      <Card title="Evolución 6 meses" padded={false} delay={0.1}>
        {loadingChart ? (
          <div className="px-4 pb-4 pt-2"><div className="skeleton h-28 rounded-2xl" /></div>
        ) : (
          <MultiLineChart months={chartMonths} series={lineSeries} currency={base} />
        )}
      </Card>

      {/* Section 4: Evolución de gasto por categoría */}
      {!loadingChart && gruposSeries.length > 0 && (
        <Card title="Gasto por categoría · 6 meses" padded={false} delay={0.15}>
          <MultiLineChart months={chartMonths} series={gruposSeries} currency={base} />
        </Card>
      )}

      {/* Section 5: Mayores gastos del mes */}
      {topGastos.length > 0 && (
        <Card title="Mayores gastos del mes" delay={0.2}>
          <div className="space-y-1">
            {topGastos.map(({ t, montoBase }, i) => {
              const cat = getCatFromSettings(t.categoria, s)
              const pct = topGastos[0].montoBase > 0 ? (montoBase / topGastos[0].montoBase) * 100 : 0
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="relative flex items-center gap-2.5 py-2 px-2 rounded-xl overflow-hidden"
                >
                  {/* Barra relativa al mayor gasto */}
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-xl"
                    style={{ backgroundColor: (cat?.color ?? '#94a3b8') + '14' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.3 + i * 0.05 }}
                  />
                  <span className="relative w-5 h-5 rounded-full bg-surface text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {i + 1}
                  </span>
                  <span className="relative inline-flex flex-shrink-0" style={{ color: cat?.color ?? '#94a3b8' }}>
                    <CategoryIcon cat={cat ?? { id: t.categoria }} size={13} />
                  </span>
                  <p className="relative flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">
                    {t.descripcion || cat?.nombre || t.categoria}
                  </p>
                  <p className="relative text-xs font-bold text-rose-500 flex-shrink-0">
                    -<Money value={montoBase} currency={base} animated={false} />
                  </p>
                </motion.div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

function Insight({ icon, label, value, tone }: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  tone?: 'good' | 'bad'
}) {
  const toneCls = tone === 'good'
    ? 'bg-emerald-500/10 text-emerald-600'
    : tone === 'bad'
      ? 'bg-rose-500/10 text-rose-500'
      : 'bg-primary/10 text-primary'
  return (
    <div className="rounded-2xl bg-gray-500/[0.06] px-2.5 py-2.5 min-w-0">
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</span>
      <p className="text-[10px] text-gray-400 font-medium leading-tight mt-1.5 truncate">{label}</p>
      <p className="text-sm font-bold text-gray-900 tabular-nums truncate mt-0.5">{value}</p>
    </div>
  )
}
