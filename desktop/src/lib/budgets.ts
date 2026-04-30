import { supabase, SHARED_UUID } from './supabase'
import { Settings, Budget } from '@/types'

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
  async function fetchAndNotify() {
    callback(await loadBudgets(mes))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`budgets-${mes}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, fetchAndNotify)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
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
