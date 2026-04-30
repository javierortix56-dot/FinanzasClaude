import { create } from 'zustand'
import { Transaction } from '@/types'
import { getCurrentMonth, shiftMonth } from '@/lib/constants'

interface TransactionState {
  transactions: Transaction[]
  currentMonth: string
  isLoading: boolean
  setTransactions: (txs: Transaction[]) => void
  setLoading: (v: boolean) => void
  prevMonth: () => void
  nextMonth: () => void
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  currentMonth: getCurrentMonth(),
  isLoading: true,
  setTransactions: (transactions) => set({ transactions, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  prevMonth: () => set({ currentMonth: shiftMonth(get().currentMonth, -1), isLoading: true }),
  nextMonth: () => set({ currentMonth: shiftMonth(get().currentMonth, +1), isLoading: true }),
}))
