// Análisis de resúmenes importados (compartido por mobile y desktop).
// Todo se calcula en el cliente sobre los renglones guardados: suscripciones
// (cobros que se repiten mes a mes), gastos hormiga, comercios principales,
// cuotas en curso, cargos bancarios y consumos que no están cargados en la app.
import { toBase } from './currency'
import { shiftMonth } from './constants'
import { Currency, Resumen, ResumenItem, Settings, Transaction } from '../types'

/** Clave estable para agrupar un comercio entre meses */
export function claveComercio(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\b(www|com|ar|co|sa|srl|sas|ltda|inc|merpago|mercadopago|dlo|dlocal|paypal)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || nombre.toLowerCase()
}

const esGasto = (i: ResumenItem) => i.monto > 0 && (i.tipo === 'consumo' || i.tipo === 'debito_automatico')
const esCuota = (i: ResumenItem) => (i.cuotaTotal ?? 0) > 1

export interface Suscripcion {
  clave: string
  comercio: string
  moneda: Currency
  /** Monto del último mes en que apareció */
  ultimo: number
  promedio: number
  /** Costo anual estimado (último × 12), en la moneda base */
  anualBase: number
  /** Cambio del último cobro contra el anterior, en % (null si hay uno solo) */
  variacionPct: number | null
  meses: string[]
  /** true si el banco lo marca como débito automático */
  debito: boolean
  /** 'confirmada' (se repite) o 'posible' (débito automático visto una vez) */
  confianza: 'confirmada' | 'posible'
  categoria: string | null
}

export interface ComercioTotal { clave: string; comercio: string; veces: number; totalBase: number; pct: number }

export interface Hormiga {
  umbralBase: number
  cantidad: number
  totalBase: number
  pctDelPeriodo: number
  comercios: ComercioTotal[]
}

export interface CuotaEnCurso {
  comercio: string; emisor: string; moneda: Currency
  actual: number; total: number; montoCuota: number; restantes: number; restante: number
  /** Mes 'YYYY-MM' en que vence la última cuota */
  finMes: string
  /** id de categoría sugerida (null si no hay una razonable) */
  categoria: string | null
}

/** Cuánto de los próximos resúmenes ya está comprometido por cuotas */
export interface CompromisoMes { mes: string; totalBase: number; cantidad: number }

export type TipoCargo = 'impuesto' | 'interes' | 'comision'
export interface Cargo { tipo: TipoCargo; descripcion: string; montoBase: number }
export interface CargoPorTipo { tipo: TipoCargo; cantidad: number; totalBase: number }

export interface AnalisisPeriodo {
  periodo: string
  resumenes: Resumen[]
  totalGastosBase: number
  suscripciones: Suscripcion[]
  hormiga: Hormiga
  topComercios: ComercioTotal[]
  cuotas: CuotaEnCurso[]
  /** Cuotas que siguen cayendo en los meses siguientes (hasta que terminan) */
  compromiso: CompromisoMes[]
  /** Último mes con cuotas pendientes (null si no hay) */
  libreDesde: string | null
  cargos: {
    totalBase: number
    /** % sobre el gasto total del resumen */
    pctDelTotal: number
    porTipo: CargoPorTipo[]
    items: Cargo[]
  }
}

/**
 * Analiza el período elegido usando todos los resúmenes guardados (las
 * suscripciones necesitan varios meses para detectarse).
 */
export function analizarPeriodo(todos: Resumen[], periodo: string, base: Currency, s: Settings): AnalisisPeriodo {
  const delPeriodo = todos.filter((r) => r.periodo === periodo)
  const items = delPeriodo.flatMap((r) => r.items.map((i) => ({ ...i, emisor: r.emisor })))
  const enBase = (i: ResumenItem) => toBase(i.monto, i.moneda, base, s, periodo)

  const gastos = items.filter(esGasto)
  const totalGastosBase = gastos.reduce((a, i) => a + enBase(i), 0)

  // ── Suscripciones: cobro sin cuotas que se repite en la mayoría de los
  // meses desde su primera aparición, con montos parecidos (admite aumentos
  // de hasta 60 % entre el menor y el mayor, por inflación).
  const historico = todos.filter((r) => r.periodo <= periodo)
  const periodosPorEmisor = new Map<string, Set<string>>()
  for (const r of historico) {
    periodosPorEmisor.set(r.emisor, (periodosPorEmisor.get(r.emisor) ?? new Set()).add(r.periodo))
  }
  type Acum = { comercio: string; moneda: Currency; emisor: string; porMes: Map<string, number>; vecesMax: Map<string, number>; debito: boolean; categoria: string | null }
  const grupos = new Map<string, Acum>()
  for (const r of historico) {
    for (const i of r.items) {
      if (!esGasto(i) || esCuota(i)) continue
      const k = `${claveComercio(i.comercio)}|${i.moneda}`
      const g = grupos.get(k) ?? { comercio: i.comercio, moneda: i.moneda, emisor: r.emisor, porMes: new Map(), vecesMax: new Map(), debito: false, categoria: i.categoria }
      g.porMes.set(r.periodo, (g.porMes.get(r.periodo) ?? 0) + i.monto)
      g.vecesMax.set(r.periodo, (g.vecesMax.get(r.periodo) ?? 0) + 1)
      g.debito ||= i.tipo === 'debito_automatico'
      if (r.periodo === periodo) g.comercio = i.comercio
      grupos.set(k, g)
    }
  }
  const suscripciones: Suscripcion[] = []
  for (const [k, g] of grupos) {
    if (!g.porMes.has(periodo)) continue // solo lo que sigue activo en el período
    const meses = [...g.porMes.keys()].sort()
    const montos = meses.map((m) => g.porMes.get(m)!)
    // Confirmada: 3+ meses (o 2 seguidos casi iguales), en la mayoría de los
    // meses disponibles desde la primera aparición, una o dos veces por mes y
    // sin saltos de más de 35 % entre un mes y el siguiente (admite aumentos
    // de precio, descarta compras de supermercado que coinciden por azar).
    const disponibles = [...(periodosPorEmisor.get(g.emisor) ?? [])].filter((p) => p >= meses[0]).length
    const pocasVeces = Math.max(...g.vecesMax.values()) <= 2
    const sinSaltos = montos.every((m, i) => i === 0 || Math.abs(m - montos[i - 1]) <= montos[i - 1] * 0.35)
    const seguidos = (a: string, b: string) => {
      const [ya, ma] = a.split('-').map(Number)
      const [yb, mb] = b.split('-').map(Number)
      return yb * 12 + mb - (ya * 12 + ma) === 1
    }
    const dosIguales = meses.length === 2 && seguidos(meses[0], meses[1]) && Math.abs(montos[1] - montos[0]) <= montos[0] * 0.05
    const repetida = pocasVeces && sinSaltos && (meses.length >= 3 || dosIguales) && meses.length >= 0.6 * disponibles
    const posible = !repetida && g.debito
    if (!repetida && !posible) continue
    const ultimo = montos[montos.length - 1]
    const anterior = montos.length > 1 ? montos[montos.length - 2] : null
    suscripciones.push({
      clave: k,
      comercio: g.comercio,
      moneda: g.moneda,
      ultimo,
      promedio: montos.reduce((a, b) => a + b, 0) / montos.length,
      anualBase: toBase(ultimo, g.moneda, base, s, periodo) * 12,
      variacionPct: anterior ? ((ultimo - anterior) / anterior) * 100 : null,
      meses,
      debito: g.debito,
      confianza: repetida ? 'confirmada' : 'posible',
      categoria: g.categoria,
    })
  }
  suscripciones.sort((a, b) => b.anualBase - a.anualBase)

  // ── Comercios del período
  const porComercio = new Map<string, ComercioTotal>()
  for (const i of gastos) {
    const k = claveComercio(i.comercio)
    const c = porComercio.get(k) ?? { clave: k, comercio: i.comercio, veces: 0, totalBase: 0, pct: 0 }
    c.veces += 1
    c.totalBase += enBase(i)
    porComercio.set(k, c)
  }
  const pct = (v: number) => (totalGastosBase > 0 ? (v / totalGastosBase) * 100 : 0)
  const topComercios = [...porComercio.values()]
    .map((c) => ({ ...c, pct: pct(c.totalBase) }))
    .sort((a, b) => b.totalBase - a.totalBase)

  // ── Gastos hormiga: compras sueltas (sin cuotas, sin suscripciones) por
  // debajo del 1 % del gasto del período.
  const clavesSusc = new Set(suscripciones.map((x) => x.clave.split('|')[0]))
  const umbralBase = totalGastosBase * 0.01
  const chicas = gastos.filter((i) => !esCuota(i) && !clavesSusc.has(claveComercio(i.comercio)) && enBase(i) <= umbralBase)
  const hormigaPorComercio = new Map<string, ComercioTotal>()
  for (const i of chicas) {
    const k = claveComercio(i.comercio)
    const c = hormigaPorComercio.get(k) ?? { clave: k, comercio: i.comercio, veces: 0, totalBase: 0, pct: 0 }
    c.veces += 1
    c.totalBase += enBase(i)
    hormigaPorComercio.set(k, c)
  }
  const hormigaTotal = chicas.reduce((a, i) => a + enBase(i), 0)
  const hormiga: Hormiga = {
    umbralBase,
    cantidad: chicas.length,
    totalBase: hormigaTotal,
    pctDelPeriodo: pct(hormigaTotal),
    comercios: [...hormigaPorComercio.values()]
      .map((c) => ({ ...c, pct: pct(c.totalBase) }))
      .sort((a, b) => b.totalBase - a.totalBase),
  }

  // ── Cuotas en curso
  const cuotas: CuotaEnCurso[] = items
    .filter((i) => esCuota(i) && i.monto > 0 && i.cuotaActual !== null)
    .map((i) => {
      const restantes = Math.max(i.cuotaTotal! - i.cuotaActual!, 0)
      return {
        comercio: i.comercio, emisor: i.emisor, moneda: i.moneda,
        actual: i.cuotaActual!, total: i.cuotaTotal!, montoCuota: i.monto,
        restantes, restante: restantes * i.monto,
        finMes: shiftMonth(periodo, restantes),
        categoria: i.categoria,
      }
    })
    // Primero las que terminan más tarde (las que más pesan en el tiempo)
    .sort((a, b) => b.finMes.localeCompare(a.finMes) || b.restante - a.restante)

  // Compromiso mes a mes: cada cuota vuelve a caer en los `restantes` meses
  // siguientes. Los meses futuros se convierten con la cotización actual.
  const compromisoPorMes = new Map<string, CompromisoMes>()
  for (const c of cuotas) {
    for (let k = 1; k <= c.restantes; k++) {
      const mes = shiftMonth(periodo, k)
      const m = compromisoPorMes.get(mes) ?? { mes, totalBase: 0, cantidad: 0 }
      m.totalBase += toBase(c.montoCuota, c.moneda, base, s)
      m.cantidad += 1
      compromisoPorMes.set(mes, m)
    }
  }
  const compromiso = [...compromisoPorMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  const libreDesde = compromiso.length > 0 ? compromiso[compromiso.length - 1].mes : null

  // ── Cargos bancarios (impuestos, intereses, comisiones)
  const cargosItems: Cargo[] = items
    .filter((i) => i.monto > 0 && (i.tipo === 'impuesto' || i.tipo === 'interes' || i.tipo === 'comision'))
    .map((i) => ({ tipo: i.tipo as Cargo['tipo'], descripcion: i.descripcion, montoBase: enBase(i) }))
    .sort((a, b) => b.montoBase - a.montoBase)

  const cargosTotal = cargosItems.reduce((a, c) => a + c.montoBase, 0)
  const porTipo: CargoPorTipo[] = (['impuesto', 'interes', 'comision'] as TipoCargo[])
    .map((tipo) => {
      const xs = cargosItems.filter((c) => c.tipo === tipo)
      return { tipo, cantidad: xs.length, totalBase: xs.reduce((a, c) => a + c.montoBase, 0) }
    })
    .filter((t) => t.cantidad > 0)
    .sort((a, b) => b.totalBase - a.totalBase)

  return {
    periodo,
    resumenes: delPeriodo,
    totalGastosBase,
    suscripciones,
    hormiga,
    topComercios,
    cuotas,
    compromiso,
    libreDesde,
    cargos: {
      totalBase: cargosTotal,
      pctDelTotal: totalGastosBase + cargosTotal > 0 ? (cargosTotal / (totalGastosBase + cargosTotal)) * 100 : 0,
      porTipo,
      items: cargosItems,
    },
  }
}

/** Rango de meses 'YYYY-MM' que cubren los renglones (para traer los movimientos a comparar) */
export function mesesDeItems(items: ResumenItem[]): string[] {
  if (items.length === 0) return []
  const fechas = items.map((i) => i.fecha).sort()
  const out: string[] = []
  let m = fechas[0].slice(0, 7)
  const fin = fechas[fechas.length - 1].slice(0, 7)
  while (m <= fin && out.length < 24) {
    out.push(m)
    const [y, mm] = m.split('-').map(Number)
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`
  }
  return out
}

const DIA = 86400000

/**
 * Gastos del resumen que no tienen un egreso equivalente en la app: misma
 * moneda, monto dentro del 1 % y fecha a ±7 días (emparejamiento uno a uno).
 * Las cuotas se excluyen: se siguen desde Cuotas, no como movimientos.
 */
export function noCargados(items: ResumenItem[], transacciones: Transaction[]): ResumenItem[] {
  const candidatos = transacciones.filter((t) => t.tipo === 'egreso')
  const usados = new Set<string>()
  const faltan: ResumenItem[] = []
  const ordenados = items.filter((i) => esGasto(i) && !esCuota(i)).sort((a, b) => b.monto - a.monto)
  for (const i of ordenados) {
    const f = new Date(i.fecha + 'T12:00:00').getTime()
    const tol = Math.max(1, Math.abs(i.monto) * 0.01)
    const match = candidatos.find((t) =>
      !usados.has(t.id!) &&
      t.moneda === i.moneda &&
      Math.abs(t.monto - i.monto) <= tol &&
      Math.abs(t.fecha.toDate().getTime() - f) <= 7 * DIA,
    )
    if (match) usados.add(match.id!)
    else faltan.push(i)
  }
  return faltan.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export const ETIQUETA_CARGO: Record<TipoCargo, { singular: string; plural: string }> = {
  impuesto: { singular: 'Impuesto', plural: 'Impuestos' },
  interes: { singular: 'Interés', plural: 'Intereses' },
  comision: { singular: 'Comisión', plural: 'Comisiones' },
}

/** 'YYYY-MM' → "Oct 26" */
export function mesCorto(mes: string): string {
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [y, m] = mes.split('-').map(Number)
  return `${nombres[m - 1]} ${String(y).slice(2)}`
}
