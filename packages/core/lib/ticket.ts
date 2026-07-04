import { parseMonto } from './extracto'

/**
 * Parser heurístico del texto OCR de un ticket/factura de compra.
 * Extrae lo mejor que puede: total, fecha y nombre del comercio.
 * El resultado solo PRE-LLENA el formulario — el usuario siempre revisa.
 */

export interface TicketParseado {
  total: number | null
  /** 'YYYY-MM-DD' si se detectó una fecha */
  fecha: string | null
  comercio: string | null
}

const MONTO_RE = /\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b|\$\s?\d+\b/g
const TOTAL_LINE_RE = /\b(total|importe|a\s*pagar|monto)\b/i
const EXCLUIR_LINE_RE = /\b(subtotal|iva|desc|dto|descuento|cambio|vuelto|efectivo|tarjeta|cuit|c\.?u\.?i\.?t)\b/i
const FECHA_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/

export function parseTicket(texto: string): TicketParseado {
  const lines = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  // ── Total: línea con "TOTAL"/"IMPORTE" que tenga un monto ──────────────────
  let total: number | null = null
  const candidatos: number[] = []
  for (const line of lines) {
    const montos = [...line.matchAll(MONTO_RE)].map((m) => parseMonto(m[0])).filter((n) => n > 0)
    if (montos.length === 0) continue
    candidatos.push(...montos)
    if (TOTAL_LINE_RE.test(line) && !EXCLUIR_LINE_RE.test(line)) {
      // La última línea "TOTAL" del ticket suele ser el total final
      total = montos[montos.length - 1]
    }
  }
  // Fallback: el monto más grande del ticket (el total nunca es menor que un ítem)
  if (total === null && candidatos.length > 0) {
    total = Math.max(...candidatos)
  }

  // ── Fecha: primera dd/mm/aa(aa) plausible ──────────────────────────────────
  let fecha: string | null = null
  for (const line of lines) {
    const m = line.match(FECHA_RE)
    if (!m) continue
    const d = parseInt(m[1], 10)
    const mo = parseInt(m[2], 10)
    let y = parseInt(m[3], 10)
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue
    if (y < 100) y += 2000
    if (y < 2015 || y > 2035) continue
    fecha = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    break
  }

  // ── Comercio: primera línea "con pinta de nombre" ──────────────────────────
  let comercio: string | null = null
  for (const line of lines.slice(0, 6)) {
    const letras = (line.match(/[a-záéíóúñ]/gi) ?? []).length
    if (letras < 3) continue
    if (EXCLUIR_LINE_RE.test(line) || FECHA_RE.test(line)) continue
    if (/factura|ticket|comprobante|consumidor|final|punto\s*de\s*venta/i.test(line)) continue
    comercio = line.replace(/[*#|]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 40)
    break
  }

  return { total, fecha, comercio }
}
