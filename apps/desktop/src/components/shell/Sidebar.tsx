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
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'

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
  const transactions = useTransactionStore((s) => s.transactions)
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS

  const sinAsignar = transactions.filter(
    (t) => t.tipo === 'egreso' && t.asignaciones.length === 0,
  ).length

  const counts: Record<string, { value: number; tone: 'neutral' | 'warning' }> = {
    '/movimientos': { value: transactions.length, tone: 'neutral' },
    '/asignaciones': { value: sinAsignar, tone: 'warning' },
  }

  return (
    <aside className="hidden lg:flex w-[236px] shrink-0 flex-col border-r border-border bg-surface min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-4 h-[52px] shrink-0 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground font-semibold text-[13px] tracking-tight">
          J&amp;M
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium text-foreground">Finanzas J&amp;M</div>
          <div className="text-xs text-muted">Desktop</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-2.5">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/')
          const Icon = it.icon
          const count = counts[it.href]
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-[11px] rounded-[9px] px-[11px] py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-2',
              )}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" />
              <span>{it.label}</span>
              {count && count.value > 0 && (
                <span
                  className={cn(
                    'ml-auto rounded-full px-[7px] py-0.5 text-[11px] font-medium tabular-nums',
                    count.tone === 'warning'
                      ? 'bg-unassigned-soft text-unassigned'
                      : 'bg-surface-2 text-muted',
                  )}
                >
                  {count.value}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mx-3.5 rounded-[10px] border border-border bg-surface-2 px-3 py-[11px] flex flex-col gap-2.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">
          Tipo de cambio
        </div>
        <div className="flex justify-between text-[13px] tabular-nums">
          <span className="text-muted">USD / ARS</span>
          <span className="font-medium text-foreground">
            {settings.tipoCambio.ARS_USD.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="flex justify-between text-[13px] tabular-nums">
          <span className="text-muted">USD / COP</span>
          <span className="font-medium text-foreground">
            {settings.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      <div className="mt-auto px-[18px] py-4 border-t border-border text-[11px] leading-normal text-muted-2">
        v0.2 · sincronizado con app móvil
      </div>
    </aside>
  )
}
