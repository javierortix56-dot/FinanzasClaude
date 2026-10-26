import { Currency, Settings, Transaction } from '../types'

// Si la tasa guardada es inválida (0, negativa o NaN), devolvemos 0 en lugar
// de Infinity/NaN — esto evita que la UI rompa cuando el usuario todavía no
// configuró los tipos de cambio o los dejó en cero por error.
function safeRate(rate: number): number {
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Cotizaciones a usar para un mes 'YYYY-MM'. Un mes pasado con registro en el
 * historial usa SU cotización (promedio del mes); el mes en curso, los meses
 * futuros o los que no tienen registro usan la cotización actual. Así un gasto
 * de marzo en pesos se pasa a USD con el dólar de marzo y no con el de hoy.
 */
export function ratesFor(s: Settings, mes?: string): { ARS_USD: number; COP_USD: number } {
  if (mes && mes < mesActual()) {
    const rec = s.historialTipoCambio?.find((h) => h.mes === mes)
    if (rec && safeRate(rec.ARS_USD) && safeRate(rec.COP_USD)) return rec
  }
  return s.tipoCambio
}

export function toUSD(monto: number, moneda: Currency, s: Settings, mes?: string): number {
  if (moneda === 'USD') return monto
  const r = ratesFor(s, mes)
  if (moneda === 'ARS') {
    const v = safeRate(r.ARS_USD)
    return v === 0 ? 0 : monto / v
  }
  if (moneda === 'COP') {
    const v = safeRate(r.COP_USD)
    return v === 0 ? 0 : monto / v
  }
  return monto
}

export function toBase(
  monto: number,
  moneda: Currency,
  base: Currency,
  s: Settings,
  mes?: string,
): number {
  if (moneda === base) return monto
  const usd = toUSD(monto, moneda, s, mes)
  if (base === 'USD') return usd
  const r = ratesFor(s, mes)
  if (base === 'ARS') return usd * safeRate(r.ARS_USD)
  if (base === 'COP') return usd * safeRate(r.COP_USD)
  return usd
}

/** Mes 'YYYY-MM' (hora local) de un movimiento */
export function txMonth(t: Pick<Transaction, 'fecha'>): string {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Monto de un movimiento en la moneda base, con la cotización de SU mes */
export function txToBase(t: Pick<Transaction, 'monto' | 'moneda' | 'fecha'>, base: Currency, s: Settings): number {
  return toBase(t.monto, t.moneda, base, s, txMonth(t))
}
