import { create } from 'zustand'
import { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/settings'

interface SettingsState {
  settings: Settings | null
  hideAmounts: boolean
  setSettings: (settings: Settings) => void
  toggleHideAmounts: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Arrancamos con defaults válidos (no null) para que la UI pinte al instante;
  // las settings reales los reemplazan apenas cargan desde Supabase.
  settings: DEFAULT_SETTINGS,
  hideAmounts: false,
  setSettings: (settings) => set({ settings }),
  toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),
}))
