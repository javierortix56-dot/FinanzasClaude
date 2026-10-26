'use client'

import { txLabel } from '@/lib/txLabel'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  TrendingUp, TrendingDown, Wallet, ArrowRight, ArrowUpRight, ArrowDownRight, PiggyBank,
  Link2, Lightbulb,
} from 'lucide-react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Card } from '@/components/ui/card'
import { MoneyText } from '@/components/MoneyText'
import { Donut } from '@/components/charts/Donut'
import Sparkline from '@/components/ui/Sparkline'
import ProgressBar from '@/components/ui/ProgressBar'
import { InsightsList } from '@/components/InsightsList'
import { toBase, txToBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings, getParentGroup, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { computeInsights } from '@finanzas/core/lib/insights'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { Currency, Transaction, Settings } from '@finanzas/core/types'
import { PageScroll } from '@/components/shell/PageScroll'
import { useSinAsignar } from '@/components/shell/Sidebar'

interface MonthAgg { month: string; ingresos: number; egresos: number; balance: number }

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function TrendChip({ delta, invert = false, onBrand = false }: { delta: number | null | undefined; invert?: boolean; onBrand?: boolean }) {
  if (delta === undefined) return null
  if (delta === null) return <span className={`text-xs ${onBrand ? 'text-white/60' : 'text-muted-2'}`}>— sin datos previos</span>
  const positive = delta >= 0
  // En egresos, "sube" es malo: se invierte la semántica de color
  const good = invert ? !positive : positive
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  const tone = onBrand
    ? good ? 'bg-emerald-400/25 text-emerald-100' : 'bg-rose-400/25 text-rose-100'
    : good ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(delta).toFixed(0)}%
      </span>
      <span className={onBrand ? 'text-white/60' : 'text-muted'}>vs mes ant.</span>
    </span>
  )
}

function StatCard({
  label, value, delta, invert, icon: Icon, tone = 'neutral', sub, href, delay,
}: {
  label: string
  value: React.ReactNode
  delta?: number | null
  invert?: boolean
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'income' | 'expense' | 'primary' | 'warning'
  sub?: React.ReactNode
  href?: string
  delay?: number
}) {
  const iconTone: Record<string, string> = {
    neutral: 'bg-surface-2 text-muted', income: 'bg-income-soft text-income',
    expense: 'bg-expense-soft text-expense', primary: 'bg-primary/12 text-primary',
    warning: 'bg-unassigned-soft text-unassigned',
  }
  const body = (
    <div className="px-5 py-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{label}</div>
          <div className="mt-2.5 text-[22px] font-semibold tnum text-foreground truncate">{value}</div>
        </div>
        <div className={`h-10 w-10 rounded-xl inline-flex items-center justify-center shrink-0 ${iconTone[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-auto pt-3 text-xs text-muted">
        {delta !== undefined ? <TrendChip delta={delta} invert={invert} /> : sub}
      </div>
    </div>
  )
  return (
    <Card delay={delay} className={href ? 'hover:shadow-card-md transition-shadow' : ''}>
      {href ? <Link href={href} className="block h-full">{body}</Link> : body}
    </Card>
  )
}

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings } = useSettingsStore()
  const { transactions, currentMonth } = useTransactionStore()
  const { assets } = useAssetStore()
  const budgets = useBudgetStore((st) => st.budgets)
  const openEditModal = useUIStore((st) => st.openEditModal)
  const sinAsignarCount = useSinAsignar()

  const s = (settings ?? DEFAULT_SETTINGS) as Settings
  const base = monedaBase as Currency

  const [grouped, setGrouped] = useState<Record<string, Transaction[]>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [hoverCat, setHoverCat] = useState<number | null>(null)

  // Historial de 6 meses (con cancelación para que un cambio rápido de mes
  // no pise los datos con una respuesta vieja)
  useEffect(() => {
    let cancel = false
    fetchLastNMonths(6, currentMonth).then((g) => {
      if (cancel) return
      setGrouped(g)
      setLoadedFor(currentMonth)
    })
    return () => { cancel = true }
  }, [currentMonth])

  const history: MonthAgg[] = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(currentMonth, -i))
    return months.map((m) => {
      const txs = m === currentMonth ? transactions : (grouped[m] ?? [])
      const ing = txs.filter((t) => t.tipo === 'ingreso').reduce((sum, t) => sum + txToBase(t, base, s), 0)
      const egr = txs.filter((t) => t.tipo === 'egreso').reduce((sum, t) => sum + txToBase(t, base, s), 0)
      return { month: m, ingresos: ing, egresos: egr, balance: ing - egr }
    })
  }, [grouped, transactions, currentMonth, base, s])

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso')
  const egresos = transactions.filter((t) => t.tipo === 'egreso')
  const totalIngresos = ingresos.reduce((sum, t) => sum + txToBase(t, base, s), 0)
  const totalEgresos = egresos.reduce((sum, t) => sum + txToBase(t, base, s), 0)
  const balance = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s, currentMonth)
  const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos) * 100 : 0
  const pctGastado = totalIngresos > 0 ? Math.min((totalEgresos / totalIngresos) * 100, 100) : 0

  const activos = assets.filter((a) => a.clase === 'activo').reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const pasivos = assets.filter((a) => a.clase === 'pasivo').reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const patrimonioUSD = activos - pasivos

  const ready = loadedFor === currentMonth
  const prev = ready ? history[history.length - 2] : null
  const dIng = prev ? pctDelta(totalIngresos, prev.ingresos) : undefined
  const dEgr = prev ? pctDelta(totalEgresos, prev.egresos) : undefined
  const dBal = prev ? pctDelta(balance, prev.balance) : undefined

  const sinAsignarTotal = useMemo(() => {
    const ids = new Set(ingresos.map((i) => i.id))
    return egresos
      .filter((e) => !e.asignaciones.some((a) => ids.has(a.ingresoId)))
      .reduce((sum, t) => sum + txToBase(t, base, s), 0)
  }, [ingresos, egresos, base, s])

  const recientes = [...transactions]
    .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
    .slice(0, 8)

  // Top categorías por grupo de gasto
  const porGrupo = new Map<string, number>()
  for (const t of egresos) {
    const id = getParentGroup(t.categoria, s.categoriasGasto)?.id ?? t.categoria
    porGrupo.set(id, (porGrupo.get(id) ?? 0) + txToBase(t, base, s))
  }
  const categorias = [...porGrupo.entries()]
    .map(([id, total]) => {
      const cat = getCatFromSettings(id, s)
      return { id, cat, nombre: cat?.nombre ?? id, color: cat?.color ?? '#94a3b8', total, pct: totalEgresos > 0 ? (total / totalEgresos) * 100 : 0 }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const insights = ready
    ? computeInsights({
        transactions, prevTransactions: grouped[shiftMonth(currentMonth, -1)] ?? [],
        budgets, settings: s, base, month: currentMonth,
      })
    : []

  // Presupuestos del mes con su avance
  const presupuestos = budgets
    .filter((b) => b.mes === currentMonth && b.limite > 0)
    .map((b) => {
      const gastado = egresos
        .filter((t) => t.categoria === b.categoria || getParentGroup(t.categoria, s.categoriasGasto)?.id === b.categoria)
        .reduce((sum, t) => sum + txToBase(t, base, s), 0)
      const enMoneda = toBase(gastado, base, b.moneda as Currency, s, b.mes)
      return { b, cat: getCatFromSettings(b.categoria, s), gastado: enMoneda, pct: (enMoneda / b.limite) * 100 }
    })
    .sort((a, b) => b.pct - a.pct)

  return (
    <PageScroll className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Hero: balance del mes ── */}
        <motion.section
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative xl:col-span-2 rounded-[26px] bg-brand text-white shadow-card-lg overflow-hidden"
        >
          <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 left-1/3 w-80 h-80 rounded-full bg-[#22d3ee]/20 blur-3xl pointer-events-none" />
          <div className="relative p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">
                Balance de {monthLabel(currentMonth).split(' de ')[0]}
              </div>
              <div className="mt-2 text-[44px] leading-none font-bold tracking-tight">
                <MoneyText amount={balance} currency={base} animated />
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/75">
                <span>≈ <MoneyText amount={balanceUSD} currency="USD" animated /></span>
                <TrendChip delta={dBal} onBrand />
              </div>
              <div className="mt-5 flex items-center gap-3 max-w-md">
                <div className="flex-1 h-2 rounded-full bg-white/15 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: pctGastado >= 90 ? '#fda4af' : pctGastado >= 70 ? '#fcd34d' : '#6ee7b7' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pctGastado}%` }}
                    transition={{ type: 'spring', stiffness: 110, damping: 22 }}
                  />
                </div>
                <span className="text-xs font-semibold text-white/85 whitespace-nowrap">
                  {totalIngresos > 0 ? `${Math.round(pctGastado)}% del ingreso gastado` : 'Sin ingresos este mes'}
                </span>
              </div>
            </div>
            <div className="lg:w-[300px] shrink-0">
              <div className="text-xs text-white/70 mb-1.5">Balance · últimos 6 meses</div>
              {ready
                ? <Sparkline values={history.map((h) => h.balance)} color="#ffffff" width={300} height={80} strokeWidth={2.2} className="w-full h-auto" />
                : <div className="h-20 rounded-xl bg-white/10 animate-pulse" />}
              <div className="flex justify-between text-[10px] text-white/55 mt-1 capitalize">
                {history.map((h) => <span key={h.month}>{monthLabel(h.month).slice(0, 3)}</span>)}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Tasa de ahorro ── */}
        <Card delay={0.05} className="p-5 flex flex-col">
          <div className="flex items-start justify-between">
            <div className="eyebrow">Tasa de ahorro</div>
            <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center">
              <PiggyBank className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-1 text-[40px] leading-none font-bold tnum text-foreground">
            {Math.round(tasaAhorro)}<span className="text-xl text-muted">%</span>
          </div>
          <ProgressBar
            value={Math.max(0, tasaAhorro)}
            color="linear-gradient(90deg, var(--primary-2), var(--primary))"
            height={8}
            className="mt-4"
          />
          <div className="mt-auto pt-4 text-xs text-muted">
            <MoneyText amount={balance} currency={base} /> ahorrado de <MoneyText amount={totalIngresos} currency={base} />
          </div>
        </Card>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard delay={0.08} label="Ingresos" icon={TrendingUp} tone="income"
          value={<MoneyText amount={totalIngresos} currency={base} animated />} delta={dIng} />
        <StatCard delay={0.11} label="Egresos" icon={TrendingDown} tone="expense"
          value={<MoneyText amount={totalEgresos} currency={base} animated />} delta={dEgr} invert />
        <StatCard delay={0.14} label="Sin asignar" icon={Link2} tone="warning" href="/asignaciones"
          value={<MoneyText amount={sinAsignarTotal} currency={base} animated />}
          sub={<span className="inline-flex items-center gap-1">{sinAsignarCount} egreso{sinAsignarCount !== 1 ? 's' : ''} · asignar <ArrowRight className="h-3 w-3" /></span>} />
        <StatCard delay={0.17} label="Patrimonio neto" icon={Wallet} tone="neutral" href="/cuentas"
          value={<MoneyText amount={patrimonioUSD} currency="USD" animated />}
          sub={<>Activos <MoneyText amount={activos} currency="USD" /> · Pasivos <MoneyText amount={pasivos} currency="USD" /></>} />
      </div>

      {/* ── Insights + presupuestos ── */}
      {(insights.length > 0 || presupuestos.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {insights.length > 0 && (
            <Card delay={0.2} className={`p-5 ${presupuestos.length > 0 ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
              <div className="eyebrow mb-4 inline-flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Lo más importante</div>
              <InsightsList insights={insights} base={base} columns={presupuestos.length > 0 ? 1 : 2} />
            </Card>
          )}
          {presupuestos.length > 0 && (
            <Card delay={0.23} className={`p-5 ${insights.length > 0 ? '' : 'xl:col-span-3'}`}>
              <div className="eyebrow mb-4">Presupuestos del mes</div>
              <div className="space-y-3.5">
                {presupuestos.map(({ b, cat, gastado, pct }) => {
                  const color = pct >= 100 ? 'var(--expense)' : pct >= 80 ? 'var(--unassigned)' : 'var(--income)'
                  return (
                    <div key={b.id ?? b.categoria}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="flex items-center gap-2 font-medium text-foreground min-w-0">
                          <span className="h-6 w-6 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: (cat?.color ?? '#94a3b8') + '22', color: cat?.color ?? '#94a3b8' }}>
                            <CategoryIcon cat={cat ?? { id: b.categoria }} size={13} />
                          </span>
                          <span className="truncate">{cat?.nombre ?? b.categoria}</span>
                        </span>
                        <span className="text-xs font-semibold tnum" style={{ color }}>{Math.round(pct)}%</span>
                      </div>
                      <ProgressBar value={pct} color={color} height={6} />
                      <div className="text-[11px] text-muted mt-1 tnum">
                        <MoneyText amount={gastado} currency={b.moneda} /> de <MoneyText amount={b.limite} currency={b.moneda} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Recientes + categorías ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card delay={0.26} className="xl:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Movimientos recientes</div>
              <div className="text-xs text-muted mt-0.5">Últimos {recientes.length} del mes · clic para editar</div>
            </div>
            <Link href="/movimientos" className="text-xs text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-primary/10 transition-colors">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recientes.length === 0 ? (
            <p className="px-6 py-12 text-center text-muted text-sm">No hay movimientos en este mes.</p>
          ) : (
            <div className="px-2 pb-2">
              {recientes.map((t, i) => <RecentRow key={t.id} t={t} settings={s} index={i} onClick={() => openEditModal(t)} />)}
            </div>
          )}
        </Card>

        <Card delay={0.29} className="p-5">
          <div className="text-sm font-semibold text-foreground">Top categorías</div>
          <div className="text-xs text-muted mt-0.5">Egresos por grupo · pasá el mouse</div>
          {categorias.length === 0 ? (
            <p className="text-sm text-muted py-10 text-center">Sin egresos cargados.</p>
          ) : (
            <>
              <div className="flex justify-center my-5">
                <Donut
                  size={190} thickness={24}
                  data={categorias.map((c) => ({ label: c.nombre, value: c.total, color: c.color }))}
                  centerLabel="Egresos"
                  currency={base}
                  highlight={hoverCat}
                  onHighlight={setHoverCat}
                />
              </div>
              <div className="space-y-1">
                {categorias.map((c, i) => (
                  <div
                    key={c.id}
                    onMouseEnter={() => setHoverCat(i)}
                    onMouseLeave={() => setHoverCat(null)}
                    className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-xs transition-colors ${hoverCat === i ? 'bg-surface-2' : ''}`}
                  >
                    <span className="flex items-center gap-2 text-foreground font-medium truncate">
                      <span className="h-6 w-6 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: c.color + '22', color: c.color }}>
                        <CategoryIcon cat={c.cat ?? { id: c.id }} size={12} />
                      </span>
                      <span className="truncate">{c.nombre}</span>
                    </span>
                    <span className="text-muted tnum shrink-0 ml-2 font-semibold">{c.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </PageScroll>
  )
}

function RecentRow({ t, settings, index, onClick }: { t: Transaction; settings: Settings; index: number; onClick: () => void }) {
  const cat = getCatFromSettings(t.categoria, settings)
  const fechaStr = t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  const ingreso = t.tipo === 'ingreso'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.03 }}
      className="w-full grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
    >
      <span className="h-9 w-9 rounded-xl inline-flex items-center justify-center" style={{ background: (cat?.color ?? '#94a3b8') + '1f', color: cat?.color ?? '#94a3b8' }}>
        <CategoryIcon cat={cat ?? { id: t.categoria }} size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-foreground font-medium truncate">{txLabel(t, settings)}</span>
        <span className="block text-xs text-muted truncate">
          {cat?.nombre ?? '—'}
          {!t.ejecutado && <span className="ml-2 text-[10px] uppercase tracking-wide text-unassigned font-semibold">Pendiente</span>}
        </span>
      </span>
      <span className="text-xs text-muted tnum">{fechaStr}</span>
      <span className={`text-sm font-semibold tnum text-right min-w-[110px] ${ingreso ? 'text-income' : 'text-expense'}`}>
        {ingreso ? '+' : '−'}<MoneyText amount={t.monto} currency={t.moneda} />
      </span>
    </motion.button>
  )
}
