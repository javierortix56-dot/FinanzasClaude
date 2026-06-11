'use client'

import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { formatAmount } from '@finanzas/core/lib/constants'

interface Props {
  amount: number
  currency: string
  className?: string
  prefix?: string
}

/**
 * Único punto de salida para montos en la UI: respeta el modo incógnito
 * (hideAmounts) aplicando blur. Usar SIEMPRE este componente en lugar de
 * formatAmount directo para no filtrar cifras con el modo privado activo.
 */
export default function Amount({ amount, currency, className = '', prefix = '' }: Props) {
  const hideAmounts = useSettingsStore((s) => s.hideAmounts)
  return (
    <span className={`${hideAmounts ? 'blur-sm select-none' : ''} ${className}`.trim()}>
      {prefix}{formatAmount(amount, currency)}
    </span>
  )
}
