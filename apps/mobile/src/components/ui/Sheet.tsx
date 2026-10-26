'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { springSoft } from './motion'

interface Props {
  open: boolean
  onClose: () => void
  /** Título accesible y visible. Con `hideTitle` queda solo para lectores de pantalla. */
  title: React.ReactNode
  subtitle?: React.ReactNode
  hideTitle?: boolean
  /** Contenido extra en la fila del título (p. ej. un segmented control) */
  headerContent?: React.ReactNode
  /** Pie fijo (acciones). Queda siempre visible sin scrollear. */
  footer?: React.ReactNode
  children: React.ReactNode
  /** Clases del contenedor scrolleable */
  bodyClassName?: string
  zIndex?: number
}

/**
 * Bottom sheet único de la app: Radix Dialog (foco, escape, aria) + Motion
 * (entrada con resorte, overlay con blur y arrastre hacia abajo para cerrar
 * desde el header). Reemplaza los 8 modales que repetían el mismo markup.
 */
export default function Sheet({
  open, onClose, title, subtitle, hideTitle, headerContent, footer, children,
  bodyClassName = 'px-5 pb-6 space-y-4', zIndex = 50,
}: Props) {
  const controls = useDragControls()

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-black/35 backdrop-blur-[6px]"
                style={{ zIndex }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[390px] sheet-surface rounded-t-[28px] outline-none flex flex-col max-h-[92dvh]"
                style={{ zIndex }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={springSoft}
                drag="y"
                dragControls={controls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={handleDragEnd}
              >
                {/* Header: zona de arrastre */}
                <div
                  className="flex-shrink-0 px-5 pt-2.5 pb-3 touch-none cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => controls.start(e)}
                >
                  <div className="flex justify-center pb-3">
                    <div className="w-10 h-1.5 rounded-full bg-gray-300/70" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 min-w-0 ${hideTitle ? 'sr-only' : ''}`}>
                      <Dialog.Title className="text-[17px] font-bold text-gray-900 tracking-tight truncate">
                        {title}
                      </Dialog.Title>
                      {subtitle && <div className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</div>}
                    </div>
                    {headerContent && <div className="flex-1 min-w-0">{headerContent}</div>}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={onClose}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-500/10 hover:bg-gray-500/15 transition-colors"
                      aria-label="Cerrar"
                    >
                      <X size={16} className="text-gray-600" />
                    </motion.button>
                  </div>
                </div>

                <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bodyClassName}`}>
                  {children}
                </div>

                {footer && (
                  <div className="flex-shrink-0 border-t border-hairline px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/** Etiqueta de campo dentro de un sheet */
export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <p className="eyebrow mb-2 flex items-center gap-1.5">
      {children}
      {hint && <span className="normal-case tracking-normal font-medium text-gray-300">{hint}</span>}
    </p>
  )
}

/** Input estándar de los formularios */
export const fieldClass =
  'w-full h-11 bg-gray-500/[0.06] rounded-2xl px-3.5 text-sm text-gray-900 outline-none border border-transparent focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-gray-400'

/** Input grande para montos */
export const amountFieldClass =
  'amount-input w-full bg-gray-500/[0.06] rounded-2xl px-4 py-2.5 font-bold tracking-tight text-gray-900 tabular-nums outline-none border border-transparent focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-gray-300'
