'use client'

import { AnimatePresence, motion } from 'motion/react'

/** Contenedor que se expande/colapsa animando la altura (acordeones) */
export default function Collapse({ open, children, className = '' }: {
  open: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { type: 'spring', stiffness: 380, damping: 38 }, opacity: { duration: 0.2 } }}
          className={`overflow-hidden ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
