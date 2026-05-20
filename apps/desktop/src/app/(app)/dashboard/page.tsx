'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, ArrowRight, ArrowUpRight, ArrowDownRight, ChevronRight, ChevronLeft, Link2 } from 'lucide-react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoneyText } from '@/components/MoneyText'
import { Donut } from '@/components/charts/Donut'
import { toBase } from '@finanzas/core/lib/currency'
import {
  formatAmount,
  getCatFromSettings,
  getTopGroup,
  monthLabel,
  shiftMonth,
  CHART_PALETTE,
} from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { fetchLastNMonths } from '@finanzas/core/lib/analytics'
import { Currency, Transaction, Settings } from '@finanzas/core/types'

interface MonthAgg { month: string; ingresos: number; egresos: number; balance: number }

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function TrendChip({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta === null) return <span className="text-xs text-muted-2">—</span>
  const positive = delta >= 0
  const good = invert ? !positive : positive
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${good ? 'text-income' : 'text-expense'}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(0)}%
      <span className="font-normal text-muted ml-0.5">vs ant.</span>
    </span>
  )
}

function TLedgerRow({ t, settings, asignadoLabel }: { t: Transaction; settings: Settings; asignadoLabel?: string }) {
  const cat = getCatFromSettings(t.categoria, settings)
  const fechaStr = t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  const done = t.ejecutado
  const showDesc = t.descripcion && t.descripcion.trim() !== (cat?.nombre ?? '').trim()
  return (
    <div className="px-3 py-1.5 hover:bg-surface-2/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {cat?.color && (
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
            )}
            <span className={`text-xs font-medium truncate ${done ? 'line-through text-muted' : 'text-foreground'}`}>
              {cat?.nombre ?? '—'}
            </span>
            {showDesc && (
              <span className={`text-[11px] truncate ${done ? 'line-through text-muted-2' : 'text-muted'}`}>
                · {t.descripcion}
              </span>
            )}
          </div>
          {asignadoLabel && (
            <div className="mt-1 pl-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-income bg-income/10 rounded px-1.5 py-0.5 max-w-full">
                <Link2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{asignadoLabel}</span>
              </span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xs font-semibold tnum ${done ? 'line-through opacity-70' : ''} ${t.tipo === 'ingreso' ? 'text-income' : 'text-expense'}`}>
            <MoneyText amount={t.monto} currency={t.moneda} />
          </div>
          <div className="text-[10px] text-muted">{fechaStr}</div>
        </div>
      </div>
    </div>
  )
}

type CatTab = 'egresos' | 'ingresos'

function TopCategorias({
  transactions, settings, base,
}: {
  transactions: Transaction[]
  settings: Settings
  base: Currency
}) {
  const [tab, setTab] = useState<CatTab>('egresos')
  const [drill, setDrill] = useState<string | null>(null)

  const { grupos, total } = useMemo(() => {
    const target = transactions.filter((t) => t.tipo === (tab === 'egresos' ? 'egreso' : 'ingreso'))
    const totalAmt = target.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

    type SubMap = Map<string, { nombre: string; color: string; total: number }>
    type GrpMap = Map<string, { nombre: string; total: number; subs: SubMap }>
    const porGrupo: GrpMap = new Map()

    for (const t of target) {
      const topGroup = getTopGroup(t.categoria, settings)
      const gid = topGroup?.id ?? t.categoria
      const gnombre = topGroup?.nombre ?? t.categoria

      if (!porGrupo.has(gid)) porGrupo.set(gid, { nombre: gnombre, total: 0, subs: new Map() })
      const g = porGrupo.get(gid)!
      const amt = toBase(t.monto, t.moneda, base, settings)
      g.total += amt

      const cat = getCatFromSettings(t.categoria, settings)
      if (!g.subs.has(t.categoria)) {
        g.subs.set(t.categoria, { nombre: cat?.nombre ?? t.categoria, color: cat?.color ?? '#94a3b8', total: 0 })
      }
      g.subs.get(t.categoria)!.total += amt
    }

    const gruposArr = [...porGrupo.entries()]
      .map(([id, g]) => ({
        id,
        nombre: g.nombre,
        total: g.total,
        subs: [...g.subs.entries()]
          .map(([sid, s]) => ({ id: sid, ...s }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((g, i) => ({ ...g, chartColor: CHART_PALETTE[i % CHART_PALETTE.length] }))

    return { grupos: gruposArr, total: totalAmt }
  }, [transactions, tab, settings, base])

  const activeGroup = drill ? grupos.find((g) => g.id === drill) ?? null : null

  const items = activeGroup
    ? activeGroup.subs.map((s, i) => ({
        id: s.id, nombre: s.nombre, total: s.total,
        color: CHART_PALETTE[i % CHART_PALETTE.length], hasChildren: false,
      }))
    : grupos.map((g) => ({
        id: g.id, nombre: g.nombre, total: g.total,
        color: g.chartColor, hasChildren: g.subs.length > 1,
      }))

  const denom = activeGroup ? activeGroup.total : total

  return (
    <Card>
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-2">
        <div className="text-sm font-semibold flex items-center gap-1 min-w-0">
          {activeGroup && (
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="text-muted hover:text-foreground shrink-0 -ml-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="truncate">{activeGroup ? activeGroup.nombre : 'Top categorías'}</span>
        </div>
        <div className="inline-flex p-0.5 rounded bg-surface-2 border border-border shrink-0">
          {(['egresos', 'ingresos'] as CatTab[]).map((c) => (
            <button
              key={c}
              onClick={() => { setTab(c); setDrill(null) }}
              className={`px-2.5 h-6 text-[11px] font-medium rounded transition-colors ${
                tab === c ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <CardContent className="pt-4">
        {grupos.length === 0 ? (
          <p className="text-xs text-muted py-6 text-center">Sin datos.</p>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <Donut
                size={160}
                thickness={22}
                data={items.map((it) => ({ label: it.nombre, value: it.total, color: it.color }))}
                centerLabel={activeGroup ? activeGroup.nombre : tab}
                centerValue={formatAmount(denom, base)}
                onSliceClick={activeGroup ? undefined : (i) => {
                  if (grupos[i]?.subs.length > 1) setDrill(grupos[i].id)
                }}
              />
            </div>
            <div className="space-y-0.5">
              {items.map((it) => {
                const Row = it.hasChildren ? 'button' : 'div'
                return (
                  <Row
                    key={it.id}
                    {...(it.hasChildren ? { type: 'button' as const, onClick: () => setDrill(it.id) } : {})}
                    className={`w-full flex items-center justify-between text-xs py-1.5 px-1 rounded transition-colors ${
                      it.hasChildren ? 'hover:bg-surface-2/60 cursor-pointer' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 text-foreground font-medium truncate min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: it.color }} />
                      <span className="truncate">{it.nombre}</span>
                      {it.hasChildren && <ChevronRight className="h-3 w-3 text-muted-2 shrink-0" />}
                    </span>
                    <span className="text-muted tnum shrink-0 ml-2">
                      {denom > 0 ? ((it.total / denom) * 100).toFixed(0) : 0}%
                    </span>
                  </Row>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings } = useSettingsStore()
  const { transactions, currentMonth } = useTransactionStore()

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

  const prev = history.length >= 2 ? history[history.length - 2] : null
  const dIng = prev ? pctDelta(totalIngresos, prev.ingresos) : null
  const dEgr = prev ? pctDelta(totalEgresos, prev.egresos) : null
  const dBal = prev ? pctDelta(balance, prev.balance) : null

  const ingresosSort = [...ingresos].sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
  const egresosSort = [...egresos].sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())

  const ingresoLabelById = new Map<string, string>(
    ingresos.map((t) => [t.id ?? '', getCatFromSettings(t.categoria, s)?.nombre ?? t.descripcion ?? 'Ingreso']),
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Resumen <span className="text-muted font-normal capitalize">· {monthLabel(currentMonth)}</span>
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <Badge tone="neutral">USD/ARS · {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}</Badge>
          <Badge tone="neutral">USD/COP · {s.tipoCambio.COP_USD.toLocaleString('es-AR')}</Badge>
        </div>
      </div>

      {/* Compact stats — balance, ingresos, egresos */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-4 py-2.5">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wide">Balance</div>
            <div className="mt-1 text-xl font-bold tnum text-foreground leading-none">
              <MoneyText amount={balance} currency={base} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
              <MoneyText amount={balanceUSD} currency="USD" />
              <span className="text-border">·</span>
              <span>{tasaAhorro.toFixed(0)}% ahorro</span>
              <TrendChip delta={dBal} />
            </div>
          </div>

          <div className="px-4 py-2.5 bg-income/[0.03]">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-income" />
              <div className="text-[11px] font-medium text-muted uppercase tracking-wide">Ingresos</div>
            </div>
            <div className="mt-1 text-xl font-semibold tnum text-income leading-none">
              <MoneyText amount={totalIngresos} currency={base} />
            </div>
            <div className="mt-1.5">
              <TrendChip delta={dIng} />
            </div>
          </div>

          <div className="px-4 py-2.5 bg-expense/[0.03]">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-expense" />
              <div className="text-[11px] font-medium text-muted uppercase tracking-wide">Egresos</div>
            </div>
            <div className="mt-1 text-xl font-semibold tnum text-expense leading-none">
              <MoneyText amount={totalEgresos} currency={base} />
            </div>
            <div className="mt-1.5">
              <TrendChip delta={dEgr} invert />
            </div>
          </div>
        </div>
      </Card>

      {/* Main: cuentas T + top categorías */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Cuentas T */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold text-foreground">Movimientos del mes</div>
            <Link
              href="/movimientos"
              className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border min-h-0">
            {/* Ingresos */}
            <div className="min-w-0">
              <div className="px-3 py-2 border-b border-border bg-income/[0.03]">
                <div className="text-[11px] font-semibold text-income uppercase tracking-wide">
                  Ingresos · {ingresos.length}
                </div>
              </div>
              <div className="overflow-y-auto max-h-72 divide-y divide-border/60">
                {ingresos.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-muted">Sin ingresos</div>
                ) : ingresosSort.map((t) => (
                  <TLedgerRow key={t.id} t={t} settings={s} />
                ))}
              </div>
            </div>
            {/* Egresos */}
            <div className="min-w-0">
              <div className="px-3 py-2 border-b border-border bg-expense/[0.03]">
                <div className="text-[11px] font-semibold text-expense uppercase tracking-wide">
                  Egresos · {egresos.length}
                </div>
              </div>
              <div className="overflow-y-auto max-h-72 divide-y divide-border/60">
                {egresos.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-muted">Sin egresos</div>
                ) : egresosSort.map((t) => (
                  <TLedgerRow
                    key={t.id}
                    t={t}
                    settings={s}
                    asignadoLabel={t.asignadoA ? ingresoLabelById.get(t.asignadoA) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Top categorías */}
        <TopCategorias transactions={transactions} settings={s} base={base} />
      </div>
    </div>
  )
}
