'use client'

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

export default function MultiLineChart({ months, series, currency = '' }: Props) {
  if (!months.length || !series.length) return null

  const allVals = series.flatMap((s) => s.values)
  const minVal  = Math.min(...allVals, 0)
  const maxVal  = Math.max(...allVals, 1)
  const n       = months.length
  const bottom  = PAD_T + PLOT_H
  const zeroY   = py(0, minVal, maxVal)

  return (
    <div className="px-3 pb-3">
      {/* Legend */}
      <div className="flex gap-3 mb-2 px-1">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color, opacity: s.dashed ? 0.7 : 1 }}
            />
            <span className="text-[9px] font-medium text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.label} id={`grad-${s.label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={s.dashed ? 0.06 : 0.12} />
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
                stroke="#f3f4f6" strokeWidth="1"
              />
              <text
                x={PAD_L - 3} y={y + 3}
                textAnchor="end" fontSize="6.5" fill="#d1d5db"
                fontFamily="system-ui"
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
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 2"
          />
        )}

        {/* Area fills */}
        {series.map((s) => {
          const pts: [number, number][] = s.values.map((v, i) => [px(i, n), py(v, minVal, maxVal)])
          return (
            <path
              key={s.label}
              d={areaFill(pts, bottom)}
              fill={`url(#grad-${s.label})`}
            />
          )
        })}

        {/* Lines */}
        {series.map((s) => {
          const pts: [number, number][] = s.values.map((v, i) => [px(i, n), py(v, minVal, maxVal)])
          return (
            <g key={s.label}>
              <path
                d={smoothLine(pts)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? '5 3' : undefined}
                opacity={s.dashed ? 0.75 : 1}
              />
              {/* End-point dot only */}
              {(() => {
                const last = pts[pts.length - 1]
                return (
                  <circle
                    cx={last[0]} cy={last[1]} r="3"
                    fill="white" stroke={s.color} strokeWidth="1.5"
                  />
                )
              })()}
            </g>
          )
        })}

        {/* X-axis labels */}
        {months.map((m, i) => (
          <text
            key={m}
            x={px(i, n)}
            y={H - 5}
            textAnchor="middle"
            fontSize="7"
            fill={i === n - 1 ? '#534AB7' : '#c4c4c4'}
            fontWeight={i === n - 1 ? '700' : '400'}
            fontFamily="system-ui"
          >
            {m}
          </text>
        ))}
      </svg>
    </div>
  )
}
