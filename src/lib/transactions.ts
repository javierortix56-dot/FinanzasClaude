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
