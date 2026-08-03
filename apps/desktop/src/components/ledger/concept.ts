import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Settings, Transaction } from '@finanzas/core/types'

/**
 * Concepto visible de un movimiento.
 *
 * Muchos movimientos no llevan descripción propia y su categoría hace de
 * concepto ("Famiq", "Alquiler", "Nafta"…). Es la misma convención que usa
 * la app móvil: descripción → nombre de categoría → id de categoría.
 */
export function conceptOf(t: Transaction, settings: Settings): string {
  return t.descripcion || getCatFromSettings(t.categoria, settings)?.nombre || t.categoria || '—'
}

/**
 * Nombre de categoría solo cuando aporta algo: si ya se está usando como
 * concepto, repetirlo en la línea de metadatos es ruido.
 */
export function categoryMeta(t: Transaction, settings: Settings): string | null {
  const nombre = getCatFromSettings(t.categoria, settings)?.nombre ?? t.categoria
  if (!nombre || nombre === conceptOf(t, settings)) return null
  return nombre
}
