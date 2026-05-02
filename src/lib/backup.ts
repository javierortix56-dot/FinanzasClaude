import { supabase } from './supabase'
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

function serializeTx(tx: Transaction & { id?: string }): object {
  return {
    ...tx,
    fecha: tx.fecha.toDate().toISOString(),
  }
}

function serializeAsset(asset: Asset & { id?: string }): object {
  return {
    ...asset,
    fechaAlta: asset.fechaAlta.toDate().toISOString(),
  }
}

export async function exportBackup(userId: string): Promise<BackupData> {
  const { data: txData } = await supabase
    .from('movimientos')
    .select('*')
    .is('deleted_at', null)


  const { data: assetData } = await supabase
    .from('cuentas')
    .select('*')

  const { data: configData } = await supabase
    .from('configuracion')
    .select('*')
    .maybeSingle()

  const appSettings = configData?.app_settings ?? {}
  const budgets: Budget[] = appSettings.budgets ?? []

  const transactions = (txData ?? []).map((row) => {
    const dateStr = row.date as string
    const extra = row.children ?? {}
    const tx: Transaction = {
      id: row.id,
      userId: 'shared',
      tipo: row.type,
      monto: row.amount,
      moneda: row.currency,
      categoria: row.category ?? '',
      descripcion: row.description ?? '',
      nota: extra.nota ?? '',
      tags: extra.tags ?? [],
      fecha: { toDate: () => new Date(dateStr + 'T12:00:00') },
      ejecutado: row.executed ?? false,
      asignadoA: extra.asignadoA ?? null,
      creadoPor: extra.creadoPor ?? 'shared',
      recurrente: extra.recurrente ?? false,
    }
    return serializeTx(tx)
  })

  const assets = (assetData ?? []).map((row) => {
    const asset: Asset = {
      id: row.id,
      userId: 'shared',
      nombre: row.name,
      tipo: row.kind,
      clase: row.type,
      moneda: row.currency,
      saldo: row.init_bal ?? 0,
      fechaAlta: { toDate: () => new Date((row.date_created ?? '2024-01-01') + 'T12:00:00') },
      metaObjetivo: row.meta_objetivo ?? null,
      metaMoneda: row.meta_moneda ?? null,
      snapshots: Array.isArray(row.snapshots) ? row.snapshots : [],
    }
    return serializeAsset(asset)
  })

  const settings = {
    tipoCambio: configData?.app_settings?.tipoCambio,
    historialTipoCambio: configData?.monthly_rates,
    categoriasGasto: configData?.transaction_cats,
    categoriasIngreso: configData?.categories,
    account_cats: configData?.account_cats,
    mesesCerrados: configData?.closed_months,
  }

  return {
    version: 2,
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
  _userId: string,
  data: BackupData
): Promise<{ transactions: number; assets: number }> {
  let txCount = 0
  let assetCount = 0

  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    const rows = data.transactions.map((raw) => {
      const r = raw as Record<string, unknown>
      const isoDate = r.fecha as string
      const date = isoDate ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
      return {
        user_id: '00000000-0000-0000-0000-000000000000',
        type: r.tipo as string,
        amount: r.monto as number,
        currency: r.moneda as string,
        category: r.categoria as string,
        description: r.descripcion as string,
        executed: r.ejecutado as boolean,
        date,
        children: {
          nota: r.nota,
          tags: r.tags,
          asignadoA: r.asignadoA,
          creadoPor: r.creadoPor,
          recurrente: r.recurrente,
        },
      }
    })
    const { error } = await supabase.from('movimientos').insert(rows)
    if (error) throw error
    txCount = rows.length
  }

  if (Array.isArray(data.assets) && data.assets.length > 0) {
    const rows = data.assets.map((raw) => {
      const r = raw as Record<string, unknown>
      const isoDate = r.fechaAlta as string
      return {
        user_id: '00000000-0000-0000-0000-000000000000',
        name: r.nombre as string,
        kind: r.tipo as string,
        type: r.clase as string,
        currency: r.moneda as string,
        init_bal: r.saldo as number,
        date_created: isoDate ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        meta_objetivo: r.metaObjetivo ?? null,
        meta_moneda: r.metaMoneda ?? null,
      }
    })
    const { error } = await supabase.from('cuentas').insert(rows)
    if (error) throw error
    assetCount = rows.length
  }

  return { transactions: txCount, assets: assetCount }
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data.version || !Array.isArray(data.transactions)) {
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
