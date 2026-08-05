import { supabase, SHARED_UUID } from './supabase'
import { useTransactionStore } from '../store/useTransactionStore'
import { Asignacion, Transaction } from '../types'

/**
 * Lee las asignaciones de un egreso desde children.
 * Formato nuevo: children.asignaciones = [{ ingresoId, monto }].
 * Formato viejo: children.asignadoA = id único → una asignación por el
 * monto completo del movimiento.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readAsignaciones(extra: Record<string, any>, monto: number): Asignacion[] {
  if (Array.isArray(extra.asignaciones)) {
    return extra.asignaciones
      .filter((a: unknown): a is Asignacion =>
        !!a && typeof (a as Asignacion).ingresoId === 'string' && Number((a as Asignacion).monto) > 0
      )
      .map((a: Asignacion) => ({ ingresoId: a.ingresoId, monto: Number(a.monto) }))
  }
  if (typeof extra.asignadoA === 'string' && extra.asignadoA) {
    return [{ ingresoId: extra.asignadoA, monto }]
  }
  return []
}

/**
 * Filas migradas de Firebase: `amount` trae el importe YA convertido a ARS y
 * `orig_amt` el importe en la moneda original, así que ahí hay que leer el
 * movimiento como ARS aunque `currency` diga otra cosa.
 *
 * Ojo: un desfasaje entre ambos NO alcanza para dar por migrada la fila. Una
 * edición vieja podía dejar `orig_amt` sin actualizar, y esa fila se leía como
 * ARS: un ingreso de COP 1.000.000 aparecía como ARS 1.000.000, sin convertir.
 * Por eso exigimos además que la conversión tenga sentido para la moneda: el
 * equivalente en ARS de un importe en COP siempre es MENOR (el peso colombiano
 * vale menos que el argentino) y el de un importe en USD siempre es MAYOR.
 */
function isPreConvertedToARS(
  currency: string,
  amount: number,
  origAmt: number | null,
): boolean {
  if (origAmt == null || Math.abs(origAmt - amount) <= 0.01) return false
  if (currency === 'COP') return amount < origAmt
  if (currency === 'USD') return amount > origAmt
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToTx(row: Record<string, any>): Transaction {
  const dateStr = row.date as string
  const extra = row.children ?? {}
  // DB may store 'inc'/'exp' (old app) or 'ingreso'/'egreso' (new)
  const rawType = row.type as string
  const tipo = rawType === 'inc' ? 'ingreso' : rawType === 'exp' ? 'egreso' : rawType as 'ingreso' | 'egreso'
  const origAmt = row.orig_amt as number | null
  const amount = row.amount as number
  const isPreConverted = isPreConvertedToARS(row.currency as string, amount, origAmt)
  return {
    id: row.id as string,
    userId: 'shared',
    tipo,
    monto: amount,
    moneda: (isPreConverted ? 'ARS' : row.currency) as 'ARS' | 'COP' | 'USD',
    categoria: (row.category as string) ?? '',
    descripcion: (row.description as string) ?? '',
    nota: extra.nota ?? '',
    tags: extra.tags ?? [],
    fecha: { toDate: () => new Date(dateStr + 'T12:00:00') },
    ejecutado: (row.executed as boolean) ?? false,
    asignaciones: readAsignaciones(extra, amount),
    creadoPor: extra.creadoPor ?? 'shared',
    recurrente: extra.recurrente ?? false,
    ahorroAssetId: extra.ahorroAssetId ?? null,
  }
}

function txToRow(tx: Omit<Transaction, 'id'>) {
  return {
    user_id: SHARED_UUID,
    type: tx.tipo,
    amount: tx.monto,
    orig_amt: tx.monto,  // same as amount for new transactions (no pre-conversion)
    currency: tx.moneda,
    category: tx.categoria,
    description: tx.descripcion,
    executed: tx.ejecutado,
    date: tx.fecha.toDate().toISOString().slice(0, 10),
    children: {
      nota: tx.nota,
      tags: tx.tags,
      asignaciones: tx.asignaciones,
      // Espejo legacy para clientes/backups viejos que solo leen asignadoA
      asignadoA: tx.asignaciones[0]?.ingresoId ?? null,
      creadoPor: tx.creadoPor,
      recurrente: tx.recurrente ?? false,
      ahorroAssetId: tx.ahorroAssetId ?? null,
    },
  }
}

export function subscribeToTransactions(
  month: string,
  callback: (txs: Transaction[]) => void
): () => void {
  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Si la suscripción ya se limpió (p. ej. al cambiar de mes rápido), descartamos
  // un fetch en vuelo para no pisar el estado nuevo con datos viejos.
  let active = true

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .is('deleted_at', null)
      .filter('date', 'gte', start)
      .filter('date', 'lte', end)
      .order('date', { ascending: false })

    if (!active) return

    if (error) {
      // No pisar el caché local con una lista vacía por un error transitorio
      // (p. ej. PWA sin conexión): se mantiene lo último conocido.
      console.error('[transactions] fetch error:', error)
      return
    }
    callback((data ?? []).map(rowToTx))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`movimientos-${month}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos' }, fetchAndNotify)
    .subscribe()

  return () => { active = false; supabase.removeChannel(channel) }
}

export async function addTransaction(data: Omit<Transaction, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('movimientos')
    .insert(txToRow(data))
    .select('id')
    .single()

  if (error) throw error
  const id = row.id as string
  // Optimista: reflejar el alta al instante; el realtime reconcilia después.
  useTransactionStore.getState().upsertTransaction({ ...data, id })
  return id
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, 'id'>>) {
  const partial: Record<string, unknown> = {}
  if (data.tipo !== undefined) partial.type = data.tipo
  if (data.monto !== undefined) {
    partial.amount = data.monto
    // orig_amt tiene que seguir a amount: si queda con el importe viejo, la
    // fila parece migrada de Firebase (importe ya convertido) y se pierde la
    // moneda original al releerla.
    partial.orig_amt = data.monto
  }
  if (data.moneda !== undefined) partial.currency = data.moneda
  if (data.categoria !== undefined) partial.category = data.categoria
  if (data.descripcion !== undefined) partial.description = data.descripcion
  if (data.ejecutado !== undefined) partial.executed = data.ejecutado
  if (data.fecha !== undefined) partial.date = data.fecha.toDate().toISOString().slice(0, 10)

  const childrenFields: Record<string, unknown> = {}
  if (data.nota !== undefined) childrenFields.nota = data.nota
  if (data.tags !== undefined) childrenFields.tags = data.tags
  if (data.asignaciones !== undefined) {
    childrenFields.asignaciones = data.asignaciones
    childrenFields.asignadoA = data.asignaciones[0]?.ingresoId ?? null
  }
  if (data.creadoPor !== undefined) childrenFields.creadoPor = data.creadoPor
  if (data.recurrente !== undefined) childrenFields.recurrente = data.recurrente
  if (data.ahorroAssetId !== undefined) childrenFields.ahorroAssetId = data.ahorroAssetId

  if (Object.keys(childrenFields).length > 0) {
    const { data: current } = await supabase
      .from('movimientos').select('children').eq('id', id).single()
    partial.children = { ...(current?.children ?? {}), ...childrenFields }
  }

  const { error } = await supabase.from('movimientos').update(partial).eq('id', id)
  if (error) throw error
  // Optimista: mergear los cambios en el store (re-ubica de mes si cambió la fecha)
  useTransactionStore.getState().patchTransaction(id, data)
}

export async function deleteTransaction(id: string) {
  // Optimista: sacar del store antes del roundtrip; si falla, el realtime
  // (o el catch del caller) lo repone al reconciliar.
  useTransactionStore.getState().removeTransaction(id)
  // Soft delete to match existing data pattern
  const { error } = await supabase
    .from('movimientos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markEjecutado(id: string, ejecutado: boolean) {
  // Optimista: el check cambia al instante
  useTransactionStore.getState().patchTransaction(id, { ejecutado })
  const { error } = await supabase.from('movimientos').update({ executed: ejecutado }).eq('id', id)
  if (error) throw error
}

export async function deleteMonthTransactions(month: string): Promise<number> {
  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('movimientos')
    .select('id')
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)

  if (error) throw error
  if (!data || data.length === 0) return 0

  const { error: delErr } = await supabase
    .from('movimientos')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', data.map((r) => r.id))

  if (delErr) throw delErr
  useTransactionStore.getState().setMonthTransactions(month, [])
  return data.length
}

/**
 * Devuelve cuántos movimientos activos tiene ya un mes determinado.
 * Útil para advertir al usuario antes de clonar o crear recurrentes y evitar duplicados.
 */
export async function countMonthTransactions(month: string): Promise<number> {
  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { count, error } = await supabase
    .from('movimientos')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)

  if (error) throw error
  return count ?? 0
}

export async function cloneMonthTransactions(fromMonth: string, toMonth: string): Promise<number> {
  const [fy, fm] = fromMonth.split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  const startF = `${fy}-${String(fm).padStart(2, '0')}-01`
  const lastDayF = new Date(fy, fm, 0).getDate()
  const endF = `${fy}-${String(fm).padStart(2, '0')}-${String(lastDayF).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)
    .gte('date', startF)
    .lte('date', endF)

  if (error) throw error
  if (!data || data.length === 0) return 0

  const inserts = data.map((row) => {
    const origDate = new Date(row.date + 'T12:00:00')
    const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
    const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { ...txToRow({ ...rowToTx(row), ejecutado: false, asignaciones: [] }), date: newDate }
  })

  const { error: insErr } = await supabase.from('movimientos').insert(inserts)
  if (insErr) throw insErr
  return inserts.length
}

export async function createRecurringTransactions(toMonth: string): Promise<number> {
  const [ty, tm] = toMonth.split('-').map(Number)
  const prevDate = new Date(ty, tm - 2, 1)
  const fy = prevDate.getFullYear()
  const fm = prevDate.getMonth() + 1
  const startF = `${fy}-${String(fm).padStart(2, '0')}-01`
  const lastDayF = new Date(fy, fm, 0).getDate()
  const endF = `${fy}-${String(fm).padStart(2, '0')}-${String(lastDayF).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)
    .gte('date', startF)
    .lte('date', endF)

  if (error) throw error
  const recurring = (data ?? []).filter((r) => r.children?.recurrente === true)
  if (recurring.length === 0) return 0

  const inserts = recurring.map((row) => {
    const origDate = new Date(row.date + 'T12:00:00')
    const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
    const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { ...txToRow({ ...rowToTx(row), ejecutado: false, asignaciones: [] }), date: newDate }
  })

  const { error: insErr } = await supabase.from('movimientos').insert(inserts)
  if (insErr) throw insErr
  return inserts.length
}

export async function cloneTransactionToMonth(txId: string, toMonth: string): Promise<string> {
  const { data: row, error } = await supabase.from('movimientos').select('*').eq('id', txId).single()
  if (error) throw error
  const [ty, tm] = toMonth.split('-').map(Number)
  const origDate = new Date((row.date as string) + 'T12:00:00')
  const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
  const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const insert = { ...txToRow({ ...rowToTx(row), ejecutado: false }), date: newDate }
  const { data: inserted, error: insErr } = await supabase.from('movimientos').insert(insert).select('id').single()
  if (insErr) throw insErr
  const newId = inserted.id as string
  useTransactionStore.getState().upsertTransaction(
    rowToTx({ ...insert, id: newId, date: newDate })
  )
  return newId
}

export async function moveTransactionToMonth(txId: string, toMonth: string): Promise<void> {
  const { data: row, error } = await supabase.from('movimientos').select('date').eq('id', txId).single()
  if (error) throw error
  const [ty, tm] = toMonth.split('-').map(Number)
  const origDate = new Date((row.date as string) + 'T12:00:00')
  const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
  const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const { error: updErr } = await supabase.from('movimientos').update({ date: newDate }).eq('id', txId)
  if (updErr) throw updErr
  // Optimista: re-ubicar el movimiento en su nuevo mes (desaparece del actual)
  useTransactionStore.getState().patchTransaction(txId, {
    fecha: { toDate: () => new Date(newDate + 'T12:00:00') },
  })
}
