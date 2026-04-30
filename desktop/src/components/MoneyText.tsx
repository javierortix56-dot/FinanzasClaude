'use client'

import { useSettingsStore } from '@/store/useSettingsStore'
import { formatAmount } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  amount: number
  currency: string
  className?: string
}

export function MoneyText({ amount, currency, className }: Props) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={cn(hide && 'blur-amount', className)}>
      {formatAmount(amount, currency)}
    </span>
  )
}
