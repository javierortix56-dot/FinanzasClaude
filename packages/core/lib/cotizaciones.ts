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

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

function promedio(nums: number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n) && n > 0)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

const redondear = (n: number) => Math.round(n * 100) / 100

export interface CotizacionesHoy { ARS_USD: number; COP_USD: number }

/**
 * Cotización del día para la fuente elegida. Si una de las dos fuentes falla
 * (son servicios públicos y pueden caerse un rato), se conserva el valor
 * anterior de esa moneda en lugar de descartar también la otra; `completa`
 * indica si las dos respondieron.
 */
export async function fetchCotizacionesHoy(
  fuente: Exclude<FuenteCambio, 'manual'>,
  previo?: CotizacionesHoy,
): Promise<CotizacionesHoy & { completa: boolean }> {
  const [ars, cop] = await Promise.allSettled([
    getJSON<{ venta: number }>(`https://dolarapi.com/v1/dolares/${CASA[fuente]}`),
    getJSON<{ valor: string }[]>('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC'),
  ])
  const arsNuevo = ars.status === 'fulfilled' && ars.value.venta > 0 ? ars.value.venta : null
  const copRaw = cop.status === 'fulfilled' ? parseFloat(cop.value[0]?.valor ?? '') : NaN
  const copNuevo = copRaw > 0 ? redondear(copRaw) : null
  const ARS_USD = arsNuevo ?? previo?.ARS_USD
  const COP_USD = copNuevo ?? previo?.COP_USD
  if (!(ARS_USD && ARS_USD > 0) || !(COP_USD && COP_USD > 0)) throw new Error('cotización no disponible')
  return { ARS_USD, COP_USD, completa: arsNuevo !== null && copNuevo !== null }
}

/** Promedio mensual de los meses pedidos (los que falten en la fuente no se devuelven) */
export async function fetchPromediosMensuales(
  fuente: Exclude<FuenteCambio, 'manual'>,
  meses: string[],
): Promise<ExchangeRateRecord[]> {
  if (meses.length === 0) return []
  const desde = [...meses].sort()[0]
  const [arsRes, copRes] = await Promise.allSettled([
    getJSON<{ fecha: string; venta: number }[]>(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${CASA[fuente]}`),
    getJSON<{ valor: string; vigenciadesde: string }[]>(
      `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=5000&$where=vigenciadesde%20%3E%3D%20'${desde}-01T00:00:00'`,
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

let enCurso: Promise<boolean> | null = null

/**
 * Actualiza la cotización de hoy y completa el historial mensual si hace
 * falta. No hace nada en modo manual ni si se sincronizó hace menos de 6 h
 * (salvo `force`). Devuelve true si guardó cambios.
 */
export function syncCotizaciones(s: Settings, { force = false } = {}): Promise<boolean> {
  if (enCurso) return enCurso
  enCurso = (async () => {
    const fuente = s.fuenteCambio ?? 'mep'
    if (fuente === 'manual') return false

    const actual = mesActual()
    const pasados = Array.from({ length: MESES_HISTORIAL }, (_, i) => shiftMonth(actual, -(MESES_HISTORIAL - i)))
    // Un mes pasado se (re)calcula si no tiene registro o si vino de otra fuente
    // (carga manual o cambio de MEP a oficial/blue).
    const faltantes = pasados.filter((m) => s.historialTipoCambio?.find((h) => h.mes === m)?.fuente !== fuente)

    const reciente = s.cambioActualizado && Date.now() - new Date(s.cambioActualizado).getTime() < INTERVALO_MS
    if (!force && reciente) return false

    const [hoy, nuevos] = await Promise.all([
      fetchCotizacionesHoy(fuente, s.tipoCambio),
      fetchPromediosMensuales(fuente, faltantes),
    ])
    const porMes = new Map((s.historialTipoCambio ?? []).map((h) => [h.mes, h]))
    for (const r of nuevos) porMes.set(r.mes, r)
    const historialTipoCambio = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))

    await updateSettings('shared', {
      tipoCambio: { ARS_USD: hoy.ARS_USD, COP_USD: hoy.COP_USD },
      historialTipoCambio,
      // Si una fuente falló no se marca como actualizada: se reintenta al próximo arranque
      ...(hoy.completa ? { cambioActualizado: new Date().toISOString() } : {}),
    })
    return hoy.completa
  })()
    .catch((err) => {
      console.warn('[cotizaciones] no se pudo sincronizar:', err)
      return false
    })
    .finally(() => { enCurso = null })
  return enCurso
}

/** Cambia la fuente y, si es automática, recalcula hoy + historial al instante */
export async function cambiarFuenteCambio(s: Settings, fuente: FuenteCambio): Promise<void> {
  await updateSettings('shared', { fuenteCambio: fuente })
  if (fuente !== 'manual') await syncCotizaciones({ ...s, fuenteCambio: fuente }, { force: true })
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
