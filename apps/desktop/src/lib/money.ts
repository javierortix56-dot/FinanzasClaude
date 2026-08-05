import { formatAmount } from '@finanzas/core/lib/constants'

/**
 * Importes del desktop: siempre en números enteros. Los centavos no aportan
 * nada en un presupuesto familiar y ensucian las columnas de montos, más aún
 * con los importes convertidos desde otra moneda.
 */
export function formatMoney(monto: number, moneda: string): string {
  const entero = Math.round(monto)
  // Evita el "-0" que devuelve Math.round con valores negativos chicos.
  return formatAmount(entero === 0 ? 0 : entero, moneda)
}
