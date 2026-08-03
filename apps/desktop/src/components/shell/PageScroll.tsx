import { cn } from '@finanzas/core/lib/utils'

/**
 * Contenedor de las vistas que scrollean de forma convencional
 * (dashboard, cuentas, análisis, ajustes). Movimientos y Asignaciones
 * usan su propio `<main>` porque scrollean por panel.
 */
export function PageScroll({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className={cn('mx-auto w-full max-w-[1600px] px-4 lg:px-6 py-5', className)}>
        {children}
      </div>
    </main>
  )
}
