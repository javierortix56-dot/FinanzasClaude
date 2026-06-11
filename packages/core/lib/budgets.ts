import { supabase, SHARED_UUID } from './supabase'
import { Settings, Budget } from '../types'

/** Budgets are stored in configuracion.app_settings.budgets as an array */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadBudgets(mes: string): Promise<Budget[]> {
  const { data } = await supabase
    .from('configuracion')
    .select('app_settings')
    .eq('user_id', SHARED_UUID)
    .maybeSingle()

  const budgets: Budget[] = data?.app_settings?.budgets ?? []
  return budgets.filter((b) => b.mes === mes)
}

async function saveBudgets(all: Budget[]) {
  // Se re-lee app_settings justo antes de escribir para preservar las claves
  // ajenas (tipoCambio, ahorroLinks, etc.), igual que updateSettings.
  // Riesgo residual: Supabase no ofrece transacciones desde el cliente, así
  // que dos escrituras concurrentes (p. ej. dos dispositivos guardando a la
  // vez) siguen siendo last-write-wins sobre la fila de configuracion.
  const { data: current } = await supabase
    .from('configuracion')
    .select('app_settings')
    .eq('user_id', SHARED_UUID)
    .maybeSingle()

  const appSettings = { ...(current?.app_settings ?? {}), budgets: all }

  await supabase
    .from('configuracion')
    .upsert({ user_id: SHARED_UUID, app_settings: appSettings }, { onConflict: 'user_id' })
}

async function getAllBudgets(): Promise<Budget[]> {
  const { data } = await supabase
    .from('configuracion')
    .select('app_settings')
    .eq('user_id', SHARED_UUID)
    .maybeSingle()
  return data?.app_settings?.budgets ?? []
}

export function subscribeToBudgets(
  mes: string,
  callback: (budgets: Budget[]) => void
): () => void {
  let active = true

  async function fetchAndNotify() {
    const budgets = await loadBudgets(mes)
    if (!active) return
    callback(budgets)
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`budgets-${mes}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, fetchAndNotify)
    .subscribe()

  return () => { active = false; supabase.removeChannel(channel) }
}

export async function upsertBudget(
  mes: string,
  categoria: string,
  limite: number,
  moneda: string,
  existingId?: string
) {
  const all = await getAllBudgets()

  if (existingId) {
    const idx = all.findIndex((b) => b.id === existingId)
    if (idx !== -1) {
      all[idx] = { ...all[idx], categoria, mes, limite, moneda }
    }
  } else {
    all.push({
      id: crypto.randomUUID(),
      userId: 'shared',
      categoria,
      mes,
      limite,
      moneda,
    })
  }

  await saveBudgets(all)
}

export async function deleteBudget(id: string) {
  const all = await getAllBudgets()
  await saveBudgets(all.filter((b) => b.id !== id))
}
