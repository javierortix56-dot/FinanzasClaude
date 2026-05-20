'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { Card, CardContent } from '@/components/ui/card'
import { MoneyText } from '@/components/MoneyText'
import { Donut } from '@/components/charts/Donut'
import { LineChart } from '@/components/charts/LineChart'
import { fetchLastNMonths, fetchMonthTransactions } from '@finanzas/core/lib/analytics'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, monthLabel, shiftMonth, formatAmount, CHART_PALETTE } from '@finanzas/core/lib/constants'
import { Currency, Transaction } from '@finanzas/core/types'

type TabBig = 'historico' | 'piloto'
type TabCat = 'gastos' | 'ingresos'

export default function AnalisisPage() {
  const { transactions, currentMonth } = useTransactionStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const { monedaBase } = useAuthStore()
  const base = monedaBase as Currency

  const [tab, setTab] = useState<TabBig>('historico')
  const [tabCat, setTabCat] = useState<TabCat>('gastos')
  const [prevTxs, setPrevTxs] = useState<Transaction[]>([])
  const [historico, setHistorico] = useState<Record<string, Transaction[]>>({})

  useEffect(() => {
    fetchMonthTransactions(shiftMonth(currentMonth, -1)).then(setPrevTxs)
    fetchLastNMonths(6, currentMonth).then(setHistorico)
  }, [currentMonth])

  const sumByType = (txs: Transaction[], tipo: 'ingreso' | 'egreso') =>
    txs.filter((t) => t.tipo === tipo)
       .reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

  const ingresosCur = sumByType(transactions, 'ingreso')
  const egresosCur  = sumByType(transactions, 'egreso')
  const balanceCur  = ingresosCur - egresosCur
  const ingresosPrev = sumByType(prevTxs, 'ingreso')
  const egresosPrev  = sumByType(prevTxs, 'egreso')
  const balancePrev  = ingresosPrev - egresosPrev

  const target = tabCat === 'gastos'
    ? transactions.filter((t) => t.tipo === 'egreso')
    : transactions.filter((t) => t.tipo === 'ingreso')

  const totalCat = target.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const byCat = new Map<string, number>()
  for (const t of target) {
    byCat.set(t.categoria, (byCat.get(t.categoria) ?? 0) + toBase(t.monto, t.moneda, base, settings))
  }
  const slices = [...byCat.entries()]
    .map(([id, value]) => {
      const c = getCatFromSettings(id, settings)
      return { id, label: c?.nombre ?? id, color: c?.color ?? '#94a3b8', value }
    })
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: CHART_PALETTE[i % CHART_PALETTE.length] }))

  const months = Object.keys(historico).sort()
  const lineLabels = months.map((m) => monthLabel(m).slice(0, 3))
  const lineSeries = [
    { label: 'Ingresos', color: '#16a34a', values: months.map((m) => sumByType(historico[m], 'ingreso')) },
    { label: 'Egresos',  color: '#dc2626', values: months.map((m) => sumByType(historico[m], 'egreso')) },
    { label: 'Balance',  color: '#534AB7', values: months.map((m) => sumByType(historico[m], 'ingreso') - sumByType(historico[m], 'egreso')) },
  ]

  function variation(cur: number, prev: number) {
    if (prev === 0) return null
    return ((cur - prev) / Math.abs(prev)) * 100
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Análisis</h2>
        <div className="inline-flex p-1 rounded-md bg-surface-2 border border-border">
          {(['historico', 'piloto'] as TabBig[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 h-8 text-sm font-medium rounded transition-colors capitalize ${
                tab === t ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              {t === 'historico' ? 'Histórico' : 'Piloto'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'historico' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ComparisonCard label="Balance"  cur={balanceCur}  base={base} variation={variation(balanceCur, balancePrev)} />
            <ComparisonCard label="Ingresos" cur={ingresosCur} base={base} variation={variation(ingresosCur, ingresosPrev)} positiveIsGood />
            <ComparisonCard label="Egresos"  cur={egresosCur}  base={base} variation={variation(egresosCur, egresosPrev)} positiveIsGood={false} />
            <ComparisonCard label="Movimientos" cur={transactions.length} base={base} variation={variation(transactions.length, prevTxs.length)} isCount />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="text-sm font-semibold">Distribución por categoría</div>
                <div className="inline-flex p-0.5 rounded bg-surface-2 border border-border">
                  {(['gastos', 'ingresos'] as TabCat[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setTabCat(c)}
                      className={`px-3 h-7 text-xs font-medium rounded ${
                        tabCat === c ? 'bg-surface text-foreground shadow-sm' : 'text-muted'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <CardContent className="pt-5">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <Donut
                    data={slices}
                    centerLabel="Total"
                    centerValue={formatAmount(totalCat, base)}
                  />
                  <div className="flex-1 w-full space-y-2">
                    {slices.length === 0 ? (
                      <p className="text-sm text-muted py-6 text-center">Sin datos.</p>
                    ) : slices.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <div className="text-right tabular-nums">
                          <div className="text-foreground"><MoneyText amount={s.value} currency={base} /></div>
                          <div className="text-xs text-muted">{((s.value / totalCat) * 100).toFixed(0)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="px-5 py-4 border-b border-border">
                <div className="text-sm font-semibold">Evolución (últimos 6 meses)</div>
              </div>
              <CardContent className="pt-5">
                <LineChart
                  labels={lineLabels}
                  series={lineSeries}
                  yFormatter={(n) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toFixed(0)}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <PilotoView
          ingresos={ingresosCur}
          egresos={egresosCur}
          base={base}
        />
      )}
    </div>
  )
}

function ComparisonCard({
  label, cur, base, variation, positiveIsGood = true, isCount = false,
}: {
  label: string
  cur: number
  base: Currency
  variation: number | null
  positiveIsGood?: boolean
  isCount?: boolean
}) {
  const up = variation !== null && variation > 0
  const good = variation === null ? null : (up ? positiveIsGood : !positiveIsGood)
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="mt-2 text-xl font-semibold text-foreground">
          {isCount ? cur : <MoneyText amount={cur} currency={base} />}
        </div>
        <div className="mt-1 text-xs flex items-center gap-1">
          {variation === null ? (
            <span className="text-muted">— vs mes anterior</span>
          ) : (
            <>
              <span className={good ? 'text-income' : 'text-expense'}>
                {up ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />}
                {Math.abs(variation).toFixed(0)}%
              </span>
              <span className="text-muted">vs mes anterior</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PilotoView({ ingresos, egresos, base }: { ingresos: number; egresos: number; base: Currency }) {
  const balance = ingresos - egresos
  const today = new Date()
  const dom = today.getDate()
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const elapsed = dom / totalDays
  const proyIngresos = elapsed > 0 ? ingresos / elapsed : 0
  const proyEgresos  = elapsed > 0 ? egresos / elapsed : 0
  const proyBalance  = proyIngresos - proyEgresos

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-5">
          <div className="text-xs font-medium text-muted">Proyección Ingresos</div>
          <div className="mt-2 text-xl font-semibold text-income"><MoneyText amount={proyIngresos} currency={base} /></div>
          <div className="text-xs text-muted mt-1">Actual: <MoneyText amount={ingresos} currency={base} /> · {(elapsed * 100).toFixed(0)}% del mes</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="text-xs font-medium text-muted">Proyección Egresos</div>
          <div className="mt-2 text-xl font-semibold text-expense"><MoneyText amount={proyEgresos} currency={base} /></div>
          <div className="text-xs text-muted mt-1">Actual: <MoneyText amount={egresos} currency={base} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <div className="text-xs font-medium text-muted">Balance proyectado</div>
          <div className={`mt-2 text-xl font-semibold ${proyBalance >= 0 ? 'text-foreground' : 'text-expense'}`}>
            <MoneyText amount={proyBalance} currency={base} />
          </div>
          <div className="text-xs text-muted mt-1">Actual: <MoneyText amount={balance} currency={base} /></div>
        </CardContent>
      </Card>
    </div>
  )
}
