// Tarjetas de crédito (compartido por mobile y desktop).
//
// Un egreso puede asignarse a una tarjeta en lugar de a un ingreso. Esos
// consumos no salen de los ingresos del mes: se suman al PAGO de la tarjeta
// del mes siguiente, que es un egreso automático y obligatorio (uno por
// tarjeta y moneda). Ese pago se asigna a un ingreso como cualquier egreso.
//
// Pago del mes M = consumos de M−1 + cuotas que vencen en M + lo que quedó
// sin pagar del pago de M−1. El monto del movimiento es el abono: por defecto
// el total; si se abona menos, la diferencia pasa al pago de M+1 (sin intereses).
//
// Para no contar dos veces el mismo dinero:
//   - caja / balance / ingresos: cuentan los pagos, no los consumos con tarjeta
//   - análisis por categoría y presupuestos: cuentan los consumos, no los pagos
import { supabase } from './supabase'
import { rowToTx, txToRow } from './transactions'
import { fetchCuotas, cuotaEnMes, updateCompraCuotas } from './cuotas'
import { updateSettings } from './settings'
import { shiftMonth, getCurrentMonth } from './constants'
import { useSettingsStore } from '../store/useSettingsStore'
import { useTransactionStore } from '../store/useTransactionStore'
import { Asignacion, CompraCuotas, Currency, PagoTarjeta, Settings, Tarjeta, Transaction } from '../types'

/** Categoría fija de los pagos de tarjeta (no aparece en los selectores) */
export const CATEGORIA_PAGO_TARJETA = 'pago_tarjeta'

/** Día del mes en que se registra el pago automático */
const DIA_PAGO = 10

export const COLORES_TARJETA = ['#26363F', '#3F6B4B', '#9C7030', '#8A4A3C', '#3F5F7A', '#5C5953']

// ── Reglas de conteo ─────────────────────────────────────────────────────────

/** Egreso pagado con tarjeta: se paga el mes siguiente */
export function esConsumoTarjeta(t: Transaction): boolean {
  return t.tipo === 'egreso' && !!t.tarjetaId && !t.pagoTarjeta
}

/** Pago automático de una tarjeta */
export function esPagoTarjeta(t: Transaction): boolean {
  return !!t.pagoTarjeta
}

/** Cuenta para caja / balance / ingresos del mes (excluye consumos con tarjeta) */
export function cuentaEnCaja(t: Transaction): boolean {
  return !esConsumoTarjeta(t)
}

/** Cuenta para análisis por categoría y presupuestos (excluye pagos de tarjeta) */
export function cuentaEnCategorias(t: Transaction): boolean {
  return !esPagoTarjeta(t)
}

/**
 * Egreso que todavía necesita un ingreso de respaldo: no está asignado a un
 * ingreso existente, no va a una tarjeta y tiene algo que pagar.
 */
export function necesitaRespaldo(t: Transaction, ingresoIds: ReadonlySet<string | undefined>): boolean {
  return t.tipo === 'egreso'
    && !esConsumoTarjeta(t)
    && t.monto > 0
    && !t.asignaciones.some((a) => ingresoIds.has(a.ingresoId))
}

/** Lo que el pago deja para el mes siguiente */
export function saldoQuePasa(t: Transaction): number {
  return t.pagoTarjeta ? r2(t.pagoTarjeta.total - t.monto) : 0
}

export function tarjetaDe(id: string | null | undefined, s: Settings | null): Tarjeta | undefined {
  return id ? s?.tarjetas?.find((t) => t.id === id) : undefined
}

// ── Cuotas vinculadas ────────────────────────────────────────────────────────

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Las compras en cuotas guardan el nombre de la tarjeta: se vinculan por nombre */
export function esDeTarjeta(c: CompraCuotas, t: Tarjeta): boolean {
  return normalizar(c.tarjeta) === normalizar(t.nombre)
}

// ── Sincronización de pagos ──────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100

const monthOf = (t: Transaction) => {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const maxMes = (...ms: (string | undefined)[]) =>
  ms.filter((m): m is string => !!m).reduce((a, b) => (b > a ? b : a))
const minMes = (...ms: (string | undefined)[]) =>
  ms.filter((m): m is string => !!m).reduce((a, b) => (b < a ? b : a))

/** Reparte el nuevo monto entre las asignaciones existentes, en proporción */
function reescalar(asig: Asignacion[], monto: number): Asignacion[] {
  const total = asig.reduce((s, a) => s + a.monto, 0)
  if (asig.length === 0 || monto <= 0 || total <= 0) return []
  if (asig.length === 1) return [{ ...asig[0], monto }]
  let resto = monto
  return asig.map((a, i) => {
    const m = i === asig.length - 1 ? r2(resto) : r2((a.monto * monto) / total)
    resto -= m
    return { ...a, monto: m }
  })
}

function fechaPago(mes: string) {
  return { toDate: () => new Date(`${mes}-${String(DIA_PAGO).padStart(2, '0')}T12:00:00`) }
}

function descripcionPago(t: Tarjeta, moneda: Currency) {
  return `Pago ${t.nombre}${moneda !== 'ARS' ? ` (${moneda})` : ''}`
}

function mismoPago(a: Transaction, b: Transaction): boolean {
  return a.monto === b.monto
    && a.moneda === b.moneda
    && a.descripcion === b.descripcion
    && a.categoria === b.categoria
    && monthOf(a) === monthOf(b)
    && a.fecha.toDate().getDate() === b.fecha.toDate().getDate()
    && JSON.stringify(a.pagoTarjeta) === JSON.stringify(b.pagoTarjeta)
    && JSON.stringify(a.asignaciones) === JSON.stringify(b.asignaciones)
}

/**
 * Crea, actualiza o borra los pagos automáticos para que reflejen los
 * consumos, las cuotas y los abonos actuales. Es idempotente: si todo está
 * al día no escribe nada.
 */
export async function syncPagosTarjeta(s: Settings, mesVisto?: string): Promise<void> {
  const tarjetas = s.tarjetas ?? []

  const [consRes, pagosRes, cuotas] = await Promise.all([
    supabase.from('movimientos').select('*').is('deleted_at', null).not('children->>tarjetaId', 'is', null),
    supabase.from('movimientos').select('*').is('deleted_at', null).not('children->>pagoTarjeta', 'is', null)
      .order('created_at', { ascending: true }),
    tarjetas.length ? fetchCuotas() : Promise.resolve([] as CompraCuotas[]),
  ])
  if (consRes.error) throw consRes.error
  if (pagosRes.error) throw pagosRes.error

  const consumos = (consRes.data ?? []).map(rowToTx).filter(esConsumoTarjeta)
  const pagos = (pagosRes.data ?? []).map(rowToTx).filter(esPagoTarjeta)
  if (tarjetas.length === 0 && pagos.length === 0) return

  const hoy = getCurrentMonth()
  const hasta = maxMes(
    shiftMonth(maxMes(hoy, mesVisto), 1),
    ...consumos.map((c) => shiftMonth(monthOf(c), 1)),
    ...pagos.map((p) => p.pagoTarjeta!.mes),
  )

  const clave = (tarjetaId: string, mes: string, moneda: string) => `${tarjetaId}|${mes}|${moneda}`
  const existentes = new Map<string, Transaction[]>()
  for (const p of pagos) {
    const k = clave(p.pagoTarjeta!.tarjetaId, p.pagoTarjeta!.mes, p.pagoTarjeta!.moneda)
    existentes.set(k, [...(existentes.get(k) ?? []), p])
  }

  const inserts: Transaction[] = []
  const updates: Transaction[] = []
  const borrar: string[] = []

  for (const t of tarjetas) {
    const misConsumos = consumos.filter((c) => c.tarjetaId === t.id)
    const misCuotas = cuotas.filter((c) => esDeTarjeta(c, t))
    const misPagos = pagos.filter((p) => p.pagoTarjeta!.tarjetaId === t.id)
    if (misConsumos.length === 0 && misCuotas.length === 0 && misPagos.length === 0) continue

    const monedas = new Set<Currency>([
      ...misConsumos.map((c) => c.moneda),
      ...misCuotas.map((c) => c.moneda),
      ...misPagos.map((p) => p.pagoTarjeta!.moneda),
    ])
    const desde = minMes(
      t.desde,
      ...misConsumos.map((c) => shiftMonth(monthOf(c), 1)),
      ...misPagos.map((p) => p.pagoTarjeta!.mes),
    )

    for (const moneda of monedas) {
      let saldoAnterior = 0
      for (let mes = desde; mes <= hasta; mes = shiftMonth(mes, 1)) {
        const previo = shiftMonth(mes, -1)
        const consumosMes = r2(misConsumos
          .filter((c) => c.moneda === moneda && monthOf(c) === previo)
          .reduce((sum, c) => sum + c.monto, 0))
        const cuotasMes = mes >= t.desde
          ? r2(misCuotas
              .filter((c) => c.moneda === moneda && cuotaEnMes(c, mes) !== null)
              .reduce((sum, c) => sum + c.montoCuota, 0))
          : 0
        const total = r2(consumosMes + cuotasMes + saldoAnterior)

        const k = clave(t.id, mes, moneda)
        const [actual, ...duplicados] = existentes.get(k) ?? []
        existentes.delete(k)
        borrar.push(...duplicados.map((d) => d.id!))

        if (total <= 0) {
          if (actual) borrar.push(actual.id!)
          saldoAnterior = 0
          continue
        }

        const manual = !!actual?.pagoTarjeta?.abonoManual
        const abono = manual ? Math.min(Math.max(actual!.monto, 0), total) : total
        saldoAnterior = r2(total - abono)

        const pagoTarjeta: PagoTarjeta = {
          tarjetaId: t.id, mes, moneda,
          consumos: consumosMes, cuotas: cuotasMes,
          saldoAnterior: r2(total - consumosMes - cuotasMes),
          total,
          abonoManual: manual && abono < total,
        }
        const deseado: Transaction = {
          ...(actual ?? {
            userId: 'shared', tipo: 'egreso', nota: '', tags: [], ejecutado: false,
            asignaciones: [], creadoPor: 'shared', recurrente: false, ahorroAssetId: null,
          }),
          monto: abono,
          moneda,
          categoria: CATEGORIA_PAGO_TARJETA,
          descripcion: descripcionPago(t, moneda),
          fecha: fechaPago(mes),
          tarjetaId: null,
          pagoTarjeta,
          asignaciones: reescalar(actual?.asignaciones ?? [], abono),
        }
        if (!actual) inserts.push(deseado)
        else if (!mismoPago(actual, deseado)) updates.push(deseado)
      }
    }
  }

  // Pagos de tarjetas eliminadas: se borran los pendientes; los ya pagados
  // quedan como registro de lo que salió
  for (const resto of existentes.values()) {
    for (const p of resto) if (!p.ejecutado) borrar.push(p.id!)
  }

  if (inserts.length) {
    const { error } = await supabase.from('movimientos').insert(inserts.map(txToRow))
    if (error) throw error
  }
  for (const u of updates) {
    const { id, ...rest } = u
    const { error } = await supabase.from('movimientos').update(txToRow(rest)).eq('id', id!)
    if (error) throw error
  }
  if (borrar.length) {
    const { error } = await supabase.from('movimientos')
      .update({ deleted_at: new Date().toISOString() }).in('id', borrar)
    if (error) throw error
    const store = useTransactionStore.getState()
    borrar.forEach((id) => store.removeTransaction(id))
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let enCurso: Promise<void> | null = null
let pendiente = false

/**
 * Programa una sincronización (con espera, para agrupar cambios seguidos).
 * La llaman los providers ante cualquier cambio de movimientos o settings.
 */
export function programarSyncPagos(delayMs = 1200) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    if (enCurso) { pendiente = true; return }
    const s = useSettingsStore.getState().settings
    if (!s) return
    enCurso = syncPagosTarjeta(s, useTransactionStore.getState().currentMonth)
      .catch((err) => console.warn('[tarjetas] no se pudieron sincronizar los pagos:', err))
      .finally(() => {
        enCurso = null
        if (pendiente) { pendiente = false; programarSyncPagos(0) }
      })
  }, delayMs)
}

/**
 * Fija cuánto se abona de un pago. Si es menos que el total, la diferencia
 * pasa al pago del mes siguiente.
 */
export async function registrarAbono(tx: Transaction, abono: number): Promise<void> {
  const p = tx.pagoTarjeta
  if (!p || !tx.id) throw new Error('No es un pago de tarjeta')
  const monto = r2(Math.min(Math.max(abono, 0), p.total))
  const pagoTarjeta: PagoTarjeta = { ...p, abonoManual: monto < p.total }
  const asignaciones = reescalar(tx.asignaciones, monto)
  const { data: current } = await supabase.from('movimientos').select('children').eq('id', tx.id).single()
  const { error } = await supabase.from('movimientos').update({
    amount: monto,
    orig_amt: monto,
    children: {
      ...(current?.children ?? {}),
      pagoTarjeta,
      asignaciones,
      asignadoA: asignaciones[0]?.ingresoId ?? null,
    },
  }).eq('id', tx.id)
  if (error) throw error
  useTransactionStore.getState().patchTransaction(tx.id, { monto, pagoTarjeta, asignaciones })
  programarSyncPagos(0)
}

/** Nueva tarjeta: sus cuotas cuentan desde el pago del mes que viene */
export function nuevaTarjeta(nombre: string, existentes: Tarjeta[]): Tarjeta {
  return {
    id: `tc_${Date.now().toString(36)}`,
    nombre: nombre.trim(),
    color: COLORES_TARJETA[existentes.length % COLORES_TARJETA.length],
    desde: shiftMonth(getCurrentMonth(), 1),
  }
}

/**
 * Quita una tarjeta: sus consumos vuelven a "sin asignar" y sus pagos
 * pendientes se borran en la próxima sincronización.
 */
export async function liberarConsumosDeTarjeta(tarjetaId: string): Promise<number> {
  const { data, error } = await supabase.from('movimientos').select('id, children')
    .is('deleted_at', null).eq('children->>tarjetaId', tarjetaId)
  if (error) throw error
  for (const row of data ?? []) {
    const { error: e } = await supabase.from('movimientos')
      .update({ children: { ...(row.children ?? {}), tarjetaId: null } }).eq('id', row.id)
    if (e) throw e
    useTransactionStore.getState().patchTransaction(row.id as string, { tarjetaId: null })
  }
  return data?.length ?? 0
}

// ── Alta, edición y baja (Ajustes) ───────────────────────────────────────────

async function guardarTarjetas(s: Settings, tarjetas: Tarjeta[]) {
  await updateSettings('shared', { tarjetas })
  useSettingsStore.getState().setSettings({ ...s, tarjetas })
  programarSyncPagos(0)
}

export async function agregarTarjeta(s: Settings, nombre: string): Promise<Tarjeta> {
  const actuales = s.tarjetas ?? []
  if (!nombre.trim()) throw new Error('Falta el nombre')
  if (actuales.some((t) => normalizar(t.nombre) === normalizar(nombre))) throw new Error('Ya existe una tarjeta con ese nombre')
  const t = nuevaTarjeta(nombre, actuales)
  await guardarTarjetas(s, [...actuales, t])
  return t
}

/** Renombra la tarjeta y sus compras en cuotas (que la referencian por nombre) */
export async function renombrarTarjeta(s: Settings, id: string, nombre: string): Promise<void> {
  const actuales = s.tarjetas ?? []
  const vieja = actuales.find((t) => t.id === id)
  if (!vieja || !nombre.trim()) return
  if (actuales.some((t) => t.id !== id && normalizar(t.nombre) === normalizar(nombre))) {
    throw new Error('Ya existe una tarjeta con ese nombre')
  }
  const cuotas = await fetchCuotas()
  for (const c of cuotas.filter((c) => esDeTarjeta(c, vieja))) {
    const { id: cid, ...rest } = c
    await updateCompraCuotas(cid!, { ...rest, tarjeta: nombre.trim() })
  }
  await guardarTarjetas(s, actuales.map((t) => (t.id === id ? { ...t, nombre: nombre.trim() } : t)))
}

export async function eliminarTarjeta(s: Settings, id: string): Promise<number> {
  const liberados = await liberarConsumosDeTarjeta(id)
  await guardarTarjetas(s, (s.tarjetas ?? []).filter((t) => t.id !== id))
  return liberados
}

// ── Detalle de un pago ───────────────────────────────────────────────────────

export interface DetallePago {
  /** Gastos del mes anterior que componen el pago */
  consumos: Transaction[]
  cuotas: { descripcion: string; numero: number; totalCuotas: number; monto: number }[]
}

export async function detallePago(p: PagoTarjeta, s: Settings): Promise<DetallePago> {
  const previo = shiftMonth(p.mes, -1)
  const [y, m] = previo.split('-').map(Number)
  const fin = `${previo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const [consRes, cuotas] = await Promise.all([
    supabase.from('movimientos').select('*').is('deleted_at', null)
      .eq('children->>tarjetaId', p.tarjetaId).eq('currency', p.moneda)
      .gte('date', `${previo}-01`).lte('date', fin).order('date'),
    fetchCuotas(),
  ])
  if (consRes.error) throw consRes.error
  const t = tarjetaDe(p.tarjetaId, s)
  return {
    consumos: (consRes.data ?? []).map(rowToTx).filter(esConsumoTarjeta),
    cuotas: t && p.mes >= t.desde
      ? cuotas
          .filter((c) => esDeTarjeta(c, t) && c.moneda === p.moneda && cuotaEnMes(c, p.mes) !== null)
          .map((c) => ({ descripcion: c.descripcion, numero: cuotaEnMes(c, p.mes)!, totalCuotas: c.totalCuotas, monto: c.montoCuota }))
      : [],
  }
}
