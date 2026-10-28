'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, XCircle, AlertTriangle, Undo2 } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'

const DURATION = 3000
/** Las advertencias suelen ser más largas de leer */
const DURATION_WARNING = 5000
/** Con acción ("Deshacer") se deja más tiempo para reaccionar */
const DURATION_ACTION = 6000

export function ToastViewport() {
  const { toast, hideToast } = useUIStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, toast.action ? DURATION_ACTION : toast.type === 'warning' ? DURATION_WARNING : DURATION)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  const type = toast?.type ?? 'success'

  return (
    <div className="fixed bottom-6 right-6 z-[60] pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl glass-strong pl-3 pr-2 py-2.5 min-w-[280px] max-w-[420px]"
          >
            <span className={`h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 ${
              type === 'success' ? 'bg-income' : type === 'warning' ? 'bg-amber-500' : 'bg-expense'
            }`}>
              {type === 'success' ? <CheckCircle2 className="h-4 w-4 text-white" />
                : type === 'warning' ? <AlertTriangle className="h-4 w-4 text-white" />
                : <XCircle className="h-4 w-4 text-white" />}
            </span>
            <span className="text-sm font-medium text-foreground flex-1 pr-2">{toast.message}</span>
            {toast.action && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => { toast.action!.onClick(); hideToast() }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary/12 text-primary text-[13px] font-semibold hover:bg-primary/20 transition-colors"
              >
                <Undo2 className="h-3.5 w-3.5" /> {toast.action.label}
                <kbd className="ml-1 text-[10px] font-medium text-primary/70">⌘Z</kbd>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
