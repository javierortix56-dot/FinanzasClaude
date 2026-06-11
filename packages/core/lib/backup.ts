import { supabase } from './supabase'
import { Transaction, Asset, Settings, Budget } from '../types'

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

/** Lanzado cuando la DB ya tiene datos y el caller no confirmó la importación. */
export class NonEmptyDatabaseError extends Error {
  constructor(public existingTransactions: number, public existingAssets: number) {
    super(
      `La base ya contiene datos (${existingTransactions} movimientos, ${existingAssets} cuentas). ` +
      'Importar puede duplicar registros.'
    )
    this.name = 'NonEmptyDatabaseError'
  }
}

export async function importBackup(
  _userId: string,
  data: BackupData,
  opts: { allowNonEmpty?: boolean } = {}
): Promise<{ transactions: number; assets: number; budgets: number; settings: boolean }> {
  let txCount = 0
  let assetCount = 0

  // Protección contra duplicación: si la DB ya tiene datos, exigir confirmación.
  if (!opts.allowNonEmpty) {
    const { count: txExisting } = await supabase
      .from('movimientos').select('id', { count: 'exact', head: true }).is('deleted_at', null)
    const { count: assetExisting } = await supabase
      .from('cuentas').select('id', { count: 'exact', head: true })
    if ((txExisting ?? 0) > 0 || (assetExisting ?? 0) > 0) {
      throw new NonEmptyDatabaseError(txExisting ?? 0, assetExisting ?? 0)
    }
  }

  if (Array.isArray(data.transactions) && data.transactions.length > 0) {
    const rows = data.transactions.map((raw) => {
      const r = raw as Record<string, unknown>
      const isoDate = r.fecha as string
      const date = isoDate ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
      return {
        // Conservar el id original para que asignadoA/ahorroAssetId sigan
        // apuntando bien; si el registro ya existe, el insert falla por PK
        // en lugar de duplicar silenciosamente.
        ...(r.id ? { id: r.id } : {}),
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
          ahorroAssetId: r.ahorroAssetId ?? null,
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
        ...(r.id ? { id: r.id } : {}),
        user_id: '00000000-0000-0000-0000-000000000000',
        name: r.nombre as string,
        kind: r.tipo as string,
        type: r.clase as string,
        currency: r.moneda as string,
        init_bal: r.saldo as number,
        date_created: isoDate ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        meta_objetivo: r.metaObjetivo ?? null,
        meta_moneda: r.metaMoneda ?? null,
        snapshots: Array.isArray(r.snapshots) ? r.snapshots : [],
      }
    })
    const { error } = await supabase.from('cuentas').insert(rows)
    if (error) throw error
    assetCount = rows.length
  }

  // Budgets y settings: restaurar sobre la fila de configuracion preservando
  // las claves de app_settings que el backup no trae.
  let budgetCount = 0
  let settingsRestored = false
  const { data: configRow } = await supabase
    .from('configuracion')
    .select('app_settings')
    .eq('user_id', '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  const appSettings: Record<string, unknown> = { ...(configRow?.app_settings ?? {}) }

  if (Array.isArray(data.budgets) && data.budgets.length > 0) {
    const existing: Budget[] = Array.isArray(appSettings.budgets) ? (appSettings.budgets as Budget[]) : []
    const imported = data.budgets as Budget[]
    appSettings.budgets = [
      ...existing.filter((b) => !imported.some((i) => i.id === b.id)),
      ...imported,
    ]
    budgetCount = imported.length
  }

  const s = (data.settings ?? {}) as Record<string, unknown>
  const configUpdate: Record<string, unknown> = {
    user_id: '00000000-0000-0000-0000-000000000000',
    app_settings: appSettings,
  }
  if (s.tipoCambio)                         { appSettings.tipoCambio = s.tipoCambio;              settingsRestored = true }
  if (Array.isArray(s.historialTipoCambio)) { configUpdate.monthly_rates = s.historialTipoCambio; settingsRestored = true }
  if (Array.isArray(s.categoriasGasto))     { configUpdate.transaction_cats = s.categoriasGasto;  settingsRestored = true }
  if (Array.isArray(s.categoriasIngreso))   { configUpdate.categories = s.categoriasIngreso;      settingsRestored = true }
  if (s.account_cats)                       { configUpdate.account_cats = s.account_cats;         settingsRestored = true }
  if (Array.isArray(s.mesesCerrados))       { configUpdate.closed_months = s.mesesCerrados;       settingsRestored = true }

  if (settingsRestored || budgetCount > 0) {
    const { error } = await supabase
      .from('configuracion')
      .upsert(configUpdate, { onConflict: 'user_id' })
    if (error) throw error
  }

  return { transactions: txCount, assets: assetCount, budgets: budgetCount, settings: settingsRestored }
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
