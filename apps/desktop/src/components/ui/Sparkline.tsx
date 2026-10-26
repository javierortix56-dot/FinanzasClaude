'use client'

import { useId } from 'react'
import { motion } from 'motion/react'

/** Mini gráfico de línea + área (tendencia). Necesita al menos 2 puntos. */
export default function Sparkline({ values, color, width = 72, height = 24, strokeWidth = 1.6, className = '' }: {
  values: number[]
  color: string
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = strokeWidth
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    max === min ? height / 2 : pad + ((max - v) / (max - min)) * (height - pad * 2),
  ])
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#spk-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} />
      <motion.path
        d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.8} fill={color} />
    </svg>
  )
}
