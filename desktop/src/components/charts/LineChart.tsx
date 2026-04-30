'use client'

interface Series {
  label: string
  color: string
  values: number[]
}

interface Props {
  labels: string[]
  series: Series[]
  height?: number
  yFormatter?: (n: number) => string
}

export function LineChart({ labels, series, height = 220, yFormatter = (n) => n.toFixed(0) }: Props) {
  const padding = { top: 12, right: 12, bottom: 24, left: 48 }
  const width = 600
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

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* grid */}
        {tickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={padding.left} y1={yFor(v)}
              x2={padding.left + innerW} y2={yFor(v)}
              stroke="var(--border)" strokeDasharray="3 3"
            />
            <text x={padding.left - 6} y={yFor(v) + 3} fontSize="10" textAnchor="end" fill="var(--muted)">
              {yFormatter(v)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {labels.map((l, i) => (
          <text
            key={l + i}
            x={xFor(i)} y={height - 6}
            fontSize="10" textAnchor="middle" fill="var(--muted)"
          >
            {l}
          </text>
        ))}
        {/* series */}
        {series.map((s, si) => {
          const path = s.values
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`)
            .join(' ')
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} />
              {s.values.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
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
