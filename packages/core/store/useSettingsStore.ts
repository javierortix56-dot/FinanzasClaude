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
  // Privacidad: la app arranca SIEMPRE en modo incógnito (montos ocultos).
  // El store no persiste, así que cada apertura/recarga vuelve a ocultar;
  // el botón del ojo (toggleHideAmounts) los muestra solo en la sesión actual.
  hideAmounts: true,
  setSettings: (settings) => set({ settings }),
  toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),
}))
