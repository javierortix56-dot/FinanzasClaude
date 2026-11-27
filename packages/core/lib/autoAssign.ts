import { Asignacion, Currency, Settings, Transaction } from '../types'
import { toBase, txToBase, txMonth } from './currency'
import { necesitaRespaldo } from './tarjetas'

/** Ingresos que se prueban combinados al dividir un egreso (2^n combinaciones) */
const MAX_INGRESOS_COMBINADOS = 16

/**
 * Plan de auto-asignación de egresos sin ingreso de respaldo (compartido por
 * mobile y desktop). Incluye los egresos "huérfanos" (asignados a ingresos que
 * ya no existen). Para cada egreso, de mayor a menor:
 *
 * 1. Si un solo ingreso lo cubre, va entero al más cercano en fecha.
 * 2. Si no, se divide en la MENOR cantidad de ingresos posible; entre las
 *    combinaciones con esa cantidad, la de ingresos más cercanos en fecha.
 *    Se llena primero el más cercano y el último toma lo que falta.
 * 3. Si ni todos juntos alcanzan, se usa todo lo disponible y lo que falta
 *    queda sobre el ingreso más grande (su disponible queda en negativo, a la
 *    vista).
 */
export function planAutoAssign(
  ingresos: Transaction[],
  egresos: Transaction[],
  base: Currency,
  s: Settings,
): { exp: Transaction; asignaciones: Asignacion[] }[] {
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
  const cap = (t: Transaction) => Math.max(capacity.get(t.id!) ?? 0, 0)

  // Primero los egresos más grandes para mejor empaquetado
  const ordered = [...unassigned].sort(
    (a, b) => txToBase(b, base, s) - txToBase(a, base, s),
  )

  return ordered.map((exp) => {
    const expBase = txToBase(exp, base, s)
    const expTime = exp.fecha.toDate().getTime()
    const cercania = (t: Transaction) => Math.abs(t.fecha.toDate().getTime() - expTime)
    const porCercania = (a: Transaction, b: Transaction) => cercania(a) - cercania(b)

    // 1. Un solo ingreso alcanza: el más cercano en fecha
    const elegibles = ingresos.filter((inc) => cap(inc) >= expBase - 0.005)
    if (elegibles.length > 0) {
      const target = [...elegibles].sort(porCercania)[0]
      capacity.set(target.id!, (capacity.get(target.id!) ?? 0) - expBase)
      return { exp, asignaciones: [{ ingresoId: target.id!, monto: exp.monto }] }
    }

    // 2. Dividir en la menor cantidad de ingresos (entre los que tienen disponible)
    const conLugar = ingresos.filter((inc) => cap(inc) > 0.005)
    const grupo = menorGrupo(conLugar, expBase, cap, cercania)

    // Partes en moneda base: se llena primero el más cercano en fecha
    const partes: { inc: Transaction; base: number }[] = []
    let falta = expBase
    for (const inc of (grupo ?? conLugar).sort(porCercania)) {
      if (falta <= 0.005) break
      const parte = Math.min(cap(inc), falta)
      partes.push({ inc, base: parte })
      falta -= parte
    }
    // 3. No alcanza ni con todos: lo que falta va al ingreso más grande
    if (falta > 0.005) {
      const mayor = [...ingresos].sort((a, b) => txToBase(b, base, s) - txToBase(a, base, s))[0]
      const existente = partes.find((p) => p.inc.id === mayor.id)
      if (existente) existente.base += falta
      else partes.push({ inc: mayor, base: falta })
    }
    for (const p of partes) capacity.set(p.inc.id!, (capacity.get(p.inc.id!) ?? 0) - p.base)

    // A la moneda del egreso; la última parte se ajusta para que la suma sea exacta
    const factor = expBase > 0 ? exp.monto / expBase : 0
    const asignaciones: Asignacion[] = []
    let acumulado = 0
    partes.forEach((p, i) => {
      const monto = i === partes.length - 1
        ? Math.round((exp.monto - acumulado) * 100) / 100
        : Math.round(p.base * factor * 100) / 100
      acumulado += monto
      if (monto > 0) asignaciones.push({ ingresoId: p.inc.id!, monto })
    })
    return { exp, asignaciones }
  })
}

/**
 * La combinación con menos ingresos cuyo disponible cubre `monto`; en empate,
 * la de ingresos más cercanos en fecha. null si ni todos juntos alcanzan.
 */
function menorGrupo(
  ingresos: Transaction[],
  monto: number,
  cap: (t: Transaction) => number,
  cercania: (t: Transaction) => number,
): Transaction[] | null {
  const total = ingresos.reduce((a, t) => a + cap(t), 0)
  if (total < monto - 0.005) return null

  // Cantidad mínima: tomando los de mayor disponible primero
  const porCapacidad = [...ingresos].sort((a, b) => cap(b) - cap(a))
  let k = 0
  for (let suma = 0; suma < monto - 0.005; k++) suma += cap(porCapacidad[k])

  // Con muchos ingresos no se prueban todas las combinaciones
  if (ingresos.length > MAX_INGRESOS_COMBINADOS) return porCapacidad.slice(0, k)

  let mejor: Transaction[] | null = null
  let mejorDist = Infinity
  const n = ingresos.length
  for (let mask = 1; mask < 1 << n; mask++) {
    let bits = 0
    for (let m = mask; m; m &= m - 1) bits++
    if (bits !== k) continue
    const grupo = ingresos.filter((_, i) => mask & (1 << i))
    if (grupo.reduce((a, t) => a + cap(t), 0) < monto - 0.005) continue
    const dist = grupo.reduce((a, t) => a + cercania(t), 0)
    if (dist < mejorDist) { mejor = grupo; mejorDist = dist }
  }
  return mejor
}
