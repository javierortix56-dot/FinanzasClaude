// Contraste del resumen de una tarjeta de crédito con los gastos registrados
// en la app con esa tarjeta. Solo entran los gastos con tarjeta de crédito:
// lo pagado en efectivo, débito o transferencia no aparece en el resumen.
//
// Emparejamiento uno a uno: misma moneda, monto dentro del 1 % y fecha a ±5
// días (el banco suele imputar la compra unos días después). Las cuotas no se
// concilian acá: se siguen desde Cuotas en curso.
import { supabase } from './supabase'
import { addTransaction, deleteTransaction, rowToTx, updateTransaction } from './transactions'
import { programarSyncPagos } from './tarjetas'
import { offerUndo } from './undo'
import { esGasto } from './resumenAnalisis'
import { SHARED_USER_ID } from './constants'
import { Resumen, ResumenItem, Tarjeta, Transaction } from '../types'

const DIA = 86400000
const TOLERANCIA_DIAS = 5
const esCargo = (i: ResumenItem) => ['impuesto', 'percepcion', 'interes', 'comision'].includes(i.tipo) && i.monto > 0

export interface ResultadoConciliacion {
  tarjeta: Tarjeta
  /** Renglón del resumen y movimiento de la app que coinciden */
  coinciden: { item: ResumenItem; tx: Transaction }[]
  /** Consumos del resumen sin un gasto registrado */
  faltan: ResumenItem[]
  /**
   * Consumos del resumen registrados con otro medio de pago (sin tarjeta o con
   * otra): agregarlos de nuevo los duplicaría; hay que pasarlos a esta tarjeta.
   */
  otroMedio: { item: ResumenItem; tx: Transaction }[]
  /** Impuestos, intereses y comisiones del resumen (no se registran a mano) */
  cargos: ResumenItem[]
  /** Gastos registrados con la tarjeta dentro del período que no aparecen en el resumen */
  sobran: Transaction[]
  /** Gastos registrados después del cierre: entran en el próximo resumen */
  proximo: Transaction[]
  desde: string
  hasta: string
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ')

/** Tarjeta de la app que corresponde al emisor del resumen ("Visa BBVA") */
export function tarjetaDelResumen(r: Resumen, tarjetas: Tarjeta[]): Tarjeta | undefined {
  const e = new Set(norm(r.emisor).split(/\s+/).filter((w) => w.length >= 3))
  let mejor: { t: Tarjeta; n: number } | undefined
  for (const t of tarjetas) {
    const n = norm(t.nombre).split(/\s+/).filter((w) => e.has(w)).length
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { t, n }
  }
  return mejor?.t ?? (tarjetas.length === 1 ? tarjetas[0] : undefined)
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Período que cubre el resumen: desde el primer consumo (sin cuotas) hasta el cierre */
export function periodoDelResumen(r: Resumen): { desde: string; hasta: string } | null {
  const fechas = r.items.filter((i) => esGasto(i) && !((i.cuotaTotal ?? 0) > 1)).map((i) => i.fecha).sort()
  if (fechas.length === 0) return null
  const hasta = r.detalle?.fechaCierre ?? fechas[fechas.length - 1]
  return { desde: fechas[0], hasta }
}

/** Egresos desde una fecha (con margen), directo de la base */
export async function fetchEgresosDesde(desde: string): Promise<Transaction[]> {
  const d = iso(new Date(desde + 'T12:00:00').getTime() - TOLERANCIA_DIAS * DIA)
  // Hasta hoy: lo cargado después del cierre se muestra como "próximo resumen"
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)
    .gte('date', d)
    .in('type', ['egreso', 'exp'])
  if (error) throw error
  return (data ?? []).map(rowToTx).filter((t) => !t.pagoTarjeta)
}

export function conciliar(r: Resumen, tarjeta: Tarjeta, txs: Transaction[]): ResultadoConciliacion | null {
  const per = periodoDelResumen(r)
  if (!per) return null
  const desdeMs = new Date(per.desde + 'T12:00:00').getTime() - TOLERANCIA_DIAS * DIA
  const hastaMs = new Date(per.hasta + 'T12:00:00').getTime()
  const deLaTarjeta = txs.filter((t) => t.tarjetaId === tarjeta.id && t.tipo === 'egreso' && !t.pagoTarjeta)
  const enPeriodo = deLaTarjeta.filter((t) => {
    const f = t.fecha.toDate().getTime()
    return f >= desdeMs && f <= hastaMs + DIA / 2
  })
  const proximo = deLaTarjeta.filter((t) => t.fecha.toDate().getTime() > hastaMs + DIA / 2)

  const consumos = r.items.filter((i) => esGasto(i) && !((i.cuotaTotal ?? 0) > 1))
  const otros = txs.filter((t) => t.tarjetaId !== tarjeta.id && t.tipo === 'egreso' && !t.pagoTarjeta)
  const usados = new Set<string>()
  const buscar = (i: ResumenItem, entre: Transaction[]) => {
    const f = new Date(i.fecha + 'T12:00:00').getTime()
    const tol = Math.max(1, i.monto * 0.01)
    return entre
      .filter((t) => !usados.has(t.id!) && t.moneda === i.moneda && Math.abs(t.monto - i.monto) <= tol)
      .map((t) => ({ t, d: Math.abs(t.fecha.toDate().getTime() - f) }))
      .filter((x) => x.d <= TOLERANCIA_DIAS * DIA)
      .sort((a, b) => a.d - b.d)[0]?.t
  }
  const coinciden: ResultadoConciliacion['coinciden'] = []
  const otroMedio: ResultadoConciliacion['otroMedio'] = []
  const faltan: ResumenItem[] = []
  // Primero los montos grandes: menos ambigüedad
  for (const i of [...consumos].sort((a, b) => b.monto - a.monto)) {
    const tx = buscar(i, enPeriodo)
    if (tx) { usados.add(tx.id!); coinciden.push({ item: i, tx }); continue }
    const otro = buscar(i, otros)
    if (otro) { usados.add(otro.id!); otroMedio.push({ item: i, tx: otro }); continue }
    faltan.push(i)
  }
  return {
    tarjeta,
    coinciden: coinciden.sort((a, b) => a.item.fecha.localeCompare(b.item.fecha)),
    faltan: faltan.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    otroMedio,
    cargos: r.items.filter(esCargo),
    sobran: enPeriodo.filter((t) => !usados.has(t.id!)).sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    proximo,
    desde: per.desde,
    hasta: per.hasta,
  }
}

/** Pasa a la tarjeta gastos que se habían registrado con otro medio */
export async function pasarATarjeta(txs: Transaction[], tarjeta: Tarjeta): Promise<void> {
  const previos = txs.map((t) => ({ id: t.id!, tarjetaId: t.tarjetaId ?? null, asignaciones: t.asignaciones }))
  for (const t of txs) await updateTransaction(t.id!, { tarjetaId: tarjeta.id, asignaciones: [] })
  programarSyncPagos()
  offerUndo(`${txs.length} gasto${txs.length !== 1 ? 's' : ''} pasado${txs.length !== 1 ? 's' : ''} a ${tarjeta.nombre}`, async () => {
    for (const p of previos) await updateTransaction(p.id, { tarjetaId: p.tarjetaId, asignaciones: p.asignaciones })
    programarSyncPagos()
  })
}

/** Registra renglones del resumen como gastos con la tarjeta (con deshacer) */
export async function registrarDesdeResumen(
  items: { fecha: string; comercio: string; descripcion: string; monto: number; moneda: ResumenItem['moneda']; categoria: string | null }[],
  tarjeta: Tarjeta, categoriaFallback: string, creadoPor: string,
): Promise<number> {
  const ids: string[] = []
  for (const i of items) {
    ids.push(await addTransaction({
      userId: SHARED_USER_ID,
      tipo: 'egreso',
      monto: i.monto,
      moneda: i.moneda,
      categoria: i.categoria ?? categoriaFallback,
      descripcion: i.comercio,
      nota: `Desde resumen: ${i.descripcion}`,
      tags: [],
      fecha: { toDate: () => new Date(i.fecha + 'T12:00:00') },
      ejecutado: true,
      asignaciones: [],
      creadoPor,
      recurrente: false,
      tarjetaId: tarjeta.id,
    }))
  }
  programarSyncPagos()
  if (ids.length > 0) {
    offerUndo(`${ids.length} gasto${ids.length !== 1 ? 's' : ''} agregado${ids.length !== 1 ? 's' : ''} desde el resumen`, async () => {
      for (const id of ids) await deleteTransaction(id)
    })
  }
  return ids.length
}

/** Los cargos del banco se registran juntos como un solo gasto */
export function cargosComoGasto(r: Resumen, cargos: ResumenItem[]) {
  const porMoneda = new Map<ResumenItem['moneda'], number>()
  for (const c of cargos) porMoneda.set(c.moneda, (porMoneda.get(c.moneda) ?? 0) + c.monto)
  const fecha = r.detalle?.fechaCierre ?? cargos[cargos.length - 1]?.fecha ?? new Date().toISOString().slice(0, 10)
  return [...porMoneda].map(([moneda, monto]) => ({
    fecha, comercio: `Intereses e impuestos ${r.emisor}`, descripcion: cargos.map((c) => c.descripcion).join(' · '),
    monto: Math.round(monto * 100) / 100, moneda, categoria: null,
  }))
}
