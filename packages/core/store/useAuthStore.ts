import { create } from 'zustand'
import { Currency, SessionUser } from '../types'

interface AuthState {
  /** Usuario logueado (null = sin sesión) */
  user: SessionUser | null
  /** true cuando ya se resolvió el estado inicial de la sesión */
  authReady: boolean
  monedaBase: Currency
  setUser: (u: SessionUser | null) => void
  setAuthReady: (v: boolean) => void
  setMonedaBase: (m: Currency) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authReady: false,
  monedaBase: 'ARS',
  // Mantiene la referencia si es el mismo usuario (los TOKEN_REFRESHED del
  // SDK no deben re-disparar effects que dependen de `user`).
  setUser: (u) => {
    const prev = get().user
    if (prev?.id === u?.id && prev?.email === u?.email) return
    set({ user: u })
  },
  setAuthReady: (authReady) => set({ authReady }),
  setMonedaBase: (monedaBase) => set({ monedaBase }),
}))
