'use client'

import { useState, useMemo } from 'react'
import { Zap, X, Unlink2, Sparkles, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { adjustAssetSaldo } from '@finanzas/core/lib/assets'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { Transaction, Currency } from '@finanzas/core/types'
import AssignmentGroup, { GroupItem } from './AssignmentGroup'
import ReassignModal from './ReassignModal'

export default function AssignmentTab() {
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
  const [unassignConfirm, setUnassignConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState(false)
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
    } finally {
      setAutoLoading(false)
    }
  }

  // Desasignar todos
  async function desassignAll() {
    if (!unassignConfirm) {
      setUnassignConfirm(true)
      setTimeout(() => setUnassignConfirm(false), 4000)
      return
    }
    setUnassignLoading(true)
    setUnassignConfirm(false)
    try {
      const assigned = egresos.filter((e) => e.asignaciones.length > 0)
      await Promise.allSettled(assigned.map((e) => updateTransaction(e.id!, { asignaciones: [] })))
    } finally {
      setUnassignLoading(false)
    }
  }

  async function desassignGroup(incomeId: string) {
    const group = groups.get(incomeId)
    if (!group) return
    // Quita solo el vínculo con ESTE ingreso; si el egreso estaba dividido,
    // conserva la parte asignada al otro ingreso.
    await Promise.allSettled(group.items.map(({ exp }) => updateTransaction(exp.id!, {
      asignaciones: exp.asignaciones.filter((a) => a.ingresoId !== incomeId),
    })))
  }

  async function reassignSelected(newIncomeId: string) {
    const byId = new Map(egresos.map((e) => [e.id!, e]))
    await Promise.allSettled([...selectedIds].map((id) => {
      const exp = byId.get(id)
      if (!exp) return Promise.resolve()
      return updateTransaction(id, {
        asignaciones: [{ ingresoId: newIncomeId, monto: exp.monto }],
      })
    }))
    setSelectedIds(new Set())
    setReassignOpen(false)
  }

  async function deleteSelected() {
    if (!deleteConfirm) { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 4000); return }
    setDeleteLoading(true)
    setDeleteConfirm(false)
    try {
      const toDelete = egresos.filter((e) => selectedIds.has(e.id!))
      for (const tx of toDelete) {
        if (tx.ahorroAssetId) {
          try {
            const txMonth = tx.fecha.toDate().toISOString().slice(0, 7)
            await adjustAssetSaldo(tx.ahorroAssetId, -tx.monto, txMonth)
          } catch { /* non-blocking */ }
        }
        await deleteTransaction(tx.id!)
      }
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
    ? 'linear-gradient(90deg, #22c55e, #10b981)'
    : progressPercent >= 50
      ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
      : 'linear-gradient(90deg, #fbbf24, #f87171)'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/60">

      {/* ── Header — hero card ── */}
      <div className="px-3 pt-2 pb-2 bg-surface">
        <div className="relative rounded-xl overflow-hidden px-3 py-2.5 bg-gradient-to-r from-primary to-[#8b5cf6] shadow-sm">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-surface/10 rounded-full blur-xl" />

          {/* Fila 1: número · badge · spacer · botón auto-asignar */}
          <div className="relative flex items-center gap-2 mb-2">
            <p className="text-lg font-black text-white tabular-nums leading-none flex-shrink-0">
              {assignedCount}
              <span className="text-white/50 text-sm font-bold">/{totalEgresos}</span>
            </p>

            {allAssigned ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-300 flex-shrink-0" />
                <span className="text-[11px] text-emerald-200 font-semibold whitespace-nowrap">Todo asignado</span>
              </div>
            ) : unassignedExpenses.length > 0 ? (
              <div className="flex items-center gap-1">
                <AlertCircle size={10} className="text-amber-300 flex-shrink-0" />
                <span className="text-[11px] text-amber-200 font-semibold whitespace-nowrap">{unassignedExpenses.length} sin asignar</span>
              </div>
            ) : null}

            <div className="flex-1" />

            <button
              onClick={autoAssign}
              disabled={autoLoading || unassignedExpenses.length === 0 || ingresos.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-primary text-[11px] font-bold shadow-sm disabled:opacity-40 active:scale-95 transition-all whitespace-nowrap flex-shrink-0"
            >
              {autoLoading
                ? <><Sparkles size={10} className="animate-pulse" /> Asignando…</>
                : <><Zap size={10} /> Auto-asignar</>
              }
            </button>
          </div>

          {/* Fila 2: barra de progreso · % · desasignar */}
          <div className="relative flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="h-1 bg-surface/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPercent}%`, background: barGradient }}
                />
              </div>
            </div>
            <span className="text-[11px] text-white/70 font-semibold tabular-nums flex-shrink-0">
              {Math.round(progressPercent)}%
            </span>
            {assignedCount > 0 && (
              <button
                onClick={desassignAll}
                disabled={unassignLoading}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 flex-shrink-0 whitespace-nowrap ${
                  unassignConfirm ? 'bg-red-400 text-white' : 'bg-surface/15 text-white/90'
                }`}
              >
                <Unlink2 size={9} />
                {unassignConfirm ? '¿Confirmar?' : 'Desasignar todo'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Groups ── */}
      <div className="flex-1 overflow-y-auto pt-2 pb-24">
        {egresos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-gray-400 text-sm">No hay egresos este mes</p>
            <p className="text-gray-300 text-xs mt-1">Agregá egresos con el botón +</p>
          </div>
        ) : (
          groupEntries.map(({ key, group }) => {
            return (
              <AssignmentGroup
                key={key}
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
            )
          })
        )}
      </div>

      {/* ── Multi-select action bar ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface border-t border-gray-100 shadow-lg z-30 px-4 py-3 flex items-center gap-2">
          <button onClick={() => { setSelectedIds(new Set()); setDeleteConfirm(false) }} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-700">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={deleteSelected}
            disabled={deleteLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              deleteConfirm ? 'bg-red-400 text-white' : 'bg-red-50 text-red-400'
            }`}
          >
            <Trash2 size={14} />
            {deleteConfirm ? '¿Confirmar?' : 'Eliminar'}
          </button>
          <button
            onClick={() => setReassignOpen(true)}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            Reasignar
          </button>
        </div>
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
