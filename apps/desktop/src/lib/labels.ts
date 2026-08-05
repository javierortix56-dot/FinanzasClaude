import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
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

/**
 * Ubicación de la categoría para el renglón secundario: el grupo padre
 * (Esenciales, Sueldo…), que es el dato que el título no muestra.
 *
 * Cuando el título es un concepto escrito a mano se agrega también la
 * categoría, porque ahí sí aporta. Y nunca se repite lo que ya dice el título:
 * si la categoría no cuelga de ningún grupo, no queda nada para mostrar.
 */
export function txCategoryPath(t: Transaction, settings: Settings | null): string | null {
  const s = settings ?? DEFAULT_SETTINGS
  const groups = t.tipo === 'ingreso' ? s.categoriasIngreso : s.categoriasGasto
  const grupo = groups.find((g) => (g.subcategorias ?? []).some((sub) => sub.id === t.categoria))
  const cat = getCatFromSettings(t.categoria, settings)

  const titulo = txLabel(t, settings)
  const partes = [grupo?.nombre, cat?.nombre].filter((p): p is string => !!p && p !== titulo)
  return partes.length > 0 ? partes.join(' · ') : null
}
