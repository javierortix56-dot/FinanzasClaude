import {
  collection,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { Transaction, Asset, Settings, Budget } from '@/types'

export interface BackupData {
  version: number
  exportedAt: string
  userId: string
  transactions: object[]
  assets: object[]
  budgets: object[]
  settings: object
}

function serializeTimestamp(ts: Timestamp): string {
  return ts.toDate().toISOString()
}

function deserializeTimestamp(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso))
}

function serializeTx(tx: Transaction & { id?: string }): object {
  return {
    ...tx,
    fecha: serializeTimestamp(tx.fecha),
  }
}

function deserializeTx(raw: Record<string, unknown>): Omit<Transaction, 'id'> {
  return {
    ...(raw as Omit<Transaction, 'id' | 'fecha'>),
    fecha: deserializeTimestamp(raw.fecha as string),
  }
}

function serializeAsset(asset: Asset & { id?: string }): object {
  return {
    ...asset,
    fechaAlta: serializeTimestamp(asset.fechaAlta),
  }
}

function deserializeAsset(raw: Record<string, unknown>): Omit<Asset, 'id'> {
  return {
    ...(raw as Omit<Asset, 'id' | 'fechaAlta'>),
    fechaAlta: deserializeTimestamp(raw.fechaAlta as string),
  }
}

export async function exportBackup(userId: string): Promise<BackupData> {
  const [txSnap, assetSnap, budgetSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, 'transactions')),
    getDocs(collection(db, 'assets')),
    getDocs(collection(db, 'budgets')),
    getDocs(collection(db, 'settings')),
  ])

  const transactions = txSnap.docs
    .filter((d) => (d.data() as Transaction).userId === userId)
    .map((d) => serializeTx({ id: d.id, ...(d.data() as Transaction) }))

  const assets = assetSnap.docs
    .filter((d) => (d.data() as Asset).userId === userId)
    .map((d) => serializeAsset({ id: d.id, ...(d.data() as Asset) }))

  const budgets = budgetSnap.docs
    .filter((d) => (d.data() as Budget).userId === userId)
    .map((d) => ({ id: d.id, ...d.data() }))

  const settingsDoc = settingsSnap.docs.find((d) => d.id === userId)
  const settings = settingsDoc ? settingsDoc.data() : {}

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    transactions,
    assets,
    budgets,
    settings,
  }
}

export function downloadBackup(data: BackupData) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finanzas-backup-${data.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(
  userId: string,
  data: BackupData,
  options: { transactions?: boolean; assets?: boolean; settings?: boolean } = {
    transactions: true,
    assets: true,
    settings: true,
  }
): Promise<{ transactions: number; assets: number }> {
  const batch = writeBatch(db)
  let txCount = 0
  let assetCount = 0

  if (options.transactions) {
    for (const raw of data.transactions) {
      const tx = deserializeTx(raw as Record<string, unknown>)
      const newDoc = doc(collection(db, 'transactions'))
      batch.set(newDoc, { ...tx, userId })
      txCount++
    }
  }

  if (options.assets) {
    for (const raw of data.assets) {
      const asset = deserializeAsset(raw as Record<string, unknown>)
      const newDoc = doc(collection(db, 'assets'))
      batch.set(newDoc, { ...asset, userId })
      assetCount++
    }
  }

  await batch.commit()

  if (options.settings && data.settings && Object.keys(data.settings).length > 0) {
    const settingsRef = doc(db, 'settings', userId)
    const settingsSnap = await getDocs(collection(db, 'settings'))
    const exists = settingsSnap.docs.some((d) => d.id === userId)
    if (!exists) {
      const b2 = writeBatch(db)
      b2.set(settingsRef, data.settings)
      await b2.commit()
    }
  }

  return { transactions: txCount, assets: assetCount }
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data.version || !data.userId || !Array.isArray(data.transactions)) {
          reject(new Error('Archivo de backup inválido'))
          return
        }
        resolve(data as BackupData)
      } catch {
        reject(new Error('No se pudo leer el archivo'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })
}
