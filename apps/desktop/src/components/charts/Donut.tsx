'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MoneyText } from '@/components/MoneyText'

interface Slice {
  label: string
  value: number
  color: string
}

interface Props {
  data: Slice[]
  size?: number
  thickness?: number
  centerLabel?: string
  /** Moneda para mostrar los montos del centro (respeta el modo privacidad) */
  currency: string
  /** Índice resaltado controlado desde afuera (p. ej. hover en la leyenda) */
  highlight?: number | null
  onHighlight?: (i: number | null) => void
}

/**
 * Donut con trazo que se dibuja por segmento y resaltado al pasar el mouse.
 * El centro muestra el total o el segmento resaltado.
 */
export function Donut({ data, size = 200, thickness = 26, centerLabel = 'Total', currency, highlight, onHighlight }: Props) {
  const [hoverLocal, setHoverLocal] = useState<number | null>(null)
  const hover = highlight !== undefined ? highlight : hoverLocal
  const setHover = (i: number | null) => { setHoverLocal(i); onHighlight?.(i) }

  const total = data.reduce((s, d) => s + d.value, 0)
  const r = size / 2 - thickness / 2
  const circ = 2 * Math.PI * r
  const gap = data.length > 1 ? 2 : 0

  const portions = total > 0 ? data.map((d) => Math.max(0, (d.value / total) * circ - gap) / circ) : []
  const offsets = portions.reduce<number[]>((acc, _, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + portions[i - 1] + gap / circ]), [])
  const active = hover !== null && data[hover] ? data[hover] : null

  return (
    <div className="relative inline-block" style={{ width: size, height: size }} onMouseLeave={() => setHover(null)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => (
            <motion.circle
              key={`${d.label}-${i}`}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={d.color}
              strokeLinecap="round"
              initial={{ pathLength: 0, pathOffset: offsets[i], opacity: 1, strokeWidth: thickness }}
              animate={{
                pathLength: portions[i],
                pathOffset: offsets[i],
                opacity: hover === null || hover === i ? 1 : 0.25,
                strokeWidth: hover === i ? thickness + 6 : thickness,
              }}
              transition={{
                pathLength: { type: 'spring', stiffness: 70, damping: 18, delay: i * 0.05 },
                pathOffset: { type: 'spring', stiffness: 70, damping: 18 },
                default: { duration: 0.18 },
              }}
              onMouseEnter={() => setHover(i)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active?.label ?? '__total'}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="min-w-0 max-w-full"
          >
            <div className="text-xs text-muted truncate">{active ? active.label : centerLabel}</div>
            <div className="text-base font-semibold text-foreground truncate">
              <MoneyText amount={active ? active.value : total} currency={currency} animated={!active} />
            </div>
            {active && total > 0 && (
              <div className="text-[11px] font-semibold" style={{ color: active.color }}>
                {Math.round((active.value / total) * 100)}%
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
