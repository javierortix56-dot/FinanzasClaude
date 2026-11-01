// Metas de gasto seguidas en vivo con los movimientos registrados del mes
// (todos los medios de pago), con proyección al cierre y aviso. Las mismas
// metas se controlan después contra el resumen de la tarjeta (resumenExtras).
//
// Proyección: lo fijo (movimientos recurrentes) no se extrapola; solo lo
// variable sigue el ritmo diario. Así un gasto fijo grande del día 1 no hace
// parecer que el mes viene desbordado.
import { txToBase, toBase } from './currency'
import { cuentaEnCategorias } from './tarjetas'
import { Currency, MetaResumen, Settings, Transaction } from '../types'

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** No se avisa por proyección antes de este día (pocos datos, mucho ruido) */
export const DIA_MIN_PROYECCION = 7

export type NivelMeta = 'ok' | 'atento' | 'excedida'

export interface MetaEnVivo {
  meta: MetaResumen
  actualBase: number
  topeBase: number
  proyeccionBase: number
  pct: number
  nivel: NivelMeta
  /** Motivo del nivel, para mostrar */
  motivo: string | null
  /** Cuánto se puede gastar por día el resto del mes sin pasarse */
  porDiaBase: number | null
  diasRestantes: number
  movimientos: number
}

/** Movimientos que cuentan para la meta */
export function filtroMeta(meta: MetaResumen, s: Settings): (t: Transaction) => boolean {
  if (meta.tipo === 'comercios') {
    const palabras = (meta.palabras ?? []).map(normalizar).filter(Boolean)
    return (t) => palabras.some((w) => normalizar(`${t.descripcion} ${t.nota}`).includes(w))
  }
  if (meta.tipo === 'categoria') {
    const g = s.categoriasGasto.find((x) => x.id === meta.categoria)
    const ids = new Set(g ? [g.id, ...g.subcategorias.map((c) => c.id)] : [meta.categoria ?? ''])
    return (t) => ids.has(t.categoria)
  }
  if (meta.tipo === 'total') return () => true
  return () => false // financiación: solo se mide con el resumen
}

export function evaluarMetasEnVivo(
  txs: Transaction[], mes: string, base: Currency, s: Settings, hoy = new Date(),
): MetaEnVivo[] {
  const [y, m] = mes.split('-').map(Number)
  const diasMes = new Date(y, m, 0).getDate()
  const esActual = hoy.getFullYear() === y && hoy.getMonth() + 1 === m
  const dia = esActual ? hoy.getDate() : diasMes
  const diasRestantes = Math.max(diasMes - dia, 0)
  const egresos = txs.filter((t) => t.tipo === 'egreso' && cuentaEnCategorias(t) && `${t.fecha.toDate().getFullYear()}-${String(t.fecha.toDate().getMonth() + 1).padStart(2, '0')}` === mes)

  return (s.metasResumen ?? [])
    .filter((meta) => meta.tipo !== 'financiacion')
    .map((meta) => {
      const xs = egresos.filter(filtroMeta(meta, s))
      const fijo = xs.filter((t) => t.recurrente).reduce((a, t) => a + txToBase(t, base, s), 0)
      const variable = xs.filter((t) => !t.recurrente).reduce((a, t) => a + txToBase(t, base, s), 0)
      const actualBase = fijo + variable
      const proyeccionBase = esActual ? fijo + (variable / Math.max(dia, 1)) * diasMes : actualBase
      const topeBase = toBase(meta.tope, meta.moneda, base, s, mes)
      const pct = topeBase > 0 ? (actualBase / topeBase) * 100 : actualBase > 0 ? Infinity : 0
      let nivel: NivelMeta = 'ok'
      let motivo: string | null = null
      if (actualBase > topeBase) { nivel = 'excedida'; motivo = 'ya superó el tope' }
      else if (esActual && dia >= DIA_MIN_PROYECCION && proyeccionBase > topeBase) { nivel = 'atento'; motivo = 'a este ritmo lo supera' }
      else if (topeBase > 0 && pct >= 80) { nivel = 'atento'; motivo = `ya usó el ${Math.round(pct)} %` }
      return {
        meta, actualBase, topeBase, proyeccionBase, pct, nivel, motivo,
        porDiaBase: esActual && diasRestantes > 0 && topeBase > actualBase ? (topeBase - actualBase) / diasRestantes : null,
        diasRestantes,
        movimientos: xs.length,
      }
    })
}
