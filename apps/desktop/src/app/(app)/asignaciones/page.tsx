'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Link2, Wand2, Unlink } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { MoneyText } from '@/components/MoneyText'
import { updateTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Transaction } from '@finanzas/core/types'

export default function AsignacionesPage() {
  const { transactions } = useTransactionStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reassignOpen, setReassignOpen] = useState(false)

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso')
                       .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [transactions],
  )
  const egresos = useMemo(() => transactions.filter((t) => t.tipo === 'egreso'), [transactions])

  const totalEgresosUSD   = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, 'USD', settings), 0)
  const asignadosUSD      = egresos.filter((e) => e.asignadoA).reduce((s, t) => s + toBase(t.monto, t.moneda, 'USD', settings), 0)
  const sinAsignarUSD     = totalEgresosUSD - asignadosUSD
  const pctAsignado = totalEgresosUSD > 0 ? (asignadosUSD / totalEgresosUSD) * 100 : 0

  const byDate = (a: Transaction, b: Transaction) =>
    a.fecha.toDate().getTime() - b.fecha.toDate().getTime()

  const grupos = useMemo(() => {
    return ingresos.map((ing) => {
      const asignados = egresos
        .filter((e) => e.asignadoA === ing.id)
        .sort(byDate)
      const totalUSD = asignados.reduce((s, t) => s + toBase(t.monto, t.moneda, 'USD', settings), 0)
      const ingresoUSD = toBase(ing.monto, ing.moneda, 'USD', settings)
      return { ingreso: ing, asignados, totalUSD, ingresoUSD, restante: ingresoUSD - totalUSD }
    })
  }, [ingresos, egresos, settings])

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
      // ingreso más cercano en fecha
      const eDate = e.fecha.toDate().getTime()
      let best = ingresos[0]
      let bestDiff = Math.abs(eDate - best.fecha.toDate().getTime())
      for (const ing of ingresos) {
        const d = Math.abs(eDate - ing.fecha.toDate().getTime())
        if (d < bestDiff) { best = ing; bestDiff = d }
      }
      if (e.id && best.id) {
        await updateTransaction(e.id, { asignadoA: best.id })
        count++
      }
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Asignación de egresos</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={autoAsignar}>
            <Wand2 className="h-4 w-4" /> Auto-asignar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-foreground">
              Asignado <MoneyText amount={asignadosUSD} currency="USD" /> de <MoneyText amount={totalEgresosUSD} currency="USD" />
            </div>
            <div className="text-sm font-semibold tabular-nums">{pctAsignado.toFixed(0)}%</div>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pctAsignado}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted mt-2">
            <span>Sin asignar: <MoneyText amount={sinAsignarUSD} currency="USD" /></span>
            <span>{sinAsignar.length} egresos pendientes</span>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground shadow-md">
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

      {sinAsignar.length > 0 && (
        <GrupoCard
          titulo="Sin asignar"
          tone="warning"
          subtitulo={`${sinAsignar.length} egresos · ${''}`}
          totalUSD={sinAsignarUSD}
          color="#ea580c"
          expanded={expanded['_sin'] ?? true}
          onToggle={() => toggle('_sin')}
          
          settings={settings}
          egresos={sinAsignar}
          selected={selected}
          onSelect={toggleSelect}
        />
      )}

      {grupos.map((g) => (
        <GrupoCard
          key={g.ingreso.id}
          titulo={g.ingreso.descripcion || '(sin descripción)'}
          subtitulo={`Ingreso · ${g.ingreso.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`}
          totalUSD={g.totalUSD}
          ingresoUSD={g.ingresoUSD}
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

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reasignar a un ingreso"
      >
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {ingresos.map((ing) => (
            <button
              key={ing.id}
              onClick={() => reasignar(ing.id ?? null)}
              className="w-full text-left p-3 rounded-md border border-border hover:bg-surface-2 transition-colors"
            >
              <div className="text-sm font-medium text-foreground">{ing.descripcion}</div>
              <div className="text-xs text-muted mt-0.5">
                {ing.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} ·{' '}
                <MoneyText amount={ing.monto} currency={ing.moneda} />
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
  titulo, subtitulo, totalUSD, ingresoUSD, color, expanded, onToggle, settings, egresos, selected, onSelect, tone,
}: {
  titulo: string
  subtitulo: string
  totalUSD: number
  ingresoUSD?: number
  color: string
  expanded: boolean
  onToggle: () => void
  settings: typeof DEFAULT_SETTINGS
  egresos: Transaction[]
  selected: Set<string>
  onSelect: (id: string) => void
  tone?: 'warning'
}) {
  const pct = ingresoUSD && ingresoUSD > 0 ? Math.min(100, (totalUSD / ingresoUSD) * 100) : 0
  return (
    <Card className={tone === 'warning' ? 'border-unassigned/30' : ''}>
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-surface-2/60"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{titulo}</div>
            <div className="text-xs text-muted">{subtitulo} · {egresos.length} egresos</div>
          </div>
        </div>
        <div className="text-right whitespace-nowrap">
          <div className="text-sm font-semibold tabular-nums">
            <MoneyText amount={totalUSD} currency="USD" />
          </div>
          {ingresoUSD !== undefined && (
            <div className="text-xs text-muted">
              de <MoneyText amount={ingresoUSD} currency="USD" /> ({pct.toFixed(0)}%)
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border">
          {egresos.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">Sin egresos asignados.</p>
          ) : (
            <div>
              {egresos.map((e) => {
                const cat = getCatFromSettings(e.categoria, settings)
                const isSel = e.id ? selected.has(e.id) : false
                return (
                  <label
                    key={e.id}
                    className={`flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-surface-2/60 ${
                      isSel ? 'bg-primary/5' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => e.id && onSelect(e.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cat?.color ?? '#94a3b8' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">{e.descripcion || '(sin descripción)'}</div>
                      <div className="text-xs text-muted">
                        {cat?.nombre ?? '—'} · {e.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    {!e.ejecutado && <Badge tone="warning">Pendiente</Badge>}
                    <span className="text-sm font-semibold text-expense tabular-nums whitespace-nowrap">
                      −<MoneyText amount={e.monto} currency={e.moneda} />
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
