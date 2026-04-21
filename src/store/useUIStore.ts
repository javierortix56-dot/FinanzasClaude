import { create } from 'zustand'
import { Transaction } from '@/types'

interface Toast {
  message: string
  type: 'success' | 'error'
}

interface UIState {
  isTransactionModalOpen: boolean
  editingTransaction: Transaction | null
  toast: Toast | null
  openAddModal: () => void
  openEditModal: (tx: Transaction) => void
  closeTransactionModal: () => void
  showToast: (message: string, type?: 'success' | 'error') => void
  hideToast: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isTransactionModalOpen: false,
  editingTransaction: null,
  toast: null,
  openAddModal: () => set({ isTransactionModalOpen: true, editingTransaction: null }),
  openEditModal: (tx) => set({ isTransactionModalOpen: true, editingTransaction: tx }),
  closeTransactionModal: () => set({ isTransactionModalOpen: false, editingTransaction: null }),
  showToast: (message, type = 'success') => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
}))
