'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Donut } from './Donut'
import { MoneyText, PercentText } from '@/components/MoneyText'
import { toBase } from '@finanzas/core/lib/currency'
import { getTopGroup, getCatFromSettings, formatAmount, CHART_PALETTE } from '@finanzas/core/lib/constants'
import { Currency, Transaction, Settings, TransactionType } from '@finanzas/core/types'

interface Props {
  transactions: Transaction[]
  tipo: TransactionType
  base: Currency
  settings: Settings
  donutSize?: number
  thickness?: number
  layout?: 'vertical' | 'horizontal'
  maxItems?: number
  /** Etiqueta del centro del donut cuando no hay drill (ej "egresos") */
  centerLabel?: string
}

/**
 * Donut + leyenda con drill-down de dos niveles.
 * Nivel 1: agrupado por grupo de primer nivel. Click en un segmento o fila
 * con subcategorías abre el nivel 2 (subcategorías de ese grupo).
 * El estado de drill se resetea remontando el componente (usar key={tipo}).
 */
export function CategoryChart({
  transactions, tipo, base, settings,
  donutSize = 160, thickness = 22, layout = 'vertical', maxItems = 8, centerLabel,
}: Props) {
  const [drill, setDrill] = useState<string | null>(null)

  const { grupos, total } = useMemo(() => {
    const target = transactions.filter((t) => t.tipo === tipo)
    const totalAmt = target.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

    type SubMap = Map<string, { nombre: string; color: string; total: number }>
    type GrpMap = Map<string, { nombre: string; total: number; subs: SubMap }>
    const porGrupo: GrpMap = new Map()

    for (const t of target) {
      const topGroup = getTopGroup(t.categoria, settings)
      const gid = topGroup?.id ?? t.categoria
      const gnombre = topGroup?.nombre ?? t.categoria
      if (!porGrupo.has(gid)) porGrupo.set(gid, { nombre: gnombre, total: 0, subs: new Map() })
      const g = porGrupo.get(gid)!
      const amt = toBase(t.monto, t.moneda, base, settings)
      g.total += amt
      const cat = getCatFromSettings(t.categoria, settings)
      if (!g.subs.has(t.categoria)) {
        g.subs.set(t.categoria, { nombre: cat?.nombre ?? t.categoria, color: cat?.color ?? '#94a3b8', total: 0 })
      }
      g.subs.get(t.categoria)!.total += amt
    }

    const gruposArr = [...porGrupo.entries()]
      .map(([id, g]) => ({
        id, nombre: g.nombre, total: g.total,
        subs: [...g.subs.entries()].map(([sid, s]) => ({ id: sid, ...s })).sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, maxItems)
      .map((g, i) => ({ ...g, chartColor: CHART_PALETTE[i % CHART_PALETTE.length] }))

    return { grupos: gruposArr, total: totalAmt }
  }, [transactions, tipo, settings, base, maxItems])

  const activeGroup = drill ? grupos.find((g) => g.id === drill) ?? null : null
  const items = activeGroup
    ? activeGroup.subs.map((s, i) => ({
        id: s.id, nombre: s.nombre, total: s.total,
        color: CHART_PALETTE[i % CHART_PALETTE.length], hasChildren: false,
      }))
    : grupos.map((g) => ({
        id: g.id, nombre: g.nombre, total: g.total,
        color: g.chartColor, hasChildren: g.subs.length > 1,
      }))
  const denom = activeGroup ? activeGroup.total : total

  if (grupos.length === 0) {
    return <p className="text-xs text-muted py-6 text-center">Sin datos.</p>
  }

  const donut = (
    <Donut
      size={donutSize}
      thickness={thickness}
      data={items.map((it) => ({ label: it.nombre, value: it.total, color: it.color }))}
      centerLabel={activeGroup ? activeGroup.nombre : centerLabel}
      centerValue={formatAmount(denom, base)}
      onSliceClick={activeGroup ? undefined : (i) => { if (grupos[i]?.subs.length > 1) setDrill(grupos[i].id) }}
    />
  )

  const legend = (
    <div className="space-y-0.5 w-full">
      {activeGroup && (
        <button
          type="button"
          onClick={() => setDrill(null)}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground mb-1.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Volver a grupos
        </button>
      )}
      {items.map((it) => {
        const Row = it.hasChildren ? 'button' : 'div'
        return (
          <Row
            key={it.id}
            {...(it.hasChildren ? { type: 'button' as const, onClick: () => setDrill(it.id) } : {})}
            className={`w-full flex items-center justify-between text-xs py-1.5 px-1 rounded transition-colors ${
              it.hasChildren ? 'hover:bg-surface-2/60 cursor-pointer' : ''
            }`}
          >
            <span className="flex items-center gap-2 text-foreground font-medium truncate min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: it.color }} />
              <span className="truncate">{it.nombre}</span>
              {it.hasChildren && <ChevronRight className="h-3 w-3 text-muted-2 shrink-0" />}
            </span>
            <span className="text-right shrink-0 ml-2 leading-tight">
              <span className="text-[11px] text-muted tnum block"><MoneyText amount={it.total} currency={base} /></span>
              <PercentText value={denom > 0 ? (it.total / denom) * 100 : 0} className="text-[10px] text-muted-2 tnum" />
            </span>
          </Row>
        )
      })}
    </div>
  )

  if (layout === 'horizontal') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="shrink-0">{donut}</div>
        <div className="flex-1 w-full">{legend}</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-center mb-4">{donut}</div>
      {legend}
    </>
  )
}
