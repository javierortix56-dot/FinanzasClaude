// Cotizaciones automáticas (compartido por mobile y desktop).
//   ARS/USD: dolarapi.com (valor del día) + argentinadatos.com (histórico diario)
//   COP/USD: TRM oficial de la Superfinanciera vía datos.gov.co (histórico)
// Todas son APIs públicas, gratuitas y con CORS abierto.
//
// El resultado se guarda en la configuración compartida: `tipoCambio` (hoy) y
// `historialTipoCambio` (promedio de cada mes pasado). Las conversiones usan
// la cotización del mes de cada movimiento (ver currency.ts).
import { ExchangeRateRecord, FuenteCambio, Settings } from '../types'
import { updateSettings } from './settings'
import { shiftMonth } from './constants'

const CASA: Record<Exclude<FuenteCambio, 'manual'>, string> = { mep: 'bolsa', oficial: 'oficial', blue: 'blue' }

/** Meses de historial que se mantienen completos hacia atrás */
const MESES_HISTORIAL = 24
/** Intervalo mínimo entre sincronizaciones automáticas */
const INTERVALO_MS = 6 * 3600 * 1000
/** Tiempo máximo por request: la cotización del día es chica, el histórico de ARS pesa ~500 KB */
const TIMEOUT_HOY_MS = 8000
const TIMEOUT_HISTORICO_MS = 20000
/** Espera antes del único reintento por fuente */
const ESPERA_REINTENTO_MS = 1000

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function getJSONUnaVez<T>(url: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } catch (err) {
    if (ctrl.signal.aborted) throw new Error(`timeout de ${timeoutMs / 1000} s`)
    throw err
  } finally {
    clearTimeout(t)
  }
}

/**
 * GET con timeout y un reintento: son servicios públicos que a veces tardan o
 * devuelven un 5xx aislado. Si falla igual, deja registro de qué URL y por qué.
 */
async function getJSON<T>(url: string, timeoutMs: number): Promise<T> {
  try {
    return await getJSONUnaVez<T>(url, timeoutMs)
  } catch {
    await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS))
    try {
      return await getJSONUnaVez<T>(url, timeoutMs)
    } catch (err) {
      console.warn(`[cotizaciones] ${url} no respondió:`, err instanceof Error ? err.message : err)
      throw err
    }
  }
}

function promedio(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

const redondear = (n: number) => Math.round(n * 100) / 100

export interface CotizacionesHoy { ARS_USD: number; COP_USD: number }

export type MonedaCotizada = 'ARS' | 'COP'

/**
 * Cotización del día para la fuente elegida. Si una de las dos fuentes falla
 * (son servicios públicos y pueden caerse un rato), se conserva el valor
 * anterior de esa moneda en lugar de descartar también la otra; `fallidas`
 * indica cuáles no respondieron.
 */
export async function fetchCotizacionesHoy(
  fuente: Exclude<FuenteCambio, 'manual'>,
  previo?: CotizacionesHoy,
): Promise<CotizacionesHoy & { fallidas: MonedaCotizada[] }> {
  const [ars, cop] = await Promise.allSettled([
    getJSON<{ venta: number }>(`https://dolarapi.com/v1/dolares/${CASA[fuente]}`, TIMEOUT_HOY_MS),
    getJSON<{ valor: string }[]>('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC', TIMEOUT_HOY_MS),
  ])
  const arsNuevo = ars.status === 'fulfilled' && ars.value.venta > 0 ? ars.value.venta : null
  const copRaw = cop.status === 'fulfilled' ? parseFloat(cop.value[0]?.valor ?? '') : NaN
  const copNuevo = copRaw > 0 ? redondear(copRaw) : null
  const ARS_USD = arsNuevo ?? previo?.ARS_USD
  const COP_USD = copNuevo ?? previo?.COP_USD
  if (!(ARS_USD && ARS_USD > 0) || !(COP_USD && COP_USD > 0)) throw new Error('cotización no disponible')
  const fallidas: MonedaCotizada[] = []
  if (arsNuevo === null) fallidas.push('ARS')
  if (copNuevo === null) fallidas.push('COP')
  return { ARS_USD, COP_USD, fallidas }
}

/** Promedio mensual de los meses pedidos (los que falten en la fuente no se devuelven) */
export async function fetchPromediosMensuales(
  fuente: Exclude<FuenteCambio, 'manual'>,
  meses: string[],
): Promise<ExchangeRateRecord[]> {
  if (meses.length === 0) return []
  const desde = [...meses].sort()[0]
  const [arsRes, copRes] = await Promise.allSettled([
    getJSON<{ fecha: string; venta: number }[]>(
      `https://api.argentinadatos.com/v1/cotizaciones/dolares/${CASA[fuente]}`,
      TIMEOUT_HISTORICO_MS,
    ),
    getJSON<{ valor: string; vigenciadesde: string }[]>(
      `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=5000&$where=vigenciadesde%20%3E%3D%20'${desde}-01T00:00:00'`,
      TIMEOUT_HISTORICO_MS,
    ),
  ])
  // Sin las dos fuentes no se puede armar ningún promedio: los meses quedan
  // pendientes y se reintentan en la próxima sincronización.
  if (arsRes.status !== 'fulfilled' || copRes.status !== 'fulfilled') return []
  const ars = arsRes.value
  const cop = copRes.value
  const arsPorMes = new Map<string, number[]>()
  for (const r of ars) {
    const m = r.fecha?.slice(0, 7)
    if (m && m >= desde) arsPorMes.set(m, [...(arsPorMes.get(m) ?? []), r.venta])
  }
  const copPorMes = new Map<string, number[]>()
  for (const r of cop) {
    const m = r.vigenciadesde?.slice(0, 7)
    if (m) copPorMes.set(m, [...(copPorMes.get(m) ?? []), parseFloat(r.valor)])
  }
  const out: ExchangeRateRecord[] = []
  for (const mes of meses) {
    const a = promedio(arsPorMes.get(mes) ?? [])
    const c = promedio(copPorMes.get(mes) ?? [])
    if (a && c) out.push({ mes, ARS_USD: redondear(a), COP_USD: redondear(c), fuente })
  }
  return out
}

/**
 * Resultado de una sincronización:
 * - `ok`: las dos monedas se actualizaron.
 * - `parcial`: una sola respondió; la otra conserva su valor anterior.
 * - `error`: no respondió ninguna o no se pudo guardar.
 * - `omitido`: modo manual o sincronizado hace menos de 6 h (sin `force`).
 */
export interface ResultadoSync {
  estado: 'ok' | 'parcial' | 'error' | 'omitido'
  /** Monedas cuya fuente no respondió */
  fallidas: MonedaCotizada[]
}

let enCurso: Promise<ResultadoSync> | null = null

/**
 * Actualiza la cotización de hoy y completa el historial mensual si hace
 * falta. No hace nada en modo manual ni si se sincronizó hace menos de 6 h
 * (salvo `force`).
 */
export function syncCotizaciones(s: Settings, { force = false } = {}): Promise<ResultadoSync> {
  if (enCurso) return enCurso
  enCurso = (async (): Promise<ResultadoSync> => {
    const fuente = s.fuenteCambio ?? 'mep'
    if (fuente === 'manual') return { estado: 'omitido', fallidas: [] }

    const actual = mesActual()
    const pasados = Array.from({ length: MESES_HISTORIAL }, (_, i) => shiftMonth(actual, -(MESES_HISTORIAL - i)))
    // Un mes pasado se (re)calcula si no tiene registro o si vino de otra fuente
    // (carga manual o cambio de MEP a oficial/blue).
    const faltantes = pasados.filter((m) => s.historialTipoCambio?.find((h) => h.mes === m)?.fuente !== fuente)

    const reciente = s.cambioActualizado && Date.now() - new Date(s.cambioActualizado).getTime() < INTERVALO_MS
    if (!force && reciente) return { estado: 'omitido', fallidas: [] }

    const [hoy, nuevos] = await Promise.all([
      fetchCotizacionesHoy(fuente, s.tipoCambio),
      fetchPromediosMensuales(fuente, faltantes),
    ])
    const completa = hoy.fallidas.length === 0
    // Ninguna respondió (había valores previos, por eso no lanzó): no hay nada nuevo de hoy
    if (hoy.fallidas.length === 2 && nuevos.length === 0) return { estado: 'error', fallidas: hoy.fallidas }

    const porMes = new Map((s.historialTipoCambio ?? []).map((h) => [h.mes, h]))
    for (const r of nuevos) porMes.set(r.mes, r)
    const historialTipoCambio = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))

    await updateSettings('shared', {
      tipoCambio: { ARS_USD: hoy.ARS_USD, COP_USD: hoy.COP_USD },
      historialTipoCambio,
      // Si una fuente falló no se marca como actualizada: se reintenta al próximo arranque
      ...(completa ? { cambioActualizado: new Date().toISOString() } : {}),
    })
    if (completa) return { estado: 'ok', fallidas: [] }
    return { estado: hoy.fallidas.length === 2 ? 'error' : 'parcial', fallidas: hoy.fallidas }
  })()
    .catch((err): ResultadoSync => {
      console.warn('[cotizaciones] no se pudo sincronizar:', err)
      return { estado: 'error', fallidas: ['ARS', 'COP'] }
    })
    .finally(() => { enCurso = null })
  return enCurso
}

/** Cambia la fuente y, si es automática, recalcula hoy + historial al instante */
export async function cambiarFuenteCambio(s: Settings, fuente: FuenteCambio): Promise<ResultadoSync> {
  await updateSettings('shared', { fuenteCambio: fuente })
  if (fuente === 'manual') return { estado: 'omitido', fallidas: [] }
  return syncCotizaciones({ ...s, fuenteCambio: fuente }, { force: true })
}

const NOMBRE_MONEDA: Record<MonedaCotizada, string> = { ARS: 'el dólar (ARS)', COP: 'la TRM (COP)' }

/** Texto para el usuario según el resultado; null si no hay nada que avisar */
export function mensajeSync(
  r: ResultadoSync,
  exito = 'Cotización actualizada',
): { texto: string; tipo: 'success' | 'warning' | 'error' } | null {
  switch (r.estado) {
    case 'ok':
      return { texto: exito, tipo: 'success' }
    case 'parcial': {
      const fallo = r.fallidas[0]
      const ok: MonedaCotizada = fallo === 'ARS' ? 'COP' : 'ARS'
      return {
        texto: `Se actualizó ${NOMBRE_MONEDA[ok]}; ${NOMBRE_MONEDA[fallo]} no respondió y se mantiene el valor anterior`,
        tipo: 'warning',
      }
    }
    case 'error':
      return { texto: 'No se pudo obtener la cotización: los servicios no respondieron', tipo: 'error' }
    case 'omitido':
      return null
  }
}

export const FUENTES_CAMBIO: { value: FuenteCambio; label: string; detalle: string }[] = [
  { value: 'mep', label: 'MEP', detalle: 'Dólar bolsa (MEP) · TRM para COP' },
  { value: 'oficial', label: 'Oficial', detalle: 'Dólar oficial · TRM para COP' },
  { value: 'blue', label: 'Blue', detalle: 'Dólar blue · TRM para COP' },
  { value: 'manual', label: 'Manual', detalle: 'Se cargan a mano y se usan para todos los meses sin historial' },
]

/** "hace 5 min", "hace 3 h", "hace 2 días" */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} día${d !== 1 ? 's' : ''}`
}
