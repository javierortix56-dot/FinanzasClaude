'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@finanzas/core/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, size = 'md', footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null

    function focusables(): HTMLElement[] {
      return Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    }

    // Foco inicial dentro del diálogo
    focusables()[0]?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Focus trap: Tab/Shift+Tab ciclan dentro del diálogo
      if (e.key === 'Tab') {
        const els = focusables()
        if (els.length === 0) return
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !panelRef.current?.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      // Devolver el foco a quien abrió el diálogo
      prevActive?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('w-full rounded-xl bg-surface shadow-xl border border-border', sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border bg-surface-2 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  )
}
