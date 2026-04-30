'use client'

import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, ArrowRight, CircleDollarSign } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useAssetStore } from '@/store/useAssetStore'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoneyText } from '@/components/MoneyText'
import { toBase } from '@/lib/currency'
import { formatAmount, getCatFromSettings, monthLabel } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Currency, Transaction } from '@/types'

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'income' | 'expense' | 'primary'
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'bg-surface-2 text-foreground',
    income:  'bg-income-soft text-income',
    expense: 'bg-expense-soft text-expense',
    primary: 'bg-primary/10 text-primary',
  }
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground truncate">
              {value}
            </div>
            {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
          </div>
          <div className={`h-10 w-10 rounded-lg inline-flex items-center justify-center ${toneClasses[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
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

  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso')
  const egresos  = transactions.filter((t) => t.tipo === 'egreso')

  const totalIngresos = ingresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
  const totalEgresos  = egresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)
  const balance = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s)

  const activos  = assets.filter((a) => a.clase === 'activo')
                          .reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const pasivos  = assets.filter((a) => a.clase === 'pasivo')
                          .reduce((sum, a) => sum + toBase(a.saldo, a.moneda, 'USD', s), 0)
  const patrimonioUSD = activos - pasivos

  const recientes = [...transactions]
    .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
    .slice(0, 8)

  // Distribución por categoría (egresos)
  const porCategoria = new Map<string, number>()
  for (const t of egresos) {
    const usd = toBase(t.monto, t.moneda, base, s)
    porCategoria.set(t.categoria, (porCategoria.get(t.categoria) ?? 0) + usd)
  }
  const categorias = [...porCategoria.entries()]
    .map(([id, total]) => {
      const cat = getCatFromSettings(id, s)
      return {
        id,
        nombre: cat?.nombre ?? id,
        color: cat?.color ?? '#94a3b8',
        total,
        pct: totalEgresos > 0 ? (total / totalEgresos) * 100 : 0,
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos) * 100 : 0

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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Balance"
          icon={CircleDollarSign}
          tone="primary"
          value={<MoneyText amount={balance} currency={base} />}
          hint={<MoneyText amount={balanceUSD} currency="USD" />}
        />
        <StatCard
          label="Ingresos"
          icon={TrendingUp}
          tone="income"
          value={<MoneyText amount={totalIngresos} currency={base} />}
          hint={`${ingresos.length} movimientos`}
        />
        <StatCard
          label="Egresos"
          icon={TrendingDown}
          tone="expense"
          value={<MoneyText amount={totalEgresos} currency={base} />}
          hint={`${egresos.length} movimientos · tasa de ahorro ${tasaAhorro.toFixed(0)}%`}
        />
        <StatCard
          label="Patrimonio neto"
          icon={Wallet}
          tone="neutral"
          value={<MoneyText amount={patrimonioUSD} currency="USD" />}
          hint={`Activos ${formatAmount(activos, 'USD')} · Pasivos ${formatAmount(pasivos, 'USD')}`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Movimientos recientes</div>
              <div className="text-xs text-muted mt-0.5">Últimos 8 del mes</div>
            </div>
            <Link
              href="/movimientos"
              className="text-xs text-primary hover:text-primary-hover font-medium inline-flex items-center gap-1"
            >
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
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted text-sm">
                      No hay movimientos en este mes.
                    </td>
                  </tr>
                ) : recientes.map((t) => (
                  <RecentRow key={t.id} t={t} settings={s} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="px-6 pt-5 pb-3">
            <div className="text-sm font-semibold text-foreground">Top categorías</div>
            <div className="text-xs text-muted mt-0.5">Distribución de egresos</div>
          </div>
          <CardContent className="space-y-3">
            {categorias.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Sin egresos cargados.</p>
            ) : categorias.map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 text-foreground font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    {c.nombre}
                  </span>
                  <span className="text-muted tabular-nums">{c.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: c.color }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RecentRow({ t, settings }: { t: Transaction; settings: typeof DEFAULT_SETTINGS }) {
  const cat = getCatFromSettings(t.categoria, settings)
  const date = t.fecha.toDate()
  const fechaStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
      <td className="px-6 py-3">
        <div className="text-sm text-foreground font-medium truncate max-w-[280px]">
          {t.descripcion || '(sin descripción)'}
        </div>
        {!t.ejecutado && (
          <span className="text-[10px] uppercase tracking-wide text-unassigned font-semibold">
            Pendiente
          </span>
        )}
      </td>
      <td className="px-6 py-3">
        <span className="inline-flex items-center gap-2 text-xs text-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: cat?.color ?? '#94a3b8' }}
          />
          {cat?.nombre ?? '—'}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-muted">{fechaStr}</td>
      <td className="px-6 py-3 text-right">
        <span
          className={`text-sm font-semibold tabular-nums ${
            t.tipo === 'ingreso' ? 'text-income' : 'text-expense'
          }`}
        >
          {t.tipo === 'ingreso' ? '+' : '−'}
          <MoneyText amount={t.monto} currency={t.moneda} />
        </span>
      </td>
    </tr>
  )
}
