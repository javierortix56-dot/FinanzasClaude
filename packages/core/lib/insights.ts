import { Budget, Currency, Settings, Transaction } from '../types'
import { toBase, txToBase } from './currency'
import { cuentaEnCaja, cuentaEnCategorias } from './tarjetas'
import { getCatFromSettings, getParentGroup, monthLabel, shiftMonth } from './constants'

// Insights en lenguaje natural (compartidos por mobile y desktop): frases
// cortas derivadas de los mismos datos que los gráficos. Cada insight se
// describe como segmentos (texto, negrita, monto) para que cada app los
// renderice con su propio componente de monto (blur de privacidad incluido).

export type InsightTone = 'good' | 'bad' | 'info'
export type InsightIcon = 'up' | 'down' | 'piggy' | 'gauge' | 'alert' | 'clock'

export type InsightSegment = string | { bold: string } | { money: number }

export interface Insight {
  key: string
  tone: InsightTone
  icon: InsightIcon
  segments: InsightSegment[]
}

interface Params {
  transactions: Transaction[]
  prevTransactions: Transaction[]
  budgets: Budget[]
  settings: Settings
  base: Currency
  /** Mes visible 'YYYY-MM' */
  month: string
  /** Fecha de referencia (para la proyección del mes en curso) */
  today?: Date
}

/** Flujo de caja: los consumos con tarjeta se pagan el mes siguiente */
function sum(txs: Transaction[], tipo: 'ingreso' | 'egreso', base: Currency, s: Settings) {
  return txs.filter((t) => t.tipo === tipo && cuentaEnCaja(t)).reduce((acc, t) => acc + txToBase(t, base, s), 0)
}

function porGrupo(txs: Transaction[], base: Currency, s: Settings) {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.tipo !== 'egreso' || !cuentaEnCategorias(t)) continue
    const id = getParentGroup(t.categoria, s.categoriasGasto)?.id ?? t.categoria
    map.set(id, (map.get(id) ?? 0) + txToBase(t, base, s))
  }
  return map
}

export function computeInsights({ transactions, prevTransactions, budgets, settings: s, base, month, today = new Date() }: Params): Insight[] {
  const out: Insight[] = []
  const inc = sum(transactions, 'ingreso', base, s)
  const exp = sum(transactions, 'egreso', base, s)
  const mesPrev = monthLabel(shiftMonth(month, -1)).split(' ')[0]

  // 1. Mayor cambio por grupo de gasto vs. el mes anterior (≥ 10 %)
  const cur = porGrupo(transactions, base, s)
  const prev = porGrupo(prevTransactions, base, s)
  const cambio = [...new Set([...cur.keys(), ...prev.keys()])]
    .map((id) => ({ id, cur: cur.get(id) ?? 0, prev: prev.get(id) ?? 0 }))
    .filter((c) => c.prev > 0 && Math.abs(c.cur - c.prev) / c.prev >= 0.1)
    .sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev))[0]
  if (cambio) {
    const pct = Math.round(((cambio.cur - cambio.prev) / cambio.prev) * 100)
    out.push({
      key: 'cambio',
      tone: pct > 0 ? 'bad' : 'good',
      icon: pct > 0 ? 'up' : 'down',
      segments: [
        'Gastaron ', { bold: `${Math.abs(pct)}% ${pct > 0 ? 'más' : 'menos'}` },
        ` en ${getCatFromSettings(cambio.id, s)?.nombre ?? cambio.id} que en ${mesPrev} (`,
        { money: cambio.cur }, ' vs ', { money: cambio.prev }, ').',
      ],
    })
  }

  // 2. Ahorro del mes
  if (inc > 0) {
    const tasa = ((inc - exp) / inc) * 100
    out.push(tasa >= 0
      ? { key: 'ahorro', tone: 'good', icon: 'piggy', segments: ['Guardaron el ', { bold: `${Math.round(tasa)}%` }, ' de lo que ingresó: ', { money: inc - exp }, ' libres este mes.'] }
      : { key: 'ahorro', tone: 'bad', icon: 'piggy', segments: ['Este mes gastaron ', { money: exp - inc }, ' ', { bold: 'más de lo que ingresó' }, '.'] })
  }

  // 3. Proyección del cierre (solo mes en curso)
  const [y, m] = month.split('-').map(Number)
  const esMesActual = today.getFullYear() === y && today.getMonth() + 1 === m
  if (esMesActual && exp > 0) {
    const diasMes = new Date(y, m, 0).getDate()
    const proyectado = (exp / Math.max(today.getDate(), 1)) * diasMes
    const supera = inc > 0 && proyectado > inc
    out.push({
      key: 'proy',
      tone: supera ? 'bad' : 'info',
      icon: 'gauge',
      segments: ['A este ritmo, el mes cierra con egresos de ', { money: proyectado }, ...(supera ? [', ', { bold: 'por encima de lo ingresado' }] : []), '.'],
    })
  }

  // 4. Presupuestos superados
  const superados = budgets.filter((b) => {
    if (b.mes !== month || b.limite <= 0) return false
    const gastado = transactions
      .filter((t) => t.tipo === 'egreso' && cuentaEnCategorias(t) && (t.categoria === b.categoria || getParentGroup(t.categoria, s.categoriasGasto)?.id === b.categoria))
      .reduce((acc, t) => acc + txToBase(t, base, s), 0)
    return toBase(gastado, base, b.moneda as Currency, s, b.mes) > b.limite
  })
  if (superados.length > 0) {
    out.push({
      key: 'presu',
      tone: 'bad',
      icon: 'alert',
      segments: ['Superaron el presupuesto de ', { bold: superados.map((b) => getCatFromSettings(b.categoria, s)?.nombre ?? b.categoria).join(', ') }, '.'],
    })
  }

  // 5. Pagos pendientes
  const pendientes = transactions.filter((t) => t.tipo === 'egreso' && cuentaEnCaja(t) && t.monto > 0 && !t.ejecutado)
  if (pendientes.length > 0) {
    const n = pendientes.length
    out.push({
      key: 'pend',
      tone: 'info',
      icon: 'clock',
      segments: ['Quedan ', { bold: `${n} pago${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''}` }, ' por ', { money: sum(pendientes, 'egreso', base, s) }, '.'],
    })
  }

  return out
}
