'use client'

import { Modal } from '@/components/ui/modal'
import { SHORTCUTS } from '@/lib/useShortcuts'

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado" size="sm">
      <ul className="space-y-2.5">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-foreground">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="min-w-7 h-7 px-2 inline-flex items-center justify-center rounded-lg bg-surface-2 border border-border text-xs font-semibold text-muted">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
