import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { Transaction } from '@/types'

export function subscribeToTransactions(
  month: string,
  callback: (txs: Transaction[]) => void
) {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, mon, 0, 23, 59, 59, 999)

  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(start)),
    where('fecha', '<=', Timestamp.fromDate(end)),
    orderBy('fecha', 'desc')
  )

  return onSnapshot(q, (snap) => {
    const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction))
    callback(txs)
  })
}

export async function addTransaction(data: Omit<Transaction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), data)
  return ref.id
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, 'id'>>) {
  await updateDoc(doc(db, 'transactions', id), data)
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, 'transactions', id))
}

export async function markEjecutado(id: string, ejecutado: boolean) {
  await updateDoc(doc(db, 'transactions', id), { ejecutado })
}

export async function deleteMonthTransactions(month: string): Promise<number> {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1, 0, 0, 0, 0)
  const end = new Date(year, mon, 0, 23, 59, 59, 999)
  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(start)),
    where('fecha', '<=', Timestamp.fromDate(end))
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return snap.size
}

export async function cloneMonthTransactions(fromMonth: string, toMonth: string): Promise<number> {
  const [fy, fm] = fromMonth.split('-').map(Number)
  const start = new Date(fy, fm - 1, 1, 0, 0, 0, 0)
  const end = new Date(fy, fm, 0, 23, 59, 59, 999)
  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(start)),
    where('fecha', '<=', Timestamp.fromDate(end))
  )
  const snap = await getDocs(q)
  const [ty, tm] = toMonth.split('-').map(Number)
  let count = 0
  for (const d of snap.docs) {
    const tx = d.data() as Omit<Transaction, 'id'>
    const origDate = tx.fecha.toDate()
    const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
    const newDate = new Date(ty, tm - 1, day, 12, 0, 0)
    await addDoc(collection(db, 'transactions'), {
      ...tx,
      fecha: Timestamp.fromDate(newDate),
      ejecutado: false,
      asignadoA: null,
    })
    count++
  }
  return count
}

export async function createRecurringTransactions(toMonth: string): Promise<number> {
  const [ty, tm] = toMonth.split('-').map(Number)
  const prevDate = new Date(ty, tm - 2, 1)
  const fromMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const [fy, fm] = fromMonth.split('-').map(Number)
  const start = new Date(fy, fm - 1, 1, 0, 0, 0, 0)
  const end = new Date(fy, fm, 0, 23, 59, 59, 999)
  const q = query(
    collection(db, 'transactions'),
    where('fecha', '>=', Timestamp.fromDate(start)),
    where('fecha', '<=', Timestamp.fromDate(end)),
    where('recurrente', '==', true)
  )
  const snap = await getDocs(q)
  let count = 0
  for (const d of snap.docs) {
    const tx = d.data() as Omit<Transaction, 'id'>
    const origDate = tx.fecha.toDate()
    const day = Math.min(origDate.getDate(), new Date(ty, tm, 0).getDate())
    const newDate = new Date(ty, tm - 1, day, 12, 0, 0)
    await addDoc(collection(db, 'transactions'), {
      ...tx,
      fecha: Timestamp.fromDate(newDate),
      ejecutado: false,
      asignadoA: null,
    })
    count++
  }
  return count
}
