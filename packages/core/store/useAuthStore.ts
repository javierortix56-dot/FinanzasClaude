import { create } from 'zustand'
import { Currency } from '../types'

interface AuthState {
  monedaBase: Currency
  setMonedaBase: (m: Currency) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  monedaBase: 'ARS',
  setMonedaBase: (monedaBase) => set({ monedaBase }),
}))
