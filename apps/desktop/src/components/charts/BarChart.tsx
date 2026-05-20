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

/** Barras agrupadas por categoría del eje X (una barra por serie). */
export function BarChart({ labels, series, height = 220, yFormatter = (n) => n.toFixed(0) }: Props) {
  const padding = { top: 12, right: 12, bottom: 24, left: 48 }
  const width = 600
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const all = series.flatMap((s) => s.values)
  const max = Math.max(1, ...all)
  const ticks = 4
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => (max * i) / ticks)
  const yFor = (v: number) => padding.top + innerH - (v / max) * innerH

  const groupW = labels.length > 0 ? innerW / labels.length : innerW
  const barGap = 4
  const barW = (groupW - barGap * (series.length + 1)) / series.length

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
        {/* bars */}
        {labels.map((l, gi) => {
          const gx = padding.left + gi * groupW
          return (
            <g key={l + gi}>
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0
                const x = gx + barGap + si * (barW + barGap)
                const y = yFor(v)
                const h = padding.top + innerH - y
                return (
                  <rect
                    key={si}
                    x={x} y={y} width={Math.max(0, barW)} height={Math.max(0, h)}
                    rx={2} fill={s.color}
                  />
                )
              })}
              <text
                x={gx + groupW / 2} y={height - 6}
                fontSize="10" textAnchor="middle" fill="var(--muted)"
              >
                {l}
              </text>
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
