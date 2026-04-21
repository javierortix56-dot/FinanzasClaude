'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'

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

  if (!toast) return null

  const isSuccess = toast.type === 'success'

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-semibold max-w-[340px] w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-200 ${
        isSuccess ? 'bg-[#1a7a4a]' : 'bg-red-600'
      }`}
    >
      {isSuccess
        ? <CheckCircle2 size={18} className="flex-shrink-0" />
        : <XCircle size={18} className="flex-shrink-0" />
      }
      <span className="flex-1 leading-tight">{toast.message}</span>
    </div>
  )
}
