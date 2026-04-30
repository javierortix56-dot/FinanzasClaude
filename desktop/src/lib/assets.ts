import { supabase, SHARED_UUID } from './supabase'
import { Asset } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAsset(row: Record<string, any>): Asset {
  const dateStr = row.date_created as string
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
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('cuentas')
      .select('*')
      .order('date_created', { ascending: false })

    if (error) {
      console.error('[assets] fetch error:', error)
      callback([])
      return
    }
    callback((data ?? []).map(rowToAsset))
  }

  fetchAndNotify()

  const channel = supabase
    .channel('cuentas-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas' }, fetchAndNotify)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function addAsset(data: Omit<Asset, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('cuentas')
    .insert(assetToRow(data))
    .select('id')
    .single()

  if (error) throw error
  return row.id as string
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
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from('cuentas').delete().eq('id', id)
  if (error) throw error
}
