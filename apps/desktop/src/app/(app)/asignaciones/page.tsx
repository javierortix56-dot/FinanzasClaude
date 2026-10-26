'use client'

import { txLabel } from '@/lib/txLabel'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Link2, Wand2, Unlink, X, Inbox } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Modal } from '@/components/ui/modal'
import Collapse from '@/components/ui/Collapse'
import ProgressBar from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/MoneyText'
import { LedgerStats, LedgerTabs } from '@/components/ledger/LedgerHeader'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { planAutoAssign } from '@finanzas/core/lib/autoAssign'
import { updateAsignacionesWithUndo } from '@finanzas/core/lib/undo'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Settings, Transaction } from '@finanzas/core/types'
import { stagger } from '@/components/ui/motion'

const fechaCorta = (t: Transaction) =>
  t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

const plural = (n: number, s: string) => `${n} ${s}${n !== 1 ? 's' : ''}`

export default function AsignacionesPage() {
  const { transactions } = useTransactionStore()
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase } = useAuthStore()
  const showToast = useUIStore((s) => s.showToast)

  const base = monedaBase as Currency

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reassignOpen, setReassignOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso')
                      .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [transactions],
  )
  const egresos = useMemo(() => transactions.filter((t) => t.tipo === 'egreso'), [transactions])

  // Un egreso asignado a un ingreso que ya no existe (huérfano) cuenta como
  // sin asignar: antes quedaba invisible, fuera de todo grupo.
  const ingresoIds = useMemo(() => new Set(ingresos.map((i) => i.id)), [ingresos])
  const sinAsignar = egresos.filter((e) => !e.asignaciones.some((a) => ingresoIds.has(a.ingresoId)))

  const totalEgresos = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const sinAsignarTotal = sinAsignar.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const asignados = totalEgresos - sinAsignarTotal
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

  const pendientes = egresos.filter((e) => !e.ejecutado).length

  // La selección se limpia si sus egresos desaparecen (otro dispositivo, borrado)
  const egresoIds = new Set(egresos.map((e) => e.id))
  const selCount = [...selected].filter((id) => egresoIds.has(id)).length

  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  function toggle(id: string, fallback: boolean) {
    setExpanded((e) => ({ ...e, [id]: !(e[id] ?? fallback) }))
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Auto-asignación por capacidad del ingreso + cercanía de fecha (misma
  // lógica que mobile). La anterior elegía solo por fecha y podía cargar
  // todo sobre un ingreso chico. Se puede deshacer.
  async function autoAsignar() {
    if (sinAsignar.length === 0) return showToast('No hay egresos sin asignar', 'error')
    if (ingresos.length === 0) return showToast('No hay ingresos para asignar', 'error')
    const plan = planAutoAssign(ingresos, egresos, base, settings)
    if (plan.length === 0) return showToast('No se encontró una asignación posible', 'error')
    setBusy(true)
    try {
      await updateAsignacionesWithUndo(
        plan.map(({ exp, ingresoId }) => ({ tx: exp, asignaciones: [{ ingresoId, monto: exp.monto }] })),
        `${plural(plan.length, 'egreso')} asignado${plan.length !== 1 ? 's' : ''}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function reasignar(toIngresoId: string | null) {
    const byId = new Map(egresos.map((e) => [e.id!, e]))
    const changes = [...selected]
      .map((id) => byId.get(id))
      .filter((e): e is Transaction => !!e)
      .map((tx) => ({ tx, asignaciones: toIngresoId ? [{ ingresoId: toIngresoId, monto: tx.monto }] : [] }))
    setSelected(new Set())
    setReassignOpen(false)
    if (changes.length === 0) return
    await updateAsignacionesWithUndo(
      changes,
      toIngresoId ? `${plural(changes.length, 'egreso')} reasignado${changes.length !== 1 ? 's' : ''}` : `${plural(changes.length, 'egreso')} desasignado${changes.length !== 1 ? 's' : ''}`,
    )
  }

  // Quita solo el vínculo con ESTE ingreso; si el egreso estaba dividido,
  // conserva el resto de sus asignaciones.
  async function desasignarGrupo(ing: Transaction, items: Transaction[]) {
    if (items.length === 0) return
    await updateAsignacionesWithUndo(
      items.map((tx) => ({ tx, asignaciones: tx.asignaciones.filter((a) => a.ingresoId !== ing.id) })),
      `Grupo "${ing.descripcion || 'ingreso'}" desasignado`,
    )
  }

  return (
    <main className="flex flex-1 min-h-0 flex-col gap-2.5 px-4 lg:px-6 pt-3">
      <LedgerStats />

      <div className="flex flex-wrap items-center gap-2">
        <LedgerTabs />
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={autoAsignar}
          disabled={busy}
          className="bg-brand ml-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-[7px] text-[12.5px] font-semibold text-primary-foreground shadow-card transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          <motion.span animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }}>
            <Wand2 className="h-3.5 w-3.5" />
          </motion.span>
          Auto-asignar
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass flex flex-col gap-2 rounded-2xl px-4 py-3"
      >
        <div className="flex justify-between text-[13px] font-semibold">
          <span className="text-foreground">
            Asignado <MoneyText amount={asignados} currency={base} /> de{' '}
            <MoneyText amount={totalEgresos} currency={base} />
          </span>
          <span className={cn('tnum', pctAsignado >= 100 ? 'text-income' : 'text-primary')}>{pctAsignado.toFixed(0)}%</span>
        </div>
        <ProgressBar
          value={pctAsignado}
          height={8}
          color={pctAsignado >= 100 ? 'var(--income)' : 'linear-gradient(90deg, var(--primary-2), var(--primary))'}
        />
        <div className="flex justify-between text-xs text-muted-2">
          <span>Sin asignar <MoneyText amount={sinAsignarTotal} currency={base} /></span>
          <span>{pendientes} {pendientes === 1 ? 'egreso pendiente' : 'egresos pendientes'}</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {selCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="bg-brand flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-primary-foreground shadow-card-md">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <motion.span
                  key={selCount}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 tnum"
                >
                  {selCount}
                </motion.span>
                {selCount === 1 ? 'seleccionado' : 'seleccionados'}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => reasignar(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-white/15"
                >
                  <Unlink className="h-3.5 w-3.5" /> Desasignar
                </button>
                <button
                  onClick={() => setReassignOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-primary transition-[filter] hover:brightness-95"
                >
                  <Link2 className="h-3.5 w-3.5" /> Reasignar
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
                  aria-label="Cancelar selección"
                  title="Cancelar (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-3.5">
        {sinAsignar.length > 0 && (
          <GrupoCard
            index={0}
            titulo="Sin asignar"
            tone="warning"
            meta={`${plural(sinAsignar.length, 'egreso')} sin ingreso de respaldo`}
            total={sinAsignarTotal}
            sub="requiere asignación"
            base={base}
            expanded={expanded['_sin'] ?? true}
            onToggle={() => toggle('_sin', true)}
            settings={settings}
            egresos={sinAsignar}
            selected={selected}
            onSelect={toggleSelect}
          />
        )}

        {grupos.map((g, i) => {
          const pct = g.ingresoTotal > 0 ? (g.total / g.ingresoTotal) * 100 : 0
          return (
            <GrupoCard
              key={g.ingreso.id}
              index={i + 1}
              titulo={`${txLabel(g.ingreso, settings)} · ${fechaCorta(g.ingreso)}`}
              meta={
                <>
                  Ingreso <MoneyText amount={g.ingresoTotal} currency={base} /> ·{' '}
                  {plural(g.asignados.length, 'egreso')}
                </>
              }
              total={g.total}
              sub={g.ingresoTotal > 0 ? `${Math.round(pct)}% del ingreso` : 'sin monto de referencia'}
              capacity={g.ingresoTotal > 0 ? pct : undefined}
              base={base}
              expanded={expanded[g.ingreso.id ?? ''] ?? false}
              onToggle={() => toggle(g.ingreso.id ?? '', false)}
              onUnassignAll={g.asignados.length > 0 ? () => desasignarGrupo(g.ingreso, g.asignados) : undefined}
              settings={settings}
              egresos={g.asignados}
              selected={selected}
              onSelect={toggleSelect}
            />
          )
        })}

        {grupos.length === 0 && sinAsignar.length === 0 && (
          <div className="glass flex flex-col items-center gap-2 rounded-[18px] py-12 text-center text-[13px] text-muted">
            <Inbox className="h-6 w-6 text-muted-2" />
            No hay movimientos en este mes.
          </div>
        )}
      </div>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reasignar a un ingreso"
        description={`${plural(selCount, 'egreso')} · se asigna el monto completo`}
      >
        <div className="space-y-2">
          {grupos.map(({ ingreso: ing, total, ingresoTotal }, i) => {
            const libre = ingresoTotal - total
            return (
              <motion.button
                key={ing.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stagger(i, 0.03) }}
                whileTap={{ scale: 0.98 }}
                onClick={() => reasignar(ing.id ?? null)}
                className="group flex w-full items-center gap-3 rounded-xl bg-surface-2 p-3 text-left transition-colors hover:bg-primary/10"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
                  <Link2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{txLabel(ing, settings)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {fechaCorta(ing)} · <MoneyText amount={ing.monto} currency={ing.moneda} />
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block eyebrow !text-[10px]">Libre</span>
                  <span className={cn('mt-1 block font-semibold tnum', libre < 0 ? 'text-expense' : 'text-income')}>
                    <MoneyText amount={libre} currency={base} />
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-2 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            )
          })}
          {ingresos.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay ingresos.</p>}
        </div>
      </Modal>
    </main>
  )
}

function GrupoCard({
  index, titulo, meta, total, sub, capacity, base, expanded, onToggle, onUnassignAll,
  settings, egresos, selected, onSelect, tone,
}: {
  index: number
  titulo: string
  meta: React.ReactNode
  total: number
  sub: string
  /** % del ingreso ya comprometido (barra de capacidad) */
  capacity?: number
  base: Currency
  expanded: boolean
  onToggle: () => void
  onUnassignAll?: () => void
  settings: Settings
  egresos: Transaction[]
  selected: Set<string>
  onSelect: (id: string) => void
  tone?: 'warning'
}) {
  const warning = tone === 'warning'
  const over = capacity !== undefined && capacity > 100
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: stagger(index, 0.04), ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'glass shrink-0 overflow-hidden rounded-[18px]',
        warning && '!border-unassigned-soft bg-unassigned-tint',
      )}
    >
      <div className="group flex items-stretch">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="grid min-w-0 flex-1 grid-cols-[16px_1fr_auto] items-center gap-3 px-[15px] py-[11px] text-left transition-colors hover:bg-surface-2"
        >
          <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
            <ChevronRight className="h-[14px] w-[14px] text-muted-2" />
          </motion.span>
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className={cn('truncate text-[15px] font-semibold', warning ? 'text-unassigned' : 'text-foreground')}>
              {titulo}
            </span>
            <span className="truncate text-xs text-muted-2">{meta}</span>
          </span>
          <span className="flex flex-col items-end gap-[3px] text-right">
            <span className={cn('text-[15px] font-bold tnum', warning ? 'text-unassigned' : over ? 'text-expense' : 'text-foreground')}>
              <MoneyText amount={total} currency={base} />
            </span>
            <span className={cn('whitespace-nowrap text-[11px]', over ? 'text-expense' : 'text-muted-2')}>{sub}</span>
          </span>
        </button>
        {onUnassignAll && (
          <button
            onClick={onUnassignAll}
            title="Desasignar todo el grupo"
            aria-label="Desasignar todo el grupo"
            className="px-3 text-muted-2 opacity-0 transition-[opacity,color] hover:text-expense focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Unlink className="h-4 w-4" />
          </button>
        )}
      </div>

      {capacity !== undefined && (
        <div className="px-[15px] pb-2.5 -mt-1">
          <ProgressBar
            value={capacity}
            height={4}
            color={over ? 'var(--expense)' : capacity > 85 ? 'var(--unassigned)' : 'var(--income)'}
          />
        </div>
      )}

      <Collapse open={expanded}>
        <div className="border-t border-hairline">
          {egresos.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">Sin egresos asignados.</p>
          ) : (
            egresos.map((e, i) => {
              const cat = getCatFromSettings(e.categoria, settings)
              const isSel = e.id ? selected.has(e.id) : false
              return (
                <motion.label
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: stagger(i, 0.015, 0.2) }}
                  className={cn(
                    'grid cursor-pointer grid-cols-[18px_52px_1fr_auto] items-center gap-3.5 border-b border-hairline py-[7px] px-[15px] text-[12.5px] transition-colors last:border-0 hover:bg-surface-2',
                    isSel && 'bg-primary/8',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => e.id && onSelect(e.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'grid h-[17px] w-[17px] place-items-center rounded-[6px] border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                      isSel ? 'border-primary bg-primary text-white' : 'border-border-strong text-transparent',
                    )}
                  >
                    <motion.span initial={false} animate={{ scale: isSel ? 1 : 0.4, opacity: isSel ? 1 : 0 }}>
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </motion.span>
                  </span>
                  <span className="tnum text-muted-2">{fechaCorta(e)}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                      style={{ background: `${cat?.color ?? '#94a3b8'}22`, color: cat?.color ?? '#94a3b8' }}
                    >
                      {cat && <CategoryIcon cat={cat} size={11} />}
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {txLabel(e, settings)}
                    </span>
                    {e.asignaciones.length > 1 && (
                      <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-semibold text-primary">dividido</span>
                    )}
                    {!e.ejecutado && (
                      <span className="shrink-0 text-[11px] text-muted-2">· pendiente</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-bold tnum text-expense">
                    −<MoneyText amount={e.monto} currency={e.moneda} />
                  </span>
                </motion.label>
              )
            })
          )}
        </div>
      </Collapse>
    </motion.div>
  )
}
