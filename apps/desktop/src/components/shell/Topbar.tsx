'use client'

import { ChevronLeft, ChevronRight, Eye, EyeOff, Menu } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { monthLabel, getCurrentMonth } from '@finanzas/core/lib/constants'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const titles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/movimientos':  'Movimientos',
  '/asignaciones': 'Asignaciones',
  '/cuentas':      'Cuentas y patrimonio',
  '/analisis':     'Análisis',
  '/ajustes':      'Ajustes',
}

export function Topbar() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const { hideAmounts, toggleHideAmounts } = useSettingsStore()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Cerrar el menú móvil con Escape (el clic afuera lo maneja el backdrop)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? ''
  const isCurrent = currentMonth === getCurrentMonth()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/85 backdrop-blur px-4 lg:px-8">
      <button
        className="lg:hidden -ml-1 p-2 text-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-1">
          <button
            onClick={prevMonth}
            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-2 text-sm font-medium text-foreground capitalize min-w-[140px] text-center">
            {monthLabel(currentMonth)}
            {!isCurrent && <span className="ml-1 text-xs text-muted">·</span>}
          </div>
          <button
            onClick={nextMonth}
            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Button
          variant="secondary"
          size="icon"
          onClick={toggleHideAmounts}
          aria-label={hideAmounts ? 'Mostrar montos' : 'Ocultar montos'}
          title={hideAmounts ? 'Mostrar montos' : 'Ocultar montos'}
        >
          {hideAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {open && (
        <>
          {/* Backdrop: cierra el menú al hacer clic afuera */}
          <div className="fixed inset-0 top-16 z-10 lg:hidden" onClick={() => setOpen(false)} />
          <div className="absolute top-16 left-0 right-0 z-20 lg:hidden border-b border-border bg-surface shadow-lg p-3 space-y-1">
          {[
            ['/dashboard', 'Dashboard'],
            ['/movimientos', 'Movimientos'],
            ['/asignaciones', 'Asignaciones'],
            ['/cuentas', 'Cuentas'],
            ['/analisis', 'Análisis'],
            ['/ajustes', 'Ajustes'],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
            >
              {label}
            </Link>
          ))}
          </div>
        </>
      )}
    </header>
  )
}
