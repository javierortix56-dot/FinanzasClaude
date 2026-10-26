import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Settings, Transaction } from '@finanzas/core/types'

/**
 * Título visible de un movimiento. Muchos se cargan sin concepto (en mobile
 * se muestra la categoría): se usa el mismo respaldo en vez de "(sin descripción)".
 */
export function txLabel(t: Pick<Transaction, 'descripcion' | 'categoria'>, settings: Settings): string {
  return t.descripcion?.trim() || getCatFromSettings(t.categoria, settings)?.nombre || t.categoria || '—'
}
