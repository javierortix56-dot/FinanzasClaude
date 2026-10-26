'use client'

import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@finanzas/core/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/**
 * Modal de la app: Radix Dialog (foco atrapado, Escape, aria) + Motion
 * (overlay con blur y entrada con resorte). Reemplaza al modal casero que
 * no atrapaba el foco ni anunciaba el diálogo a lectores de pantalla.
 */
export function Modal({ open, onClose, title, description, children, size = 'md', footer }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className={cn('pointer-events-auto w-full sheet-surface rounded-[22px] outline-none flex flex-col max-h-[90vh]', sizes[size])}
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-hairline shrink-0">
                    <div className="min-w-0">
                      <Dialog.Title className="text-[17px] font-semibold tracking-tight text-foreground">{title}</Dialog.Title>
                      {description && <div className="text-xs text-muted mt-1">{description}</div>}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-surface-2 text-muted hover:text-foreground transition-colors"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </motion.button>
                  </div>
                  <div className="px-6 py-5 overflow-y-auto min-h-0">{children}</div>
                  {footer && <div className="px-6 py-4 border-t border-hairline shrink-0">{footer}</div>}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
