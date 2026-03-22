import { create } from 'zustand'
import { Transaction } from '@/types'

interface UIState {
  isTransactionModalOpen: boolean
  editingTransaction: Transaction | null
  openAddModal: () => void
  openEditModal: (tx: Transaction) => void
  closeTransactionModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isTransactionModalOpen: false,
  editingTransaction: null,
  openAddModal: () => set({ isTransactionModalOpen: true, editingTransaction: null }),
  openEditModal: (tx) => set({ isTransactionModalOpen: true, editingTransaction: tx }),
  closeTransactionModal: () => set({ isTransactionModalOpen: false, editingTransaction: null }),
}))
