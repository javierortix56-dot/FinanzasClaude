'use client'

const R  = 45
const CX = 60
const CY = 60
const CIRC = 2 * Math.PI * R   // ≈ 282.74
const GAP  = 2                 // gap between slices

export interface DonutSlice {
  id: string
  color: string
  amount: number
  dimmed?: boolean
}

interface Props {
  slices: DonutSlice[]
  total: number
  centerLabel: string
  centerSub: string
  size?: number
}

export default function DonutChart({ slices, total, centerLabel, centerSub, size = 160 }: Props) {
  if (total === 0) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <div
          className="rounded-full border-[18px] border-gray-100 flex items-center justify-center"
          style={{ width: size, height: size }}
        />
      </div>
    )
  }

  let accumulated = 0
  const circles = slices.map((slice) => {
    const portion = Math.max(0, (slice.amount / total) * CIRC - GAP)
    const el = (
      <circle
        key={slice.id}
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={slice.color}
        strokeWidth={18}
        strokeDasharray={`${portion} ${CIRC - portion}`}
        strokeDashoffset={-accumulated}
        opacity={slice.dimmed ? 0.2 : 1}
        style={{ transition: 'opacity 0.2s' }}
      />
    )
    accumulated += portion + GAP
    return el
  })

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    >
      {/* Background ring */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={18} />

      {/* Slices — rotated so first slice starts at 12 o'clock */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>{circles}</g>

      {/* Center text */}
      <text
        x={CX} y={CY - 7}
        textAnchor="middle"
        fontSize="8"
        fill="#6b7280"
        fontFamily="system-ui"
      >
        {centerSub}
      </text>
      <text
        x={CX} y={CY + 8}
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#111827"
        fontFamily="system-ui"
      >
        {centerLabel}
      </text>
    </svg>
  )
}
