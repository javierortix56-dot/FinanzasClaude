'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'

interface Series {
  label: string
  color: string
  values: number[]
  dashed?: boolean
}

interface Props {
  labels: string[]
  series: Series[]
  height?: number
  yFormatter?: (n: number) => string
}

/** Curva suave (bezier) por los puntos */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C ${cx},${pts[i - 1][1]} ${cx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  return d
}

/**
 * Gráfico de líneas con trazo animado y tooltip al pasar el mouse por un
 * mes (guía vertical + valores de cada serie). Respeta el modo privacidad.
 */
export function LineChart({ labels, series, height = 240, yFormatter = (n) => n.toFixed(0) }: Props) {
  const uid = useId().replace(/:/g, '')
  const hide = useSettingsStore((s) => s.hideAmounts)
  const [hover, setHover] = useState<number | null>(null)

  const padding = { top: 14, right: 16, bottom: 26, left: 52 }
  const width = 640
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const all = series.flatMap((s) => s.values)
  const min = Math.min(0, ...all)
  const max = Math.max(0, ...all, 1)
  const range = max - min || 1

  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0
  const yFor = (v: number) => padding.top + innerH - ((v - min) / range) * innerH
  const xFor = (i: number) => padding.left + i * stepX

  const ticks = 4
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => min + (range * i) / ticks)
  const blurStyle = hide ? { filter: 'blur(3px)' } : undefined

  return (
    <div className="w-full relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          {series.map((s, si) => (
            <linearGradient key={si} id={`lg-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.16} />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {tickValues.map((v, i) => (
          <g key={i}>
            <line x1={padding.left} y1={yFor(v)} x2={padding.left + innerW} y2={yFor(v)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={padding.left - 8} y={yFor(v) + 3} fontSize="10" textAnchor="end" fill="var(--muted-2)" style={blurStyle}>
              {yFormatter(v)}
            </text>
          </g>
        ))}

        {labels.map((l, i) => (
          <text key={l + i} x={xFor(i)} y={height - 6} fontSize="10.5" textAnchor="middle"
            fill={hover === i ? 'var(--primary)' : 'var(--muted)'} fontWeight={hover === i ? 700 : 400}>
            {l}
          </text>
        ))}

        {hover !== null && (
          <motion.line
            initial={false}
            animate={{ x1: xFor(hover), x2: xFor(hover) }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            y1={padding.top} y2={padding.top + innerH}
            stroke="var(--primary)" strokeOpacity={0.3}
          />
        )}

        {series.map((s, si) => {
          const pts: [number, number][] = s.values.map((v, i) => [xFor(i), yFor(v)])
          const line = smooth(pts)
          const area = pts.length > 1 ? `${line} L ${pts[pts.length - 1][0]},${padding.top + innerH} L ${pts[0][0]},${padding.top + innerH} Z` : ''
          return (
            <g key={si}>
              <motion.path d={area} fill={`url(#lg-${uid}-${si})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} />
              <motion.path
                d={line} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.8 : 2.4}
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dashed ? '6 4' : undefined}
                initial={s.dashed ? { opacity: 0 } : { pathLength: 0 }}
                animate={s.dashed ? { opacity: 0.85 } : { pathLength: 1 }}
                transition={{ duration: 0.9, delay: si * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
              {hover !== null && pts[hover] && (
                <circle cx={pts[hover][0]} cy={pts[hover][1]} r={4.5} fill="var(--surface)" stroke={s.color} strokeWidth={2} />
              )}
            </g>
          )
        })}

        {/* Zonas de hover por mes */}
        {labels.map((l, i) => (
          <rect key={`h-${i}`} x={xFor(i) - stepX / 2} y={0} width={Math.max(stepX, 24)} height={height}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>

      <AnimatePresence>
        {hover !== null && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, left: `${(xFor(hover) / width) * 100}%` }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            className="absolute top-0 -translate-x-1/2 pointer-events-none glass-strong rounded-xl px-3 py-2 text-xs min-w-[140px]"
          >
            <div className="font-semibold text-foreground mb-1 capitalize">{labels[hover]}</div>
            {series.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
                </span>
                <span className={`font-semibold tabular-nums text-foreground ${hide ? 'blur-amount' : ''}`}>
                  {yFormatter(s.values[hover] ?? 0)}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 mt-2 flex-wrap">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}
