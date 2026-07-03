/**
 * Parser heurístico de extractos/resúmenes de tarjeta de crédito.
 *
 * Busca líneas con el patrón de cuota "NN/MM" (cuota N de M) típico de los
 * resúmenes (p. ej. "15/03/26 MERPAGO*TIENDA C.03/12 12.345,67") y extrae
 * descripción, cuota actual, total de cuotas y monto. El resultado SIEMPRE
 * pasa por una pantalla de revisión editable antes de importarse — el parser
 * prioriza detectar de más antes que perder compras.
 */

export interface CuotaDetectada {
  descripcion: string
  cuotaActual: number
  totalCuotas: number
  /** Monto de la cuota tal como figura en el extracto */
  monto: number
}

/** Parsea montos en formato es-AR/es-CO ("1.234,56") o en formato plano ("1234.56") */
function parseMonto(raw: string): number {
  let s = raw.trim().replace(/[$\s]/g, '').replace(/-$/, '')
  if (s.startsWith('-')) s = s.slice(1)
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // 1.234,56 → coma decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // 1,234.56 o 1234.56 → punto decimal
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

const CUOTA_RE = /(\d{1,2})\s*\/\s*(\d{1,2})(\/\d{2,4})?/g
const MONTO_RE = /-?\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\$?\s?\d+[.,]\d{2}/g

export function parseExtractoTexto(texto: string): CuotaDetectada[] {
  const resultados: CuotaDetectada[] = []
  const vistos = new Set<string>()

  for (const rawLine of texto.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/\s{2,}/g, ' ')
    if (line.length < 8) continue

    // Todas las apariciones x/y de la línea
    const matches = [...line.matchAll(CUOTA_RE)]
    if (matches.length === 0) continue

    // Candidata a cuota: la ÚLTIMA aparición que cumpla 1 ≤ a ≤ b, 2 ≤ b ≤ 36
    // y que no sea una fecha (las fechas van al principio o llevan año).
    let cuota: { a: number; b: number; index: number; len: number } | null = null
    for (const m of matches) {
      const a = parseInt(m[1], 10)
      const b = parseInt(m[2], 10)
      const conAnio = !!m[3]
      if (conAnio) continue
      if (a < 1 || a > b || b < 2 || b > 36) continue
      // dd/mm al inicio de línea sin año: probablemente fecha corta
      if (m.index === 0 && b <= 12) continue
      cuota = { a, b, index: m.index!, len: m[0].length }
    }
    if (!cuota) continue

    // Monto: el último número con decimales de la línea
    const montos = [...line.matchAll(MONTO_RE)]
    if (montos.length === 0) continue
    const monto = parseMonto(montos[montos.length - 1][0])
    if (monto <= 0) continue

    // Descripción: lo que hay antes del patrón de cuota, sin fecha inicial
    // ni prefijos tipo "C." / "CUOTA"
    let desc = line.slice(0, cuota.index)
      .replace(/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\s*/, '')  // fecha al inicio
      .replace(/\b(cuota|cuot|cta|c)\.?\s*$/i, '')            // prefijo de cuota
      .replace(/[*·|]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!desc) desc = line.slice(cuota.index + cuota.len).replace(MONTO_RE, '').trim()
    if (!desc) continue
    if (desc.length > 40) desc = desc.slice(0, 40).trim()

    const key = `${desc}|${cuota.a}/${cuota.b}|${monto}`
    if (vistos.has(key)) continue
    vistos.add(key)

    resultados.push({
      descripcion: desc,
      cuotaActual: cuota.a,
      totalCuotas: cuota.b,
      monto,
    })
  }

  return resultados
}
