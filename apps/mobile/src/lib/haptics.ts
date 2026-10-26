// Vibración háptica breve en acciones clave. Solo Android/Chrome implementa
// navigator.vibrate; en iOS Safari es un no-op silencioso.

const PATTERNS = {
  light: 8,
  success: [10, 40, 18],
  warning: [24, 50, 24],
} as const

export function haptic(kind: keyof typeof PATTERNS = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[kind] as number | number[])
    }
  } catch { /* sin soporte */ }
}
