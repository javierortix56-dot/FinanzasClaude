import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import { Budget } from '@/types'

export function subscribeToBudgets(
  userId: string,
  mes: string,
  callback: (budgets: Budget[]) => void
) {
  const q = query(
    collection(db, 'budgets'),
    where('userId', '==', userId),
    where('mes',    '==', mes)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Budget)))
  })
}

export async function upsertBudget(
  userId: string,
  mes: string,
  categoria: string,
  limite: number,
  moneda: string,
  existingId?: string
) {
  const data: Omit<Budget, 'id'> = { userId, categoria, mes, limite, moneda }
  if (existingId) {
    await updateDoc(doc(db, 'budgets', existingId), data)
  } else {
    await addDoc(collection(db, 'budgets'), data)
  }
}

export async function deleteBudget(id: string) {
  await deleteDoc(doc(db, 'budgets', id))
}
