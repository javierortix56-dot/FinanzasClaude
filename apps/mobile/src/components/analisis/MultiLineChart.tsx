'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'

const W     = 320
const H     = 120
const PAD_L = 34
const PAD_B = 22
const PAD_T = 8
const PLOT_W = W - PAD_L
const PLOT_H = H - PAD_B - PAD_T

export interface LineSeries {
  label: string
  color: string
  values: number[]
  dashed?: boolean
}

interface Props {
  months: string[]
  series: LineSeries[]
  currency?: string
}

function px(i: number, n: number) {
  if (n <= 1) return PAD_L + PLOT_W / 2
  return PAD_L + (i / (n - 1)) * PLOT_W
}

function py(val: number, min: number, max: number) {
  if (max === min) return PAD_T + PLOT_H / 2
  return PAD_T + ((max - val) / (max - min)) * PLOT_H
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return n.toFixed(0)
}

/** Smooth cubic-bezier path through points */
function smoothLine(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C ${cpx},${pts[i - 1][1]} ${cpx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  return d
}

/** Area fill: close at bottom */
function areaFill(pts: [number, number][], bottom: number): string {
  if (pts.length < 2) return ''
  return `${smoothLine(pts)} L ${pts[pts.length - 1][0]},${bottom} L ${pts[0][0]},${bottom} Z`
}

const GRID_ROWS = 3

export default function MultiLineChart({ months, series }: Props) {
  const uid = useId().replace(/:/g, '')
  const hideAmounts = useSettingsStore((st) => st.hideAmounts)
  // Mes seleccionado (tap/arrastre): por defecto, el último
  const [sel, setSel] = useState<number | null>(null)

  if (!months.length || !series.length) return null

  const allVals = series.flatMap((s) => s.values)
  const minVal  = Math.min(...allVals, 0)
  const maxVal  = Math.max(...allVals, 1)
  const n       = months.length
  const bottom  = PAD_T + PLOT_H
  const zeroY   = py(0, minVal, maxVal)
  const active  = sel ?? n - 1
  const colW    = n > 1 ? PLOT_W / (n - 1) : PLOT_W
  const blur    = hideAmounts ? 'blur-[4px] select-none' : ''

  return (
    <div className="px-3 pb-4">
      {/* Leyenda con el valor del mes seleccionado */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 px-1 min-h-[30px] items-start">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color, opacity: s.dashed ? 0.75 : 1 }}
            />
            <span className="text-[10px] font-medium text-gray-400 truncate max-w-[84px]">{s.label}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${active}-${s.values[active]}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={`text-[10px] font-bold tabular-nums text-gray-700 ${blur}`}
              >
                {fmt(s.values[active] ?? 0)}
              </motion.span>
            </AnimatePresence>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }} className="touch-pan-y">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.label} id={`grad-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={s.dashed ? 0.08 : 0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid lines */}
        {Array.from({ length: GRID_ROWS }, (_, i) => {
          const v = minVal + (i / (GRID_ROWS - 1)) * (maxVal - minVal)
          const y = py(v, minVal, maxVal)
          return (
            <g key={i}>
              <line
                x1={PAD_L} y1={y} x2={W} y2={y}
                stroke="var(--color-gray-200)" strokeWidth="0.6" strokeDasharray="2 3"
              />
              <text
                x={PAD_L - 4} y={y + 2.5}
                textAnchor="end" fontSize="6.5" fill="var(--color-gray-400)"
                fontFamily="inherit"
                style={hideAmounts ? { filter: 'blur(2px)' } : undefined}
              >
                {fmt(v)}
              </text>
            </g>
          )
        })}

        {/* Zero line (only when there are negatives) */}
        {minVal < 0 && (
          <line
            x1={PAD_L} y1={zeroY} x2={W} y2={zeroY}
            stroke="var(--color-gray-300)" strokeWidth="0.8"
          />
        )}

        {/* Guía vertical del mes seleccionado */}
        <motion.line
          y1={PAD_T} y2={bottom}
          stroke="var(--primary)" strokeOpacity="0.25" strokeWidth="1"
          initial={false}
          animate={{ x1: px(active, n), x2: px(active, n) }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />

        {/* Area fills */}
        {series.map((s, si) => {
          const pts: [number, number][] = s.values.map((v, i) => [px(i, n), py(v, minVal, maxVal)])
          return (
            <motion.path
              key={s.label}
              d={areaFill(pts, bottom)}
              fill={`url(#grad-${uid}-${si})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            />
          )
        })}

        {/* Lines */}
        {series.map((s, si) => {
          const pts: [number, number][] = s.values.map((v, i) => [px(i, n), py(v, minVal, maxVal)])
          const pt = pts[active]
          return (
            <g key={s.label}>
              <motion.path
                d={smoothLine(pts)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? '5 3' : undefined}
                opacity={s.dashed ? 0.8 : 1}
                initial={s.dashed ? { opacity: 0 } : { pathLength: 0 }}
                animate={s.dashed ? { opacity: 0.8 } : { pathLength: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: si * 0.08 }}
              />
              {/* Punto en el mes seleccionado */}
              {pt && (
                <motion.circle
                  r="3.2"
                  fill="var(--surface)" stroke={s.color} strokeWidth="1.6"
                  initial={false}
                  animate={{ cx: pt[0], cy: pt[1] }}
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
            </g>
          )
        })}

        {/* X-axis labels */}
        {months.map((m, i) => (
          <text
            key={`${m}-${i}`}
            x={px(i, n)}
            y={H - 5}
            textAnchor="middle"
            fontSize="7"
            fill={i === active ? 'var(--primary)' : 'var(--color-gray-400)'}
            fontWeight={i === active ? '700' : '400'}
            fontFamily="inherit"
          >
            {m}
          </text>
        ))}

        {/* Zonas táctiles por mes */}
        {months.map((m, i) => (
          <rect
            key={`hit-${m}-${i}`}
            x={px(i, n) - colW / 2}
            y={0}
            width={colW}
            height={H}
            fill="transparent"
            onPointerDown={() => setSel(i)}
            onPointerEnter={(e) => { if (e.buttons > 0 || e.pointerType === 'mouse') setSel(i) }}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>
    </div>
  )
}
