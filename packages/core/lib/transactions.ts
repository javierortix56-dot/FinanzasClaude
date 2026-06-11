import { supabase, SHARED_UUID } from './supabase'
import { useSettingsStore } from '../store/useSettingsStore'
import { monthLabel } from './constants'
import { Transaction } from '../types'

/** Meses cerrados son de solo lectura: toda mutación sobre ellos se rechaza. */
function assertMonthOpen(month: string) {
  const closed = useSettingsStore.getState().settings?.mesesCerrados ?? []
  if (closed.includes(month)) {
    throw new Error(`${monthLabel(month)} está cerrado (solo lectura). Reabrilo desde Ajustes para editarlo.`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTx(row: Record<string, any>): Transaction {
  const dateStr = row.date as string
  const extra = row.children ?? {}
  // DB may store 'inc'/'exp' (old app) or 'ingreso'/'egreso' (new)
  const rawType = row.type as string
  const tipo = rawType === 'inc' ? 'ingreso' : rawType === 'exp' ? 'egreso' : rawType as 'ingreso' | 'egreso'
  // Migrated Firebase rows: amount = pre-converted ARS value, orig_amt = original currency value.
  // When orig_amt differs from amount, amount is already in ARS — use it directly.
  const origAmt = row.orig_amt as number | null
  const amount = row.amount as number
  const isPreConverted = origAmt != null && Math.abs(origAmt - amount) > 0.01
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
    asignadoA: extra.asignadoA ?? null,
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
      asignadoA: tx.asignadoA,
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
      console.error('[transactions] fetch error:', error)
      callback([])
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
  assertMonthOpen(txToRow(data).date.slice(0, 7))
  const { data: row, error } = await supabase
    .from('movimientos')
    .insert(txToRow(data))
    .select('id')
    .single()

  if (error) throw error
  return row.id as string
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, 'id'>>) {
  const partial: Record<string, unknown> = {}
  if (data.tipo !== undefined) partial.type = data.tipo
  if (data.monto !== undefined) partial.amount = data.monto
  if (data.moneda !== undefined) partial.currency = data.moneda
  if (data.categoria !== undefined) partial.category = data.categoria
  if (data.descripcion !== undefined) partial.description = data.descripcion
  if (data.ejecutado !== undefined) partial.executed = data.ejecutado
  if (data.fecha !== undefined) partial.date = data.fecha.toDate().toISOString().slice(0, 10)

  const childrenFields: Record<string, unknown> = {}
  if (data.nota !== undefined) childrenFields.nota = data.nota
  if (data.tags !== undefined) childrenFields.tags = data.tags
  if (data.asignadoA !== undefined) childrenFields.asignadoA = data.asignadoA
  if (data.creadoPor !== undefined) childrenFields.creadoPor = data.creadoPor
  if (data.recurrente !== undefined) childrenFields.recurrente = data.recurrente
  if (data.ahorroAssetId !== undefined) childrenFields.ahorroAssetId = data.ahorroAssetId

  const { data: current, error: curErr } = await supabase
    .from('movimientos').select('date, children').eq('id', id).single()
  if (curErr) throw curErr
  assertMonthOpen((current.date as string).slice(0, 7))
  if (partial.date !== undefined) assertMonthOpen((partial.date as string).slice(0, 7))

  if (Object.keys(childrenFields).length > 0) {
    partial.children = { ...(current?.children ?? {}), ...childrenFields }
  }

  const { error } = await supabase.from('movimientos').update(partial).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: string) {
  const { data: row, error: curErr } = await supabase
    .from('movimientos').select('date').eq('id', id).single()
  if (curErr) throw curErr
  assertMonthOpen((row.date as string).slice(0, 7))
  // Soft delete to match existing data pattern
  const { error } = await supabase
    .from('movimientos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markEjecutado(id: string, ejecutado: boolean) {
  const { data: row, error: curErr } = await supabase
    .from('movimientos').select('date').eq('id', id).single()
  if (curErr) throw curErr
  assertMonthOpen((row.date as string).slice(0, 7))
  const { error } = await supabase.from('movimientos').update({ executed: ejecutado }).eq('id', id)
  if (error) throw error
}

export async function deleteMonthTransactions(month: string): Promise<number> {
  assertMonthOpen(month)
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

/**
 * Cuenta movimientos activos cuya categoría sea alguna de las dadas.
 * Útil para bloquear el borrado de categorías en uso.
 */
export async function countTransactionsByCategories(categoryIds: string[]): Promise<number> {
  if (categoryIds.length === 0) return 0
  const { count, error } = await supabase
    .from('movimientos')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .in('category', categoryIds)
  if (error) throw error
  return count ?? 0
}

export async function cloneMonthTransactions(fromMonth: string, toMonth: string): Promise<number> {
  assertMonthOpen(toMonth)
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
    return { ...txToRow({ ...rowToTx(row), ejecutado: false, asignadoA: null }), date: newDate }
  })

  const { error: insErr } = await supabase.from('movimientos').insert(inserts)
  if (insErr) throw insErr
  return inserts.length
}

export async function createRecurringTransactions(toMonth: string): Promise<number> {
  assertMonthOpen(toMonth)
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
    return { ...txToRow({ ...rowToTx(row), ejecutado: false, asignadoA: null }), date: newDate }
  })

  const { error: insErr } = await supabase.from('movimientos').insert(inserts)
  if (insErr) throw insErr
  return inserts.length
}

export async function cloneTransactionToMonth(txId: string, toMonth: string): Promise<string> {
  assertMonthOpen(toMonth)
  const { data: row, error } = await supabase.from('movimientos').select('*').eq('id', txId).single()
  if (error) throw error
  const [ty, tm] = toMonth.split('-').map(Number)
  const origDate = new Date((row.date as string) + 'T12:00:00')
  const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
  const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const insert = { ...txToRow({ ...rowToTx(row), ejecutado: false }), date: newDate }
  const { data: inserted, error: insErr } = await supabase.from('movimientos').insert(insert).select('id').single()
  if (insErr) throw insErr
  return inserted.id as string
}

export async function moveTransactionToMonth(txId: string, toMonth: string): Promise<void> {
  assertMonthOpen(toMonth)
  const { data: row, error } = await supabase.from('movimientos').select('date').eq('id', txId).single()
  if (error) throw error
  assertMonthOpen((row.date as string).slice(0, 7))
  const [ty, tm] = toMonth.split('-').map(Number)
  const origDate = new Date((row.date as string) + 'T12:00:00')
  const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
  const newDate = `${ty}-${String(tm).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const { error: updErr } = await supabase.from('movimientos').update({ date: newDate }).eq('id', txId)
  if (updErr) throw updErr
}
