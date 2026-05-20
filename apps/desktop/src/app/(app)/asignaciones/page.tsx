'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Wand2, Unlink, Link2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { MoneyText, PercentText } from '@/components/MoneyText'
import { updateTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Transaction, Currency } from '@finanzas/core/types'

export default function AsignacionesPage() {
  const { transactions } = useTransactionStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)
  const base = useAuthStore((s) => s.monedaBase) as Currency

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reassignOpen, setReassignOpen] = useState(false)

  const ingresos = useMemo(
    () => transactions
      .filter((t) => t.tipo === 'ingreso')
      .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [transactions],
  )
  const egresos = useMemo(() => transactions.filter((t) => t.tipo === 'egreso'), [transactions])

  const byDate = (a: Transaction, b: Transaction) =>
    a.fecha.toDate().getTime() - b.fecha.toDate().getTime()

  const totalEgresosB = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const asignadosB    = egresos.filter((e) => e.asignadoA).reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const sinAsignarB   = totalEgresosB - asignadosB
  const pctAsignado   = totalEgresosB > 0 ? (asignadosB / totalEgresosB) * 100 : 0

  const grupos = useMemo(() => {
    return ingresos.map((ing) => {
      const asignados = egresos.filter((e) => e.asignadoA === ing.id).sort(byDate)
      const totalB    = asignados.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
      const ingresoB  = toBase(ing.monto, ing.moneda, base, settings)
      return { ingreso: ing, asignados, totalB, ingresoB }
    })
  }, [ingresos, egresos, settings, base])

  const sinAsignar = useMemo(
    () => egresos.filter((e) => !e.asignadoA).sort(byDate),
    [egresos],
  )

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }
  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function autoAsignar() {
    if (sinAsignar.length === 0) return showToast('No hay egresos sin asignar', 'error')
    if (ingresos.length === 0) return showToast('No hay ingresos para asignar', 'error')
    let count = 0
    for (const e of sinAsignar) {
      const eDate = e.fecha.toDate().getTime()
      let best = ingresos[0]
      let bestDiff = Math.abs(eDate - best.fecha.toDate().getTime())
      for (const ing of ingresos) {
        const d = Math.abs(eDate - ing.fecha.toDate().getTime())
        if (d < bestDiff) { best = ing; bestDiff = d }
      }
      if (e.id && best.id) { await updateTransaction(e.id, { asignadoA: best.id }); count++ }
    }
    showToast(`Asignados ${count} egresos`)
  }

  async function reasignar(toIngresoId: string | null) {
    let count = 0
    for (const id of selected) {
      await updateTransaction(id, { asignadoA: toIngresoId })
      count++
    }
    setSelected(new Set())
    setReassignOpen(false)
    showToast(toIngresoId ? `Reasignados ${count}` : `Desasignados ${count}`)
  }

  function ingresoLabel(t: Transaction) {
    return t.descripcion || getCatFromSettings(t.categoria, settings)?.nombre || '—'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Asignaciones</h2>
        <Button variant="secondary" onClick={autoAsignar}>
          <Wand2 className="h-4 w-4" /> Auto-asignar
        </Button>
      </div>

      {/* Barra de progreso global */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs text-muted">
              Asignado <span className="text-foreground font-medium"><MoneyText amount={asignadosB} currency={base} /></span>
              {' '}de <MoneyText amount={totalEgresosB} currency={base} />
            </div>
            <div className="text-xs font-semibold"><PercentText value={pctAsignado} /></div>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pctAsignado}%` }} />
          </div>
          {sinAsignar.length > 0 && (
            <div className="text-[11px] text-muted mt-1.5">
              Sin asignar: <MoneyText amount={sinAsignarB} currency={base} /> · {sinAsignar.length} egresos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selección múltiple */}
      {selected.size > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground shadow-md">
          <div className="text-sm font-medium">{selected.size} seleccionados</div>
          <div className="flex gap-2">
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={() => reasignar(null)}>
              <Unlink className="h-4 w-4" /> Desasignar
            </Button>
            <Button variant="secondary" onClick={() => setReassignOpen(true)}>
              <Link2 className="h-4 w-4" /> Reasignar
            </Button>
            <Button variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={() => setSelected(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Sin asignar */}
      {sinAsignar.length > 0 && (
        <GrupoCard
          titulo="Sin asignar"
          tone="warning"
          fecha=""
          totalB={sinAsignarB}
          base={base}
          color="#ea580c"
          expanded={expanded['_sin'] ?? true}
          onToggle={() => toggle('_sin')}
          settings={settings}
          egresos={sinAsignar}
          selected={selected}
          onSelect={toggleSelect}
        />
      )}

      {/* Grupos por ingreso */}
      {grupos.map((g) => (
        <GrupoCard
          key={g.ingreso.id}
          titulo={ingresoLabel(g.ingreso)}
          fecha={g.ingreso.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          totalB={g.totalB}
          ingresoB={g.ingresoB}
          base={base}
          color="#534AB7"
          expanded={expanded[g.ingreso.id ?? ''] ?? false}
          onToggle={() => toggle(g.ingreso.id ?? '')}
          settings={settings}
          egresos={g.asignados}
          selected={selected}
          onSelect={toggleSelect}
        />
      ))}

      {grupos.length === 0 && sinAsignar.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted text-sm">
            No hay movimientos en este mes.
          </CardContent>
        </Card>
      )}

      {/* Modal reasignar */}
      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reasignar a…">
        <div className="space-y-1.5 max-h-[400px] overflow-auto">
          {ingresos.map((ing) => (
            <button
              key={ing.id}
              onClick={() => reasignar(ing.id ?? null)}
              className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:bg-surface-2 transition-colors"
            >
              <div className="text-sm font-medium text-foreground">{ingresoLabel(ing)}</div>
              <div className="text-xs text-muted mt-0.5">
                {ing.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} · <MoneyText amount={ing.monto} currency={ing.moneda} />
              </div>
            </button>
          ))}
          {ingresos.length === 0 && <p className="text-sm text-muted text-center py-6">No hay ingresos.</p>}
        </div>
      </Modal>
    </div>
  )
}

function GrupoCard({
  titulo, fecha, totalB, ingresoB, base, color, expanded, onToggle, settings, egresos, selected, onSelect, tone,
}: {
  titulo: string
  fecha: string
  totalB: number
  ingresoB?: number
  base: Currency
  color: string
  expanded: boolean
  onToggle: () => void
  settings: typeof DEFAULT_SETTINGS
  egresos: Transaction[]
  selected: Set<string>
  onSelect: (id: string) => void
  tone?: 'warning'
}) {
  const pct = ingresoB && ingresoB > 0 ? Math.min(100, (totalB / ingresoB) * 100) : 0
  return (
    <Card className={tone === 'warning' ? 'border-unassigned/30' : ''}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-2/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />}
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{titulo}</div>
            <div className="text-[11px] text-muted">
              {fecha && `${fecha} · `}{egresos.length} egreso{egresos.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="text-right whitespace-nowrap shrink-0">
          <div className="text-sm font-semibold tnum">
            <MoneyText amount={totalB} currency={base} />
          </div>
          {ingresoB !== undefined && (
            <div className="text-[11px] text-muted">
              de <MoneyText amount={ingresoB} currency={base} /> · <PercentText value={pct} />
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {egresos.length === 0 ? (
            <p className="text-xs text-muted text-center py-5">Sin egresos asignados.</p>
          ) : egresos.map((e) => {
            const cat = getCatFromSettings(e.categoria, settings)
            const label = e.descripcion || cat?.nombre || '—'
            const isSel = e.id ? selected.has(e.id) : false
            return (
              <label
                key={e.id}
                className={`flex items-center gap-3 px-4 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-surface-2/60 ${
                  isSel ? 'bg-primary/5' : ''
                }`}
              >
                <input
                  type="checkbox" checked={isSel}
                  onChange={() => e.id && onSelect(e.id)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                />
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cat?.color ?? '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{label}</div>
                  <div className="text-[11px] text-muted">
                    {cat?.nombre !== label ? `${cat?.nombre ?? '—'} · ` : ''}
                    {e.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    {e.moneda !== base && <> · <MoneyText amount={e.monto} currency={e.moneda} /></>}
                  </div>
                </div>
                {!e.ejecutado && <Badge tone="warning">Pendiente</Badge>}
                <span className="text-xs font-semibold text-expense tnum whitespace-nowrap shrink-0">
                  <MoneyText amount={toBase(e.monto, e.moneda, base, settings)} currency={base} />
                </span>
              </label>
            )
          })}
        </div>
      )}
    </Card>
  )
}
