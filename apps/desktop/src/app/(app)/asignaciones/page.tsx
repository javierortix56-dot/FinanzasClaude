'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Link2, Wand2, Unlink } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Modal } from '@/components/ui/modal'
import { MoneyText } from '@/components/MoneyText'
import { LedgerStats, LedgerTabs } from '@/components/ledger/LedgerHeader'
import { updateTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { conceptOf } from '@/components/ledger/concept'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Settings, Transaction } from '@finanzas/core/types'

export default function AsignacionesPage() {
  const { transactions } = useTransactionStore()
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase } = useAuthStore()
  const showToast = useUIStore((s) => s.showToast)

  const base = monedaBase as Currency

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reassignOpen, setReassignOpen] = useState(false)

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso')
                      .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [transactions],
  )
  const egresos = useMemo(() => transactions.filter((t) => t.tipo === 'egreso'), [transactions])

  const totalEgresos = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const asignados = egresos.filter((e) => e.asignaciones.length > 0)
                           .reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const sinAsignarTotal = totalEgresos - asignados
  const pctAsignado = totalEgresos > 0 ? (asignados / totalEgresos) * 100 : 0

  // Un egreso dividido aparece bajo cada ingreso; el total del grupo suma
  // solo la parte asignada a ese ingreso.
  const grupos = useMemo(() => {
    return ingresos.map((ing) => {
      const asignados = egresos.filter((e) => e.asignaciones.some((a) => a.ingresoId === ing.id))
      const total = egresos.reduce((s, e) => s + e.asignaciones
        .filter((a) => a.ingresoId === ing.id)
        .reduce((x, a) => x + toBase(a.monto, e.moneda, base, settings), 0), 0)
      const ingresoTotal = toBase(ing.monto, ing.moneda, base, settings)
      return { ingreso: ing, asignados, total, ingresoTotal }
    })
  }, [ingresos, egresos, settings, base])

  const sinAsignar = egresos.filter((e) => e.asignaciones.length === 0)
  const pendientes = egresos.filter((e) => !e.ejecutado).length

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
        await updateTransaction(e.id, { asignaciones: [{ ingresoId: best.id, monto: e.monto }] })
        count++
      }
    }
    showToast(`Asignados ${count} egresos`)
  }

  async function reasignar(toIngresoId: string | null) {
    const byId = new Map(egresos.map((e) => [e.id!, e]))
    let count = 0
    for (const id of selected) {
      const exp = byId.get(id)
      if (!exp) continue
      await updateTransaction(id, {
        asignaciones: toIngresoId ? [{ ingresoId: toIngresoId, monto: exp.monto }] : [],
      })
      count++
    }
    setSelected(new Set())
    setReassignOpen(false)
    showToast(toIngresoId ? `Reasignados ${count}` : `Desasignados ${count}`)
  }

  return (
    <main className="flex flex-1 min-h-0 flex-col gap-2.5 px-4 lg:px-6 pt-3">
      <LedgerStats />

      <div className="flex flex-wrap items-center gap-2">
        <LedgerTabs />
        <button
          onClick={autoAsignar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-[6px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          <Wand2 className="h-3.5 w-3.5" /> Auto-asignar
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
        <div className="flex justify-between text-[13px] font-medium">
          <span className="text-foreground">
            Asignado <MoneyText amount={asignados} currency={base} /> de{' '}
            <MoneyText amount={totalEgresos} currency={base} />
          </span>
          <span className="tabular-nums font-medium text-primary">{pctAsignado.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pctAsignado}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-2">
          <span>Sin asignar <MoneyText amount={sinAsignarTotal} currency={base} /></span>
          <span>{pendientes} {pendientes === 1 ? 'egreso pendiente' : 'egresos pendientes'}</span>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-card-md">
          <div className="text-[13px] font-medium">{selected.size} seleccionados</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => reasignar(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-white/10"
            >
              <Unlink className="h-3.5 w-3.5" /> Desasignar
            </button>
            <button
              onClick={() => setReassignOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              <Link2 className="h-3.5 w-3.5" /> Reasignar
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-3.5">
        {grupos.map((g) => (
          <GrupoCard
            key={g.ingreso.id}
            titulo={`${conceptOf(g.ingreso, settings)} · ${g.ingreso.fecha
              .toDate()
              .toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`}
            meta={
              <>
                Ingreso <MoneyText amount={g.ingresoTotal} currency={base} /> ·{' '}
                {g.asignados.length} {g.asignados.length === 1 ? 'egreso' : 'egresos'}
              </>
            }
            total={g.total}
            sub={
              g.ingresoTotal > 0
                ? `${Math.round((g.total / g.ingresoTotal) * 100)}% del ingreso`
                : 'sin monto de referencia'
            }
            base={base}
            expanded={expanded[g.ingreso.id ?? ''] ?? false}
            onToggle={() => toggle(g.ingreso.id ?? '')}
            settings={settings}
            egresos={g.asignados}
            selected={selected}
            onSelect={toggleSelect}
          />
        ))}

        {sinAsignar.length > 0 && (
          <GrupoCard
            titulo="Sin asignar"
            tone="warning"
            meta={`${sinAsignar.length} ${
              sinAsignar.length === 1 ? 'egreso' : 'egresos'
            } sin ingreso de respaldo`}
            total={sinAsignarTotal}
            sub="requiere asignación"
            base={base}
            expanded={expanded['_sin'] ?? true}
            onToggle={() => toggle('_sin')}
            settings={settings}
            egresos={sinAsignar}
            selected={selected}
            onSelect={toggleSelect}
          />
        )}

        {grupos.length === 0 && sinAsignar.length === 0 && (
          <div className="rounded-[14px] border border-border bg-surface py-12 text-center text-[13px] text-muted">
            No hay movimientos en este mes.
          </div>
        )}
      </div>

      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reasignar a un ingreso">
        <div className="max-h-[400px] space-y-2 overflow-auto">
          {ingresos.map((ing) => (
            <button
              key={ing.id}
              onClick={() => reasignar(ing.id ?? null)}
              className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-surface-2"
            >
              <div className="text-sm font-medium text-foreground">{conceptOf(ing, settings)}</div>
              <div className="mt-0.5 text-xs text-muted">
                {ing.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} ·{' '}
                <MoneyText amount={ing.monto} currency={ing.moneda} />
              </div>
            </button>
          ))}
          {ingresos.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay ingresos.</p>}
        </div>
      </Modal>
    </main>
  )
}

function GrupoCard({
  titulo, meta, total, sub, base, expanded, onToggle, settings, egresos, selected, onSelect, tone,
}: {
  titulo: string
  meta: React.ReactNode
  total: number
  sub: string
  base: Currency
  expanded: boolean
  onToggle: () => void
  settings: Settings
  egresos: Transaction[]
  selected: Set<string>
  onSelect: (id: string) => void
  tone?: 'warning'
}) {
  const warning = tone === 'warning'
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-[14px] border bg-surface',
        warning ? 'border-unassigned-soft' : 'border-border',
      )}
    >
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-[16px_1fr_auto] items-center gap-3 px-[15px] py-[11px] text-left transition-colors hover:bg-surface-2"
      >
        {expanded ? (
          <ChevronDown className="h-[13px] w-[13px] text-muted-2" />
        ) : (
          <ChevronRight className="h-[13px] w-[13px] text-muted-2" />
        )}
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span
            className={cn(
              'truncate text-[14px] font-medium',
              warning ? 'text-unassigned' : 'text-foreground',
            )}
          >
            {titulo}
          </span>
          <span className="truncate text-xs text-muted-2">{meta}</span>
        </span>
        <span className="flex flex-col items-end gap-[3px] text-right">
          <span
            className={cn(
              'text-[14px] font-semibold tabular-nums',
              warning ? 'text-unassigned' : 'text-foreground',
            )}
          >
            <MoneyText amount={total} currency={base} />
          </span>
          <span className="whitespace-nowrap text-[11px] text-muted-2">{sub}</span>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {egresos.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">Sin egresos asignados.</p>
          ) : (
            egresos.map((e) => {
              const cat = getCatFromSettings(e.categoria, settings)
              const isSel = e.id ? selected.has(e.id) : false
              return (
                <label
                  key={e.id}
                  className={cn(
                    'grid cursor-pointer grid-cols-[16px_52px_1fr_auto] items-center gap-3.5 border-b border-border py-[7px] pl-[15px] pr-[15px] text-[12.5px] transition-colors last:border-0 hover:bg-surface-2',
                    isSel && 'bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => e.id && onSelect(e.id)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="tabular-nums text-muted-2">
                    {e.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-[5px] w-[5px] shrink-0 rounded-full"
                      style={{ background: cat?.color ?? '#94a3b8' }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {conceptOf(e, settings)}
                    </span>
                    {!e.ejecutado && (
                      <span className="shrink-0 text-[11px] text-muted-2">· pendiente</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-expense">
                    −<MoneyText amount={e.monto} currency={e.moneda} />
                  </span>
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
