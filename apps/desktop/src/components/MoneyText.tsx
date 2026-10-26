'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { formatAmount } from '@finanzas/core/lib/constants'
import { cn } from '@finanzas/core/lib/utils'

/** Interpola un número hacia su nuevo valor (count-up) */
export function useAnimatedNumber(value: number, duration = 0.7): number {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (reduce) {
      fromRef.current = value
      const id = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(id)
    }
    const controls = animate(fromRef.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { fromRef.current = v; setDisplay(v) },
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  return display
}

interface Props {
  amount: number
  currency: string
  className?: string
  /** Anima el número al cambiar (default false para montos de filas/tablas) */
  animated?: boolean
}

/**
 * Monto formateado que respeta el modo privacidad (blur). Con `animated`
 * hace count-up al cambiar; durante la animación redondea a enteros para
 * que los decimales no parpadeen.
 */
export function MoneyText({ amount, currency, className, animated = false }: Props) {
  const hide = useSettingsStore((s) => s.hideAmounts)
  const shown = useAnimatedNumber(amount)
  const v = !animated || Math.abs(shown - amount) < 0.005 ? amount : Math.round(shown)
  return (
    <span
      className={cn('tnum transition-[filter] duration-300', hide && 'blur-amount', className)}
      aria-hidden={hide || undefined}
    >
      {formatAmount(v, currency)}
    </span>
  )
}
