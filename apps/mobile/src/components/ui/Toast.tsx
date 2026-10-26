'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, XCircle, Undo2 } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { haptic } from '@/lib/haptics'
import { springPop } from './motion'

const DURATION = 2500
/** Con acción ("Deshacer") se deja más tiempo para reaccionar */
const DURATION_ACTION = 5500

export default function Toast() {
  const { toast, hideToast } = useUIStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!toast) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hideToast, toast.action ? DURATION_ACTION : DURATION)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast, hideToast])

  const isSuccess = toast?.type === 'success'

  return (
    <div className="fixed bottom-[104px] inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95, transition: { duration: 0.18 } }}
            transition={springPop}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 30) hideToast() }}
            className="pointer-events-auto flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-full glass-strong max-w-[350px] text-sm font-semibold text-gray-900"
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
            }`}>
              {isSuccess
                ? <CheckCircle2 size={16} className="text-white" />
                : <XCircle size={16} className="text-white" />
              }
            </span>
            <span className="leading-tight pr-2">{toast.message}</span>
            {toast.action && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => { haptic('light'); toast.action!.onClick(); hideToast() }}
                className="flex items-center gap-1 h-8 px-3 rounded-full bg-primary/12 text-primary text-[13px] font-bold whitespace-nowrap"
              >
                <Undo2 size={14} /> {toast.action.label}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
