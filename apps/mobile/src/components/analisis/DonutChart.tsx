'use client'

import { AnimatePresence, motion } from 'motion/react'

const R    = 42
const CX   = 60
const CY   = 60
const CIRC = 2 * Math.PI * R
const GAP  = 2.2
const STROKE = 12

export interface DonutSlice {
  id: string
  color: string
  amount: number
  dimmed?: boolean
}

interface Props {
  slices: DonutSlice[]
  total: number
  centerLabel: React.ReactNode
  centerSub: string
  size?: number
  /** Cambia cuando cambia el conjunto de slices (nivel / tipo) para re-animar el trazo */
  animationKey?: string
}

export default function DonutChart({ slices, total, centerLabel, centerSub, size = 150, animationKey = '' }: Props) {
  // Fracciones (0–1) y offsets precalculados sin mutar variables durante el render
  const portions = total > 0
    ? slices.map((slice) => Math.max(0, (slice.amount / total) * CIRC - GAP) / CIRC)
    : []
  const offsets = portions.reduce<number[]>(
    (acc, _, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + portions[i - 1] + GAP / CIRC]),
    []
  )

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible' }}>
        {/* Pista de fondo */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-gray-100)" strokeWidth={STROKE} opacity={0.7} />

        {/* Slices: el trazo se dibuja desde 0 (pathLength) en su posición (pathOffset) */}
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {slices.map((slice, i) => (
            <motion.circle
              key={`${animationKey}-${slice.id}`}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              initial={{ pathLength: 0, pathOffset: offsets[i], opacity: 1 }}
              animate={{ pathLength: portions[i], pathOffset: offsets[i], opacity: slice.dimmed ? 0.15 : 1 }}
              transition={{
                pathLength: { type: 'spring', stiffness: 70, damping: 18, delay: i * 0.05 },
                pathOffset: { type: 'spring', stiffness: 70, damping: 18 },
                opacity: { duration: 0.2 },
              }}
            />
          ))}
        </g>
      </svg>

      {/* Centro (HTML para respetar blur de privacidad y tipografía nítida) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={centerSub}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            className="min-w-0 max-w-full"
          >
            <p className="text-[10px] text-gray-400 font-medium truncate">{centerSub}</p>
            <p className="text-[13px] font-bold text-gray-900 tabular-nums leading-tight truncate">{centerLabel}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
