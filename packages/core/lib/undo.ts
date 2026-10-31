// Borrados con "Deshacer" (compartido por mobile y desktop): la acción se
// ejecuta al instante y el toast ofrece revertirla unos segundos. Revertir
// restaura el mismo registro (mismo id), así que no se rompen asignaciones.
import { useUIStore } from '../store/useUIStore'
import { deleteTransaction, restoreTransactions, updateTransaction } from './transactions'
import { adjustAssetSaldo } from './assets'
import { Asignacion, Transaction } from '../types'

let feedback: (() => void) | null = null

/** Hook opcional de feedback (p. ej. vibración en mobile) al mostrar el toast */
export function setUndoFeedback(fn: (() => void) | null) {
  feedback = fn
}

function toast(message: string, onUndo: () => Promise<void>) {
  feedback?.()
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
  const pagos = txs.filter((t) => t.pagoTarjeta)
  if (pagos.length) {
    txs = txs.filter((t) => !t.pagoTarjeta)
    useUIStore.getState().showToast(
      pagos.length === 1
        ? 'El pago de tarjeta es automático: no se puede borrar'
        : `${pagos.length} pagos de tarjeta no se borraron (son automáticos)`,
      'warning',
    )
    if (txs.length === 0) return
  }
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

/**
 * Aplica cambios de asignaciones (a ingresos o, con `tarjetaId`, a una
 * tarjeta) guardando el estado previo para deshacer.
 */
export async function updateAsignacionesWithUndo(
  changes: { tx: Transaction; asignaciones: Asignacion[]; tarjetaId?: string | null }[],
  message: string,
) {
  const prev = changes.map(({ tx }) => ({ id: tx.id!, asignaciones: tx.asignaciones, tarjetaId: tx.tarjetaId ?? null }))
  await Promise.allSettled(changes.map(({ tx, asignaciones, tarjetaId }) =>
    updateTransaction(tx.id!, { asignaciones, ...(tarjetaId !== undefined ? { tarjetaId } : {}) })))
  toast(message, async () => {
    await Promise.allSettled(prev.map(({ id, asignaciones, tarjetaId }) => updateTransaction(id, { asignaciones, tarjetaId })))
  })
}

/** Toast de deshacer genérico para borrados que el llamador sabe revertir */
export function offerUndo(message: string, onUndo: () => Promise<void>) {
  toast(message, onUndo)
}
