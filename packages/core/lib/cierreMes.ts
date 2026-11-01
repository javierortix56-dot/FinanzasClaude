// Cierre de mes: planificado contra real de cada categoría, propuesta para el
// mes siguiente y cierre (concreta lo ejecutado y fija el mes).
//
//   Planificado: las líneas del mes (egresos e ingresos), sumadas por categoría.
//   Real: si la categoría tiene consumos registrados, su suma; si no, las
//     líneas marcadas como ejecutadas (las que faltan quedan pendientes).
//   Pagos de tarjeta: no se planifican a mano; se muestran aparte con su
//     estado (estimado o confirmado por el resumen).
//
// El plan del mes siguiente se arma por categoría con el monto elegido: si
// ya hay líneas en ese mes se ajustan en proporción; si no, se copian las del
// mes cerrado (mismas fechas, descripción, tarjeta) escaladas al monto.
import { supabase } from './supabase'
import { rowToTx, txToRow, updateTransaction } from './transactions'
import { fetchConsumos } from './consumos'
import { claveCupo, planPorCategoria } from './planVsReal'
import { cuentaEnCategorias, esPagoTarjeta, programarSyncPagos } from './tarjetas'
import { toBase, txToBase } from './currency'
import { updateSettings } from './settings'
import { offerUndo } from './undo'
import { SHARED_USER_ID, getCatFromSettings, shiftMonth } from './constants'
import { useSettingsStore } from '../store/useSettingsStore'
import { Consumo, Currency, Settings, Transaction } from '../types'

export type Seguimiento = 'consumos' | 'ejecutado' | 'pendiente' | 'sin_plan'
export type OpcionPropuesta = 'plan' | 'real' | 'promedio'

export interface FilaCierre {
  clave: string
  tipo: 'egreso' | 'ingreso'
  nombre: string
  color: string
  /** Líneas planificadas del mes en esta categoría */
  lineas: Transaction[]
  /** Líneas que ya existen en el mes siguiente */
  siguiente: Transaction[]
  planBase: number
  /** null mientras haya líneas pendientes sin consumos */
  realBase: number | null
  seguimiento: Seguimiento
  pendientes: Transaction[]
  difBase: number | null
  /** Promedio de lo real (o planificado) de los 3 meses anteriores */
  promedioBase: number | null
  /** Lo ya planificado en el mes siguiente */
  siguienteBase: number
  /** Monto sugerido para el mes siguiente y de qué opción sale */
  sugerida: OpcionPropuesta
  opciones: Record<OpcionPropuesta, number | null>
}

export interface Cierre {
  mes: string
  siguiente: string
  filas: FilaCierre[]
  /** Pagos de tarjeta del mes (automáticos) */
  pagos: Transaction[]
  totales: { planEgresos: number; realEgresos: number; planIngresos: number; realIngresos: number }
  cerrado: boolean
}

const mesTx = (t: Transaction) => {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function fetchMeses(desde: string, hasta: string): Promise<Transaction[]> {
  const [y, m] = hasta.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  const { data, error } = await supabase
    .from('movimientos').select('*').is('deleted_at', null)
    .gte('date', `${desde}-01`).lte('date', `${hasta}-${String(ultimo).padStart(2, '0')}`)
  if (error) throw error
  return (data ?? []).map(rowToTx)
}

/** Movimientos del mes, del siguiente y de los 3 anteriores, y consumos (directo de la base) */
export async function cargarDatosCierre(mes: string) {
  const [txs, consumos] = await Promise.all([fetchMeses(shiftMonth(mes, -3), shiftMonth(mes, 1)), fetchConsumos(shiftMonth(mes, -3), mes)])
  return { txs, consumos }
}

export function armarCierre(txs: Transaction[], consumos: Consumo[], mes: string, base: Currency, s: Settings): Cierre {
  const siguienteMes = shiftMonth(mes, 1)
  const delMes = txs.filter((t) => mesTx(t) === mes)
  const delSiguiente = txs.filter((t) => mesTx(t) === siguienteMes)
  const previos = [1, 2, 3].map((k) => shiftMonth(mes, -k))

  // Real por categoría (consumos), con la misma regla de cupo que el inicio
  const realDe = (m: string) => {
    const plan = planPorCategoria(txs, m, base, s)
    const r = new Map<string, number>()
    for (const c of consumos) {
      if (c.fecha.slice(0, 7) !== m) continue
      const k = claveCupo(c.categoria, plan, s)
      r.set(k, (r.get(k) ?? 0) + toBase(c.monto, c.moneda, base, s, m))
    }
    return r
  }
  const realMes = realDe(mes)
  const realPrevios = previos.map(realDe)

  const planificables = (t: Transaction) => !esPagoTarjeta(t) && (t.tipo === 'ingreso' || cuentaEnCategorias(t))
  const claves = new Map<string, 'egreso' | 'ingreso'>()
  for (const t of delMes.filter(planificables)) claves.set(t.categoria, t.tipo)
  for (const k of realMes.keys()) if (!claves.has(k)) claves.set(k, 'egreso')

  const suma = (xs: Transaction[]) => xs.reduce((a, t) => a + txToBase(t, base, s), 0)

  const filas = [...claves].map(([clave, tipo]): FilaCierre => {
    const lineas = delMes.filter((t) => planificables(t) && t.categoria === clave && t.tipo === tipo)
    const siguiente = delSiguiente.filter((t) => planificables(t) && t.categoria === clave && t.tipo === tipo)
    const planBase = suma(lineas)
    const conConsumos = realMes.get(clave)
    const pendientes = lineas.filter((t) => !t.ejecutado)
    let seguimiento: Seguimiento
    let realBase: number | null
    if (conConsumos !== undefined) {
      seguimiento = planBase > 0 ? 'consumos' : 'sin_plan'
      realBase = conConsumos
    } else if (pendientes.length === 0) {
      seguimiento = 'ejecutado'
      realBase = planBase
    } else {
      seguimiento = 'pendiente'
      realBase = null
    }
    // Promedio de los 3 meses anteriores: lo real si hubo consumos; si no, lo planificado
    const historicos = previos.map((m, i) => {
      const r = realPrevios[i].get(clave)
      if (r !== undefined) return r
      const p = suma(txs.filter((t) => mesTx(t) === m && planificables(t) && t.categoria === clave && t.tipo === tipo))
      return p > 0 ? p : null
    }).filter((x): x is number => x !== null)
    const actual = realBase ?? planBase
    const promedioBase = historicos.length ? (historicos.reduce((a, x) => a + x, 0) + actual) / (historicos.length + 1) : null
    const opciones: Record<OpcionPropuesta, number | null> = { plan: planBase || null, real: realBase, promedio: promedioBase }
    // Sugerencia: lo real si se siguió con consumos (refleja lo que se gasta); si no, mantener el plan
    const sugerida: OpcionPropuesta = seguimiento === 'consumos' || seguimiento === 'sin_plan' ? 'real' : 'plan'
    const cat = getCatFromSettings(clave, s)
    return {
      clave, tipo, nombre: cat?.nombre ?? clave, color: cat?.color ?? '#94a3b8',
      lineas, siguiente, planBase, realBase, seguimiento, pendientes,
      difBase: realBase === null ? null : realBase - planBase,
      promedioBase, siguienteBase: suma(siguiente), sugerida, opciones,
    }
  }).sort((a, b) => (a.tipo === b.tipo ? b.planBase + (b.realBase ?? 0) - (a.planBase + (a.realBase ?? 0)) : a.tipo === 'ingreso' ? 1 : -1))

  const egresos = filas.filter((f) => f.tipo === 'egreso')
  const ingresos = filas.filter((f) => f.tipo === 'ingreso')
  return {
    mes, siguiente: siguienteMes, filas,
    pagos: delMes.filter(esPagoTarjeta),
    totales: {
      planEgresos: egresos.reduce((a, f) => a + f.planBase, 0),
      realEgresos: egresos.reduce((a, f) => a + (f.realBase ?? f.planBase), 0),
      planIngresos: ingresos.reduce((a, f) => a + f.planBase, 0),
      realIngresos: ingresos.reduce((a, f) => a + (f.realBase ?? f.planBase), 0),
    },
    cerrado: (s.mesesCerrados ?? []).includes(mes),
  }
}

const r0 = (n: number) => Math.round(n)

/**
 * Arma el plan del mes siguiente con el monto elegido por categoría (en la
 * moneda base). 0 = no planificar esa categoría. Ofrece deshacer.
 */
export async function aplicarPlanSiguiente(c: Cierre, montos: Record<string, number>, base: Currency): Promise<{ creadas: number; ajustadas: number }> {
  const inserts: Omit<Transaction, 'id'>[] = []
  const cambios: { id: string; antes: Transaction; monto: number }[] = []
  for (const f of c.filas) {
    const objetivo = montos[`${f.tipo}|${f.clave}`]
    if (objetivo === undefined || !(objetivo > 0)) continue
    if (f.siguiente.length > 0) {
      // Ya hay líneas en el mes siguiente: se ajustan en proporción
      if (Math.abs(f.siguienteBase - objetivo) < 1 || f.siguienteBase <= 0) continue
      const factor = objetivo / f.siguienteBase
      for (const t of f.siguiente) cambios.push({ id: t.id!, antes: t, monto: r0(t.monto * factor) })
    } else if (f.lineas.length > 0 && f.planBase > 0) {
      // Se copian las líneas del mes cerrado, escaladas al monto elegido
      const factor = objetivo / f.planBase
      for (const t of f.lineas) {
        const d = t.fecha.toDate()
        const [y, m] = c.siguiente.split('-').map(Number)
        const dia = Math.min(d.getDate(), new Date(y, m, 0).getDate())
        const { id: _id, ...resto } = t
        inserts.push({
          ...resto, monto: r0(t.monto * factor), ejecutado: false, asignaciones: [],
          fecha: { toDate: () => new Date(`${c.siguiente}-${String(dia).padStart(2, '0')}T12:00:00`) },
        })
      }
    } else {
      // Categoría con consumos pero sin planificar: una línea nueva el día 1
      inserts.push({
        userId: SHARED_USER_ID, tipo: f.tipo, monto: r0(objetivo), moneda: base, categoria: f.clave,
        descripcion: '', nota: 'Agregada desde el cierre de mes', tags: [], ejecutado: false, asignaciones: [],
        creadoPor: SHARED_USER_ID, recurrente: false, tarjetaId: null,
        fecha: { toDate: () => new Date(`${c.siguiente}-01T12:00:00`) },
      })
    }
  }
  let creadas: string[] = []
  if (inserts.length) {
    const { data, error } = await supabase.from('movimientos').insert(inserts.map(txToRow)).select('id')
    if (error) throw error
    creadas = (data ?? []).map((r) => r.id as string)
  }
  for (const x of cambios) {
    const total = x.antes.asignaciones.reduce((a, b) => a + b.monto, 0)
    // Si baja, las asignaciones bajan en proporción; si sube, quedan y la diferencia queda sin asignar
    const asignaciones = total > x.monto && total > 0
      ? x.antes.asignaciones.map((a) => ({ ...a, monto: Math.round((a.monto * x.monto) / total) }))
      : x.antes.asignaciones
    await updateTransaction(x.id, { monto: x.monto, asignaciones })
  }
  programarSyncPagos()
  if (creadas.length || cambios.length) {
    offerUndo(`Plan de ${c.siguiente} actualizado`, async () => {
      if (creadas.length) await supabase.from('movimientos').update({ deleted_at: new Date().toISOString() }).in('id', creadas)
      for (const x of cambios) await updateTransaction(x.id, { monto: x.antes.monto, asignaciones: x.antes.asignaciones })
      programarSyncPagos()
    })
  }
  return { creadas: creadas.length, ajustadas: cambios.length }
}

/** Marca una línea pendiente como ejecutada (se concretó) */
export async function marcarEjecutadas(lineas: Transaction[]) {
  for (const t of lineas) await updateTransaction(t.id!, { ejecutado: true })
}

/**
 * Cierra el mes: concreta las líneas seguidas con consumos (ejecutadas),
 * guarda la cotización del mes si no estaba y lo marca cerrado (los pagos de
 * tarjeta de ese mes ya no se recalculan).
 */
export async function cerrarMes(c: Cierre, s: Settings) {
  const aEjecutar = c.filas.filter((f) => f.seguimiento === 'consumos').flatMap((f) => f.lineas.filter((t) => !t.ejecutado))
  await marcarEjecutadas(aEjecutar)
  const hist = s.historialTipoCambio ?? []
  const historialTipoCambio = hist.some((h) => h.mes === c.mes)
    ? hist
    : [...hist, { mes: c.mes, ARS_USD: s.tipoCambio.ARS_USD, COP_USD: s.tipoCambio.COP_USD }].sort((a, b) => a.mes.localeCompare(b.mes))
  const mesesCerrados = [...new Set([...(s.mesesCerrados ?? []), c.mes])].sort()
  await updateSettings(SHARED_USER_ID, { historialTipoCambio, mesesCerrados })
  const actual = useSettingsStore.getState().settings ?? s
  useSettingsStore.getState().setSettings({ ...actual, historialTipoCambio, mesesCerrados })
  offerUndo(`${c.mes} cerrado`, async () => {
    for (const t of aEjecutar) await updateTransaction(t.id!, { ejecutado: false })
    const cerrados = (useSettingsStore.getState().settings?.mesesCerrados ?? []).filter((m) => m !== c.mes)
    await updateSettings(SHARED_USER_ID, { mesesCerrados: cerrados })
    const st = useSettingsStore.getState().settings
    if (st) useSettingsStore.getState().setSettings({ ...st, mesesCerrados: cerrados })
  })
}
