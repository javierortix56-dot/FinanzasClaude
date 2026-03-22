import { supabase, SHARED_UUID } from './supabase'
import { Transaction } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTx(row: Record<string, any>): Transaction {
  const dateStr = row.date as string
  const extra = row.children ?? {}
  // DB may store 'inc'/'exp' (old app) or 'ingreso'/'egreso' (new)
  const rawType = row.type as string
  const tipo = rawType === 'inc' ? 'ingreso' : rawType === 'exp' ? 'egreso' : rawType as 'ingreso' | 'egreso'
  return {
    id: row.id as string,
    userId: 'shared',
    tipo,
    monto: row.amount as number,
    moneda: row.currency as 'ARS' | 'COP' | 'USD',
    categoria: (row.category as string) ?? '',
    descripcion: (row.description as string) ?? '',
    nota: extra.nota ?? '',
    tags: extra.tags ?? [],
    fecha: { toDate: () => new Date(dateStr + 'T12:00:00') },
    ejecutado: (row.executed as boolean) ?? false,
    asignadoA: extra.asignadoA ?? null,
    creadoPor: extra.creadoPor ?? 'shared',
    recurrente: extra.recurrente ?? false,
  }
}

function txToRow(tx: Omit<Transaction, 'id'>) {
  return {
    user_id: SHARED_UUID,
    type: tx.tipo,
    amount: tx.monto,
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

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    if (error) {
      console.error('[transactions] fetch error:', error)
      callback([])
      return
    }
    callback((data ?? []).map(rowToTx))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`movimientos-${month}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos' }, fetchAndNotify)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function addTransaction(data: Omit<Transaction, 'id'>): Promise<string> {
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

  if (Object.keys(childrenFields).length > 0) {
    const { data: current } = await supabase
      .from('movimientos').select('children').eq('id', id).single()
    partial.children = { ...(current?.children ?? {}), ...childrenFields }
  }

  const { error } = await supabase.from('movimientos').update(partial).eq('id', id)
  if (error) throw error
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('movimientos').delete().eq('id', id)
  if (error) throw error
}

export async function markEjecutado(id: string, ejecutado: boolean) {
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
    .gte('date', start)
    .lte('date', end)

  if (error) throw error
  if (!data || data.length === 0) return 0

  const { error: delErr } = await supabase
    .from('movimientos')
    .delete()
    .in('id', data.map((r) => r.id))

  if (delErr) throw delErr
  return data.length
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
