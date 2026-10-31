'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { subscribeToTransactions } from '@finanzas/core/lib/transactions'
import { programarSyncPagos } from '@finanzas/core/lib/tarjetas'
import { subscribeToAssets } from '@finanzas/core/lib/assets'
import TransactionModal from '@/components/transactions/TransactionModal'
import Toast from '@/components/ui/Toast'
import Onboarding from '@/components/Onboarding'
import { spring, springPop } from '@/components/ui/motion'
import { LayoutDashboard, Wallet, BarChart2, Settings, Plus, type LucideIcon } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Resumen'   },
  { href: '/patrimonio', icon: Wallet,           label: 'Cuentas'  },
  { href: '/analisis',   icon: BarChart2,        label: 'Análisis' },
  { href: '/ajustes',    icon: Settings,         label: 'Ajustes'  },
]

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: LucideIcon; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="relative flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={spring}
          className="absolute inset-x-1.5 inset-y-1.5 rounded-[18px] bg-primary/10"
        />
      )}
      <motion.span
        className="relative"
        animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
        transition={spring}
      >
        <Icon size={21} strokeWidth={active ? 2.3 : 1.8} className={active ? 'text-primary' : 'text-gray-400'} />
      </motion.span>
      <span className={`relative text-[10px] font-semibold transition-colors ${active ? 'text-primary' : 'text-gray-400'}`}>
        {label}
      </span>
    </Link>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { openAddModal, isTransactionModalOpen } = useUIStore()
  const pathname = usePathname()
  const { currentMonth, setMonthTransactions } = useTransactionStore()
  const { setAssets } = useAssetStore()

  // Global subscriptions — available on all pages
  useEffect(() => {
    const unsub = subscribeToTransactions(currentMonth, (txs) => {
      setMonthTransactions(currentMonth, txs)
      // Cualquier cambio puede mover el pago de una tarjeta (consumos, abonos)
      programarSyncPagos()
    })
    return () => unsub()
  }, [currentMonth, setMonthTransactions])

  useEffect(() => {
    const unsub = subscribeToAssets(setAssets)
    return () => unsub()
  }, [setAssets])

  const leftNav  = NAV_ITEMS.slice(0, 2)
  const rightNav = NAV_ITEMS.slice(2)

  return (
    <div className="flex flex-col h-[100dvh] overflow-x-hidden">
      <main className="flex-1 min-h-0 overflow-x-hidden">{children}</main>

      {/* Dock flotante */}
      <nav className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[366px] z-40">
        <div className="glass-strong rounded-[24px] h-[58px] flex items-stretch px-1">
          {leftNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}

          {/* FAB */}
          <div className="w-[72px] flex items-center justify-center flex-shrink-0">
            <motion.button
              onClick={openAddModal}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              transition={springPop}
              className="relative -mt-6 w-[54px] h-[54px] rounded-[18px] bg-brand flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(38,54,63,0.6)] ring-4 ring-[var(--background)]"
              aria-label="Agregar movimiento"
            >
              <motion.span
                animate={{ rotate: isTransactionModalOpen ? 45 : 0 }}
                transition={springPop}
                className="inline-flex"
              >
                <Plus size={26} color="white" strokeWidth={2.5} />
              </motion.span>
            </motion.button>
          </div>

          {rightNav.map((item) => (
            <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}
        </div>
      </nav>

      {/* Global modal — mounted once, always available */}
      <TransactionModal />
      <Toast />
      <Onboarding />
    </div>
  )
}
