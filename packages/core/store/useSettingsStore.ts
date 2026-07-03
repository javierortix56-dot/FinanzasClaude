import { create } from 'zustand'
import { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../lib/settings'

// ── Persistencia: la PWA arranca con las settings de la última sesión ────────
// (tipos de cambio y categorías correctos al instante, sin esperar el fetch)
const CACHE_KEY = 'finanzas-settings-v1'

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Settings) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persistSettings(s: Settings) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(s)) } catch { /* noop */ }
}

/** Borra las settings persistidas (se llama al cerrar sesión). */
export function clearSettingsCache() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(CACHE_KEY) } catch { /* noop */ }
}

interface SettingsState {
  settings: Settings | null
  hideAmounts: boolean
  setSettings: (settings: Settings) => void
  toggleHideAmounts: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Arrancamos con las últimas settings conocidas (o defaults) para que la UI
  // pinte al instante; las reales las reemplazan apenas cargan desde Supabase.
  settings: loadSettings(),
  // Privacidad: la app arranca SIEMPRE en modo incógnito (montos ocultos).
  // El store no persiste este flag, así que cada apertura/recarga vuelve a
  // ocultar; el botón del ojo (toggleHideAmounts) los muestra solo en la sesión.
  hideAmounts: true,
  setSettings: (settings) => {
    persistSettings(settings)
    set({ settings })
  },
  toggleHideAmounts: () => set((state) => ({ hideAmounts: !state.hideAmounts })),
}))
