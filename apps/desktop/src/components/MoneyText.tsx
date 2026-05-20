'use client'

import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { formatAmount } from '@finanzas/core/lib/constants'
import { cn } from '@finanzas/core/lib/utils'

interface MoneyProps {
  amount: number
  currency: string
  className?: string
}

export function MoneyText({ amount, currency, className }: MoneyProps) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={cn(hide && 'blur-amount', className)}>
      {formatAmount(amount, currency)}
    </span>
  )
}

interface PercentProps {
  value: number
  decimals?: number
  className?: string
}

export function PercentText({ value, decimals = 0, className }: PercentProps) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={cn(hide && 'blur-amount', className)}>
      {value.toFixed(decimals)}%
    </span>
  )
}

/** Envuelve cualquier contenido sensible para que se oculte con el modo incógnito. */
export function Sensitive({ children, className }: { children: React.ReactNode; className?: string }) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return <span className={cn(hide && 'blur-amount', className)}>{children}</span>
}
