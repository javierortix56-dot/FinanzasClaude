// Contraste del resumen de una tarjeta de crédito con los consumos reales
// registrados con esa tarjeta. Solo entran los consumos con tarjeta de
// crédito: lo pagado en efectivo, débito o transferencia no aparece en el
// resumen.
//
// Emparejamiento uno a uno: misma moneda, monto dentro del 1 % y fecha a ±5
// días (el banco suele imputar la compra unos días después). Las cuotas no se
// concilian acá: se siguen desde Cuotas en curso.
import { actualizarConsumo, agregarConsumos } from './consumos'
import { offerUndo } from './undo'
import { esGasto } from './resumenAnalisis'
import { Consumo, Resumen, ResumenItem, Tarjeta } from '../types'

const DIA = 86400000
const TOLERANCIA_DIAS = 5

export interface ResultadoConciliacion {
  tarjeta: Tarjeta
  /** Renglón del resumen y consumo registrado que coinciden */
  coinciden: { item: ResumenItem; consumo: Consumo }[]
  /** Consumos del resumen sin registrar */
  faltan: ResumenItem[]
  /**
   * Consumos del resumen registrados con otro medio de pago (o sin indicar):
   * agregarlos de nuevo los duplicaría; hay que pasarlos a esta tarjeta.
   */
  otroMedio: { item: ResumenItem; consumo: Consumo }[]
  /** Consumos registrados con la tarjeta dentro del período que no aparecen en el resumen */
  sobran: Consumo[]
  /** Consumos con la tarjeta posteriores al cierre: entran en el próximo resumen */
  proximo: Consumo[]
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

/** Período que cubre el resumen: desde el primer consumo (sin cuotas) hasta el cierre */
export function periodoDelResumen(r: Resumen): { desde: string; hasta: string } | null {
  const fechas = r.items.filter((i) => esGasto(i) && !((i.cuotaTotal ?? 0) > 1)).map((i) => i.fecha).sort()
  if (fechas.length === 0) return null
  const hasta = r.detalle?.fechaCierre ?? fechas[fechas.length - 1]
  return { desde: fechas[0], hasta }
}

const ms = (fecha: string) => new Date(fecha + 'T12:00:00').getTime()

export function conciliar(r: Resumen, tarjeta: Tarjeta, consumos: Consumo[]): ResultadoConciliacion | null {
  const per = periodoDelResumen(r)
  if (!per) return null
  const desdeMs = ms(per.desde) - TOLERANCIA_DIAS * DIA
  const hastaMs = ms(per.hasta)
  const deLaTarjeta = consumos.filter((c) => c.tarjetaId === tarjeta.id)
  const enPeriodo = deLaTarjeta.filter((c) => ms(c.fecha) >= desdeMs && ms(c.fecha) <= hastaMs)
  const proximo = deLaTarjeta.filter((c) => ms(c.fecha) > hastaMs)
  const otros = consumos.filter((c) => c.tarjetaId !== tarjeta.id && ms(c.fecha) >= desdeMs && ms(c.fecha) <= hastaMs + TOLERANCIA_DIAS * DIA)

  const consumosResumen = r.items.filter((i) => esGasto(i) && !((i.cuotaTotal ?? 0) > 1))
  const usados = new Set<string>()
  const buscar = (i: ResumenItem, entre: Consumo[]) => {
    const f = ms(i.fecha)
    const tol = Math.max(1, i.monto * 0.01)
    return entre
      .filter((c) => !usados.has(c.id!) && c.moneda === i.moneda && Math.abs(c.monto - i.monto) <= tol)
      .map((c) => ({ c, d: Math.abs(ms(c.fecha) - f) }))
      .filter((x) => x.d <= TOLERANCIA_DIAS * DIA)
      .sort((a, b) => a.d - b.d)[0]?.c
  }
  const coinciden: ResultadoConciliacion['coinciden'] = []
  const otroMedio: ResultadoConciliacion['otroMedio'] = []
  const faltan: ResumenItem[] = []
  // Primero los montos grandes: menos ambigüedad
  for (const i of [...consumosResumen].sort((a, b) => b.monto - a.monto)) {
    const c = buscar(i, enPeriodo)
    if (c) { usados.add(c.id!); coinciden.push({ item: i, consumo: c }); continue }
    const otro = buscar(i, otros)
    if (otro) { usados.add(otro.id!); otroMedio.push({ item: i, consumo: otro }); continue }
    faltan.push(i)
  }
  return {
    tarjeta,
    coinciden: coinciden.sort((a, b) => a.item.fecha.localeCompare(b.item.fecha)),
    faltan: faltan.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    otroMedio,
    sobran: enPeriodo.filter((c) => !usados.has(c.id!)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    proximo,
    desde: per.desde,
    hasta: per.hasta,
  }
}

/** Pasa a la tarjeta consumos que se habían registrado con otro medio */
export async function pasarATarjeta(cs: Consumo[], tarjeta: Tarjeta): Promise<void> {
  const previos = cs.map((c) => ({ id: c.id!, medio: c.medio, tarjetaId: c.tarjetaId }))
  for (const c of cs) await actualizarConsumo(c.id!, { medio: 'credito', tarjetaId: tarjeta.id })
  offerUndo(`${cs.length} consumo${cs.length !== 1 ? 's' : ''} pasado${cs.length !== 1 ? 's' : ''} a ${tarjeta.nombre}`, async () => {
    for (const p of previos) await actualizarConsumo(p.id, { medio: p.medio, tarjetaId: p.tarjetaId })
  })
}

/** Registra renglones del resumen como consumos con la tarjeta (con deshacer) */
export async function registrarDesdeResumen(items: ResumenItem[], tarjeta: Tarjeta, categoriaFallback: string, creadoPor: string): Promise<number> {
  return agregarConsumos(items.map((i) => ({
    fecha: i.fecha, monto: i.monto, moneda: i.moneda, categoria: i.categoria ?? categoriaFallback,
    comercio: i.comercio, descripcion: i.descripcion, medio: 'credito' as const, tarjetaId: tarjeta.id,
    fuente: 'resumen' as const, creadoPor,
  })), `${items.length} consumo${items.length !== 1 ? 's' : ''} agregado${items.length !== 1 ? 's' : ''} desde el resumen`)
}
