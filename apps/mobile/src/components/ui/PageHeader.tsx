'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { monthLabel } from '@finanzas/core/lib/constants'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { easeOut } from './motion'

interface HeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Acciones a la derecha del título */
  actions?: React.ReactNode
  children?: React.ReactNode
}

/** Encabezado "large title" de cada pantalla, transparente sobre el fondo ambiental */
export default function PageHeader({ title, subtitle, actions, children }: HeaderProps) {
  return (
    <header className="px-4 pt-[max(2.75rem,env(safe-area-inset-top))] pb-3 flex-shrink-0">
      <div className="flex items-end gap-3">
        <motion.div
          className="flex-1 min-w-0"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOut}
        >
          {subtitle && <p className="text-xs font-medium text-gray-400 mb-0.5 truncate">{subtitle}</p>}
          <h1 className="text-[28px] leading-none font-bold tracking-tight text-gray-900">{title}</h1>
        </motion.div>
        {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** Botón redondo glass para acciones de header */
export function HeaderButton({ children, onClick, label, active = false }: {
  children: React.ReactNode
  onClick: () => void
  label: string
  active?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-9 min-w-9 px-2.5 flex items-center justify-center gap-1 rounded-full glass text-xs font-semibold transition-colors ${
        active ? 'text-primary' : 'text-gray-600'
      }`}
    >
      {children}
    </motion.button>
  )
}

/** Ojo de privacidad (oculta/muestra montos en toda la app) */
export function PrivacyToggle() {
  const hideAmounts = useSettingsStore((s) => s.hideAmounts)
  const toggle = useSettingsStore((s) => s.toggleHideAmounts)
  return (
    <HeaderButton onClick={toggle} label={hideAmounts ? 'Mostrar montos' : 'Ocultar montos'} active={!hideAmounts}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={hideAmounts ? 'off' : 'on'}
          initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.18 }}
          className="inline-flex"
        >
          {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
        </motion.span>
      </AnimatePresence>
    </HeaderButton>
  )
}

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-10" → "oct 2026" */
function shortMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTH_SHORT[parseInt(m, 10) - 1]} ${y}`
}

/** Selector de mes con etiqueta que se desliza en la dirección del cambio */
export function MonthSwitcher({ month, onPrev, onNext, compact = false }: {
  month: string
  onPrev: () => void
  onNext: () => void
  compact?: boolean
}) {
  // Dirección del último cambio (+1 adelante, -1 atrás) para la animación.
  // Patrón "estado derivado del valor previo" (setState durante el render).
  const [prevMonth, setPrevMonth] = useState(month)
  const [dir, setDir] = useState(1)
  if (prevMonth !== month) {
    setDir(month > prevMonth ? 1 : -1)
    setPrevMonth(month)
  }
  const label = compact ? shortMonthLabel(month) : monthLabel(month).replace(' de ', ' ')

  return (
    <div className="flex items-center glass rounded-full h-9 px-0.5">
      <motion.button
        type="button" whileTap={{ scale: 0.85 }} onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-500/10"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={15} />
      </motion.button>
      <div className={`relative overflow-hidden h-5 ${compact ? 'w-[78px]' : 'w-[104px]'}`}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.span
            key={month}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 24, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -24, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800 capitalize whitespace-nowrap"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
      <motion.button
        type="button" whileTap={{ scale: 0.85 }} onClick={onNext}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-500/10"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={15} />
      </motion.button>
    </div>
  )
}
