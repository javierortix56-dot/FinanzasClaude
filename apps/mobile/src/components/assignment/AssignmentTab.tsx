'use client'

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Zap, X, Unlink2, Sparkles, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { updateTransaction } from '@finanzas/core/lib/transactions'
import { deleteTransactionsWithUndo, updateAsignacionesWithUndo, offerUndo } from '@/lib/undo'
import { haptic } from '@/lib/haptics'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { Transaction, Currency } from '@finanzas/core/types'
import AssignmentGroup, { GroupItem } from './AssignmentGroup'
import ReassignModal from './ReassignModal'
import { springSoft, stagger } from '@/components/ui/motion'

export default function AssignmentTab({ onScrollY }: { onScrollY?: (y: number) => void }) {
  const { transactions } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const { openEditModal } = useUIStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['unassigned']))
  const [reassignOpen, setReassignOpen]     = useState(false)
  const [autoLoading, setAutoLoading]       = useState(false)
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [deleteLoading, setDeleteLoading]   = useState(false)
  const userNames = Object.fromEntries(SHARED_USERS.map((u) => [u.id, u.nombre]))

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso').sort(
      (a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()
    ),
    [transactions]
  )
  const egresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'egreso').sort(
      (a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()
    ),
    [transactions]
  )

  // Un egreso dividido aparece bajo CADA ingreso al que está asignado, con su
  // monto parcial. Asignaciones huérfanas (ingreso borrado) caen en "Sin asignar".
  const groups = useMemo(() => {
    const ingresoIds = new Set(ingresos.map((i) => i.id!))
    const map = new Map<string, { income: Transaction | null; items: GroupItem[] }>()
    ingresos.forEach((inc) => map.set(inc.id!, { income: inc, items: [] }))
    map.set('unassigned', { income: null, items: [] })
    egresos.forEach((exp) => {
      const validas = exp.asignaciones.filter((a) => ingresoIds.has(a.ingresoId))
      if (validas.length === 0) {
        map.get('unassigned')!.items.push({ exp, montoAsignado: exp.monto, esParcial: false })
      } else {
        validas.forEach((a) => {
          map.get(a.ingresoId)!.items.push({ exp, montoAsignado: a.monto, esParcial: validas.length > 1 })
        })
      }
    })
    return map
  }, [ingresos, egresos])

  const totalEgresos       = egresos.length
  const realUnassigned     = groups.get('unassigned')?.items.length ?? 0
  const assignedCount      = totalEgresos - realUnassigned
  const progressPercent    = totalEgresos > 0 ? (assignedCount / totalEgresos) * 100 : 0
  const allAssigned        = realUnassigned === 0 && totalEgresos > 0

  // Auto-asignar: prioriza capacidad + cercanía por fecha; si no entra en
  // ninguno, asigna al ingreso con más capacidad restante (o al más cercano
  // por fecha) para que ningún egreso quede sin asignar.
  async function autoAssign() {
    // Incluye los egresos sin asignar Y los huérfanos (todas sus asignaciones
    // apuntan a ingresos que ya no existen — caen en el grupo "Sin asignar").
    const ingresoIds = new Set(ingresos.map((i) => i.id!))
    const unassigned = egresos.filter(
      (e) => !e.asignaciones.some((a) => ingresoIds.has(a.ingresoId))
    )
    if (ingresos.length === 0 || unassigned.length === 0) return
    setAutoLoading(true)

    const capacity = new Map<string, number>()
    ingresos.forEach((inc) => {
      const incBase = toBase(inc.monto, inc.moneda, base, s)
      const yaAsignado = egresos.reduce((sum, e) => sum + e.asignaciones
        .filter((a) => a.ingresoId === inc.id)
        .reduce((x, a) => x + toBase(a.monto, e.moneda, base, s), 0), 0)
      capacity.set(inc.id!, incBase - yaAsignado)
    })

    // Procesa primero los egresos más grandes para mejor empaquetado.
    const ordered = [...unassigned].sort(
      (a, b) => toBase(b.monto, b.moneda, base, s) - toBase(a.monto, a.moneda, base, s)
    )

    const previas = ordered.map((e) => ({ id: e.id!, asignaciones: e.asignaciones }))
    try {
      for (const exp of ordered) {
        const expBase = toBase(exp.monto, exp.moneda, base, s)
        const expTime = exp.fecha.toDate().getTime()

        const elegibles = ingresos.filter((inc) => (capacity.get(inc.id!) ?? 0) >= expBase)

        let target: Transaction
        if (elegibles.length > 0) {
          // Más cercano por fecha entre los que tienen capacidad
          target = elegibles.reduce((prev, curr) =>
            Math.abs(curr.fecha.toDate().getTime() - expTime) <
            Math.abs(prev.fecha.toDate().getTime() - expTime) ? curr : prev
          )
        } else {
          // Fallback: ningún ingreso cubre solo. Elegimos el de mayor
          // capacidad restante (menos sobregiro). En empate, el más
          // cercano por fecha.
          target = ingresos.reduce((prev, curr) => {
            const prevCap = capacity.get(prev.id!) ?? 0
            const currCap = capacity.get(curr.id!) ?? 0
            if (currCap !== prevCap) return currCap > prevCap ? curr : prev
            return Math.abs(curr.fecha.toDate().getTime() - expTime) <
                   Math.abs(prev.fecha.toDate().getTime() - expTime) ? curr : prev
          })
        }
        capacity.set(target.id!, (capacity.get(target.id!) ?? 0) - expBase)
        await updateTransaction(exp.id!, {
          asignaciones: [{ ingresoId: target.id!, monto: exp.monto }],
        })
      }
      haptic('success')
      offerUndo(`${ordered.length} egreso${ordered.length !== 1 ? 's' : ''} asignado${ordered.length !== 1 ? 's' : ''}`, async () => {
        await Promise.allSettled(previas.map(({ id, asignaciones }) => updateTransaction(id, { asignaciones })))
      })
    } finally {
      setAutoLoading(false)
    }
  }

  // Desasignar todos
  async function desassignAll() {
    setUnassignLoading(true)
    try {
      const assigned = egresos.filter((e) => e.asignaciones.length > 0)
      await updateAsignacionesWithUndo(
        assigned.map((tx) => ({ tx, asignaciones: [] })),
        `${assigned.length} egreso${assigned.length !== 1 ? 's' : ''} desasignado${assigned.length !== 1 ? 's' : ''}`,
      )
    } finally {
      setUnassignLoading(false)
    }
  }

  async function desassignGroup(incomeId: string) {
    const group = groups.get(incomeId)
    if (!group) return
    // Quita solo el vínculo con ESTE ingreso; si el egreso estaba dividido,
    // conserva la parte asignada al otro ingreso.
    await updateAsignacionesWithUndo(
      group.items.map(({ exp }) => ({ tx: exp, asignaciones: exp.asignaciones.filter((a) => a.ingresoId !== incomeId) })),
      'Grupo desasignado',
    )
  }

  async function reassignSelected(newIncomeId: string) {
    const elegidos = egresos.filter((e) => selectedIds.has(e.id!))
    await updateAsignacionesWithUndo(
      elegidos.map((tx) => ({ tx, asignaciones: [{ ingresoId: newIncomeId, monto: tx.monto }] })),
      `${elegidos.length} egreso${elegidos.length !== 1 ? 's' : ''} reasignado${elegidos.length !== 1 ? 's' : ''}`,
    )
    setSelectedIds(new Set())
    setReassignOpen(false)
  }

  async function deleteSelected() {
    setDeleteLoading(true)
    try {
      await deleteTransactionsWithUndo(egresos.filter((e) => selectedIds.has(e.id!)))
      setSelectedIds(new Set())
    } finally {
      setDeleteLoading(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const unassignedExpenses = groups.get('unassigned')?.items ?? []
  const groupEntries = [
    ...ingresos.map((inc) => ({ key: inc.id!, group: groups.get(inc.id!)! })),
    { key: 'unassigned', group: { income: null, items: unassignedExpenses } },
  ]

  const barGradient = allAssigned
    ? 'linear-gradient(90deg, #6ee7b7, #34d399)'
    : progressPercent >= 50
      ? 'linear-gradient(90deg, #a5b4fc, #e0e7ff)'
      : 'linear-gradient(90deg, #fcd34d, #fda4af)'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header — hero card ── */}
      <div className="px-3 pt-1 pb-2 flex-shrink-0">
        <div className="relative rounded-[22px] overflow-hidden px-3.5 py-3 bg-brand shadow-soft text-white">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/15 rounded-full blur-2xl" />

          {/* Fila 1: número · badge · spacer · botón auto-asignar */}
          <div className="relative flex items-center gap-2 mb-2.5">
            <p className="text-xl font-bold tabular-nums leading-none flex-shrink-0">
              {assignedCount}
              <span className="text-white/50 text-sm font-semibold">/{totalEgresos}</span>
            </p>

            <AnimatePresence mode="wait" initial={false}>
              {allAssigned ? (
                <motion.div key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20">
                  <CheckCircle2 size={11} className="text-emerald-200 flex-shrink-0" />
                  <span className="text-[11px] text-emerald-100 font-semibold whitespace-nowrap">Todo asignado</span>
                </motion.div>
              ) : unassignedExpenses.length > 0 ? (
                <motion.div key="pending" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20">
                  <AlertCircle size={11} className="text-amber-200 flex-shrink-0" />
                  <span className="text-[11px] text-amber-100 font-semibold whitespace-nowrap">{unassignedExpenses.length} sin asignar</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex-1" />

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={autoAssign}
              disabled={autoLoading || unassignedExpenses.length === 0 || ingresos.length === 0}
              className="flex items-center gap-1 px-3 h-8 rounded-full bg-white text-primary text-[11px] font-bold shadow-sm disabled:opacity-40 whitespace-nowrap flex-shrink-0"
            >
              {autoLoading
                ? <><Sparkles size={12} className="animate-pulse" /> Asignando…</>
                : <><Zap size={12} /> Auto-asignar</>
              }
            </motion.button>
          </div>

          {/* Fila 2: barra de progreso · % · desasignar */}
          <div className="relative flex items-center gap-2">
            <div className="flex-1 min-w-0 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: barGradient }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </div>
            <span className="text-[11px] text-white/75 font-semibold tabular-nums flex-shrink-0">
              {Math.round(progressPercent)}%
            </span>
            {assignedCount > 0 && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={desassignAll}
                disabled={unassignLoading}
                className="hit-44 flex items-center gap-1 px-2.5 h-6 rounded-full text-[11px] font-semibold transition-colors flex-shrink-0 whitespace-nowrap bg-white/15 text-white/90"
              >
                <Unlink2 size={10} />
                Desasignar todo
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Groups ── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain pt-1 pb-28 no-scrollbar"
        onScroll={(e) => onScrollY?.(e.currentTarget.scrollTop)}
      >
        {egresos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2.5">
              <Zap size={20} className="text-primary" />
            </div>
            <p className="text-gray-500 text-sm font-semibold">No hay egresos este mes</p>
            <p className="text-gray-400 text-xs mt-1">Agregá egresos con el botón +</p>
          </div>
        ) : (
          groupEntries.map(({ key, group }, i) => {
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: stagger(i, 0.04), ease: [0.22, 1, 0.36, 1] }}
              >
                <AssignmentGroup
                  income={group.income}
                  items={group.items}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onEdit={openEditModal}
                  onDesassign={() => desassignGroup(key)}
                  isExpanded={expandedGroups.has(key)}
                  onToggleExpand={() => toggleGroup(key)}
                  userNames={userNames}
                  settings={s}
                  monedaBase={base}
                />
              </motion.div>
            )
          })
        )}
      </div>

      {/* ── Multi-select action bar (portal: queda fuera de los contenedores animados) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={springSoft}
              className="fixed bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[366px] glass-strong rounded-[22px] z-30 pl-2 pr-2 py-2 flex items-center gap-2"
            >
              <button onClick={() => setSelectedIds(new Set())} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-500/10" aria-label="Cancelar selección">
                <X size={18} className="text-gray-500" />
              </button>
              <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[13px] font-semibold text-gray-700 whitespace-nowrap">
                <motion.span
                  key={selectedIds.size}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  className="min-w-6 h-6 px-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center tabular-nums"
                >
                  {selectedIds.size}
                </motion.span>
                <span className="truncate">selecc.</span>
              </span>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={deleteSelected}
                disabled={deleteLoading}
                className="flex items-center gap-1.5 px-3 h-10 rounded-2xl text-[13px] font-semibold transition-colors whitespace-nowrap bg-rose-500/10 text-rose-500"
              >
                <Trash2 size={14} />
                Eliminar
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setReassignOpen(true)}
                className="px-3.5 h-10 rounded-2xl bg-brand text-white text-[13px] font-semibold shadow-soft whitespace-nowrap"
              >
                Reasignar
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <ReassignModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        ingresos={ingresos}
        egresos={egresos}
        userNames={userNames}
        selectedCount={selectedIds.size}
        onReassign={reassignSelected}
        settings={s}
        monedaBase={base}
      />
    </div>
  )
}
