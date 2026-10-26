// Re-exporta los helpers compartidos de "Deshacer" y agrega la vibración
// háptica propia de mobile.
import { setUndoFeedback } from '@finanzas/core/lib/undo'
import { haptic } from './haptics'

setUndoFeedback(() => haptic('warning'))

export { deleteTransactionsWithUndo, updateAsignacionesWithUndo, offerUndo } from '@finanzas/core/lib/undo'
