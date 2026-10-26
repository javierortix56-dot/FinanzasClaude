'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
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

  // Huérfanos (asignados a un ingreso que ya no existe) cuentan como sin asignar,
  // igual que el badge de la barra lateral.
  const ingresoIds = new Set(ingresos.map((t) => t.id))
  const sinAsignarList = egresos.filter((t) => !t.asignaciones.some((a) => ingresoIds.has(a.ingresoId)))
  const sinAsignar = sinAsignarList.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

  const share = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) : 0

  return (
    <div className="grid grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr] gap-2.5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden flex flex-col gap-[3px] rounded-2xl bg-brand text-white px-4 py-3 shadow-card-md"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
          Balance de {shortMonth(currentMonth)}
        </div>
        <div className="text-[25px] font-bold leading-[1.1] tracking-[-0.025em] tnum">
          <MoneyText amount={balance} currency={base} animated />
        </div>
        <div className="text-[11.5px] tnum text-white/70">
          ≈ <MoneyText amount={balanceUSD} currency="USD" />
        </div>
      </motion.div>

      <StatCard
        delay={0.04}
        label="Ingresos"
        tone="income"
        value={<MoneyText amount={totalIn} currency={base} animated />}
        sub={`${ingresos.length} ${ingresos.length === 1 ? 'movimiento' : 'movimientos'}`}
      />
      <StatCard
        delay={0.08}
        label="Egresos"
        tone="expense"
        value={<MoneyText amount={totalOut} currency={base} animated />}
        sub={totalIn > 0 ? `${share}% del ingreso` : `${egresos.length} movimientos`}
        progress={totalIn > 0 ? share : undefined}
      />
      <StatCard
        delay={0.12}
        label="Sin asignar"
        tone="unassigned"
        value={<MoneyText amount={sinAsignar} currency={base} animated />}
        sub={`${sinAsignarList.length} ${sinAsignarList.length === 1 ? 'egreso' : 'egresos'} sin asignar`}
      />
    </div>
  )
}

const toneStyles = {
  income: { text: 'text-income', dot: 'bg-income', bar: 'var(--income)' },
  expense: { text: 'text-expense', dot: 'bg-expense', bar: 'var(--expense)' },
  unassigned: { text: 'text-unassigned', dot: 'bg-unassigned', bar: 'var(--unassigned)' },
} as const

function StatCard({
  label,
  value,
  sub,
  tone,
  delay,
  progress,
}: {
  label: string
  value: React.ReactNode
  sub: string
  tone: keyof typeof toneStyles
  delay?: number
  /** 0–100: barra fina bajo el monto */
  progress?: number
}) {
  const t = toneStyles[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass flex flex-col gap-[3px] rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
        {label}
      </div>
      <div className={cn('text-[18px] font-bold leading-[1.15] tracking-[-0.02em] tnum', t.text)}>
        {value}
      </div>
      {progress !== undefined && (
        <div className="h-1 rounded-full bg-surface-2 overflow-hidden my-0.5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: t.bar }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
      )}
      <div className="text-[11px] tnum text-muted">{sub}</div>
    </motion.div>
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
    <div className="flex gap-[3px] rounded-xl bg-surface-2 p-[3px]">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative rounded-[9px] px-[13px] py-[5px] text-[12.5px] font-semibold transition-colors',
              active ? 'text-primary' : 'text-muted hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId="ledger-tab"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[9px] bg-surface shadow-card"
              />
            )}
            <span className="relative">{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
