// Tema de la app: 'system' sigue al sistema operativo; 'light'/'dark' lo
// fuerzan con data-theme en <html> (ver globals.css). Se guarda por dispositivo.

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'finanzas-theme'

const THEME_COLOR = { light: '#f3f2fa', dark: '#0c0d14' }

export function getThemePref(): ThemePref {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, pref)
  } catch { /* modo privado: solo en memoria */ }
  applyTheme(pref)
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)

  // La barra de estado acompaña al tema efectivo
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light)
  })
}

/** Script inline para <head>: aplica el tema guardado antes del primer pintado (sin parpadeo) */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`
