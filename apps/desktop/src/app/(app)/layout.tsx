'use client'

import { useCallback, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import DataProvider from '@/components/DataProvider'
import { ToastViewport } from '@/components/ui/toast'
import { GlobalTransactionModal } from '@/components/GlobalTransactionModal'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { useShortcuts } from '@/lib/useShortcuts'

function Shell({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const openHelp = useCallback(() => setHelpOpen(true), [])
  useShortcuts(openHelp)

  return (
    // Shell anclado al viewport: cada vista decide dónde scrollea
    // (el libro mayor mantiene sus dos columnas a la vista).
    <div className="flex h-screen overflow-hidden">
      <Sidebar onShowShortcuts={openHelp} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar />
        {children}
      </div>
      <ToastViewport />
      <GlobalTransactionModal />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // reducedMotion="user": respeta "Reducir movimiento" del sistema
    <MotionConfig reducedMotion="user">
      <DataProvider>
        <Shell>{children}</Shell>
      </DataProvider>
    </MotionConfig>
  )
}
