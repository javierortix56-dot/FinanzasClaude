import { supabase, SHARED_UUID } from './supabase'
import { CompraCuotas } from '../types'
import { shiftMonth } from './constants'

// ── Mapeo fila ↔ modelo ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCompra(row: Record<string, any>): CompraCuotas {
  return {
    id: row.id as string,
    descripcion: row.descripcion as string,
    tarjeta: (row.tarjeta as string) ?? '',
    moneda: row.moneda as CompraCuotas['moneda'],
    montoCuota: Number(row.monto_cuota) || 0,
    totalCuotas: Number(row.total_cuotas) || 1,
    primerMes: row.primer_mes as string,
    creadoPor: (row.creado_por as string) ?? 'shared',
  }
}

function compraToRow(c: Omit<CompraCuotas, 'id'>) {
  return {
    user_id: SHARED_UUID,
    descripcion: c.descripcion,
    tarjeta: c.tarjeta,
    moneda: c.moneda,
    monto_cuota: c.montoCuota,
    total_cuotas: c.totalCuotas,
    primer_mes: c.primerMes,
    creado_por: c.creadoPor,
  }
}

// ── CRUD + realtime ───────────────────────────────────────────────────────────

export function subscribeToCuotas(callback: (compras: CompraCuotas[]) => void): () => void {
  let active = true

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('compras_cuotas')
      .select('*')
      .order('primer_mes', { ascending: false })

    if (!active) return
    if (error) {
      console.error('[cuotas] fetch error:', error)
      return
    }
    callback((data ?? []).map(rowToCompra))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`compras-cuotas-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_cuotas' }, fetchAndNotify)
    .subscribe()

  return () => { active = false; supabase.removeChannel(channel) }
}

export async function addCompraCuotas(data: Omit<CompraCuotas, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('compras_cuotas')
    .insert(compraToRow(data))
    .select('id')
    .single()
  if (error) throw error
  return row.id as string
}

/** Inserta varias compras de una (importación desde extracto) */
export async function addComprasCuotas(items: Omit<CompraCuotas, 'id'>[]): Promise<number> {
  if (items.length === 0) return 0
  const { error } = await supabase
    .from('compras_cuotas')
    .insert(items.map(compraToRow))
  if (error) throw error
  return items.length
}

export async function updateCompraCuotas(id: string, data: Omit<CompraCuotas, 'id'>) {
  const { error } = await supabase
    .from('compras_cuotas')
    .update(compraToRow(data))
    .eq('id', id)
  if (error) throw error
}

export async function deleteCompraCuotas(id: string) {
  const { error } = await supabase.from('compras_cuotas').delete().eq('id', id)
  if (error) throw error
}

// ── Helpers de proyección ─────────────────────────────────────────────────────

function monthIndex(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  return y * 12 + (m - 1)
}

/**
 * Número de cuota (1-based) que vence en `mes`, o null si la compra no tiene
 * cuota ese mes (todavía no empezó o ya terminó).
 */
export function cuotaEnMes(c: CompraCuotas, mes: string): number | null {
  const n = monthIndex(mes) - monthIndex(c.primerMes) + 1
  return n >= 1 && n <= c.totalCuotas ? n : null
}

/** Cuotas que faltan pagar contando desde `mes` inclusive */
export function cuotasRestantes(c: CompraCuotas, mes: string): number {
  const n = monthIndex(mes) - monthIndex(c.primerMes) + 1
  if (n <= 0) return c.totalCuotas          // todavía no empezó
  return Math.max(c.totalCuotas - n + 1, 0) // incluye la del mes actual
}

export function estaActiva(c: CompraCuotas, mes: string): boolean {
  return cuotasRestantes(c, mes) > 0
}

/**
 * Compromiso mensual de cuotas para los próximos `n` meses desde `desdeMes`
 * (inclusive). Devuelve los montos SIN convertir, agrupados por moneda, para
 * que el caller convierta a moneda base con sus settings.
 */
export function compromisoPorMes(
  compras: CompraCuotas[],
  desdeMes: string,
  n: number
): { mes: string; porMoneda: Record<string, number> }[] {
  const out: { mes: string; porMoneda: Record<string, number> }[] = []
  for (let i = 0; i < n; i++) {
    const mes = shiftMonth(desdeMes, i)
    const porMoneda: Record<string, number> = {}
    for (const c of compras) {
      if (cuotaEnMes(c, mes) !== null) {
        porMoneda[c.moneda] = (porMoneda[c.moneda] ?? 0) + c.montoCuota
      }
    }
    out.push({ mes, porMoneda })
  }
  return out
}
