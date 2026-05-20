import { create } from 'zustand'
import { Settings } from '../types'

interface SettingsState {
  settings: Settings | null
  hideAmounts: boolean
  setSettings: (settings: Settings) => void
  toggleHideAmounts: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  hideAmounts: false,
  setSettings: (settings) => set({ settings }),
  toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),
}))
