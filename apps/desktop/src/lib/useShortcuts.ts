'use client'

import { useEffect } from 'react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'Nuevo movimiento' },
  { keys: ['←', '→'], label: 'Mes anterior / siguiente' },
  { keys: ['H'], label: 'Ocultar / mostrar cifras' },
  { keys: ['⌘', 'Z'], label: 'Deshacer la última eliminación' },
  { keys: ['?'], label: 'Ver atajos de teclado' },
]

function escribiendo(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** Atajos globales de teclado del desktop */
export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘Z / Ctrl+Z: ejecuta el "Deshacer" del toast visible (si hay)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !escribiendo(e.target)) {
        const { toast, hideToast } = useUIStore.getState()
        if (toast?.action) {
          e.preventDefault()
          toast.action.onClick()
          hideToast()
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || escribiendo(e.target)) return
      // No interferir mientras hay un diálogo abierto
      if (document.querySelector('[role="dialog"]')) return

      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          useUIStore.getState().openAddModal()
          break
        case 'ArrowLeft':
          useTransactionStore.getState().prevMonth()
          break
        case 'ArrowRight':
          useTransactionStore.getState().nextMonth()
          break
        case 'h':
        case 'H':
          useSettingsStore.getState().toggleHideAmounts()
          break
        case '?':
          onHelp()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onHelp])
}
