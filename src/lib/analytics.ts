import {
  collection, query, where, orderBy, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { Transaction } from '@/types'
import { shiftMonth } from './constants'

export async function fetchMonthTransactions(month: string): Promise<Transaction[]> {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0)
  const end   = new Date(year, mon,     0, 23, 59, 59, 999)
  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(start)),
    where('fecha', '<=', Timestamp.fromDate(end)),
    orderBy('fecha', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))
}

/** Returns a map month → transactions for the last `n` months up to `upToMonth`. */
export async function fetchLastNMonths(
  n: number,
  upToMonth: string
): Promise<Record<string, Transaction[]>> {
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) months.push(shiftMonth(upToMonth, -i))

  const startM = months[0]
  const endM   = months[months.length - 1]
  const [sy, sm] = startM.split('-').map(Number)
  const [ey, em] = endM.split('-').map(Number)

  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(new Date(sy, sm - 1, 1))),
    where('fecha', '<=', Timestamp.fromDate(new Date(ey, em, 0, 23, 59, 59))),
    orderBy('fecha', 'desc')
  )
  const snap = await getDocs(q)
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))

  const grouped: Record<string, Transaction[]> = {}
  months.forEach((m) => { grouped[m] = [] })
  all.forEach((tx) => {
    const d   = tx.fecha.toDate()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (grouped[key]) grouped[key].push(tx)
  })
  return grouped
}
