'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { formatAmount } from '@finanzas/core/lib/constants'

/** Interpola un número hacia su nuevo valor (count-up) */
export function useAnimatedNumber(value: number, duration = 0.7): number {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (reduce) {
      fromRef.current = value
      // Sin animación: se muestra el valor final directo
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

interface MoneyProps {
  value: number
  currency: string
  className?: string
  /** Anima el número al cambiar (default true) */
  animated?: boolean
  /** Antepone el signo "+" a los positivos */
  signed?: boolean
  /** Ignora el modo privacidad (para montos que no son sensibles) */
  alwaysVisible?: boolean
}

/**
 * Monto formateado que respeta el modo privacidad global (blur) y anima los
 * cambios de valor. Unifica el `${hideAmounts ? 'blur-sm' : ''}` repetido.
 */
export function Money({ value, currency, className = '', animated = true, signed = false, alwaysVisible = false }: MoneyProps) {
  const hideAmounts = useSettingsStore((s) => s.hideAmounts)
  const shown = useAnimatedNumber(value)
  // Durante la interpolación se redondea a enteros para que los decimales no
  // "parpadeen"; al llegar al destino se muestra el valor exacto.
  const v = !animated || Math.abs(shown - value) < 0.005 ? value : Math.round(shown)
  const hidden = hideAmounts && !alwaysVisible
  return (
    <span
      className={`tabular-nums transition-[filter] duration-300 ${hidden ? 'blur-[6px] select-none' : ''} ${className}`}
      aria-hidden={hidden || undefined}
    >
      {signed && value > 0 ? '+' : ''}{formatAmount(v, currency)}
    </span>
  )
}
