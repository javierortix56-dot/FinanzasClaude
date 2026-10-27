// Nombre y categoría que el usuario eligió para cada comercio de los resúmenes
// (tabla comercio_reglas, compartida por la familia). Se aplican solas a los
// resúmenes siguientes: al revisar uno nuevo solo hay que validar los
// comercios que todavía no tienen regla.
//
// Cada regla se guarda con varias claves para reconocer el comercio aunque la
// IA proponga otro nombre: la descripción del banco normalizada, el nombre que
// propuso la IA y el nombre elegido.
import { supabase } from './supabase'
import { claveComercio } from './resumenAnalisis'
import { Currency, Resumen, ResumenItem } from '../types'

export interface ReglaComercio { clave: string; nombre: string; categoria: string | null }
export type Reglas = Map<string, ReglaComercio>

/** Renglones a los que se les revisa nombre y categoría (los gastos) */
export const esRevisable = (i: ResumenItem) => i.tipo === 'consumo' || i.tipo === 'debito_automatico'

/** Clave del grupo al que pertenece un renglón (por el nombre que muestra) */
export const claveGrupo = (i: ResumenItem) => claveComercio(i.comercio)

function clavesDe(i: ResumenItem): string[] {
  const out = [claveComercio(i.descripcion), claveComercio(i.comercioOriginal ?? i.comercio), claveComercio(i.comercio)]
  return [...new Set(out.filter((k) => k.length >= 3))]
}

function buscar(i: ResumenItem, reglas: Reglas): ReglaComercio | undefined {
  for (const k of clavesDe(i)) {
    const r = reglas.get(k)
    if (r) return r
  }
  return undefined
}

export async function fetchReglas(): Promise<Reglas> {
  const { data, error } = await supabase.from('comercio_reglas').select('clave, nombre, categoria')
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.clave as string, r as ReglaComercio]))
}

/** Aplica las reglas guardadas a los renglones recién extraídos */
export function aplicarReglas(items: ResumenItem[], reglas: Reglas, categoriasValidas: Set<string>): ResumenItem[] {
  return items.map((i) => {
    const base = { ...i, comercioOriginal: i.comercioOriginal ?? i.comercio }
    if (!esRevisable(i)) return base
    const r = buscar(base, reglas)
    if (!r) return base
    const categoria = r.categoria && categoriasValidas.has(r.categoria) ? r.categoria : null
    return { ...base, comercio: r.nombre, categoria }
  })
}

export interface GrupoComercio {
  clave: string
  nombre: string
  categoria: string | null
  cantidad: number
  total: number
  moneda: Currency
  /** true si ningún renglón del grupo tenía regla guardada */
  nuevo: boolean
  /** Descripciones tal como vienen del banco (para reconocer el comercio) */
  descripciones: string[]
}

/** Agrupa los gastos por comercio; los nuevos primero, después por monto */
export function agruparComercios(items: ResumenItem[], reglas: Reglas): GrupoComercio[] {
  const grupos = new Map<string, GrupoComercio>()
  for (const i of items) {
    if (!esRevisable(i)) continue
    const k = claveGrupo(i)
    const g = grupos.get(k) ?? {
      clave: k, nombre: i.comercio, categoria: i.categoria, cantidad: 0, total: 0, moneda: i.moneda, nuevo: true, descripciones: [],
    }
    g.cantidad += 1
    if (i.moneda === g.moneda) g.total += i.monto
    if (buscar(i, reglas)) g.nuevo = false
    if (g.descripciones.length < 3 && !g.descripciones.includes(i.descripcion)) g.descripciones.push(i.descripcion)
    grupos.set(k, g)
  }
  return [...grupos.values()].sort((a, b) => Number(b.nuevo) - Number(a.nuevo) || b.total - a.total)
}

/** Cambia nombre y categoría de todos los renglones de un grupo */
export function editarGrupo(items: ResumenItem[], clave: string, nombre: string, categoria: string | null): ResumenItem[] {
  const n = nombre.trim()
  return items.map((i) => (esRevisable(i) && claveGrupo(i) === clave ? { ...i, comercio: n || i.comercio, categoria } : i))
}

/** Reglas a guardar a partir de los renglones ya revisados */
export function reglasDe(items: ResumenItem[]): ReglaComercio[] {
  const out = new Map<string, ReglaComercio>()
  for (const i of items) {
    if (!esRevisable(i)) continue
    for (const clave of clavesDe(i)) out.set(clave, { clave, nombre: i.comercio, categoria: i.categoria })
  }
  return [...out.values()]
}

export async function guardarReglas(reglas: ReglaComercio[]) {
  // Una fila por clave (gana la última): Postgres rechaza un upsert que toca
  // dos veces la misma fila
  const unicas = [...new Map(reglas.map((r) => [r.clave, r])).values()]
  if (unicas.length === 0) return
  const { error } = await supabase
    .from('comercio_reglas')
    .upsert(unicas.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'clave' })
  if (error) throw error
}

/**
 * Recategoriza (o renombra) un comercio en todos los resúmenes guardados y
 * guarda la regla para los próximos.
 */
export async function recategorizarComercio(resumenes: Resumen[], clave: string, nombre: string, categoria: string | null) {
  const items = resumenes.flatMap((r) => r.items).filter((i) => esRevisable(i) && claveGrupo(i) === clave)
  if (items.length === 0) return
  const n = nombre.trim() || items[0].comercio
  const ids = items.map((i) => i.id).filter((id): id is string => !!id)
  if (ids.length > 0) {
    const { error } = await supabase.from('resumen_items').update({ comercio: n, categoria }).in('id', ids)
    if (error) throw error
  }
  await guardarReglas(reglasDe(items.map((i) => ({ ...i, comercio: n, categoria }))).concat(
    // La clave vieja también apunta al nombre nuevo
    [{ clave, nombre: n, categoria }],
  ))
}
