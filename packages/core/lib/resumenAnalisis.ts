// Análisis de resúmenes importados (compartido por mobile y desktop).
// Todo se calcula en el cliente sobre los renglones guardados: suscripciones
// (cobros que se repiten mes a mes), gastos hormiga, comercios principales,
// cuotas y refinanciaciones en curso, cargos bancarios (impuestos, percepciones,
// intereses, comisiones), gasto por categoría y por titular, y consumos que no
// están cargados en la app. La cabecera que informa el banco (saldos, cuotas a
// vencer, tasas, avisos) va en Resumen.detalle y tiene prioridad sobre lo
// calculado cuando existe.
import { toBase } from './currency'
import { shiftMonth } from './constants'
import { cuotaEnMes } from './cuotas'
import { CompraCuotas, Currency, Resumen, ResumenItem, Settings, Transaction } from '../types'

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
const enCuotas = (i: ResumenItem) =>
  esCuota(i) && i.monto > 0 && i.cuotaActual !== null && (i.tipo === 'consumo' || i.tipo === 'financiacion')

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

/** Comercio al que se le compra seguido (propinas incluidas) */
export interface Habito {
  clave: string
  comercio: string
  veces: number
  totalBase: number
  /** Ticket promedio */
  ticketBase: number
  anualBase: number
  pct: number
}

/**
 * Gastos hormiga: lo que se va sin darse cuenta. Dos partes que no se pisan:
 * hábitos (comercios con muchas compras en el mes, sin importar el monto) y
 * compras chicas sueltas (hasta un tope en dólares, para que la inflación no
 * mueva el criterio). Quedan afuera cuotas y suscripciones.
 */
export interface Hormiga {
  topeUsd: number
  topeBase: number
  minCompras: number
  habitos: Habito[]
  chicas: { cantidad: number; totalBase: number; comercios: ComercioTotal[] }
  totalBase: number
  pctDelPeriodo: number
  anualBase: number
}

export const HORMIGA_DEFAULT = { topeUsd: 10, minCompras: 4 }

/** Las propinas se suman al comercio ("Rappi (propina)" → Rappi) */
function claveHabito(nombre: string): string {
  const k = claveComercio(nombre)
  return k.replace(/\bpropinas?\b/g, ' ').replace(/\s+/g, ' ').trim() || k
}

export interface CuotaEnCurso {
  comercio: string; emisor: string; moneda: Currency
  actual: number; total: number; montoCuota: number; restantes: number; restante: number
  /** Mes 'YYYY-MM' en que vence la última cuota */
  finMes: string
  /** id de categoría sugerida (null si no hay una razonable) */
  categoria: string | null
  /** Cuota cargada a mano (no figura en ningún resumen subido) */
  manual?: CompraCuotas
}

/**
 * Cuánto de los próximos resúmenes ya está comprometido por cuotas. Si el banco
 * informa su cuadro de cuotas a vencer se usa ese (cantidad = null).
 */
export interface CompromisoMes { mes: string; totalBase: number; cantidad: number | null }

export interface TotalPor { clave: string | null; totalBase: number; pct: number }

export type TipoCargo = 'impuesto' | 'percepcion' | 'interes' | 'comision'
export interface Cargo { tipo: TipoCargo; descripcion: string; montoBase: number }
export interface CargoPorTipo { tipo: TipoCargo; cantidad: number; totalBase: number }

export interface AnalisisPeriodo {
  periodo: string
  resumenes: Resumen[]
  totalGastosBase: number
  suscripciones: Suscripcion[]
  hormiga: Hormiga
  topComercios: ComercioTotal[]
  /** Cuotas de compras */
  cuotas: CuotaEnCurso[]
  /** Refinanciaciones del saldo (Plan V, financiación de saldo…) */
  financiaciones: CuotaEnCurso[]
  /** Cuotas que siguen cayendo en los meses siguientes (hasta que terminan) */
  compromiso: CompromisoMes[]
  /** Acumulado "a partir de" que informa el banco después de su cuadro */
  compromisoResto: CompromisoMes | null
  /** Último mes con cuotas pendientes (null si no hay) */
  libreDesde: string | null
  /** Gasto por categoría (clave = id de categoría o null) */
  porCategoria: TotalPor[]
  /** Gasto por titular/adicional (vacío si el resumen no los separa) */
  porTitular: TotalPor[]
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
export function analizarPeriodo(
  todos: Resumen[], periodo: string, base: Currency, s: Settings, manuales: CompraCuotas[] = [],
): AnalisisPeriodo {
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

  // ── Gastos hormiga (ver interfaz Hormiga)
  const cfg = { ...HORMIGA_DEFAULT, ...s.hormiga }
  const clavesSusc = new Set(suscripciones.map((x) => x.clave.split('|')[0]))
  const sueltas = gastos.filter((i) => !esCuota(i) && !clavesSusc.has(claveComercio(i.comercio)))
  const porHabito = new Map<string, typeof sueltas>()
  for (const i of sueltas) {
    const k = claveHabito(i.comercio)
    porHabito.set(k, [...(porHabito.get(k) ?? []), i])
  }
  const habitos: Habito[] = []
  const enHabito = new Set<string>()
  for (const [k, xs] of porHabito) {
    if (xs.length < cfg.minCompras) continue
    enHabito.add(k)
    const totalBase = xs.reduce((a, i) => a + enBase(i), 0)
    // Nombre: el de una compra que no sea propina, si la hay
    const nombre = (xs.find((i) => claveComercio(i.comercio) === k) ?? xs[0]).comercio
    habitos.push({
      clave: k, comercio: nombre, veces: xs.length, totalBase, ticketBase: totalBase / xs.length,
      anualBase: totalBase * 12, pct: pct(totalBase),
    })
  }
  habitos.sort((a, b) => b.totalBase - a.totalBase)
  const topeBase = toBase(cfg.topeUsd, 'USD', base, s, periodo)
  const chicas = sueltas.filter((i) => !enHabito.has(claveHabito(i.comercio)) && enBase(i) <= topeBase)
  const chicasPorComercio = new Map<string, ComercioTotal>()
  for (const i of chicas) {
    const k = claveHabito(i.comercio)
    const c = chicasPorComercio.get(k) ?? { clave: k, comercio: i.comercio, veces: 0, totalBase: 0, pct: 0 }
    c.veces += 1
    c.totalBase += enBase(i)
    chicasPorComercio.set(k, c)
  }
  const chicasTotal = chicas.reduce((a, i) => a + enBase(i), 0)
  const hormigaTotal = chicasTotal + habitos.reduce((a, h) => a + h.totalBase, 0)
  const hormiga: Hormiga = {
    topeUsd: cfg.topeUsd,
    topeBase,
    minCompras: cfg.minCompras,
    habitos,
    chicas: {
      cantidad: chicas.length,
      totalBase: chicasTotal,
      comercios: [...chicasPorComercio.values()].map((c) => ({ ...c, pct: pct(c.totalBase) })).sort((a, b) => b.totalBase - a.totalBase),
    },
    totalBase: hormigaTotal,
    pctDelPeriodo: pct(hormigaTotal),
    anualBase: hormigaTotal * 12,
  }

  // ── Cuotas en curso (compras y refinanciaciones)
  const enCurso = items
    .filter(enCuotas)
    .map((i) => {
      const restantes = Math.max(i.cuotaTotal! - i.cuotaActual!, 0)
      return {
        comercio: i.comercio, emisor: i.emisor, moneda: i.moneda,
        actual: i.cuotaActual!, total: i.cuotaTotal!, montoCuota: i.monto,
        restantes, restante: restantes * i.monto,
        finMes: shiftMonth(periodo, restantes),
        categoria: i.categoria,
        financiacion: i.tipo === 'financiacion',
      }
    })
    // Primero las que terminan más tarde (las que más pesan en el tiempo)
    .sort((a, b) => b.finMes.localeCompare(a.finMes) || b.restante - a.restante)
  const sinMarca = ({ financiacion: _f, ...c }: CuotaEnCurso & { financiacion: boolean }): CuotaEnCurso => c

  // Cuotas cargadas a mano: las que siguen vigentes o todavía no empezaron
  const deManuales: CuotaEnCurso[] = manuales.flatMap((c) => {
    const actual = cuotaEnMes(c, periodo) ?? 0
    const futuras = Array.from({ length: c.totalCuotas }, (_, k) => shiftMonth(periodo, k + 1))
      .filter((mes) => cuotaEnMes(c, mes) !== null)
    if (actual === 0 && futuras.length === 0) return []
    return [{
      comercio: c.descripcion, emisor: c.tarjeta || 'Manual', moneda: c.moneda,
      actual, total: c.totalCuotas, montoCuota: c.montoCuota,
      restantes: futuras.length, restante: futuras.length * c.montoCuota,
      finMes: futuras[futuras.length - 1] ?? periodo,
      categoria: null, manual: c,
    }]
  })
  const cuotas = [...enCurso.filter((c) => !c.financiacion).map(sinMarca), ...deManuales]
    .sort((a, b) => b.finMes.localeCompare(a.finMes) || b.restante - a.restante)
  const financiaciones = enCurso.filter((c) => c.financiacion).map(sinMarca)

  // Compromiso mes a mes. Por cada resumen: el cuadro del banco si lo trae;
  // si no, cada cuota vuelve a caer en los `restantes` meses siguientes. Los
  // meses futuros se convierten con la cotización actual.
  const compromisoPorMes = new Map<string, CompromisoMes>()
  const sumar = (mes: string, monto: number, moneda: Currency, cantidad: number | null) => {
    const m = compromisoPorMes.get(mes) ?? { mes, totalBase: 0, cantidad: 0 }
    m.totalBase += toBase(monto, moneda, base, s)
    m.cantidad = m.cantidad === null || cantidad === null ? null : m.cantidad + cantidad
    compromisoPorMes.set(mes, m)
  }
  let compromisoResto: CompromisoMes | null = null
  for (const r of delPeriodo) {
    const cuadro = r.detalle?.cuotasAVencer ?? []
    if (cuadro.length > 0) {
      for (const c of cuadro) {
        if (!c.desde) { sumar(c.mes, c.monto, r.moneda, null); continue }
        const totalBase: number = (compromisoResto?.totalBase ?? 0) + toBase(c.monto, r.moneda, base, s)
        const mes: string = compromisoResto && compromisoResto.mes < c.mes ? compromisoResto.mes : c.mes
        compromisoResto = { mes, totalBase, cantidad: null }
      }
      continue
    }
    for (const c of enCurso.filter((x) => x.emisor === r.emisor)) {
      for (let k = 1; k <= c.restantes; k++) sumar(shiftMonth(periodo, k), c.montoCuota, c.moneda, 1)
    }
  }
  for (const c of deManuales) {
    for (let k = 1; k <= c.total; k++) {
      const mes = shiftMonth(periodo, k)
      if (cuotaEnMes(c.manual!, mes) !== null) sumar(mes, c.montoCuota, c.moneda, 1)
    }
  }
  const compromiso = [...compromisoPorMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  const libreDesde = [...enCurso, ...deManuales].reduce<string | null>((max, c) => (c.restantes > 0 && (!max || c.finMes > max) ? c.finMes : max), null)

  // ── Cargos bancarios (impuestos, percepciones, intereses, comisiones). Las
  // percepciones se netean con sus devoluciones (vienen con monto negativo).
  const TIPOS_CARGO: TipoCargo[] = ['impuesto', 'percepcion', 'interes', 'comision']
  const cargosItems: Cargo[] = items
    .filter((i) => (TIPOS_CARGO as string[]).includes(i.tipo) && (i.monto > 0 || i.tipo === 'percepcion'))
    .map((i) => ({ tipo: i.tipo as TipoCargo, descripcion: i.descripcion, montoBase: enBase(i) }))
    .sort((a, b) => b.montoBase - a.montoBase)

  const cargosTotal = cargosItems.reduce((a, c) => a + c.montoBase, 0)
  const porTipo: CargoPorTipo[] = TIPOS_CARGO
    .map((tipo) => {
      const xs = cargosItems.filter((c) => c.tipo === tipo)
      return { tipo, cantidad: xs.length, totalBase: xs.reduce((a, c) => a + c.montoBase, 0) }
    })
    .filter((t) => t.cantidad > 0)
    .sort((a, b) => b.totalBase - a.totalBase)

  // ── Gasto por categoría y por titular
  const agrupar = (clave: (i: ResumenItem) => string | null): TotalPor[] => {
    const m = new Map<string | null, number>()
    for (const i of gastos) m.set(clave(i), (m.get(clave(i)) ?? 0) + enBase(i))
    return [...m].map(([k, v]) => ({ clave: k, totalBase: v, pct: pct(v) })).sort((a, b) => b.totalBase - a.totalBase)
  }
  const porCategoria = agrupar((i) => i.categoria)
  const titulares = agrupar((i) => i.titular)
  const porTitular = titulares.filter((t) => t.clave).length > 1 ? titulares : []

  return {
    periodo,
    resumenes: delPeriodo,
    totalGastosBase,
    suscripciones,
    hormiga,
    topComercios,
    cuotas,
    financiaciones,
    compromiso,
    compromisoResto,
    libreDesde,
    porCategoria,
    porTitular,
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

/**
 * Control de lectura: saldo anterior + renglones = saldo actual, por moneda.
 * Devuelve la diferencia (0 = cuadra; null = el banco no informa los saldos).
 * Una diferencia suele indicar un renglón que faltó o se duplicó.
 */
export function conciliacion(r: Resumen): { ars: number | null; usd: number | null } {
  const d = r.detalle
  const dif = (ant: number | null | undefined, act: number | null | undefined, moneda: Currency) => {
    if (ant == null || act == null) return null
    const suma = r.items.filter((i) => i.moneda === moneda).reduce((a, i) => a + i.monto, 0)
    const v = Math.round((ant + suma - act) * 100) / 100
    return Math.abs(v) < 1 ? 0 : v
  }
  return { ars: dif(d?.saldoAnteriorArs, d?.saldoActualArs, 'ARS'), usd: dif(d?.saldoAnteriorUsd, d?.saldoActualUsd, 'USD') }
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
  percepcion: { singular: 'Percepción', plural: 'Percepciones' },
  interes: { singular: 'Interés', plural: 'Intereses' },
  comision: { singular: 'Comisión', plural: 'Comisiones' },
}

/** 'YYYY-MM' → "Oct 26" */
export function mesCorto(mes: string): string {
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const [y, m] = mes.split('-').map(Number)
  return `${nombres[m - 1]} ${String(y).slice(2)}`
}
