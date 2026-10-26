'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, LogOut, Menu, Monitor, Moon, Plus, Sun, X } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { signOut } from '@finanzas/core/lib/auth'
import { monthLabel } from '@finanzas/core/lib/constants'
import { cn } from '@finanzas/core/lib/utils'
import { currentThemePref, setThemePref, subscribeTheme, ThemePref } from '@/lib/theme'
import { NAV_ITEMS } from './Sidebar'

const titles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/movimientos':  'Movimientos',
  '/asignaciones': 'Asignación de egresos',
  '/cuentas':      'Cuentas y patrimonio',
  '/analisis':     'Análisis',
  '/ajustes':      'Ajustes',
}

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_LABEL: Record<ThemePref, string> = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' }

/** Selector de mes con la etiqueta deslizándose en la dirección del cambio */
function MonthSwitcher() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const [prev, setPrev] = useState(currentMonth)
  const [dir, setDir] = useState(1)
  if (prev !== currentMonth) {
    setDir(currentMonth > prev ? 1 : -1)
    setPrev(currentMonth)
  }
  return (
    <div className="flex items-center rounded-xl bg-surface-2 p-0.5">
      <button onClick={prevMonth} className="h-8 w-8 inline-flex items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-foreground transition-colors" aria-label="Mes anterior" title="Mes anterior (←)">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="relative h-8 w-[150px] overflow-hidden">
        <AnimatePresence initial={false} custom={dir}>
          <motion.span
            key={currentMonth}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 28, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -28, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-foreground first-letter:uppercase"
          >
            {monthLabel(currentMonth)}
          </motion.span>
        </AnimatePresence>
      </div>
      <button onClick={nextMonth} className="h-8 w-8 inline-flex items-center justify-center rounded-[10px] text-muted hover:bg-surface hover:text-foreground transition-colors" aria-label="Mes siguiente" title="Mes siguiente (→)">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Topbar() {
  const { hideAmounts, toggleHideAmounts } = useSettingsStore()
  const openAddModal = useUIStore((s) => s.openAddModal)
  const user = useAuthStore((s) => s.user)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const theme = useSyncExternalStore(subscribeTheme, currentThemePref, () => 'system' as ThemePref)

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? ''

  function cycleTheme() {
    setThemePref(THEME_NEXT[theme])
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header className="relative z-30 flex h-[60px] shrink-0 items-center gap-3 px-4 lg:px-6 mt-3">
      <button
        className="lg:hidden -ml-1 h-9 w-9 inline-flex items-center justify-center rounded-xl glass text-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <AnimatePresence mode="wait" initial={false}>
        <motion.h1
          key={title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="text-xl font-semibold tracking-tight text-foreground truncate"
        >
          {title}
        </motion.h1>
      </AnimatePresence>

      <div className="ml-auto flex items-center gap-2 glass rounded-2xl p-1">
        <MonthSwitcher />

        <button
          onClick={toggleHideAmounts}
          className={cn(
            'h-9 inline-flex items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2',
            hideAmounts ? 'text-primary' : 'text-muted',
          )}
          title="Ocultar / mostrar cifras (H)"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={hideAmounts ? 'off' : 'on'}
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
              transition={{ duration: 0.16 }}
              className="inline-flex"
            >
              {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
          <span className="hidden xl:inline">{hideAmounts ? 'Mostrar cifras' : 'Ocultar cifras'}</span>
        </button>

        <button
          onClick={cycleTheme}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label={THEME_LABEL[theme]}
          title={THEME_LABEL[theme]}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} className="inline-flex">
              <ThemeIcon className="h-4 w-4" />
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          onClick={() => signOut()}
          className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Cerrar sesión"
          title={user?.email ? `Cerrar sesión (${user.email})` : 'Cerrar sesión'}
        >
          <LogOut className="h-4 w-4" />
        </button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={openAddModal}
          className="h-9 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 text-[13px] font-semibold text-white shadow-card"
          title="Nuevo movimiento (N)"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Nuevo</span>
          <kbd className="hidden md:inline-flex h-5 items-center rounded-md bg-white/20 px-1.5 text-[10px] font-semibold">N</kbd>
        </motion.button>
      </div>

      {/* Navegación en pantallas angostas */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute top-[64px] left-4 right-4 lg:hidden glass-strong rounded-2xl p-2 grid grid-cols-2 gap-1"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname.startsWith(href) ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface-2',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
