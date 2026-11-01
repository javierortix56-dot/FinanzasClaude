// Planificado contra real.
//   Planificado: los egresos del mes (las líneas que se cargan para el mes,
//     p. ej. "Mercado $300.000" el 8 y otra el 22) sumados por categoría: un
//     solo cupo por categoría y mes.
//   Real: los consumos registrados (tabla consumos).
// Un consumo cae en el cupo de su categoría; si la línea planificada está en
// el grupo (Esenciales) y el consumo en una subcategoría, cuenta para el grupo.
//
// Solo las categorías con cupo (Ajustes → Gastos con cupo): las demás son
// pagos únicos y se siguen marcándolos como pagados.
import { toBase, txToBase } from './currency'
import { cuentaEnCategorias } from './tarjetas'
import { getCatFromSettings, getParentGroup, shiftMonth } from './constants'
import { categoriasCupo, esCupo } from './modoGasto'
import { Consumo, Currency, Settings, Transaction } from '../types'

/** No se avisa por proyección antes de este día del mes (pocos datos) */
export const DIA_MIN_PROYECCION = 7

export type NivelCupo = 'ok' | 'atento' | 'excedido' | 'sin_plan'

export interface Cupo {
  categoria: string
  nombre: string
  color: string
  planBase: number
  realBase: number
  /** real / plan × 100 (Infinity si no hay plan) */
  pct: number
  proyeccionBase: number
  /** Cuánto se puede gastar por día el resto del mes sin pasarse */
  porDiaBase: number | null
  nivel: NivelCupo
  motivo: string | null
  consumos: Consumo[]
}

const mesDe = (fecha: string) => fecha.slice(0, 7)
const mesTx = (t: Transaction) => {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Plan del mes por categoría (egresos que no son pagos de tarjeta), en base */
export function planPorCategoria(txs: Transaction[], mes: string, base: Currency, s: Settings): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) {
    if (t.tipo !== 'egreso' || !cuentaEnCategorias(t) || t.noPlanificado || mesTx(t) !== mes) continue
    // Lo planificado (si la línea se pagó con otro monto, el monto original)
    const monto = t.montoPlanificado ?? t.monto
    m.set(t.categoria, (m.get(t.categoria) ?? 0) + txToBase({ ...t, monto }, base, s))
  }
  return m
}

/** Categoría del cupo al que va un consumo (la suya o la de su grupo si el plan está en el grupo) */
export function claveCupo(categoria: string, plan: Map<string, number>, s: Settings): string {
  if (plan.has(categoria)) return categoria
  const g = getParentGroup(categoria, s.categoriasGasto)
  return g && plan.has(g.id) ? g.id : categoria
}

export function calcularCupos(
  txs: Transaction[], consumos: Consumo[], mes: string, base: Currency, s: Settings, hoy = new Date(),
): Cupo[] {
  const [y, m] = mes.split('-').map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  const esActual = hoy.getFullYear() === y && hoy.getMonth() + 1 === m
  const esFuturo = new Date(y, m - 1, 1) > hoy
  const dia = esActual ? hoy.getDate() : esFuturo ? 0 : diasMes
  const restantes = Math.max(diasMes - dia, 0)

  const plan = planPorCategoria(txs, mes, base, s)
  const delMes = consumos.filter((c) => mesDe(c.fecha) === mes && esCupo(c.categoria, s))
  const porCupo = new Map<string, Consumo[]>()
  // Toda categoría con cupo y algo planificado aparece, aunque todavía no tenga consumos
  for (const k of plan.keys()) if (esCupo(k, s)) porCupo.set(k, [])
  for (const id of categoriasCupo(s)) if (plan.has(id) && !porCupo.has(id)) porCupo.set(id, [])
  for (const c of delMes) {
    const k = claveCupo(c.categoria, plan, s)
    porCupo.set(k, [...(porCupo.get(k) ?? []), c])
  }

  return [...porCupo].map(([categoria, cs]): Cupo => {
    const cat = getCatFromSettings(categoria, s)
    const realBase = cs.reduce((a, c) => a + toBase(c.monto, c.moneda, base, s, mes), 0)
    const planBase = plan.get(categoria) ?? 0
    const proyeccionBase = esActual ? (realBase / Math.max(dia, 1)) * diasMes : realBase
    let nivel: NivelCupo = 'ok'
    let motivo: string | null = null
    if (planBase <= 0) { nivel = 'sin_plan'; motivo = 'no estaba planificado' }
    else if (realBase > planBase) { nivel = 'excedido'; motivo = 'ya superó lo planificado' }
    else if (esActual && dia >= DIA_MIN_PROYECCION && proyeccionBase > planBase) { nivel = 'atento'; motivo = 'a este ritmo lo supera' }
    else if (realBase >= planBase * 0.8) { nivel = 'atento'; motivo = `ya usó el ${Math.round((realBase / planBase) * 100)} %` }
    return {
      categoria,
      nombre: cat?.nombre ?? categoria,
      color: cat?.color ?? '#94a3b8',
      planBase, realBase,
      pct: planBase > 0 ? (realBase / planBase) * 100 : Infinity,
      proyeccionBase,
      porDiaBase: esActual && restantes > 0 && planBase > realBase ? (planBase - realBase) / restantes : null,
      nivel, motivo,
      consumos: cs.sort((a, b) => b.fecha.localeCompare(a.fecha)),
    }
  }).sort((a, b) => b.realBase - a.realBase)
}

// ── Desvíos mes a mes ────────────────────────────────────────────────────────

export interface DesvioMes { mes: string; planBase: number; realBase: number; desvioBase: number; desvioPct: number | null }
export interface DesvioCategoria {
  categoria: string
  nombre: string
  color: string
  meses: DesvioMes[]
  /** Meses (con plan y con consumos) en los que el real superó al plan */
  excedidos: number
  evaluados: number
  /** Desvío promedio en % de los meses evaluados */
  desvioPromPct: number | null
  realPromBase: number
  sugerencia: string | null
}

const fmtCorto = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M` : `${Math.round(n / 1e3).toLocaleString('es-AR')} k`)

/**
 * Plan contra real de las categorías con consumos en los meses dados (del más
 * viejo al más nuevo). `txsPorMes` son los movimientos de cada mes.
 */
export function calcularDesvios(
  txsPorMes: Record<string, Transaction[]>, consumos: Consumo[], meses: string[], base: Currency, s: Settings, hoy = new Date(),
): DesvioCategoria[] {
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const filas = new Map<string, DesvioMes[]>()
  for (const mes of meses) {
    const plan = planPorCategoria(txsPorMes[mes] ?? [], mes, base, s)
    const real = new Map<string, number>()
    for (const c of consumos) {
      if (mesDe(c.fecha) !== mes || !esCupo(c.categoria, s)) continue
      const k = claveCupo(c.categoria, plan, s)
      real.set(k, (real.get(k) ?? 0) + toBase(c.monto, c.moneda, base, s, mes))
    }
    for (const [k, r] of real) {
      const p = plan.get(k) ?? 0
      filas.set(k, [...(filas.get(k) ?? []), { mes, planBase: p, realBase: r, desvioBase: r - p, desvioPct: p > 0 ? ((r - p) / p) * 100 : null }])
    }
  }
  return [...filas].map(([categoria, ms]): DesvioCategoria => {
    const cat = getCatFromSettings(categoria, s)
    // El mes en curso todavía no terminó: no entra en el balance de excedidos
    const cerrados = ms.filter((x) => x.mes < mesActual && x.planBase > 0)
    const excedidos = cerrados.filter((x) => x.realBase > x.planBase).length
    const desvioPromPct = cerrados.length ? cerrados.reduce((a, x) => a + (x.desvioPct ?? 0), 0) / cerrados.length : null
    const realPromBase = ms.filter((x) => x.mes < mesActual).reduce((a, x, _, arr) => a + x.realBase / arr.length, 0)
    let sugerencia: string | null = null
    if (cerrados.length >= 2 && excedidos >= Math.ceil(cerrados.length * 0.6) && desvioPromPct !== null && desvioPromPct > 5) {
      sugerencia = `Se pasó ${excedidos} de ${cerrados.length} meses (≈ ${Math.round(desvioPromPct)} % arriba): o planifica ≈ ${fmtCorto(realPromBase)} o se fija bajar el gasto.`
    } else if (cerrados.length >= 2 && excedidos === 0 && desvioPromPct !== null && desvioPromPct < -15) {
      sugerencia = `Gasta ≈ ${Math.round(-desvioPromPct)} % menos de lo planificado: puede bajar el plan a ≈ ${fmtCorto(realPromBase)} y liberar la diferencia.`
    } else if (ms.some((x) => x.planBase === 0 && x.mes < mesActual)) {
      sugerencia = 'Tiene consumos sin planificar: conviene agregarla al plan del mes.'
    }
    return {
      categoria, nombre: cat?.nombre ?? categoria, color: cat?.color ?? '#94a3b8',
      meses: ms, excedidos, evaluados: cerrados.length, desvioPromPct, realPromBase, sugerencia,
    }
  }).sort((a, b) => b.meses.reduce((t, x) => t + x.realBase, 0) - a.meses.reduce((t, x) => t + x.realBase, 0))
}

/** Últimos `n` meses terminando en `mes` (del más viejo al más nuevo) */
export function ultimosMeses(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(mes, i - n + 1))
}
