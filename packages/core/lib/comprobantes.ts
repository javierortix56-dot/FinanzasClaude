// Consumos leídos de una foto de ticket o de una captura de movimientos (app
// del banco, Mercado Pago). La Edge Function `leer-comprobante` los extrae con
// IA; acá se completan con lo que la app ya sabe (categoría aprendida de los
// resúmenes, tarjeta) y se marcan los que ya están registrados. Se guardan
// como consumos reales (no como movimientos).
import { supabase } from './supabase'
import { categoriasDeGasto } from './resumenes'
import { Reglas, reglaParaNombre } from './comercioReglas'
import { agregarConsumos } from './consumos'
import { toLocalDateString } from './constants'
import { Consumo, Currency, MedioPago, Settings, Tarjeta } from '../types'

export interface GastoLeido {
  /** id local para la lista de revisión */
  key: string
  fecha: string
  comercio: string
  descripcion: string
  monto: number
  moneda: Currency
  categoria: string | null
  medio: MedioPago | null
  /** id de la tarjeta de crédito (solo si medio = crédito) */
  tarjetaId: string | null
  cuotas: number | null
  /** Consumo ya registrado que parece ser el mismo (mismo monto y fecha cercana) */
  duplicado: Consumo | null
}

const LADO_MAX = 2000

/** Reduce la imagen (las capturas de iPhone pesan varios MB) y la pasa a base64 */
async function imagenABase64(file: File): Promise<{ data: string; mime: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * escala)
    canvas.height = Math.round(bmp.height * escala)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', 0.85)
    return { data: url.split(',')[1], mime: 'image/jpeg' }
  } catch {
    // Formato que el navegador no decodifica (p. ej. HEIC fuera de Safari): se manda tal cual
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { data: btoa(bin), mime: file.type || 'image/jpeg' }
  }
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim()

/** Tarjeta por el nombre que devolvió la IA; con una sola tarjeta, esa */
function tarjetaPorNombre(nombre: string | null, tarjetas: Tarjeta[]): Tarjeta | undefined {
  if (nombre) {
    const n = norm(nombre)
    const t = tarjetas.find((x) => norm(x.nombre) === n)
      ?? tarjetas.find((x) => norm(x.nombre).split(' ').some((w) => w.length >= 3 && n.includes(w)))
    if (t) return t
  }
  return tarjetas.length === 1 ? tarjetas[0] : undefined
}

const DIA = 86400000

/** Consumo ya registrado con el mismo monto (±1 %) y fecha (±1 día) */
export function buscarDuplicado(g: { fecha: string; monto: number; moneda: Currency }, consumos: Consumo[], usados = new Set<string>()): Consumo | null {
  const f = new Date(g.fecha + 'T12:00:00').getTime()
  const tol = Math.max(1, g.monto * 0.01)
  return consumos.find((c) =>
    !usados.has(c.id!) && c.moneda === g.moneda && Math.abs(c.monto - g.monto) <= tol &&
    Math.abs(new Date(c.fecha + 'T12:00:00').getTime() - f) <= 1.5 * DIA,
  ) ?? null
}

/**
 * Lee el ticket o la captura y devuelve los consumos listos para revisar.
 * `existentes` son los consumos ya registrados (para marcar duplicados).
 */
export async function leerComprobante(
  file: File, modo: 'ticket' | 'movimientos', s: Settings, reglas: Reglas, existentes: Consumo[],
): Promise<GastoLeido[]> {
  const tarjetas = s.tarjetas ?? []
  const hoy = toLocalDateString(new Date())
  const { data, error } = await supabase.functions.invoke('leer-comprobante', {
    body: {
      imagen: await imagenABase64(file), modo, hoy,
      categorias: categoriasDeGasto(s), tarjetas: tarjetas.map((t) => t.nombre),
    },
  })
  if (error) {
    let detalle = error.message
    try {
      const ctx = (error as { context?: Response }).context
      const j = ctx ? await ctx.json() : null
      if (j?.error) detalle = j.error
    } catch { /* sin detalle */ }
    throw new Error(detalle)
  }
  const validas = new Set(categoriasDeGasto(s).map((c) => c.id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const crudos: any[] = data?.resultado?.movimientos ?? []
  const usados = new Set<string>()
  return crudos
    .filter((m) => m && m.es_gasto !== false && Number(m.monto) > 0)
    .map((m, k): GastoLeido => {
      const comercio = String(m.comercio || m.descripcion || 'Gasto').trim()
      // La categoría que ya eligió para ese comercio en los resúmenes gana a la de la IA
      const regla = reglaParaNombre(comercio, reglas) ?? reglaParaNombre(String(m.descripcion ?? ''), reglas)
      const catRegla = regla?.categoria && validas.has(regla.categoria) ? regla.categoria : null
      const catIA = m.categoria && validas.has(m.categoria) ? m.categoria : null
      const medio = (['credito', 'debito', 'efectivo', 'transferencia', 'otro'] as const).includes(m.medio) ? m.medio as MedioPago : null
      const tarjeta = medio === 'credito' ? tarjetaPorNombre(m.tarjeta ?? null, tarjetas) : undefined
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(m.fecha ?? '') ? m.fecha : hoy
      const moneda: Currency = ['ARS', 'USD', 'COP'].includes(m.moneda) ? m.moneda : 'ARS'
      const monto = Math.round(Number(m.monto) * 100) / 100
      const duplicado = buscarDuplicado({ fecha, monto, moneda }, existentes, usados)
      if (duplicado) usados.add(duplicado.id!)
      return {
        key: `${k}-${fecha}-${monto}`,
        fecha, comercio: regla?.nombre ?? comercio, descripcion: String(m.descripcion ?? comercio),
        monto, moneda, categoria: catRegla ?? catIA, medio,
        tarjetaId: tarjeta?.id ?? null,
        cuotas: Number.isInteger(m.cuotas) && m.cuotas > 1 ? m.cuotas : null,
        duplicado,
      }
    })
}

/** Guarda los elegidos como consumos reales (con deshacer) */
export async function guardarGastosLeidos(gastos: GastoLeido[], fuente: Consumo['fuente'], creadoPor: string): Promise<number> {
  return agregarConsumos(gastos.map((g) => ({
    fecha: g.fecha, monto: g.monto, moneda: g.moneda, categoria: g.categoria!,
    comercio: g.comercio, descripcion: g.descripcion, medio: g.medio,
    tarjetaId: g.medio === 'credito' ? g.tarjetaId : null, fuente, creadoPor,
  })))
}

/** Categoría para un gasto sin sugerencia: la primera subcategoría de "Otros" */
export function categoriaPorDefecto(s: Settings): string {
  const grupos = s.categoriasGasto.filter((g) => g.activa)
  const g = grupos.find((x) => /otro/i.test(x.nombre)) ?? grupos[grupos.length - 1]
  return g?.subcategorias.find((c) => c.activa)?.id ?? g?.id ?? 'otros'
}

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  credito: 'Tarjeta de crédito', debito: 'Débito', efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro',
}
