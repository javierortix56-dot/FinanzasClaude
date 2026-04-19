import { Currency, Settings } from '@/types'

// Si la tasa guardada es inválida (0, negativa o NaN), devolvemos 0 en lugar
// de Infinity/NaN — esto evita que la UI rompa cuando el usuario todavía no
// configuró los tipos de cambio o los dejó en cero por error.
function safeRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}

export function toUSD(monto: number, moneda: Currency, s: Settings): number {
  if (moneda === 'USD') return monto
  if (moneda === 'ARS') {
    const r = safeRate(s.tipoCambio.ARS_USD)
    return r === 0 ? 0 : monto / r
  }
  if (moneda === 'COP') {
    const r = safeRate(s.tipoCambio.COP_USD)
    return r === 0 ? 0 : monto / r
  }
  return monto
}

export function toBase(
  monto: number,
  moneda: Currency,
  base: Currency,
  s: Settings
): number {
  const usd = toUSD(monto, moneda, s)
  if (base === 'USD') return usd
  if (base === 'ARS') return usd * safeRate(s.tipoCambio.ARS_USD)
  if (base === 'COP') return usd * safeRate(s.tipoCambio.COP_USD)
  return usd
}
