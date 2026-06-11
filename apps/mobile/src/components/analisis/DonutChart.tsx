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
            border: '13px solid #f3f4f6',
          }}
        />
      </div>
    )
  }

  // Pre-calcular porción y offset de cada slice sin mutar variables del
  // closure durante el render (react-hooks/immutability).
  const segments = slices.reduce<{ slice: DonutSlice; portion: number; offset: number }[]>(
    (acc, slice) => {
      const prev = acc[acc.length - 1]
      const offset = prev ? prev.offset + prev.portion + GAP : 0
      const portion = Math.max(0, (slice.amount / total) * CIRC - GAP)
      acc.push({ slice, portion, offset })
      return acc
    },
    [],
  )
  const circles = segments.map(({ slice, portion, offset }) => (
    <circle
      key={slice.id}
      cx={CX} cy={CY} r={R}
      fill="none"
      stroke={slice.color}
      strokeWidth={13}
      strokeDasharray={`${portion} ${CIRC - portion}`}
      strokeDashoffset={-offset}
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
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={13} />

      {/* Slices */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>{circles}</g>

      {/* Center: sub label */}
      <text
        x={CX} y={CY - 6}
        textAnchor="middle"
        fontSize="7"
        fill="#9ca3af"
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
        fill="#111827"
        fontFamily="system-ui"
      >
        {centerLabel}
      </text>
    </svg>
  )
}
