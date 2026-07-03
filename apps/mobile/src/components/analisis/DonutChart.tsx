'use client'

const R    = 42
const CX   = 60
const CY   = 60
const CIRC = 2 * Math.PI * R
const GAP  = 1.5

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

export default function DonutChart({ slices, total, centerLabel, centerSub, size = 150 }: Props) {
  if (total === 0) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center">
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: size, height: size,
            border: '13px solid var(--color-gray-100)',
          }}
        />
      </div>
    )
  }

  // Offsets precalculados sin mutar variables durante el render
  const portions = slices.map((slice) => Math.max(0, (slice.amount / total) * CIRC - GAP))
  const offsets = portions.reduce<number[]>(
    (acc, portion, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + portions[i - 1] + GAP]),
    []
  )
  const circles = slices.map((slice, i) => (
    <circle
      key={slice.id}
      cx={CX} cy={CY} r={R}
      fill="none"
      stroke={slice.color}
      strokeWidth={13}
      strokeDasharray={`${portions[i]} ${CIRC - portions[i]}`}
      strokeDashoffset={-offsets[i]}
      opacity={slice.dimmed ? 0.15 : 1}
      style={{ transition: 'opacity 0.2s' }}
    />
  ))

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
    >
      {/* Shadow ring */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--color-gray-100)" strokeWidth={13} />

      {/* Slices */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>{circles}</g>

      {/* Center: sub label */}
      <text
        x={CX} y={CY - 6}
        textAnchor="middle"
        fontSize="7"
        fill="var(--color-gray-400)"
        fontFamily="system-ui"
        letterSpacing="0.3"
      >
        {centerSub}
      </text>
      {/* Center: main amount */}
      <text
        x={CX} y={CY + 8}
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill="var(--color-gray-900)"
        fontFamily="system-ui"
      >
        {centerLabel}
      </text>
    </svg>
  )
}
