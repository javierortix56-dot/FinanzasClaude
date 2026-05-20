import { create } from 'zustand'
import { Budget } from '../types'

interface BudgetState {
  budgets: Budget[]
  setBudgets: (b: Budget[]) => void
  getBudget: (categoria: string) => Budget | undefined
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  setBudgets: (budgets) => set({ budgets }),
  getBudget: (categoria) => get().budgets.find((b) => b.categoria === categoria),
}))
