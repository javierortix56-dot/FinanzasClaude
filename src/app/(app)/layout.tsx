'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUIStore } from '@/store/useUIStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import { subscribeToTransactions } from '@/lib/transactions'
import TransactionModal from '@/components/transactions/TransactionModal'
import { LayoutDashboard, Wallet, BarChart2, Settings, Plus } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Resumen'   },
  { href: '/patrimonio', icon: Wallet,           label: 'Cuentas'  },
  { href: '/analisis',   icon: BarChart2,        label: 'Análisis' },
  { href: '/ajustes',    icon: Settings,         label: 'Ajustes'  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { openAddModal } = useUIStore()
  const pathname = usePathname()
  const { currentMonth, setTransactions } = useTransactionStore()

  // Global transaction subscription — available on all pages
  useEffect(() => {
    const unsub = subscribeToTransactions(currentMonth, setTransactions)
    return () => unsub()
  }, [currentMonth, setTransactions])

  const leftNav  = NAV_ITEMS.slice(0, 2)
  const rightNav = NAV_ITEMS.slice(2)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 overflow-x-hidden">
      <main className="flex-1 pb-20 overflow-x-hidden">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 shadow-lg z-40">
        <div className="flex items-end justify-around px-2 py-2 relative">
          {leftNav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${
                  active ? 'text-[#534AB7]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          {/* FAB */}
          <button
            onClick={openAddModal}
            className="relative -top-4 w-14 h-14 rounded-full bg-[#534AB7] flex items-center justify-center shadow-xl shadow-[#534AB7]/40 active:scale-95 transition-transform z-50"
            aria-label="Agregar movimiento"
          >
            <Plus size={26} color="white" strokeWidth={2.5} />
          </button>

          {rightNav.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${
                  active ? 'text-[#534AB7]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Global modal — mounted once, always available */}
      <TransactionModal />
    </div>
  )
}
