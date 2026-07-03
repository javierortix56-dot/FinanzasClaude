import { supabase } from './supabase'
import { Transaction } from '../types'
import { shiftMonth } from './constants'

function rowToTx(row: Record<string, unknown>): Transaction {
  const dateStr = row.date as string
  const extra = (row.children as Record<string, unknown>) ?? {}
  // Migrated Firebase rows: amount = pre-converted ARS value, orig_amt = original currency value.
  const origAmt = row.orig_amt as number | null
  const amount = row.amount as number
  const isPreConverted = origAmt != null && Math.abs(origAmt - amount) > 0.01
  return {
    id: row.id as string,
    userId: 'shared',
    tipo: (row.type === 'inc' ? 'ingreso' : row.type === 'exp' ? 'egreso' : row.type) as 'ingreso' | 'egreso',
    monto: amount,
    moneda: (isPreConverted ? 'ARS' : row.currency) as 'ARS' | 'COP' | 'USD',
    categoria: (row.category as string) ?? '',
    descripcion: (row.description as string) ?? '',
    nota: (extra.nota as string) ?? '',
    tags: (extra.tags as string[]) ?? [],
    fecha: { toDate: () => new Date(dateStr + 'T12:00:00') },
    ejecutado: (row.executed as boolean) ?? false,
    asignadoA: (extra.asignadoA as string | null) ?? null,
    creadoPor: (extra.creadoPor as string) ?? 'shared',
    recurrente: (extra.recurrente as boolean) ?? false,
  }
}

// ── Caché en memoria con TTL corto ────────────────────────────────────────────
// Evita refetchear los mismos meses históricos cada vez que se entra a
// Análisis o se navega de mes. Los meses pasados casi no cambian; el mes
// actual siempre viene en vivo del store, no de acá.
const TTL_MS = 2 * 60 * 1000
const monthCache = new Map<string, { at: number; data: Transaction[] }>()
const lastNCache = new Map<string, { at: number; data: Record<string, Transaction[]> }>()

export async function fetchMonthTransactions(month: string): Promise<Transaction[]> {
  const hit = monthCache.get(month)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data

  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const end = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  if (error) {
    console.error('[analytics] fetchMonthTransactions error:', error)
    return []
  }

  const txs = (data ?? []).map(rowToTx)
  monthCache.set(month, { at: Date.now(), data: txs })
  return txs
}

/** Returns a map month → transactions for the last `n` months up to `upToMonth`. */
export async function fetchLastNMonths(
  n: number,
  upToMonth: string
): Promise<Record<string, Transaction[]>> {
  const cacheKey = `${n}:${upToMonth}`
  const hit = lastNCache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data

  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) months.push(shiftMonth(upToMonth, -i))

  const startM = months[0]
  const endM = months[months.length - 1]
  const [sy, sm] = startM.split('-').map(Number)
  const [ey, em] = endM.split('-').map(Number)

  const startDate = `${sy}-${String(sm).padStart(2, '0')}-01`
  const lastDay = new Date(ey, em, 0).getDate()
  const endDate = `${ey}-${String(em).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) {
    console.error('[analytics] fetchLastNMonths error:', error)
    return Object.fromEntries(months.map((m) => [m, []]))
  }

  const all = (data ?? []).map(rowToTx)
  const grouped: Record<string, Transaction[]> = {}
  months.forEach((m) => { grouped[m] = [] })
  all.forEach((tx) => {
    const d = tx.fecha.toDate()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (grouped[key]) grouped[key].push(tx)
  })
  lastNCache.set(cacheKey, { at: Date.now(), data: grouped })
  return grouped
}
