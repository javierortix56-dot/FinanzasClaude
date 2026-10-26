'use client'

import { motion } from 'motion/react'
import { spring } from './motion'
import { haptic } from '@/lib/haptics'

export interface SegmentOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Color de fondo del indicador cuando esta opción está activa (CSS color) */
  activeColor?: string
}

interface Props<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Identificador único por instancia: el indicador se anima con layoutId */
  id: string
  size?: 'sm' | 'md' | 'lg'
  /** 'solid' = indicador de color con texto blanco · 'glass' = indicador claro */
  variant?: 'solid' | 'glass'
  className?: string
  vertical?: boolean
}

const SIZES = {
  sm: 'h-8 text-[11px]',
  md: 'h-9 text-xs',
  lg: 'h-11 text-sm',
}

/**
 * Control segmentado con indicador que se desliza entre opciones
 * (shared layout animation). Reemplaza los tabs con borde inferior y los
 * grupos de botones toggle que había dispersos por la app.
 */
export default function Segmented<T extends string>({
  options, value, onChange, id, size = 'md', variant = 'glass', className = '', vertical = false,
}: Props<T>) {
  return (
    <div
      role="tablist"
      className={`relative flex ${vertical ? 'flex-col' : ''} gap-0.5 p-[3px] rounded-[14px] bg-gray-500/[0.08] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value
        const solid = variant === 'solid' || !!opt.activeColor
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active) haptic('light'); onChange(opt.value) }}
            className={`relative flex-1 ${vertical ? 'px-3' : 'px-2'} ${SIZES[size]} rounded-[11px] font-semibold whitespace-nowrap transition-colors duration-200 ${
              active
                ? solid ? 'text-white' : 'text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className={`absolute inset-0 rounded-[11px] ${
                  solid ? 'shadow-md' : 'bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_-4px_rgba(0,0,0,0.12)]'
                }`}
                style={solid ? { background: opt.activeColor ?? 'var(--primary)' } : undefined}
              />
            )}
            <span className="relative z-[1] inline-flex items-center justify-center gap-1">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
