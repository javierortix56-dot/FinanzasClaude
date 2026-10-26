// Borrados con "Deshacer": la acción se ejecuta al instante (sin doble toque)
// y el toast ofrece revertirla durante unos segundos. Revertir restaura el
// mismo registro (mismo id), así que no se rompen asignaciones ni vínculos.
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { deleteTransaction, restoreTransactions, updateTransaction } from '@finanzas/core/lib/transactions'
import { adjustAssetSaldo } from '@finanzas/core/lib/assets'
import { Transaction, Asignacion } from '@finanzas/core/types'
import { haptic } from './haptics'

function toast(message: string, onUndo: () => Promise<void>) {
  haptic('warning')
  useUIStore.getState().showToast(message, 'success', {
    label: 'Deshacer',
    onClick: () => {
      onUndo().catch((err) => {
        console.error('[undo] error:', err)
        useUIStore.getState().showToast('No se pudo deshacer', 'error')
      })
    },
  })
}

function txMonth(tx: Transaction) {
  return tx.fecha.toDate().toISOString().slice(0, 7)
}

/** Borra movimientos (revirtiendo su impacto en cuentas de ahorro) con opción de deshacer */
export async function deleteTransactionsWithUndo(txs: Transaction[], message?: string) {
  for (const tx of txs) {
    if (tx.ahorroAssetId) {
      try { await adjustAssetSaldo(tx.ahorroAssetId, -tx.monto, txMonth(tx)) } catch { /* no bloqueante */ }
    }
    await deleteTransaction(tx.id!)
  }
  toast(message ?? (txs.length === 1 ? 'Movimiento eliminado' : `${txs.length} movimientos eliminados`), async () => {
    await restoreTransactions(txs)
    for (const tx of txs) {
      if (tx.ahorroAssetId) {
        try { await adjustAssetSaldo(tx.ahorroAssetId, tx.monto, txMonth(tx)) } catch { /* no bloqueante */ }
      }
    }
  })
}

/** Aplica cambios de asignaciones guardando el estado previo para deshacer */
export async function updateAsignacionesWithUndo(
  changes: { tx: Transaction; asignaciones: Asignacion[] }[],
  message: string,
) {
  const prev = changes.map(({ tx }) => ({ id: tx.id!, asignaciones: tx.asignaciones }))
  await Promise.allSettled(changes.map(({ tx, asignaciones }) => updateTransaction(tx.id!, { asignaciones })))
  toast(message, async () => {
    await Promise.allSettled(prev.map(({ id, asignaciones }) => updateTransaction(id, { asignaciones })))
  })
}

/** Toast de deshacer genérico para borrados que el llamador sabe revertir */
export function offerUndo(message: string, onUndo: () => Promise<void>) {
  toast(message, onUndo)
}
