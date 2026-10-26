'use client'

import { motion } from 'motion/react'
import { easeOut } from './motion'

/** Tarjeta glass de sección con título opcional y entrada animada */
export default function Card({ title, action, children, className = '', delay = 0, padded = true }: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Retraso de entrada (s) para escalonar secciones */
  delay?: number
  padded?: boolean
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...easeOut, delay }}
      className={`glass rounded-[24px] ${padded ? 'p-4' : ''} ${className}`}
    >
      {(title || action) && (
        <div className={`flex items-center justify-between gap-2 ${padded ? 'mb-3' : 'px-4 pt-4 pb-1'}`}>
          {title && <p className="eyebrow">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </motion.section>
  )
}
