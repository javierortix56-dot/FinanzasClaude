import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { Settings } from '@/types'
import { DEFAULT_GASTO_CATEGORIES, DEFAULT_INGRESO_CATEGORIES } from './constants'

export const DEFAULT_SETTINGS: Settings = {
  tipoCambio: {
    ARS_USD: 1200,
    COP_USD: 4100,
  },
  historialTipoCambio: [],
  categoriasGasto: DEFAULT_GASTO_CATEGORIES.map((c) => ({ ...c, activa: true })),
  categoriasIngreso: DEFAULT_INGRESO_CATEGORIES.map((c) => ({ ...c, activa: true })),
  tiposActivo: ['Banco', 'Efectivo', 'Cripto', 'Inversiones', 'Ahorro'],
  tiposPasivo: ['Tarjeta de crédito', 'Préstamo', 'Deuda'],
  mesesCerrados: [],
}

export async function getOrInitSettings(userId: string): Promise<Settings> {
  const ref = doc(db, 'settings', userId)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as Settings
  await setDoc(ref, DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export function subscribeToSettings(
  userId: string,
  callback: (s: Settings) => void
) {
  return onSnapshot(doc(db, 'settings', userId), (snap) => {
    if (snap.exists()) callback(snap.data() as Settings)
  })
}

export async function updateSettings(userId: string, partial: Partial<Settings>) {
  await setDoc(doc(db, 'settings', userId), partial, { merge: true })
}
