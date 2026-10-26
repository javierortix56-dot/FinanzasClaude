import { create } from 'zustand'

// Introducción de 3 pantallas: se muestra sola la primera vez (por
// dispositivo) y se puede volver a abrir desde Ajustes.
const KEY = 'finanzas-onboarding-v1'

interface OnboardingState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

export function openOnboarding() {
  useOnboardingStore.getState().setOpen(true)
}

export function onboardingVisto(): boolean {
  try { return window.localStorage.getItem(KEY) === '1' } catch { return true }
}

export function marcarOnboardingVisto() {
  try { window.localStorage.setItem(KEY, '1') } catch { /* modo privado */ }
}
