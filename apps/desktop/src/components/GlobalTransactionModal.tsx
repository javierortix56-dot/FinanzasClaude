'use client'

import { useUIStore } from '@finanzas/core/store/useUIStore'
import { TransactionModal } from '@/components/modals/TransactionModal'

/** Modal de movimiento disparado desde la barra superior o el atajo N */
export function GlobalTransactionModal() {
  const { isTransactionModalOpen, editingTransaction, closeTransactionModal } = useUIStore()
  return (
    <TransactionModal
      open={isTransactionModalOpen}
      onClose={closeTransactionModal}
      editing={editingTransaction}
    />
  )
}
