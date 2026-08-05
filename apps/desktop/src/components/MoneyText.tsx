'use client'

import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { formatMoney } from '@/lib/money'
import { toBase } from '@finanzas/core/lib/currency'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Settings } from '@finanzas/core/types'

interface Props {
  amount: number
  currency: string
  className?: string
}

export function MoneyText({ amount, currency, className }: Props) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={cn(hide && 'blur-amount', className)}>
      {formatMoney(amount, currency)}
    </span>
  )
}

/** Moneda base activa + settings, para convertir montos dentro de un componente. */
export function useBaseCurrency(): { base: Currency; settings: Settings } {
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const base = useAuthStore((s) => s.monedaBase) as Currency
  return { base, settings }
}

/**
 * Importe expresado SIEMPRE en la moneda base: si el movimiento se cargó en
 * COP o USD, acá se muestra ya convertido con los tipos de cambio de Ajustes.
 */
export function MoneyInBase({
  amount, currency, className,
}: {
  amount: number
  currency: Currency
  className?: string
}) {
  const { base, settings } = useBaseCurrency()
  return <MoneyText amount={toBase(amount, currency, base, settings)} currency={base} className={className} />
}

/**
 * Renglón secundario con el importe tal como fue cargado. Se omite cuando el
 * movimiento ya está en la moneda base (no aporta nada repetir el mismo número).
 */
export function MoneyOriginal({
  amount, currency, className,
}: {
  amount: number
  currency: Currency
  className?: string
}) {
  const { base } = useBaseCurrency()
  if (currency === base) return null
  return <MoneyText amount={amount} currency={currency} className={className} />
}
