'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  PieChart,
  Settings,
  Link2,
  Keyboard,
} from 'lucide-react'
import { cn } from '@finanzas/core/lib/utils'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { haceCuanto } from '@finanzas/core/lib/cotizaciones'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'

export const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/movimientos',   label: 'Movimientos',  icon: ArrowRightLeft },
  { href: '/asignaciones',  label: 'Asignaciones', icon: Link2 },
  { href: '/cuentas',       label: 'Cuentas',      icon: Wallet },
  { href: '/analisis',      label: 'Análisis',     icon: PieChart },
  { href: '/ajustes',       label: 'Ajustes',      icon: Settings },
]

/** Egresos sin ingreso de respaldo (incluye los asignados a ingresos borrados) */
export function useSinAsignar(): number {
  const transactions = useTransactionStore((s) => s.transactions)
  const ingresoIds = new Set(transactions.filter((t) => t.tipo === 'ingreso').map((t) => t.id))
  return transactions.filter(
    (t) => t.tipo === 'egreso' && !t.asignaciones.some((a) => ingresoIds.has(a.ingresoId)),
  ).length
}

export function Sidebar({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const pathname = usePathname()
  const transactions = useTransactionStore((s) => s.transactions)
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const sinAsignar = useSinAsignar()

  const counts: Record<string, { value: number; tone: 'neutral' | 'warning' }> = {
    '/movimientos': { value: transactions.length, tone: 'neutral' },
    '/asignaciones': { value: sinAsignar, tone: 'warning' },
  }

  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col m-3 mr-0 rounded-[22px] glass min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-4 h-[60px] shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-primary-foreground font-bold text-[12px] tracking-tight shadow-card">
          J&amp;M
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">Finanzas J&amp;M</div>
          <div className="text-xs text-muted">Desktop</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5 pb-2.5">
        {NAV_ITEMS.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/')
          const Icon = it.icon
          const count = counts[it.href]
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-[11px] rounded-xl px-[11px] py-2 text-[13px] font-medium transition-colors',
                active ? 'text-primary' : 'text-foreground/80 hover:text-foreground hover:bg-surface-2',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/15"
                />
              )}
              <Icon className="relative h-[17px] w-[17px] shrink-0" />
              <span className="relative">{it.label}</span>
              <AnimatePresence>
                {count && count.value > 0 && (
                  <motion.span
                    key={count.value}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className={cn(
                      'relative ml-auto rounded-full px-[7px] py-0.5 text-[11px] font-semibold tabular-nums',
                      count.tone === 'warning'
                        ? 'bg-unassigned-soft text-unassigned'
                        : 'bg-surface-2 text-muted',
                    )}
                  >
                    {count.value}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      <div className="mx-3 rounded-2xl bg-surface-2 px-3 py-[11px] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Tipo de cambio</div>
          <span className="rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-semibold text-primary uppercase" title={`Actualizado ${haceCuanto(settings.cambioActualizado)}`}>
            {settings.fuenteCambio === 'manual' ? 'Manual' : (settings.fuenteCambio ?? 'mep').toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between text-[13px] tabular-nums">
          <span className="text-muted">USD / ARS</span>
          <strong className="text-foreground">
            {settings.tipoCambio.ARS_USD.toLocaleString('es-AR')}
          </strong>
        </div>
        <div className="flex justify-between text-[13px] tabular-nums">
          <span className="text-muted">USD / COP</span>
          <strong className="text-foreground">
            {settings.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </strong>
        </div>
      </div>

      <div className="mt-auto px-4 py-4 flex items-center justify-between text-[11px] leading-normal text-muted-2">
        <span>Sincronizado con la app móvil</span>
        <button
          onClick={onShowShortcuts}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-surface-2 hover:text-foreground transition-colors"
          title="Atajos de teclado (?)"
        >
          <Keyboard className="h-3.5 w-3.5" /> ?
        </button>
      </div>
    </aside>
  )
}
