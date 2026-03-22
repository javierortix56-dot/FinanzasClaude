import { create } from 'zustand'
import { User as FirebaseUser } from 'firebase/auth'
import { Currency } from '@/types'

interface AuthState {
  user: FirebaseUser | null
  loading: boolean
  monedaBase: Currency
  setUser: (user: FirebaseUser | null) => void
  setLoading: (loading: boolean) => void
  setMonedaBase: (m: Currency) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  monedaBase: 'ARS',
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setMonedaBase: (monedaBase) => set({ monedaBase }),
}))
