'use client'

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
  centerValue?: string
}

export function Donut({ data, size = 200, thickness = 28, centerLabel, centerValue }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = size / 2
  const inner = radius - thickness
  const cx = radius
  const cy = radius

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius - thickness / 2} fill="none" stroke="var(--border)" strokeWidth={thickness} />
      </svg>
    )
  }

  const offsets = data.reduce<number[]>((acc, d) => {
    acc.push((acc[acc.length - 1] ?? 0) + d.value)
    return acc
  }, [])
  const segments = data.map((d, i) => {
    const startV = offsets[i] - d.value
    const endV = offsets[i]
    const startA = (startV / total) * 2 * Math.PI - Math.PI / 2
    const endA = (endV / total) * 2 * Math.PI - Math.PI / 2
    const large = endA - startA > Math.PI ? 1 : 0
    const x1 = cx + radius * Math.cos(startA)
    const y1 = cy + radius * Math.sin(startA)
    const x2 = cx + radius * Math.cos(endA)
    const y2 = cy + radius * Math.sin(endA)
    const x3 = cx + inner * Math.cos(endA)
    const y3 = cy + inner * Math.sin(endA)
    const x4 = cx + inner * Math.cos(startA)
    const y4 = cy + inner * Math.sin(startA)
    return {
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`,
      color: d.color,
    }
  })

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} />
        ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel && <span className="text-xs text-muted">{centerLabel}</span>}
          {centerValue && <span className="text-base font-semibold text-foreground">{centerValue}</span>}
        </div>
      )}
    </div>
  )
}
