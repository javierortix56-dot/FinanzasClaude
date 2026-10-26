import type { Transition } from 'motion/react'

// Presets compartidos: todas las animaciones de la app salen de acá para que
// el "feel" sea consistente (resortes cortos, sin rebote exagerado).

/** Resorte estándar para layout, pills y tarjetas */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }

/** Resorte suave para sheets y elementos grandes */
export const springSoft: Transition = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 }

/** Resorte con un toque de rebote para feedback (checks, FAB) */
export const springPop: Transition = { type: 'spring', stiffness: 520, damping: 22 }

/** Rebote corto por keyframes (los resortes solo admiten 2 keyframes) */
export const pulse: Transition = { duration: 0.32, ease: 'easeOut' }

/** Curva para fades y entradas */
export const easeOut: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] }

/** Entrada escalonada para listas: retraso por índice con tope */
export function stagger(i: number, step = 0.025, max = 0.3): number {
  return Math.min(i * step, max)
}
