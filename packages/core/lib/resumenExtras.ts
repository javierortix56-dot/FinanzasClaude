// Análisis de Resúmenes que miran más de un período: costo de financiarse y
// comparación con los resúmenes anteriores. Compartido por mobile y desktop.
import { toBase } from './currency'
import { categoriasDeGasto } from './resumenes'
import { claveComercio, esGasto } from './resumenAnalisis'
import { Currency, Resumen, ResumenItem, Settings } from '../types'

const IVA = 0.21
const esIva = (i: ResumenItem) => i.tipo === 'impuesto' && /\biva\b/i.test(i.descripcion)

// ── Costo de financiarse ─────────────────────────────────────────────────────

export interface CostoFinanciacion {
  periodo: string
  /** Intereses que el banco informa como renglón propio */
  interesesBase: number
  /**
   * Intereses que vienen dentro de las cuotas de refinanciación (no tienen
   * renglón propio): se estiman a partir del IVA del 21 % que se cobra sobre
   * ellos (IVA / 0,21 − intereses informados − comisiones).
   */
  interesEnCuotasBase: number
  ivaBase: number
  totalBase: number
  /** % sobre lo cobrado en el resumen (consumos + cargos) */
  pctDelResumen: number
}

function costoDe(resumenes: Resumen[], periodo: string, base: Currency, s: Settings): CostoFinanciacion {
  const items = resumenes.flatMap((r) => r.items)
  const enBase = (i: ResumenItem) => toBase(i.monto, i.moneda, base, s, periodo)
  const suma = (f: (i: ResumenItem) => boolean) => items.filter(f).reduce((a, i) => a + enBase(i), 0)
  const interesesBase = suma((i) => i.tipo === 'interes' && i.monto > 0)
  const ivaBase = suma((i) => esIva(i) && i.monto > 0)
  const comisionesBase = suma((i) => i.tipo === 'comision' && i.monto > 0)
  const interesEnCuotasBase = Math.max(ivaBase / IVA - interesesBase - comisionesBase, 0)
  const totalBase = interesesBase + interesEnCuotasBase + ivaBase
  const cobrado = suma((i) => i.monto > 0 && i.tipo !== 'pago' && i.tipo !== 'transferencia')
  return {
    periodo, interesesBase, interesEnCuotasBase, ivaBase, totalBase,
    pctDelResumen: cobrado > 0 ? (totalBase / cobrado) * 100 : 0,
  }
}

export interface AnalisisFinanciacion {
  actual: CostoFinanciacion
  /** Períodos anteriores (hasta 6), del más viejo al más nuevo, con el actual al final */
  historial: CostoFinanciacion[]
  /** Si se paga solo el mínimo: lo que queda financiado y el interés del mes que viene (con IVA) */
  siPagaMinimo: { financiadoBase: number; interesBase: number; tem: number } | null
  tna: number | null
  cftea: number | null
}

export function analizarFinanciacion(todos: Resumen[], periodo: string, base: Currency, s: Settings): AnalisisFinanciacion {
  const periodos = [...new Set(todos.map((r) => r.periodo))].filter((p) => p <= periodo).sort().slice(-7)
  const historial = periodos.map((p) => costoDe(todos.filter((r) => r.periodo === p), p, base, s))
  const delPeriodo = todos.filter((r) => r.periodo === periodo)
  let financiadoBase = 0
  let interesBase = 0
  let tem: number | null = null
  for (const r of delPeriodo) {
    const d = r.detalle
    if (!d || d.saldoActualArs == null || d.pagoMinimo == null || d.tem == null) continue
    const financiado = Math.max(d.saldoActualArs - d.pagoMinimo, 0)
    financiadoBase += toBase(financiado, 'ARS', base, s)
    interesBase += toBase(financiado * (d.tem / 100) * (1 + IVA), 'ARS', base, s)
    tem = Math.max(tem ?? 0, d.tem)
  }
  const conTasa = delPeriodo.find((r) => r.detalle?.tna != null)?.detalle
  return {
    actual: historial[historial.length - 1],
    historial,
    siPagaMinimo: tem !== null && financiadoBase > 0 ? { financiadoBase, interesBase, tem } : null,
    tna: conTasa?.tna ?? null,
    cftea: conTasa?.cftea ?? null,
  }
}

// ── Comparación con resúmenes anteriores ─────────────────────────────────────

export interface Variacion { clave: string | null; nombre: string; actualBase: number; referenciaBase: number; difBase: number; difPct: number | null }

export interface Comparativa {
  /** Períodos usados como referencia (hasta 3, los más recientes antes del actual) */
  previos: string[]
  /** Solo se comparan las tarjetas/cuentas que tiene el período actual */
  emisores: string[]
  total: {
    actualBase: number
    anteriorBase: number
    promedioBase: number
    vsAnteriorPct: number | null
    vsPromedioPct: number | null
    /** Variación contra el promedio medida en dólares (descuenta la devaluación) */
    vsPromedioUsdPct: number | null
  }
  /** Categorías con más diferencia contra el promedio (en valor absoluto) */
  categorias: Variacion[]
  /** Comercios que más subieron contra el promedio */
  subas: Variacion[]
  /** Comercios que más bajaron */
  bajas: Variacion[]
  /** Comercios que no aparecen en ningún período anterior */
  nuevos: { comercio: string; totalBase: number }[]
}

const pctDe = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)

export function compararConAnteriores(todos: Resumen[], periodo: string, base: Currency, s: Settings): Comparativa | null {
  const emisores = [...new Set(todos.filter((r) => r.periodo === periodo).map((r) => r.emisor))]
  const mismos = todos.filter((r) => emisores.includes(r.emisor))
  const previos = [...new Set(mismos.map((r) => r.periodo))].filter((p) => p < periodo).sort().slice(-3)
  if (previos.length === 0) return null

  const gastosDe = (p: string) => mismos.filter((r) => r.periodo === p).flatMap((r) => r.items).filter(esGasto)
  const total = (p: string, moneda: Currency) => gastosDe(p).reduce((a, i) => a + toBase(i.monto, i.moneda, moneda, s, p), 0)
  const prom = (f: (p: string) => number) => previos.reduce((a, p) => a + f(p), 0) / previos.length

  const actualBase = total(periodo, base)
  const anteriorBase = total(previos[previos.length - 1], base)
  const promedioBase = prom((p) => total(p, base))
  const actualUsd = total(periodo, 'USD')
  const promedioUsd = prom((p) => total(p, 'USD'))

  const agrupar = (p: string, clave: (i: ResumenItem) => string | null) => {
    const m = new Map<string | null, { nombre: string; v: number }>()
    for (const i of gastosDe(p)) {
      const k = clave(i)
      const g = m.get(k) ?? { nombre: i.comercio, v: 0 }
      g.v += toBase(i.monto, i.moneda, base, s, p)
      if (p === periodo) g.nombre = i.comercio
      m.set(k, g)
    }
    return m
  }
  const variaciones = (clave: (i: ResumenItem) => string | null) => {
    const actual = agrupar(periodo, clave)
    const refs = previos.map((p) => agrupar(p, clave))
    const claves = new Set<string | null>([...actual.keys(), ...refs.flatMap((r) => [...r.keys()])])
    return [...claves].map((k): Variacion => {
      const a = actual.get(k)?.v ?? 0
      const ref = refs.reduce((t, r) => t + (r.get(k)?.v ?? 0), 0) / refs.length
      const nombre = actual.get(k)?.nombre ?? refs.map((r) => r.get(k)?.nombre).find(Boolean) ?? ''
      return { clave: k, nombre, actualBase: a, referenciaBase: ref, difBase: a - ref, difPct: pctDe(a, ref) }
    })
  }

  const nombresCat = new Map(categoriasDeGasto(s).map((c) => [c.id, c.nombre]))
  const categorias = variaciones((i) => i.categoria)
    .map((v) => ({ ...v, nombre: v.clave ? nombresCat.get(v.clave) ?? v.clave : 'Sin categoría' }))
    .filter((v) => Math.abs(v.difBase) > 0)
    .sort((a, b) => Math.abs(b.difBase) - Math.abs(a.difBase))
  const porComercio = variaciones((i) => claveComercio(i.comercio))
  const conocidos = new Set(previos.flatMap((p) => gastosDe(p).map((i) => claveComercio(i.comercio))))
  // Las subas excluyen lo nuevo (va en su propia lista)
  const subas = porComercio.filter((v) => v.difBase > 0 && v.referenciaBase > 0).sort((a, b) => b.difBase - a.difBase)
  const bajas = porComercio.filter((v) => v.difBase < 0).sort((a, b) => a.difBase - b.difBase)
  const nuevos = porComercio
    .filter((v) => v.actualBase > 0 && !conocidos.has(v.clave!))
    .map((v) => ({ comercio: v.nombre, totalBase: v.actualBase }))
    .sort((a, b) => b.totalBase - a.totalBase)

  return {
    previos,
    emisores,
    total: {
      actualBase, anteriorBase, promedioBase,
      vsAnteriorPct: pctDe(actualBase, anteriorBase),
      vsPromedioPct: pctDe(actualBase, promedioBase),
      vsPromedioUsdPct: pctDe(actualUsd, promedioUsd),
    },
    categorias,
    subas,
    bajas,
    nuevos,
  }
}
