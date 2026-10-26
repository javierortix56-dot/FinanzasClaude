'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Lightbulb, CalendarClock } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import ProgressBar from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/MoneyText'
import { Donut } from '@/components/charts/Donut'
import { LineChart } from '@/components/charts/LineChart'
import { InsightsList } from '@/components/InsightsList'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { computeInsights } from '@finanzas/core/lib/insights'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { Currency, Transaction } from '@finanzas/core/types'
import { PageScroll } from '@/components/shell/PageScroll'
import { easeOut } from '@/components/ui/motion'

type TabBig = 'historico' | 'piloto'
type TabCat = 'gastos' | 'ingresos'

export default function AnalisisPage() {
  const { transactions, currentMonth } = useTransactionStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const budgets = useBudgetStore((s) => s.budgets)
  const { monedaBase } = useAuthStore()
  const base = monedaBase as Currency

  const [tab, setTab] = useState<TabBig>('historico')
  const [tabCat, setTabCat] = useState<TabCat>('gastos')
  const [hover, setHover] = useState<number | null>(null)
  const [historico, setHistorico] = useState<Record<string, Transaction[]>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Un solo fetch (6 meses incluye el anterior) y cancelable: antes había
  // dos promesas sin cancelar y un cambio rápido de mes mezclaba datos.
  useEffect(() => {
    let cancel = false
    fetchLastNMonths(6, currentMonth).then((g) => {
      if (cancel) return
      setHistorico(g)
      setLoadedFor(currentMonth)
    })
    return () => { cancel = true }
  }, [currentMonth])

  const ready = loadedFor === currentMonth
  const prevTxs = ready ? historico[shiftMonth(currentMonth, -1)] ?? [] : []

  const sumByType = (txs: Transaction[], tipo: 'ingreso' | 'egreso') =>
    txs.filter((t) => t.tipo === tipo)
       .reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

  const ingresosCur = sumByType(transactions, 'ingreso')
  const egresosCur  = sumByType(transactions, 'egreso')
  const balanceCur  = ingresosCur - egresosCur
  const ingresosPrev = sumByType(prevTxs, 'ingreso')
  const egresosPrev  = sumByType(prevTxs, 'egreso')
  const balancePrev  = ingresosPrev - egresosPrev

  const target = transactions.filter((t) => t.tipo === (tabCat === 'gastos' ? 'egreso' : 'ingreso'))
  const totalCat = target.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const byCat = new Map<string, number>()
  for (const t of target) {
    byCat.set(t.categoria, (byCat.get(t.categoria) ?? 0) + toBase(t.monto, t.moneda, base, settings))
  }
  const slices = [...byCat.entries()]
    .map(([id, value]) => {
      const c = getCatFromSettings(id, settings)
      return { id, cat: c, label: c?.nombre ?? id, color: c?.color ?? '#94a3b8', value }
    })
    .sort((a, b) => b.value - a.value)

  // Serie de 6 meses: el mes visible sale del store (siempre al día)
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, i - 5))
  const txsOf = (m: string) => (m === currentMonth ? transactions : historico[m] ?? [])
  const lineLabels = months.map((m) => monthLabel(m).slice(0, 3))
  const lineSeries = ready ? [
    { label: 'Ingresos', color: 'var(--income)',  values: months.map((m) => sumByType(txsOf(m), 'ingreso')) },
    { label: 'Egresos',  color: 'var(--expense)', values: months.map((m) => sumByType(txsOf(m), 'egreso')) },
    { label: 'Balance',  color: 'var(--primary)', dashed: true, values: months.map((m) => sumByType(txsOf(m), 'ingreso') - sumByType(txsOf(m), 'egreso')) },
  ] : []

  const insights = ready
    ? computeInsights({ transactions, prevTransactions: prevTxs, budgets, settings, base, month: currentMonth })
    : []

  function variation(cur: number, prev: number) {
    if (!ready || prev === 0) return null
    return ((cur - prev) / Math.abs(prev)) * 100
  }

  return (
    <PageScroll className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="eyebrow">{monthLabel(currentMonth)} · comparado con el mes anterior</div>
        <Segmented
          id="analisis-tab"
          value={tab}
          onChange={setTab}
          options={[{ value: 'historico', label: 'Histórico' }, { value: 'piloto', label: 'Piloto' }]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'historico' ? (
          <motion.div
            key="historico"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={easeOut}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <ComparisonCard delay={0}    label="Balance"  cur={balanceCur}  base={base} variation={variation(balanceCur, balancePrev)} />
              <ComparisonCard delay={0.04} label="Ingresos" cur={ingresosCur} base={base} variation={variation(ingresosCur, ingresosPrev)} />
              <ComparisonCard delay={0.08} label="Egresos"  cur={egresosCur}  base={base} variation={variation(egresosCur, egresosPrev)} invert />
              <ComparisonCard delay={0.12} label="Movimientos" cur={transactions.length} base={base} variation={variation(transactions.length, prevTxs.length)} isCount />
            </div>

            {insights.length > 0 && (
              <Card delay={0.14} className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="eyebrow">Lo que dicen los números</span>
                </div>
                <InsightsList insights={insights} base={base} columns={2} />
              </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Card delay={0.18}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <div className="eyebrow">Distribución por categoría</div>
                  <Segmented
                    id="analisis-cat"
                    size="sm"
                    value={tabCat}
                    onChange={(v) => { setTabCat(v); setHover(null) }}
                    options={[
                      { value: 'gastos', label: 'Gastos', activeColor: 'var(--expense)' },
                      { value: 'ingresos', label: 'Ingresos', activeColor: 'var(--income)' },
                    ]}
                  />
                </div>
                <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row items-center gap-6">
                  <Donut data={slices} currency={base} highlight={hover} onHighlight={setHover} />
                  <div className="flex-1 w-full space-y-0.5 min-w-0">
                    {slices.length === 0 ? (
                      <p className="text-sm text-muted py-6 text-center">Sin datos este mes.</p>
                    ) : slices.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: hover === null || hover === i ? 1 : 0.45, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        className="flex items-center justify-between gap-3 text-sm rounded-xl px-2 py-1.5 hover:bg-surface-2 transition-colors cursor-default"
                      >
                        <span className="flex items-center gap-2.5 text-foreground min-w-0">
                          <span className="h-7 w-7 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: `${s.color}22`, color: s.color }}>
                            {s.cat ? <CategoryIcon cat={s.cat} size={14} /> : null}
                          </span>
                          <span className="truncate">{s.label}</span>
                        </span>
                        <div className="text-right tnum shrink-0">
                          <div className="text-foreground font-medium"><MoneyText amount={s.value} currency={base} /></div>
                          <div className="text-[11px] text-muted">{totalCat > 0 ? ((s.value / totalCat) * 100).toFixed(0) : 0}%</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card delay={0.22}>
                <div className="px-6 pt-5 pb-3 eyebrow">Evolución · últimos 6 meses</div>
                <div className="px-6 pb-6 pt-2">
                  {ready ? (
                    <LineChart
                      labels={lineLabels}
                      series={lineSeries}
                      yFormatter={(n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toFixed(0)}
                    />
                  ) : (
                    <div className="skeleton h-[220px] rounded-2xl" />
                  )}
                </div>
              </Card>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="piloto"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={easeOut}
          >
            <PilotoView ingresos={ingresosCur} egresos={egresosCur} base={base} month={currentMonth} />
          </motion.div>
        )}
      </AnimatePresence>
    </PageScroll>
  )
}

function ComparisonCard({
  label, cur, base, variation, invert = false, isCount = false, delay,
}: {
  label: string
  cur: number
  base: Currency
  variation: number | null
  /** En egresos, "sube" es malo */
  invert?: boolean
  isCount?: boolean
  delay?: number
}) {
  const up = variation !== null && variation > 0
  const good = variation === null ? null : (up ? !invert : invert)
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <Card delay={delay} className="px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2.5 text-[22px] font-semibold tnum text-foreground truncate">
        {isCount ? cur : <MoneyText amount={cur} currency={base} animated />}
      </div>
      <div className="mt-2 text-xs flex items-center gap-1.5">
        {variation === null ? (
          <span className="text-muted-2">— sin datos previos</span>
        ) : (
          <>
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${good ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
              <Icon className="h-3.5 w-3.5" />
              {Math.abs(variation).toFixed(0)}%
            </span>
            <span className="text-muted">vs mes ant.</span>
          </>
        )}
      </div>
    </Card>
  )
}

/**
 * Proyección lineal al cierre del mes visible. Antes usaba siempre la fecha
 * de hoy: en un mes pasado proyectaba de más y en uno futuro dividía por un
 * avance que no corresponde. Ahora un mes cerrado vale 100 % y uno futuro 0 %.
 */
function PilotoView({ ingresos, egresos, base, month }: { ingresos: number; egresos: number; base: Currency; month: string }) {
  const today = new Date()
  const [y, m] = month.split('-').map(Number)
  const totalDays = new Date(y, m, 0).getDate()
  const cmp = y * 12 + m - (today.getFullYear() * 12 + today.getMonth() + 1)
  const elapsed = cmp < 0 ? 1 : cmp > 0 ? 0 : today.getDate() / totalDays
  const proy = (n: number) => (elapsed > 0 ? n / elapsed : n)
  const proyIngresos = proy(ingresos)
  const proyEgresos  = proy(egresos)
  const proyBalance  = proyIngresos - proyEgresos
  const balance = ingresos - egresos
  const usoProy = proyIngresos > 0 ? (proyEgresos / proyIngresos) * 100 : 0

  const estado = cmp < 0 ? 'Mes cerrado: la proyección coincide con lo real.'
    : cmp > 0 ? 'Mes futuro: todavía no hay avance para proyectar.'
    : `Día ${today.getDate()} de ${totalDays}.`

  return (
    <div className="space-y-5">
      <Card className="px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <div className="eyebrow">Avance del mes</div>
              <div className="text-sm text-muted mt-1.5">{estado}</div>
            </div>
          </div>
          <div className="text-2xl font-semibold tnum">{Math.round(elapsed * 100)}%</div>
        </div>
        <ProgressBar value={elapsed * 100} className="mt-4" height={8} color="linear-gradient(90deg, var(--primary-2), var(--primary))" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProyCard delay={0.04} label="Proyección ingresos" tone="text-income" value={proyIngresos} actual={ingresos} base={base} />
        <ProyCard delay={0.08} label="Proyección egresos" tone="text-expense" value={proyEgresos} actual={egresos} base={base} />
        <ProyCard delay={0.12} label="Balance proyectado" tone={proyBalance >= 0 ? 'text-foreground' : 'text-expense'} value={proyBalance} actual={balance} base={base} />
      </div>

      {proyIngresos > 0 && (
        <Card delay={0.16} className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Egresos proyectados sobre ingresos</div>
            <div className={`text-sm font-semibold tnum ${usoProy > 100 ? 'text-expense' : usoProy > 85 ? 'text-unassigned' : 'text-income'}`}>
              {usoProy.toFixed(0)}%
            </div>
          </div>
          <ProgressBar
            value={usoProy}
            className="mt-3"
            height={8}
            color={usoProy > 100 ? 'var(--expense)' : usoProy > 85 ? 'var(--unassigned)' : 'var(--income)'}
          />
          <p className="text-xs text-muted mt-3">
            {usoProy > 100
              ? 'A este ritmo, el mes cierra gastando más de lo que ingresa.'
              : 'A este ritmo, el mes cierra dentro de lo ingresado.'}
          </p>
        </Card>
      )}
    </div>
  )
}

function ProyCard({ label, tone, value, actual, base, delay }: {
  label: string; tone: string; value: number; actual: number; base: Currency; delay?: number
}) {
  return (
    <Card delay={delay} className="px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2.5 text-[22px] font-semibold tnum ${tone}`}>
        <MoneyText amount={value} currency={base} animated />
      </div>
      <div className="text-xs text-muted mt-1.5">Actual: <MoneyText amount={actual} currency={base} /></div>
    </Card>
  )
}
