'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'

export function ToastViewport() {
  const { toast, hideToast } = useUIStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, 3000)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  if (!toast) return null

  const Icon = toast.type === 'success' ? CheckCircle2 : XCircle
  const color = toast.type === 'success' ? 'text-income' : 'text-expense'

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm text-foreground">{toast.message}</span>
      </div>
    </div>
  )
}
