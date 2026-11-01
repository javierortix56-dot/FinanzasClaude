// Consumos reales (tabla `consumos`). Se registran a mano, con foto de ticket,
// con captura de movimientos o desde el resumen de la tarjeta, y llenan el
// cupo de lo planificado en su categoría (ver planVsReal.ts). No son
// movimientos: no cambian caja, asignaciones ni el pago de la tarjeta.
import { supabase } from './supabase'
import { offerUndo } from './undo'
import { updateSettings } from './settings'
import { SHARED_USER_ID, shiftMonth } from './constants'
import { useSettingsStore } from '../store/useSettingsStore'
import { Category, Consumo, Settings } from '../types'

/** Lo real con tarjeta cambia el pago estimado de la tarjeta: recalcularlo */
function recalcularPagos() {
  import('./tarjetas').then((m) => m.programarSyncPagos()).catch(() => { /* no bloqueante */ })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConsumo(r: Record<string, any>): Consumo {
  return {
    id: r.id, fecha: r.fecha, monto: Number(r.monto), moneda: r.moneda, categoria: r.categoria,
    comercio: r.comercio ?? '', descripcion: r.descripcion ?? '', medio: r.medio ?? null,
    tarjetaId: r.tarjeta_id ?? null, fuente: r.fuente ?? 'manual', creadoPor: r.creado_por ?? 'shared',
  }
}

function consumoToRow(c: Omit<Consumo, 'id'>) {
  return {
    fecha: c.fecha, monto: c.monto, moneda: c.moneda, categoria: c.categoria, comercio: c.comercio,
    descripcion: c.descripcion, medio: c.medio, tarjeta_id: c.tarjetaId, fuente: c.fuente, creado_por: c.creadoPor,
  }
}

/** Consumos desde el primer día de `desdeMes` (YYYY-MM) */
export async function fetchConsumos(desdeMes: string, hastaMes?: string): Promise<Consumo[]> {
  let q = supabase.from('consumos').select('*').gte('fecha', `${desdeMes}-01`).order('fecha', { ascending: false })
  if (hastaMes) q = q.lt('fecha', `${shiftMonth(hastaMes, 1)}-01`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(rowToConsumo)
}

/** Consumos desde `desdeMes`, con cambios en vivo */
export function subscribeToConsumos(desdeMes: string, callback: (c: Consumo[]) => void): () => void {
  let active = true
  const cargar = () => fetchConsumos(desdeMes).then((c) => { if (active) callback(c) }).catch((e) => console.error('[consumos]', e))
  cargar()
  const channel = supabase
    .channel(`consumos-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'consumos' }, cargar)
    .subscribe()
  return () => { active = false; supabase.removeChannel(channel) }
}

/** Guarda varios consumos juntos y ofrece deshacer */
export async function agregarConsumos(cs: Omit<Consumo, 'id'>[], mensaje?: string): Promise<number> {
  if (cs.length === 0) return 0
  const { data, error } = await supabase.from('consumos').insert(cs.map(consumoToRow)).select('id')
  if (error) throw error
  const ids = (data ?? []).map((r) => r.id as string)
  recalcularPagos()
  offerUndo(mensaje ?? `${ids.length} consumo${ids.length !== 1 ? 's' : ''} registrado${ids.length !== 1 ? 's' : ''}`, async () => {
    await supabase.from('consumos').delete().in('id', ids)
    recalcularPagos()
  })
  return ids.length
}

export async function actualizarConsumo(id: string, cambios: Partial<Omit<Consumo, 'id'>>) {
  const row: Record<string, unknown> = {}
  if (cambios.fecha !== undefined) row.fecha = cambios.fecha
  if (cambios.monto !== undefined) row.monto = cambios.monto
  if (cambios.moneda !== undefined) row.moneda = cambios.moneda
  if (cambios.categoria !== undefined) row.categoria = cambios.categoria
  if (cambios.comercio !== undefined) row.comercio = cambios.comercio
  if (cambios.descripcion !== undefined) row.descripcion = cambios.descripcion
  if (cambios.medio !== undefined) row.medio = cambios.medio
  if (cambios.tarjetaId !== undefined) row.tarjeta_id = cambios.tarjetaId
  const { error } = await supabase.from('consumos').update(row).eq('id', id)
  if (error) throw error
  recalcularPagos()
}

export async function borrarConsumo(c: Consumo) {
  const { error } = await supabase.from('consumos').delete().eq('id', c.id!)
  if (error) throw error
  recalcularPagos()
  offerUndo(`"${c.comercio || 'Consumo'}" eliminado`, async () => {
    const { id: _id, ...resto } = c
    await supabase.from('consumos').insert({ id: c.id, ...consumoToRow(resto) })
    recalcularPagos()
  })
}

/** Crea una subcategoría de gasto dentro de un grupo y devuelve su id */
export async function crearCategoriaGasto(s: Settings, nombre: string, grupoId: string): Promise<string> {
  const n = nombre.trim()
  if (!n) throw new Error('falta el nombre')
  const grupos = s.categoriasGasto.map((g) => ({ ...g, subcategorias: [...g.subcategorias] }))
  const g = grupos.find((x) => x.id === grupoId)
  if (!g) throw new Error('grupo inexistente')
  const existente = g.subcategorias.find((c) => c.nombre.trim().toLowerCase() === n.toLowerCase())
  if (existente) return existente.id
  const base = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'categoria'
  const id = `${base}_${Date.now().toString(36)}`
  const nueva: Category = { id, nombre: n, color: g.color, activa: true }
  g.subcategorias.push(nueva)
  await updateSettings(SHARED_USER_ID, { categoriasGasto: grupos })
  const actual = useSettingsStore.getState().settings ?? s
  useSettingsStore.getState().setSettings({ ...actual, categoriasGasto: grupos })
  return id
}
