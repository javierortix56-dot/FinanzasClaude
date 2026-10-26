'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { springPop } from './motion'

const DURATION = 2500

export default function Toast() {
  const { toast, hideToast } = useUIStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!toast) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hideToast, DURATION)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast, hideToast])

  const isSuccess = toast?.type === 'success'

  return (
    <div className="fixed bottom-[104px] inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message + toast.type}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95, transition: { duration: 0.18 } }}
            transition={springPop}
            onClick={hideToast}
            className="pointer-events-auto flex items-center gap-2.5 pl-2.5 pr-4 py-2.5 rounded-full glass-strong max-w-[340px] text-sm font-semibold text-gray-900"
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
            }`}>
              {isSuccess
                ? <CheckCircle2 size={16} className="text-white" />
                : <XCircle size={16} className="text-white" />
              }
            </span>
            <span className="leading-tight">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
