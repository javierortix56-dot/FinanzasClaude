'use client'

const W = 320
const H = 100
const PAD_L = 38
const PAD_B = 20
const PAD_T = 10

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

function scaleX(i: number, n: number) {
  if (n <= 1) return PAD_L + (W - PAD_L) / 2
  return PAD_L + (i / (n - 1)) * (W - PAD_L)
}

function scaleY(val: number, min: number, max: number) {
  if (max === min) return PAD_T + (H - PAD_B - PAD_T) / 2
  return PAD_T + ((max - val) / (max - min)) * (H - PAD_B - PAD_T)
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return n.toFixed(0)
}

export default function MultiLineChart({ months, series, currency = '' }: Props) {
  if (!months.length || !series.length) return null

  const allVals = series.flatMap((s) => s.values)
  const minVal  = Math.min(...allVals, 0)
  const maxVal  = Math.max(...allVals, 1)
  const n       = months.length

  return (
    <div className="px-4 pb-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <svg width="20" height="8">
              <line
                x1="0" y1="4" x2="20" y2="4"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dashed ? '4 2' : undefined}
              />
            </svg>
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
        {/* Zero line */}
        {minVal < 0 && (
          <line
            x1={PAD_L} y1={scaleY(0, minVal, maxVal)}
            x2={W}     y2={scaleY(0, minVal, maxVal)}
            stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 2"
          />
        )}

        {/* Y-axis labels */}
        {[minVal, (minVal + maxVal) / 2, maxVal].map((v, i) => (
          <text
            key={i}
            x={PAD_L - 4}
            y={scaleY(v, minVal, maxVal) + 3}
            textAnchor="end"
            fontSize="7"
            fill="#9ca3af"
            fontFamily="system-ui"
          >
            {fmt(v)}
          </text>
        ))}

        {/* Lines */}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => `${scaleX(i, n)},${scaleY(v, minVal, maxVal)}`)
            .join(' ')
          return (
            <g key={s.label}>
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? '5 3' : undefined}
              />
              {/* Dots */}
              {s.values.map((v, i) => (
                <circle
                  key={i}
                  cx={scaleX(i, n)}
                  cy={scaleY(v, minVal, maxVal)}
                  r="3"
                  fill="white"
                  stroke={s.color}
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )
        })}

        {/* X-axis labels */}
        {months.map((m, i) => (
          <text
            key={m}
            x={scaleX(i, n)}
            y={H - 4}
            textAnchor="middle"
            fontSize="7"
            fill={i === n - 1 ? '#534AB7' : '#9ca3af'}
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
