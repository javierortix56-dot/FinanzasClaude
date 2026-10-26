'use client'

import { motion } from 'motion/react'

interface Props {
  /** 0–100 */
  value: number
  /** Color CSS o gradiente del relleno */
  color?: string
  className?: string
  trackClassName?: string
  height?: number
}

/** Barra de progreso con relleno animado (crece al montar y al cambiar) */
export default function ProgressBar({
  value, color = 'var(--primary)', className = '', trackClassName = 'bg-gray-500/10', height = 6,
}: Props) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`w-full rounded-full overflow-hidden ${trackClassName} ${className}`} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
    </div>
  )
}
