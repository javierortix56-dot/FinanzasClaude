'use client'

import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { formatAmount } from '@finanzas/core/lib/constants'

function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${abs.toFixed(0)}`
}

interface Props {
  value: number
  /** Requerida salvo en modo compact (que omite la moneda) */
  currency?: string
  /** Formato corto "12k" / "1.2M", sin moneda */
  compact?: boolean
  /** Texto pegado al monto que también debe ocultarse (p. ej. "+", "-", "≈ ") */
  prefix?: string
  className?: string
}

/**
 * Único punto de salida para montos en la app: respeta el modo incógnito
 * (hideAmounts) aplicando blur. Usar SIEMPRE este componente en vez de
 * formatAmount directo en JSX.
 */
export default function Amount({ value, currency = '', compact = false, prefix = '', className = '' }: Props) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={`${hide ? 'blur-sm select-none' : ''} ${className}`.trim()}>
      {prefix}{compact ? fmtCompact(value) : formatAmount(value, currency)}
    </span>
  )
}
