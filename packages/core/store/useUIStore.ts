import { create } from 'zustand'
import { Transaction } from '../types'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  message: string
  type: 'success' | 'error'
  /** Acción opcional (p. ej. "Deshacer"); el toast dura más cuando la tiene */
  action?: ToastAction
  /** Identifica cada toast para que dos iguales seguidos reinicien el timer */
  id: number
}

interface UIState {
  isTransactionModalOpen: boolean
  editingTransaction: Transaction | null
  toast: Toast | null
  openAddModal: () => void
  openEditModal: (tx: Transaction) => void
  closeTransactionModal: () => void
  showToast: (message: string, type?: 'success' | 'error', action?: ToastAction) => void
  hideToast: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isTransactionModalOpen: false,
  editingTransaction: null,
  toast: null,
  openAddModal: () => set({ isTransactionModalOpen: true, editingTransaction: null }),
  openEditModal: (tx) => set({ isTransactionModalOpen: true, editingTransaction: tx }),
  // editingTransaction se conserva al cerrar: el sheet anima su salida con el
  // contenido intacto. openAddModal / openEditModal lo reemplazan al reabrir.
  closeTransactionModal: () => set({ isTransactionModalOpen: false }),
  showToast: (message, type = 'success', action) => set({ toast: { message, type, action, id: Date.now() } }),
  hideToast: () => set({ toast: null }),
}))
