import { supabase, SHARED_UUID } from './supabase'
import { Asset, AssetSnapshot } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAsset(row: Record<string, any>): Asset {
  const dateStr = row.date_created as string
  const rawSnaps = Array.isArray(row.snapshots) ? row.snapshots : []
  const snapshots: AssetSnapshot[] = rawSnaps
    .filter((s: unknown): s is AssetSnapshot =>
      !!s && typeof (s as AssetSnapshot).month === 'string'
    )
    .map((s: AssetSnapshot) => ({
      month: s.month,
      aporte: Number(s.aporte) || 0,
      saldo: Number(s.saldo) || 0,
    }))
    .sort((a: AssetSnapshot, b: AssetSnapshot) => a.month.localeCompare(b.month))
  return {
    id: row.id as string,
    userId: 'shared',
    nombre: row.name as string,
    tipo: row.kind as string,
    clase: row.type as 'activo' | 'pasivo',
    moneda: row.currency as 'ARS' | 'COP' | 'USD',
    saldo: row.init_bal as number ?? 0,
    fechaAlta: { toDate: () => new Date(dateStr + 'T12:00:00') },
    metaObjetivo: row.meta_objetivo ?? null,
    metaMoneda: row.meta_moneda ?? null,
    snapshots,
  }
}

function assetToRow(asset: Omit<Asset, 'id'>) {
  return {
    user_id: SHARED_UUID,
    name: asset.nombre,
    kind: asset.tipo,
    type: asset.clase,
    currency: asset.moneda,
    init_bal: asset.saldo,
    date_created: asset.fechaAlta.toDate().toISOString().slice(0, 10),
    meta_objetivo: asset.metaObjetivo,
    meta_moneda: asset.metaMoneda,
  }
}

export function subscribeToAssets(callback: (assets: Asset[]) => void): () => void {
  let active = true

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('cuentas')
      .select('*')
      .order('date_created', { ascending: false })

    if (!active) return

    if (error) {
      console.error('[assets] fetch error:', error)
      callback([])
      return
    }
    callback((data ?? []).map(rowToAsset))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`cuentas-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas' }, fetchAndNotify)
    .subscribe()

  return () => { active = false; supabase.removeChannel(channel) }
}

export async function addAsset(data: Omit<Asset, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('cuentas')
    .insert(assetToRow(data))
    .select('id')
    .single()

  if (error) throw error
  const id = row.id as string
  // Intentar guardar snapshots iniciales si la columna existe (falla silenciosa si no)
  if (data.snapshots && data.snapshots.length > 0) {
    await supabase
      .from('cuentas')
      .update({ snapshots: data.snapshots })
      .eq('id', id)
      // no throw — columna puede no existir todavía
  }
  return id
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id'>>) {
  const partial: Record<string, unknown> = {}
  if (data.nombre !== undefined) partial.name = data.nombre
  if (data.tipo !== undefined) partial.kind = data.tipo
  if (data.clase !== undefined) partial.type = data.clase
  if (data.moneda !== undefined) partial.currency = data.moneda
  if (data.saldo !== undefined) partial.init_bal = data.saldo
  if (data.metaObjetivo !== undefined) partial.meta_objetivo = data.metaObjetivo
  if (data.metaMoneda !== undefined) partial.meta_moneda = data.metaMoneda

  const { error } = await supabase.from('cuentas').update(partial).eq('id', id)
  if (error) throw error

  // Snapshots en un UPDATE separado — falla silenciosa si la columna no existe aún
  if (data.snapshots !== undefined) {
    await supabase
      .from('cuentas')
      .update({ snapshots: data.snapshots })
      .eq('id', id)
  }
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from('cuentas').delete().eq('id', id)
  if (error) throw error
}

/**
 * Inserta o reemplaza el snapshot de un mes para el activo dado, y actualiza
 * el saldo "actual" (init_bal) con el del snapshot más reciente.
 */
export async function upsertSnapshot(asset: Asset, snap: AssetSnapshot) {
  const others = (asset.snapshots ?? []).filter((s) => s.month !== snap.month)
  const next = [...others, snap].sort((a, b) => a.month.localeCompare(b.month))
  const latest = next[next.length - 1]
  const partial: Record<string, unknown> = { snapshots: next }
  // El saldo "current" del activo refleja el snapshot más reciente
  if (latest && latest.month >= snap.month) partial.init_bal = latest.saldo
  const { error } = await supabase.from('cuentas').update(partial).eq('id', asset.id!)
  if (error) throw error
}

export async function adjustAssetSaldo(assetId: string, delta: number, txMonth: string): Promise<void> {
  const { data: row, error } = await supabase.from('cuentas').select('*').eq('id', assetId).single()
  if (error) throw error
  const asset = rowToAsset(row)
  const existing = asset.snapshots.find((sn) => sn.month === txMonth)
  await upsertSnapshot(asset, {
    month: txMonth,
    aporte: (existing?.aporte ?? 0) + delta,
    saldo: asset.saldo + delta,
  })
}

