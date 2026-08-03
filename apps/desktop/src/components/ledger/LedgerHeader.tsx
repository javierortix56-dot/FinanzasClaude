'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { toBase } from '@finanzas/core/lib/currency'
import { monthLabel } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { MoneyText } from '@/components/MoneyText'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Settings } from '@finanzas/core/types'

/** "julio de 2026" → "julio" */
function shortMonth(month: string): string {
  return monthLabel(month).split(' de ')[0]
}

/**
 * Fila de indicadores compartida por Movimientos y Asignaciones:
 * balance del mes + ingresos / egresos / sin asignar.
 */
export function LedgerStats() {
  const { monedaBase } = useAuthStore()
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const { transactions, currentMonth } = useTransactionStore()

  const base = monedaBase as Currency
  const ingresos = transactions.filter((t) => t.tipo === 'ingreso')
  const egresos = transactions.filter((t) => t.tipo === 'egreso')

  const totalIn = ingresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const totalOut = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const balance = totalIn - totalOut
  const balanceUSD = Math.round(toBase(balance, base, 'USD', settings))

  const sinAsignarList = egresos.filter((t) => t.asignaciones.length === 0)
  const sinAsignar = sinAsignarList.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

  const share = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) : 0

  return (
    <div className="grid grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr] gap-2.5">
      <div className="flex flex-col gap-[3px] rounded-xl border border-border bg-surface px-3.5 py-3 shadow-card">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-2">
          Balance de {shortMonth(currentMonth)}
        </div>
        <div className="text-[25px] font-semibold leading-[1.1] tracking-[-0.025em] tabular-nums text-foreground">
          <MoneyText amount={balance} currency={base} />
        </div>
        <div className="text-[11.5px] tabular-nums text-muted">
          ≈ <MoneyText amount={balanceUSD} currency="USD" />
        </div>
      </div>

      <StatCard
        label="Ingresos"
        tone="income"
        value={<MoneyText amount={totalIn} currency={base} />}
        sub={`${ingresos.length} ${ingresos.length === 1 ? 'movimiento' : 'movimientos'}`}
      />
      <StatCard
        label="Egresos"
        tone="expense"
        value={<MoneyText amount={totalOut} currency={base} />}
        sub={totalIn > 0 ? `${share}% del ingreso` : `${egresos.length} movimientos`}
      />
      <StatCard
        label="Sin asignar"
        tone="unassigned"
        value={<MoneyText amount={sinAsignar} currency={base} />}
        sub={`${sinAsignarList.length} ${sinAsignarList.length === 1 ? 'egreso' : 'egresos'} sin asignar`}
      />
    </div>
  )
}

const toneStyles = {
  income: 'bg-income-tint border-income-soft text-income',
  expense: 'bg-expense-tint border-expense-soft text-expense',
  unassigned: 'bg-unassigned-tint border-unassigned-soft text-unassigned',
} as const

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub: string
  tone: keyof typeof toneStyles
}) {
  return (
    <div className={cn('flex flex-col gap-[3px] rounded-xl border px-3.5 py-3', toneStyles[tone])}>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[18px] font-semibold leading-[1.15] tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      <div className="text-[11px] tabular-nums text-muted">{sub}</div>
    </div>
  )
}

const tabs = [
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/asignaciones', label: 'Asignación' },
]

/** Segmento Movimientos / Asignación — las dos caras del mismo mes. */
export function LedgerTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-[3px] rounded-[10px] bg-surface-2 p-[3px]">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-lg px-[13px] py-[5px] text-[12.5px] font-medium transition-colors',
              active ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}

/** Píldora de filtro usada en la barra de herramientas del libro mayor. */
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-[11px] py-[5px] text-[12.5px] font-medium transition-colors',
        active ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
