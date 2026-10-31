import { Currency, Settings, Transaction } from '../types'
import { toBase, txToBase, txMonth } from './currency'
import { necesitaRespaldo } from './tarjetas'

/**
 * Plan de auto-asignación de egresos sin ingreso de respaldo (compartido por
 * mobile y desktop). Prioriza capacidad + cercanía por fecha; si ningún
 * ingreso cubre el egreso, elige el de mayor capacidad restante (o el más
 * cercano en empate) para que ninguno quede sin asignar. Incluye los
 * egresos "huérfanos" (asignados a ingresos que ya no existen).
 */
export function planAutoAssign(
  ingresos: Transaction[],
  egresos: Transaction[],
  base: Currency,
  s: Settings,
): { exp: Transaction; ingresoId: string }[] {
  const ingresoIds = new Set(ingresos.map((i) => i.id!))
  const unassigned = egresos.filter((e) => necesitaRespaldo(e, ingresoIds))
  if (ingresos.length === 0 || unassigned.length === 0) return []

  const capacity = new Map<string, number>()
  ingresos.forEach((inc) => {
    const incBase = txToBase(inc, base, s)
    const yaAsignado = egresos.reduce((sum, e) => sum + e.asignaciones
      .filter((a) => a.ingresoId === inc.id)
      .reduce((x, a) => x + toBase(a.monto, e.moneda, base, s, txMonth(e)), 0), 0)
    capacity.set(inc.id!, incBase - yaAsignado)
  })

  // Primero los egresos más grandes para mejor empaquetado
  const ordered = [...unassigned].sort(
    (a, b) => txToBase(b, base, s) - txToBase(a, base, s),
  )

  return ordered.map((exp) => {
    const expBase = txToBase(exp, base, s)
    const expTime = exp.fecha.toDate().getTime()
    const elegibles = ingresos.filter((inc) => (capacity.get(inc.id!) ?? 0) >= expBase)
    const cercania = (t: Transaction) => Math.abs(t.fecha.toDate().getTime() - expTime)

    const target = elegibles.length > 0
      ? elegibles.reduce((prev, curr) => (cercania(curr) < cercania(prev) ? curr : prev))
      : ingresos.reduce((prev, curr) => {
          const pc = capacity.get(prev.id!) ?? 0
          const cc = capacity.get(curr.id!) ?? 0
          if (cc !== pc) return cc > pc ? curr : prev
          return cercania(curr) < cercania(prev) ? curr : prev
        })
    capacity.set(target.id!, (capacity.get(target.id!) ?? 0) - expBase)
    return { exp, ingresoId: target.id! }
  })
}
