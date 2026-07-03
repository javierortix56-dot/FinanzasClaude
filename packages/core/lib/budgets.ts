import { supabase, SHARED_UUID } from './supabase'
import { Budget } from '../types'

/**
 * Presupuestos por categoría y mes, en su propia tabla `presupuestos`.
 * (Antes vivían en configuracion.app_settings.budgets, donde cualquier
 * guardado de ajustes los pisaba por la escritura read-merge-write.)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBudget(row: Record<string, any>): Budget {
  return {
    id: row.id as string,
    userId: 'shared',
    categoria: row.categoria as string,
    mes: row.mes as string,
    limite: Number(row.limite) || 0,
    moneda: row.moneda as string,
  }
}

export function subscribeToBudgets(
  mes: string,
  callback: (budgets: Budget[]) => void
): () => void {
  let active = true

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('presupuestos')
      .select('*')
      .eq('mes', mes)

    if (!active) return

    if (error) {
      console.error('[budgets] fetch error:', error)
      callback([])
      return
    }
    callback((data ?? []).map(rowToBudget))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`presupuestos-${mes}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuestos' }, fetchAndNotify)
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
  if (existingId) {
    const { error } = await supabase
      .from('presupuestos')
      .update({ categoria, mes, limite, moneda })
      .eq('id', existingId)
    if (error) throw error
    return
  }
  // La tabla tiene unique(categoria, mes): un upsert evita duplicados si
  // ambos usuarios crean el mismo presupuesto a la vez.
  const { error } = await supabase
    .from('presupuestos')
    .upsert(
      { user_id: SHARED_UUID, categoria, mes, limite, moneda },
      { onConflict: 'categoria,mes' }
    )
  if (error) throw error
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from('presupuestos').delete().eq('id', id)
  if (error) throw error
}
