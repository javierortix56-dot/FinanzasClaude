import { Currency, Settings } from '@/types'

export function toUSD(monto: number, moneda: Currency, s: Settings): number {
  if (moneda === 'USD') return monto
  if (moneda === 'ARS') return monto / s.tipoCambio.ARS_USD
  if (moneda === 'COP') return monto / s.tipoCambio.COP_USD
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
  if (base === 'ARS') return usd * s.tipoCambio.ARS_USD
  if (base === 'COP') return usd * s.tipoCambio.COP_USD
  return usd
}
