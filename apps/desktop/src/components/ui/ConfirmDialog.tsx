'use client'

import { Modal } from './modal'
import { Button } from './button'

/** Confirmación in-app (reemplaza al confirm() nativo, que bloquea y no sigue el tema) */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel,
}: {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{message}</p>
    </Modal>
  )
}
