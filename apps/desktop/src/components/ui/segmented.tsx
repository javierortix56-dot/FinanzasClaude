'use client'

import { motion } from 'motion/react'
import { cn } from '@finanzas/core/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Color del indicador cuando la opción está activa (texto en blanco) */
  activeColor?: string
}

/**
 * Control segmentado con indicador que se desliza entre opciones (layoutId).
 * Unifica los tabs y grupos de botones que había en cada vista.
 */
export function Segmented<T extends string>({
  options, value, onChange, id, size = 'md', className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Identificador único por instancia (para el layoutId) */
  id: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div role="tablist" className={cn('relative inline-flex gap-0.5 rounded-xl bg-surface-2 p-[3px]', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative flex-1 rounded-[9px] font-semibold whitespace-nowrap transition-colors',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[13px]',
              active ? (o.activeColor ? 'text-white' : 'text-foreground') : 'text-muted hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={cn('absolute inset-0 rounded-[9px]', !o.activeColor && 'bg-surface shadow-card')}
                style={o.activeColor ? { background: o.activeColor } : undefined}
              />
            )}
            <span className="relative z-[1] inline-flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
