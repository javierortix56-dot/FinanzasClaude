'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import {
  LayoutDashboard,
  Wallet,
  BarChart2,
  Settings,
  Plus,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/patrimonio', icon: Wallet, label: 'Cuentas' },
  { href: '/analisis', icon: BarChart2, label: 'Análisis' },
  { href: '/ajustes', icon: Settings, label: 'Ajustes' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-3 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  // Split nav: 2 items | FAB | 2 items
  const leftNav = NAV_ITEMS.slice(0, 2)
  const rightNav = NAV_ITEMS.slice(2)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Page content — leave space for bottom nav */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 shadow-lg z-50">
        <div className="flex items-end justify-around px-2 py-2 relative">
          {/* Left tabs */}
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

          {/* FAB center */}
          <button
            onClick={() => {
              // Will open add-transaction modal in step 3
            }}
            className="relative -top-4 w-14 h-14 rounded-full bg-[#534AB7] flex items-center justify-center shadow-xl shadow-[#534AB7]/40 active:scale-95 transition-transform"
            aria-label="Agregar movimiento"
          >
            <Plus size={26} color="white" strokeWidth={2.5} />
          </button>

          {/* Right tabs */}
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
    </div>
  )
}
