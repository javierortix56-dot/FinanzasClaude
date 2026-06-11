/**
 * Parser de montos compartido entre apps.
 *
 * Acepta tanto formato es-AR ("1.234,56") como formato US ("1,234.56" /
 * "1234.56"). Reglas:
 *   - Si hay coma y punto, el separador que aparece ÚLTIMO es el decimal.
 *   - Solo comas: una coma → decimal ("12,5"); varias → miles ("1,234,567").
 *   - Solo puntos: un punto → decimal ("12.5"); varios → miles ("1.234.567").
 *
 * Devuelve `null` si el texto no es un número válido, es NaN/Infinity o es
 * negativo (salvo `allowNegative`, p. ej. retiros en snapshots).
 */
export function parseAmount(
  input: string,
  opts: { allowNegative?: boolean } = {}
): number | null {
  const raw = input.trim()
  if (!raw) return null

  let normalized = raw
  const lastComma = raw.lastIndexOf(',')
  const lastDot   = raw.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // es-AR: "1.234,56" → puntos = miles, coma = decimal
      normalized = raw.replace(/\./g, '').replace(',', '.')
    } else {
      // US: "1,234.56" → comas = miles
      normalized = raw.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    const commas = raw.split(',').length - 1
    normalized = commas === 1 ? raw.replace(',', '.') : raw.replace(/,/g, '')
  } else if (lastDot !== -1) {
    const dots = raw.split('.').length - 1
    if (dots > 1) normalized = raw.replace(/\./g, '')
  }

  // Rechazar restos no numéricos ("12abc", "1.2.3,4", etc.)
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null

  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  if (n < 0 && !opts.allowNegative) return null
  return n
}
