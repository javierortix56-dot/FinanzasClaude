'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  PieChart,
  Settings,
  Link2,
} from 'lucide-react'
import { cn } from '@finanzas/core/lib/utils'

const items = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/movimientos',   label: 'Movimientos',  icon: ArrowRightLeft },
  { href: '/asignaciones',  label: 'Asignaciones', icon: Link2 },
  { href: '/cuentas',       label: 'Cuentas',      icon: Wallet },
  { href: '/analisis',      label: 'Análisis',     icon: PieChart },
  { href: '/ajustes',       label: 'Ajustes',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          J&amp;M
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">Finanzas J&amp;M</div>
          <div className="text-xs text-muted">Desktop</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/')
          const Icon = it.icon
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-2',
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border text-xs text-muted">
        v0.1 · sincronizado con app móvil
      </div>
    </aside>
  )
}
