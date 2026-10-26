'use client'

import { motion } from 'motion/react'

// El template se remonta en cada navegación: la vista entra con un fade +
// desplazamiento corto. flex-1/min-h-0 conservan el layout de las vistas
// que scrollean por panel (Movimientos, Asignaciones).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 min-h-0 flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
