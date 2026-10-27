/** Convierte un importe con formato local ("1.234,56", "1,234.56", "$ 99") a número */
export function parseMonto(raw: string): number {
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
