import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Settings, Transaction } from '@finanzas/core/types'

/**
 * Nombre visible de un movimiento. Muchos movimientos se cargan sin concepto
 * (sobre todo los clonados o recurrentes), así que caemos a la categoría antes
 * de mostrar un placeholder: es el mismo criterio que usa la app mobile.
 */
export function txLabel(t: Transaction, settings: Settings | null): string {
  const desc = t.descripcion?.trim()
  if (desc) return desc
  return getCatFromSettings(t.categoria, settings)?.nombre || t.categoria || '(sin descripción)'
}
