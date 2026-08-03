import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import DataProvider from '@/components/DataProvider'
import { ToastViewport } from '@/components/ui/toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      {/* Shell anclado al viewport: cada vista decide dónde scrollea
          (el libro mayor mantiene sus dos columnas a la vista). */}
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Topbar />
          {children}
        </div>
        <ToastViewport />
      </div>
    </DataProvider>
  )
}
