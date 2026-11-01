// Modo de cada categoría de gasto (se elige en Ajustes → Gastos con cupo):
//   - Cupo: lo planificado es un tope que se llena con cada compra registrada
//     (tabla consumos). Ej.: Mercado, Uber, Salud.
//   - Pago único (por defecto): la línea planificada se marca como pagada, con
//     el monto real (se guarda lo planificado para ver el desvío).
//
// "Registrar gasto" (a mano, ticket, captura o desde el resumen) decide solo
// adónde va cada gasto real:
//   cupo → consumo · pago único con línea pendiente → la marca como pagada ·
//   pago único sin línea → gasto no planificado (egreso ya pagado).
import { supabase } from './supabase'
import { addTransaction, deleteTransaction, rowToTx, updateTransaction } from './transactions'
import { agregarConsumos } from './consumos'
import { programarSyncPagos } from './tarjetas'
import { offerUndo } from './undo'
import { SHARED_USER_ID, getParentGroup } from './constants'
import { updateSettings } from './settings'
import { useSettingsStore } from '../store/useSettingsStore'
import { Consumo, Currency, MedioPago, Settings, Transaction } from '../types'

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Categorías con cupo. Sin configurar: las que se llaman Mercado o Supermercado */
export function categoriasCupo(s: Settings): Set<string> {
  if (s.categoriasCupo) return new Set(s.categoriasCupo)
  const ids: string[] = []
  for (const g of s.categoriasGasto) {
    for (const c of g.subcategorias ?? []) if (/^(mercado|supermercado)$/.test(norm(c.nombre.trim()))) ids.push(c.id)
  }
  return new Set(ids)
}

/** La categoría (o su grupo) se controla con cupo */
export function esCupo(categoria: string, s: Settings): boolean {
  const set = categoriasCupo(s)
  if (set.has(categoria)) return true
  const g = getParentGroup(categoria, s.categoriasGasto)
  return !!g && set.has(g.id)
}

export async function guardarCategoriasCupo(ids: string[]) {
  await updateSettings(SHARED_USER_ID, { categoriasCupo: ids })
  const st = useSettingsStore.getState()
  if (st.settings) st.setSettings({ ...st.settings, categoriasCupo: ids })
  programarSyncPagos()
}

/** Línea planificada que todavía no se pagó (pago único) */
export const esPendiente = (t: Transaction) =>
  t.tipo === 'egreso' && !t.ejecutado && !t.pagoTarjeta && !t.noPlanificado

export interface GastoReal {
  fecha: string
  monto: number
  moneda: Currency
  categoria: string
  comercio: string
  descripcion: string
  medio: MedioPago | null
  tarjetaId: string | null
}

export type Destino =
  | { tipo: 'cupo' }
  | { tipo: 'pago'; linea: Transaction }
  | { tipo: 'puntual' }

const ms = (fecha: string) => new Date(fecha + 'T12:00:00').getTime()
const mesDe = (t: Transaction) => {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Adónde va un gasto real. `usadas` evita asignar dos gastos a la misma línea */
export function destinoGasto(g: Pick<GastoReal, 'categoria' | 'fecha'>, txs: Transaction[], s: Settings, usadas = new Set<string>()): Destino {
  if (esCupo(g.categoria, s)) return { tipo: 'cupo' }
  const mes = g.fecha.slice(0, 7)
  const linea = txs
    .filter((t) => esPendiente(t) && t.categoria === g.categoria && mesDe(t) === mes && !usadas.has(t.id!))
    .sort((a, b) => Math.abs(a.fecha.toDate().getTime() - ms(g.fecha)) - Math.abs(b.fecha.toDate().getTime() - ms(g.fecha)))[0]
  return linea ? { tipo: 'pago', linea } : { tipo: 'puntual' }
}

/** Movimientos de los meses dados, directo de la base (para buscar líneas pendientes) */
export async function fetchMovimientosDe(meses: string[]): Promise<Transaction[]> {
  if (meses.length === 0) return []
  const orden = [...new Set(meses)].sort()
  const [y, m] = orden[orden.length - 1].split('-').map(Number)
  const { data, error } = await supabase.from('movimientos').select('*').is('deleted_at', null)
    .gte('date', `${orden[0]}-01`).lte('date', `${orden[orden.length - 1]}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`)
  if (error) throw error
  return (data ?? []).map(rowToTx)
}

/** Campos para marcar una línea como pagada con el monto real */
function cambiosPago(linea: Transaction, monto: number, medio: MedioPago | null, tarjetaId: string | null): Partial<Transaction> {
  const planificado = linea.montoPlanificado ?? linea.monto
  const cambios: Partial<Transaction> = {
    ejecutado: true,
    monto,
    montoPlanificado: Math.abs(planificado - monto) >= 1 ? planificado : null,
  }
  // Pagado con tarjeta: pasa al pago de la tarjeta (ya no necesita un ingreso)
  if (medio === 'credito' && tarjetaId) { cambios.tarjetaId = tarjetaId; cambios.asignaciones = []; return cambios }
  if (medio && medio !== 'credito' && linea.tarjetaId) cambios.tarjetaId = null
  // Asignación a ingresos: si cubría todo, cubre el monto real; nunca más que lo pagado
  const asig = linea.asignaciones ?? []
  const total = asig.reduce((a, x) => a + x.monto, 0)
  if (asig.length && Math.abs(total - linea.monto) < 0.01) {
    let resto = monto
    cambios.asignaciones = asig.map((a, i) => {
      const m = i === asig.length - 1 ? Math.round(resto * 100) / 100 : Math.round((a.monto * monto / total) * 100) / 100
      resto -= m
      return { ...a, monto: m }
    })
  } else if (total > monto) {
    let resto = monto
    cambios.asignaciones = asig.map((a) => { const m = Math.min(a.monto, Math.max(resto, 0)); resto -= m; return { ...a, monto: m } }).filter((a) => a.monto > 0)
  }
  return cambios
}

/** Marca un pago único como pagado (con el monto real); ofrece deshacer */
export async function marcarPagado(linea: Transaction, monto: number, medio: MedioPago | null = null, tarjetaId: string | null = null) {
  const antes: Partial<Transaction> = {
    ejecutado: linea.ejecutado, monto: linea.monto, montoPlanificado: linea.montoPlanificado ?? null,
    tarjetaId: linea.tarjetaId ?? null, asignaciones: linea.asignaciones,
  }
  await updateTransaction(linea.id!, cambiosPago(linea, monto, medio, tarjetaId))
  programarSyncPagos()
  offerUndo(`${linea.descripcion || 'Pago'} marcado como pagado`, async () => {
    await updateTransaction(linea.id!, antes)
    programarSyncPagos()
  })
}

/** Vuelve un pago a pendiente (con el monto planificado) */
export async function desmarcarPagado(linea: Transaction) {
  const plan = linea.montoPlanificado ?? linea.monto
  const asig = linea.asignaciones ?? []
  const total = asig.reduce((a, x) => a + x.monto, 0)
  // Si estaba asignado completo, vuelve a cubrir lo planificado
  const asignaciones = asig.length === 1 && Math.abs(total - linea.monto) < 0.01 ? [{ ...asig[0], monto: plan }] : undefined
  await updateTransaction(linea.id!, {
    ejecutado: false, monto: plan, montoPlanificado: null, ...(asignaciones ? { asignaciones } : {}),
  })
  programarSyncPagos()
}

export interface ResultadoRegistro { cupo: number; pagos: number; puntuales: number }

/**
 * Registra gastos reales: cada uno va a su cupo, a la línea pendiente que paga
 * o como gasto no planificado. `txs` son los movimientos de los meses
 * involucrados (si no se pasan, se buscan). Todo con un solo deshacer.
 */
export async function registrarGastosReales(
  gastos: GastoReal[], s: Settings, creadoPor: string, fuente: Consumo['fuente'], txs?: Transaction[],
): Promise<ResultadoRegistro> {
  const movs = txs ?? await fetchMovimientosDe(gastos.map((g) => g.fecha.slice(0, 7)))
  const usadas = new Set<string>()
  const aCupo: GastoReal[] = []
  const aPagar: { g: GastoReal; linea: Transaction }[] = []
  const puntuales: GastoReal[] = []
  for (const g of gastos) {
    const d = destinoGasto(g, movs, s, usadas)
    if (d.tipo === 'cupo') aCupo.push(g)
    else if (d.tipo === 'pago') { usadas.add(d.linea.id!); aPagar.push({ g, linea: d.linea }) }
    else puntuales.push(g)
  }

  // Cupos: consumos (con su propio deshacer)
  if (aCupo.length) {
    await agregarConsumos(aCupo.map((g) => ({
      fecha: g.fecha, monto: g.monto, moneda: g.moneda, categoria: g.categoria, comercio: g.comercio,
      descripcion: g.descripcion, medio: g.medio, tarjetaId: g.medio === 'credito' ? g.tarjetaId : null, fuente, creadoPor,
    })))
  }

  // Pagos únicos y gastos no planificados (un deshacer para todos)
  const previos: { id: string; antes: Partial<Transaction> }[] = []
  for (const { g, linea } of aPagar) {
    previos.push({ id: linea.id!, antes: {
      ejecutado: linea.ejecutado, monto: linea.monto, montoPlanificado: linea.montoPlanificado ?? null,
      tarjetaId: linea.tarjetaId ?? null, asignaciones: linea.asignaciones,
    } })
    await updateTransaction(linea.id!, cambiosPago(linea, g.monto, g.medio, g.tarjetaId))
  }
  const nuevos: string[] = []
  for (const g of puntuales) {
    nuevos.push(await addTransaction({
      userId: SHARED_USER_ID, tipo: 'egreso', monto: g.monto, moneda: g.moneda, categoria: g.categoria,
      descripcion: g.comercio, nota: g.descripcion !== g.comercio ? g.descripcion : '', tags: [],
      fecha: { toDate: () => new Date(g.fecha + 'T12:00:00') },
      ejecutado: true, asignaciones: [], creadoPor, recurrente: false,
      tarjetaId: g.medio === 'credito' ? g.tarjetaId : null, noPlanificado: true,
    }))
  }
  if (aPagar.length || puntuales.length) {
    programarSyncPagos()
    offerUndo(`${aPagar.length + puntuales.length} gasto${aPagar.length + puntuales.length !== 1 ? 's' : ''} registrado${aPagar.length + puntuales.length !== 1 ? 's' : ''}`, async () => {
      for (const p of previos) await updateTransaction(p.id, p.antes)
      for (const id of nuevos) await deleteTransaction(id)
      programarSyncPagos()
    })
  }
  return { cupo: aCupo.length, pagos: aPagar.length, puntuales: puntuales.length }
}

/** Texto corto de adónde va un gasto, para mostrarlo antes de guardar */
export function describirDestino(d: Destino, nombreCategoria: string): string {
  if (d.tipo === 'cupo') return `Llena el cupo de ${nombreCategoria}`
  if (d.tipo === 'pago') return `Marca como pagado: ${d.linea.descripcion || nombreCategoria} (planificado ${Math.round(d.linea.montoPlanificado ?? d.linea.monto).toLocaleString('es-AR')})`
  return 'Gasto no planificado'
}
