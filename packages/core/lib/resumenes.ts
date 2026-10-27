// Resúmenes de banco / tarjeta (compartido por mobile y desktop).
//   1. El archivo se prepara en el navegador: PDF → base64; CSV/TXT → texto;
//      Excel (.xlsx) → CSV por hoja.
//   2. La Edge Function `analizar-resumen` lo lee con IA (Gemini o Claude) y
//      devuelve la cabecera (saldos, tasas, cuotas a vencer, avisos) y los
//      renglones estructurados.
//   3. La app guarda el resultado (tablas resumenes / resumen_items, con RLS).
import { supabase } from './supabase'
import { addTransaction, deleteTransaction } from './transactions'
import { offerUndo } from './undo'
import { SHARED_USER_ID, SHARED_USERS, shiftMonth } from './constants'
import { Currency, Resumen, ResumenDetalle, ResumenItem, ResumenItemTipo, ResumenTipo, Settings } from '../types'

const MAX_BYTES = 15 * 1024 * 1024

export type ArchivoPayload = { nombre: string; tipo: 'pdf' | 'texto'; data: string }

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function celda(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Prepara el archivo para la función de extracción */
export async function archivoAPayload(file: File): Promise<ArchivoPayload> {
  if (file.size > MAX_BYTES) throw new Error('El archivo supera los 15 MB')
  const nombre = file.name
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || file.type === 'application/pdf') {
    return { nombre, tipo: 'pdf', data: toBase64(await file.arrayBuffer()) }
  }
  if (ext === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const hojas = await readXlsxFile(file)
    const texto = hojas
      .map((h) => `# Hoja: ${h.sheet}\n` + h.data.map((fila) => fila.map(celda).join(',')).join('\n'))
      .join('\n\n')
    return { nombre, tipo: 'texto', data: texto }
  }
  if (ext === 'xls') {
    throw new Error('El formato .xls (Excel viejo) no se puede leer: ábralo y guárdelo como .xlsx o .csv')
  }
  if (['csv', 'txt', 'tsv'].includes(ext) || file.type.startsWith('text/')) {
    return { nombre, tipo: 'texto', data: await file.text() }
  }
  throw new Error('Formato no soportado: use PDF, Excel (.xlsx) o CSV')
}

// ── Extracción ───────────────────────────────────────────────────────────────

interface ItemCrudo {
  fecha: string; descripcion: string; comercio: string; monto: number; moneda: Currency
  cuota_actual: number | null; cuota_total: number | null; tipo: ResumenItemTipo; categoria: string | null
  titular?: string | null
}
type N = number | null
interface DetalleCrudo {
  producto: string | null; fecha_cierre: string | null; fecha_vencimiento: string | null
  proximo_cierre: string | null; proximo_vencimiento: string | null
  saldo_anterior_ars: N; saldo_anterior_usd: N; saldo_actual_ars: N; saldo_actual_usd: N; pago_minimo: N
  limite_compra: N; limite_financiacion: N; limite_adelanto: N; limite_cuotas: N
  tna: N; tem: N; tea: N; cftea: N; tipo_cambio: N
  cuotas_a_vencer?: { mes: string; monto: number; desde: boolean }[]
  saldo_financiable: N
  planes_ofrecidos?: { cuotas: number; monto_cuota: number; tna: N; cftea: N }[]
  avisos?: ResumenDetalle['avisos']
}
interface ResultadoCrudo {
  emisor: string; tipo: ResumenTipo; periodo: string; moneda: Currency; total: number | null
  detalle?: DetalleCrudo | null; items: ItemCrudo[]
}

const fechaOk = (f: string | null | undefined) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null)
const numOk = (n: N | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : null)

function mapDetalle(d: DetalleCrudo | null | undefined): ResumenDetalle | null {
  if (!d) return null
  return {
    producto: d.producto?.trim() || null,
    fechaCierre: fechaOk(d.fecha_cierre),
    fechaVencimiento: fechaOk(d.fecha_vencimiento),
    proximoCierre: fechaOk(d.proximo_cierre),
    proximoVencimiento: fechaOk(d.proximo_vencimiento),
    saldoAnteriorArs: numOk(d.saldo_anterior_ars),
    saldoAnteriorUsd: numOk(d.saldo_anterior_usd),
    saldoActualArs: numOk(d.saldo_actual_ars),
    saldoActualUsd: numOk(d.saldo_actual_usd),
    pagoMinimo: numOk(d.pago_minimo),
    limiteCompra: numOk(d.limite_compra),
    limiteFinanciacion: numOk(d.limite_financiacion),
    limiteAdelanto: numOk(d.limite_adelanto),
    limiteCuotas: numOk(d.limite_cuotas),
    tna: numOk(d.tna),
    tem: numOk(d.tem),
    tea: numOk(d.tea),
    cftea: numOk(d.cftea),
    tipoCambio: numOk(d.tipo_cambio),
    cuotasAVencer: (d.cuotas_a_vencer ?? [])
      .filter((c) => /^\d{4}-\d{2}$/.test(c.mes) && Number.isFinite(c.monto))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    saldoFinanciable: numOk(d.saldo_financiable),
    planesOfrecidos: (d.planes_ofrecidos ?? [])
      .filter((p) => p.cuotas > 0 && Number.isFinite(p.monto_cuota))
      .map((p) => ({ cuotas: p.cuotas, montoCuota: p.monto_cuota, tna: numOk(p.tna), cftea: numOk(p.cftea) })),
    avisos: (d.avisos ?? []).filter((a) => a.texto?.trim()).map((a) => ({ ...a, vigencia: fechaOk(a.vigencia) })),
  }
}

/** Categorías de gasto (grupos y subcategorías activas) para que el modelo sugiera una */
function categoriasParaModelo(s: Settings) {
  const out: { id: string; nombre: string }[] = []
  for (const g of s.categoriasGasto) {
    if (!g.activa) continue
    const subs = g.subcategorias.filter((c) => c.activa)
    if (subs.length === 0) out.push({ id: g.id, nombre: g.nombre })
    for (const c of subs) out.push({ id: c.id, nombre: `${g.nombre} › ${c.nombre}` })
  }
  return out
}

/**
 * Mes al que corresponde el resumen. Es el del cierre, salvo que el cierre caiga
 * en los primeros días del mes (p. ej. 1-Oct): ese resumen es de septiembre y
 * el siguiente (29-Oct) es el de octubre; así no se pisan dos cierres del mismo
 * mes y coincide con cómo el banco rotula el cuadro de cuotas a vencer.
 */
export function periodoDelResumen(periodo: string, fechaCierre: string | null): string {
  if (fechaCierre) {
    const mes = fechaCierre.slice(0, 7)
    return Number(fechaCierre.slice(8, 10)) <= 7 ? shiftMonth(mes, -1) : mes
  }
  return /^\d{4}-\d{2}$/.test(periodo) ? periodo : new Date().toISOString().slice(0, 7)
}

/** Lee el archivo con la Edge Function y devuelve el resumen (sin guardar) */
export async function extraerResumen(file: File, s: Settings, creadoPor: string): Promise<Resumen> {
  const archivo = await archivoAPayload(file)
  const { data, error } = await supabase.functions.invoke('analizar-resumen', {
    body: { archivo, categorias: categoriasParaModelo(s) },
  })
  if (error) {
    // La función responde { error } con el detalle; supabase-js lo deja en context
    let detalle = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) detalle = j.error
    } catch { /* sin detalle */ }
    throw new Error(detalle)
  }
  const r = (data as { resultado: ResultadoCrudo }).resultado
  const validas = new Set(categoriasParaModelo(s).map((c) => c.id))
  const detalle = mapDetalle(r.detalle)
  return {
    emisor: r.emisor.trim() || 'Resumen',
    tipo: r.tipo,
    periodo: periodoDelResumen(r.periodo, detalle?.fechaCierre ?? null),
    moneda: r.moneda,
    total: r.total,
    archivo: archivo.nombre,
    creadoPor,
    detalle,
    items: r.items
      .filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.fecha) && Number.isFinite(i.monto))
      .map((i) => ({
        fecha: i.fecha,
        descripcion: i.descripcion,
        comercio: i.comercio.trim() || i.descripcion,
        monto: i.monto,
        moneda: i.moneda,
        cuotaActual: i.cuota_actual,
        cuotaTotal: i.cuota_total,
        tipo: i.tipo,
        categoria: i.categoria && validas.has(i.categoria) ? i.categoria : null,
        titular: i.titular?.trim() || null,
      })),
  }
}

// ── Persistencia ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToResumen(r: any): Resumen {
  return {
    id: r.id,
    emisor: r.emisor,
    tipo: r.tipo,
    periodo: r.periodo,
    moneda: r.moneda,
    total: r.total === null ? null : Number(r.total),
    archivo: r.archivo,
    creadoPor: r.creado_por,
    createdAt: r.created_at,
    detalle: r.detalle ?? null,
    items: (r.resumen_items ?? []).map((i: any): ResumenItem => ({
      id: i.id,
      resumenId: i.resumen_id,
      fecha: i.fecha,
      descripcion: i.descripcion,
      comercio: i.comercio,
      monto: Number(i.monto),
      moneda: i.moneda,
      cuotaActual: i.cuota_actual,
      cuotaTotal: i.cuota_total,
      tipo: i.tipo,
      categoria: i.categoria,
      titular: i.titular ?? null,
    })).sort((a: ResumenItem, b: ResumenItem) => a.fecha.localeCompare(b.fecha)),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchResumenes(): Promise<Resumen[]> {
  const { data, error } = await supabase
    .from('resumenes')
    .select('*, resumen_items(*)')
    .order('periodo', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToResumen)
}

/** ¿Ya hay un resumen del mismo emisor y período? (se reemplaza al guardar) */
export async function existeResumen(emisor: string, periodo: string): Promise<boolean> {
  const { count } = await supabase
    .from('resumenes')
    .select('id', { count: 'exact', head: true })
    .eq('emisor', emisor)
    .eq('periodo', periodo)
  return (count ?? 0) > 0
}

/** Guarda (o reemplaza si ya existe el mismo emisor + período) */
export async function guardarResumen(r: Resumen): Promise<string> {
  await supabase.from('resumenes').delete().eq('emisor', r.emisor).eq('periodo', r.periodo)
  const { data, error } = await supabase
    .from('resumenes')
    .insert({
      emisor: r.emisor, tipo: r.tipo, periodo: r.periodo, moneda: r.moneda,
      total: r.total, archivo: r.archivo, creado_por: r.creadoPor, detalle: r.detalle,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  if (r.items.length > 0) {
    const { error: e2 } = await supabase.from('resumen_items').insert(
      r.items.map((i) => ({
        resumen_id: id, fecha: i.fecha, descripcion: i.descripcion, comercio: i.comercio,
        monto: i.monto, moneda: i.moneda, cuota_actual: i.cuotaActual, cuota_total: i.cuotaTotal,
        tipo: i.tipo, categoria: i.categoria, titular: i.titular,
      })),
    )
    if (e2) {
      await supabase.from('resumenes').delete().eq('id', id)
      throw e2
    }
  }
  return id
}

export async function borrarResumen(r: Resumen) {
  const { error } = await supabase.from('resumenes').delete().eq('id', r.id!)
  if (error) throw error
  offerUndo(`Resumen ${r.emisor} eliminado`, async () => { await guardarResumen(r) })
}

/** Crea un egreso en la app a partir de un renglón del resumen (con deshacer) */
export async function cargarComoMovimiento(item: ResumenItem, categoriaFallback: string, creadoPor: string) {
  const id = await addTransaction({
    userId: SHARED_USER_ID,
    tipo: 'egreso',
    monto: Math.abs(item.monto),
    moneda: item.moneda,
    categoria: item.categoria ?? categoriaFallback,
    descripcion: item.comercio,
    nota: `Desde resumen: ${item.descripcion}`,
    tags: [],
    fecha: { toDate: () => new Date(item.fecha + 'T12:00:00') },
    ejecutado: true,
    asignaciones: [],
    creadoPor,
    recurrente: false,
  })
  offerUndo(`"${item.comercio}" cargado`, async () => { await deleteTransaction(id) })
  return id
}

/** id de SHARED_USERS ('javier' | 'mary') del usuario logueado */
export function usuarioId(user: { nombre?: string; email?: string } | null): string {
  const n = (user?.nombre || user?.email || '').toLowerCase()
  return SHARED_USERS.find((u) => n.startsWith(u.id) || n.includes(u.nombre.toLowerCase()))?.id ?? SHARED_USERS[0].id
}
