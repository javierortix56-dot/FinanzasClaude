'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, ArrowRight, ArrowUpRight, ArrowDownRight, PiggyBank } from 'lucide-react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoneyText } from '@/components/MoneyText'
import { Donut } from '@/components/charts/Donut'
import { toBase } from '@finanzas/core/lib/currency'
import { formatAmount, getCatFromSettings, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { Currency, Transaction, Settings } from '@finanzas/core/types'

interface MonthAgg { month: string; ingresos: number; egresos: number; balance: number }

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function TrendChip({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta === null) return <span className="text-xs text-muted-2">— sin datos previos</span>
  const positive = delta >= 0
  // For egresos, "up" is bad; invert color semantics.
  const good = invert ? !positive : positive
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        good ? 'text-income' : 'text-expense'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(delta).toFixed(0)}%
      <span className="font-normal text-muted ml-1">vs mes ant.</span>
    </span>
  )
}

function Sparkline({ values, color = 'var(--primary)' }: { values: number[]; color?: string }) {
  const w = 240, h = 56, pad = 4
  if (values.length < 2) return <div className="h-14" />
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y]
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${h} L ${pts[0][0].toFixed(1)} ${h} Z`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && (
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
      )}
    </svg>
  )
}

function StatCard({
  label, value, delta, invert, icon: Icon, tone = 'neutral', sub,
}: {
  label: string
  value: React.ReactNode
  delta?: number | null
  invert?: boolean
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'income' | 'expense' | 'primary'
  sub?: React.ReactNode
}) {
  const accent: Record<string, string> = {
    neutral: 'before:bg-muted-2', income: 'before:bg-income',
    expense: 'before:bg-expense', primary: 'before:bg-primary',
  }
  const iconTone: Record<string, string> = {
    neutral: 'bg-surface-2 text-muted', income: 'bg-income-soft text-income',
    expense: 'bg-expense-soft text-expense', primary: 'bg-primary/10 text-primary',
  }
  return (
    <Card className={`relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent[tone]}`}>
      <CardContent className="pt-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-2 text-2xl font-semibold tnum text-foreground truncate">{value}</div>
          </div>
          <div className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${iconTone[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          {delta !== undefined ? <TrendChip delta={delta} invert={invert} /> : <span className="text-xs text-muted">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings } = useSettingsStore()
  const { transactions, currentMonth } = useTransactionStore()
  const { assets } = useAssetStore()

  const s = (settings ?? DEFAULT_SETTINGS) as Settings
  const base = monedaBase as Currency

  const [history, setHistory] = useState<MonthAgg[]>([])

  useEffect(() => {
    let cancel = false
    fetchLastNMonths(6, currentMonth).then((grouped) => {
      if (cancel) return
      const months: string[] = []
      for (let i = 5; i >= 0; i--) months.push(shiftMonth(currentMonth, -i))
      const agg = months.map((m) => {
        const txs = grouped[m] ?? []
        const ing = txs.filter((t) => t.tipo === 'ingreso').reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
        const egr = txs.filter((t) => t.tipo === 'egreso').reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
        return { month: m, ingresos: ing, egresos: egr, balance: ing - egr }
      })
      setHistory(agg)
    })
    return () => { cancel = true }
  }, [currentMonth, base, s])

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso')
  const egresos = transactions.filter((t) => t.tipo === 'egreso')
  const totalIngresos = ingresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
  const totalEgresos = egresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
  const balance = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s)
  const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos) * 100 : 0

  const activos = assets.filter((a) => a.clase === 'activo').reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const pasivos = assets.filter((a) => a.clase === 'pasivo').reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const patrimonioUSD = activos - pasivos

  const prev = history.length >= 2 ? history[history.length - 2] : null
  const dIng = prev ? pctDelta(totalIngresos, prev.ingresos) : undefined
  const dEgr = prev ? pctDelta(totalEgresos, prev.egresos) : undefined
  const dBal = prev ? pctDelta(balance, prev.balance) : undefined

  const recientes = [...transactions]
    .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
    .slice(0, 8)

  const porCategoria = new Map<string, number>()
  for (const t of egresos) {
    porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + toBase(t.monto, t.moneda, base, s))
  }
  const categorias = [...porCategoria.entries()]
    .map(([id, total]) => {
      const cat = getCatFromSettings(id, s)
      return { id, nombre: cat?.nombre ?? id, color: cat?.color ?? '#94a3b8', total, pct: totalEgresos > 0 ? (total / totalEgresos) * 100 : 0 }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted capitalize">{monthLabel(currentMonth)}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Resumen del mes</h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge tone="neutral">USD/ARS · {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}</Badge>
          <Badge tone="neutral">USD/COP · {s.tipoCambio.COP_USD.toLocaleString('es-AR')}</Badge>
        </div>
      </div>

      {/* Hero balance + trend */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 hero-gradient shadow-card-md overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Balance del mes
                </div>
                <div className="mt-2 text-4xl font-bold tnum text-foreground">
                  <MoneyText amount={balance} currency={base} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted">
                  <span><MoneyText amount={balanceUSD} currency="USD" /></span>
                  {dBal !== undefined && <TrendChip delta={dBal} />}
                </div>
              </div>
              <div className="lg:w-64">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Evolución 6 meses</span>
                </div>
                <Sparkline values={history.map((h) => h.balance)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <StatCard
          label="Tasa de ahorro" tone="primary" icon={PiggyBank}
          value={<span>{tasaAhorro.toFixed(0)}<span className="text-lg text-muted">%</span></span>}
          sub={`${formatAmount(balance, base)} ahorrado de ${formatAmount(totalIngresos, base)}`}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Ingresos" icon={TrendingUp} tone="income"
          value={<MoneyText amount={totalIngresos} currency={base} />} delta={dIng} />
        <StatCard label="Egresos" icon={TrendingDown} tone="expense"
          value={<MoneyText amount={totalEgresos} currency={base} />} delta={dEgr} invert />
        <StatCard label="Patrimonio neto" icon={Wallet} tone="neutral"
          value={<MoneyText amount={patrimonioUSD} currency="USD" />}
          sub={`Activos ${formatAmount(activos, 'USD')} · Pasivos ${formatAmount(pasivos, 'USD')}`} />
      </div>

      {/* Movements + categories */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Movimientos recientes</div>
              <div className="text-xs text-muted mt-0.5">Últimos {recientes.length} del mes</div>
            </div>
            <Link href="/movimientos" className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-y border-border">
                  <th className="px-6 py-2 font-medium">Concepto</th>
                  <th className="px-6 py-2 font-medium">Categoría</th>
                  <th className="px-6 py-2 font-medium">Fecha</th>
                  <th className="px-6 py-2 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {recientes.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted text-sm">No hay movimientos en este mes.</td></tr>
                ) : recientes.map((t) => <RecentRow key={t.id} t={t} settings={s} />)}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="px-6 pt-5 pb-3">
            <div className="text-sm font-semibold text-foreground">Top categorías</div>
            <div className="text-xs text-muted mt-0.5">Distribución de egresos</div>
          </div>
          <CardContent>
            {categorias.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sin egresos cargados.</p>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <Donut
                    size={180} thickness={26}
                    data={categorias.map((c) => ({ label: c.nombre, value: c.total, color: c.color }))}
                    centerLabel="Egresos"
                    centerValue={formatAmount(totalEgresos, base)}
                  />
                </div>
                <div className="space-y-2">
                  {categorias.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-foreground font-medium truncate">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="truncate">{c.nombre}</span>
                      </span>
                      <span className="text-muted tnum shrink-0 ml-2">{c.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RecentRow({ t, settings }: { t: Transaction; settings: Settings }) {
  const cat = getCatFromSettings(t.categoria, settings)
  const date = t.fecha.toDate()
  const fechaStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
      <td className="px-6 py-3">
        <div className="text-sm text-foreground font-medium truncate max-w-[280px]">{t.descripcion || '(sin descripción)'}</div>
        {!t.ejecutado && <span className="text-[10px] uppercase tracking-wide text-unassigned font-semibold">Pendiente</span>}
      </td>
      <td className="px-6 py-3">
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: cat?.color ?? '#94a3b8' }} />
          {cat?.nombre ?? '—'}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-muted">{fechaStr}</td>
      <td className="px-6 py-3 text-right">
        <span className={`text-sm font-semibold tnum ${t.tipo === 'ingreso' ? 'text-income' : 'text-expense'}`}>
          {t.tipo === 'ingreso' ? '+' : '−'}<MoneyText amount={t.monto} currency={t.moneda} />
        </span>
      </td>
    </tr>
  )
}
