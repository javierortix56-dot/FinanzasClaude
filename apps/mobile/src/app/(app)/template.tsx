'use client'

import { motion } from 'motion/react'

// El template se remonta en cada navegación: la pantalla entra con un fade
// + desplazamiento corto en vez de aparecer de golpe.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
