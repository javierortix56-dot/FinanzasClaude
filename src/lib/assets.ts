import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from './firebase'
import { Asset } from '@/types'

export function subscribeToAssets(callback: (assets: Asset[]) => void) {
  const q = query(collection(db, 'assets'), orderBy('fechaAlta', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)))
  })
}

export async function addAsset(data: Omit<Asset, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'assets'), data)
  return ref.id
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id'>>) {
  await updateDoc(doc(db, 'assets', id), data)
}

export async function deleteAsset(id: string) {
  await deleteDoc(doc(db, 'assets', id))
}
