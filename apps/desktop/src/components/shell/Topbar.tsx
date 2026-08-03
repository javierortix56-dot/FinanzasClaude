'use client'

import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { signOut } from '@finanzas/core/lib/auth'
import { monthLabel } from '@finanzas/core/lib/constants'
import { cn } from '@finanzas/core/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const titles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/movimientos':  'Movimientos',
  '/asignaciones': 'Asignación de egresos',
  '/cuentas':      'Cuentas y patrimonio',
  '/analisis':     'Análisis',
  '/ajustes':      'Ajustes',
}

export function Topbar() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const { hideAmounts, toggleHideAmounts } = useSettingsStore()
  const user = useAuthStore((s) => s.user)
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? ''

  return (
    <header className="relative z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-surface px-4">
      <button
        className="lg:hidden -ml-1 p-2 text-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center overflow-hidden rounded-[10px] border border-border bg-surface">
          <button
            onClick={prevMonth}
            className="px-[11px] py-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[140px] px-1 py-1.5 text-center text-[13px] font-semibold text-foreground first-letter:uppercase">
            {monthLabel(currentMonth)}
          </div>
          <button
            onClick={nextMonth}
            className="px-[11px] py-1.5 text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={toggleHideAmounts}
          className={cn(
            'rounded-[10px] border border-border bg-surface px-[11px] py-1.5 text-[12.5px] font-medium transition-colors hover:bg-surface-2',
            hideAmounts ? 'text-primary' : 'text-muted',
          )}
        >
          {hideAmounts ? 'Mostrar cifras' : 'Ocultar cifras'}
        </button>

        <button
          onClick={() => signOut()}
          className="rounded-[10px] border border-border bg-surface p-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Cerrar sesión"
          title={user?.email ? `Cerrar sesión (${user.email})` : 'Cerrar sesión'}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="absolute top-[52px] left-0 right-0 lg:hidden border-b border-border bg-surface shadow-lg p-3 space-y-1">
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
      )}
    </header>
  )
}
