'use client'

import { useState, useMemo } from 'react'
import { Zap, X, Unlink2 } from 'lucide-react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { updateTransaction } from '@/lib/transactions'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { SHARED_USERS } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { Transaction, Currency } from '@/types'
import AssignmentGroup from './AssignmentGroup'
import ReassignModal from './ReassignModal'

export default function AssignmentTab() {
  const { transactions } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['unassigned']))
  const [reassignOpen, setReassignOpen]     = useState(false)
  const [autoLoading, setAutoLoading]       = useState(false)
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [unassignConfirm, setUnassignConfirm] = useState(false)
  const userNames = Object.fromEntries(SHARED_USERS.map((u) => [u.id, u.nombre]))

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso').sort(
      (a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime()
    ),
    [transactions]
  )
  const egresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'egreso').sort(
      (a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime()
    ),
    [transactions]
  )

  const assignedCount   = egresos.filter((e) => e.asignadoA !== null).length
  const totalEgresos    = egresos.length
  const progressPercent = totalEgresos > 0 ? (assignedCount / totalEgresos) * 100 : 0
  const allAssigned     = assignedCount === totalEgresos && totalEgresos > 0

  const groups = useMemo(() => {
    const map = new Map<string, { income: Transaction | null; expenses: Transaction[] }>()
    ingresos.forEach((inc) => map.set(inc.id!, { income: inc, expenses: [] }))
    map.set('unassigned', { income: null, expenses: [] })
    egresos.forEach((exp) => {
      const key = exp.asignadoA ?? 'unassigned'
      if (!map.has(key)) map.get('unassigned')!.expenses.push(exp)
      else map.get(key)!.expenses.push(exp)
    })
    return map
  }, [ingresos, egresos])

  // Auto-asignar respetando capacidad
  async function autoAssign() {
    const unassigned = egresos.filter((e) => e.asignadoA === null)
    if (ingresos.length === 0 || unassigned.length === 0) return
    setAutoLoading(true)

    const capacity = new Map<string, number>()
    ingresos.forEach((inc) => {
      const incBase = toBase(inc.monto, inc.moneda, base, s)
      const yaAsignado = egresos
        .filter((e) => e.asignadoA === inc.id)
        .reduce((sum, e) => sum + toBase(e.monto, e.moneda, base, s), 0)
      capacity.set(inc.id!, incBase - yaAsignado)
    })

    try {
      for (const exp of unassigned) {
        const expBase = toBase(exp.monto, exp.moneda, base, s)
        const expTime = exp.fecha.toDate().getTime()
        const elegibles = ingresos.filter((inc) => (capacity.get(inc.id!) ?? 0) >= expBase)
        if (elegibles.length === 0) continue
        const closest = elegibles.reduce((prev, curr) =>
          Math.abs(curr.fecha.toDate().getTime() - expTime) <
          Math.abs(prev.fecha.toDate().getTime() - expTime) ? curr : prev
        )
        capacity.set(closest.id!, (capacity.get(closest.id!) ?? 0) - expBase)
        await updateTransaction(exp.id!, { asignadoA: closest.id! })
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
      const assigned = egresos.filter((e) => e.asignadoA !== null)
      await Promise.allSettled(assigned.map((e) => updateTransaction(e.id!, { asignadoA: null })))
    } finally {
      setUnassignLoading(false)
    }
  }

  async function desassignGroup(incomeId: string) {
    const group = groups.get(incomeId)
    if (!group) return
    await Promise.allSettled(group.expenses.map((e) => updateTransaction(e.id!, { asignadoA: null })))
  }

  async function reassignSelected(newIncomeId: string) {
    await Promise.allSettled([...selectedIds].map((id) => updateTransaction(id, { asignadoA: newIncomeId })))
    setSelectedIds(new Set())
    setReassignOpen(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const unassignedExpenses = groups.get('unassigned')?.expenses ?? []
  const groupEntries = [
    ...ingresos.map((inc) => ({ key: inc.id!, group: groups.get(inc.id!)! })),
    { key: 'unassigned', group: { income: null, expenses: unassignedExpenses } },
  ]

  const barColor = progressPercent >= 100 ? '#22c55e' : progressPercent >= 50 ? '#534AB7' : '#f59e0b'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-4 bg-white border-b border-gray-100">
        {/* Stats row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              allAssigned
                ? 'bg-green-100 text-green-700'
                : assignedCount === 0
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-[#534AB7]/10 text-[#534AB7]'
            }`}>
              {assignedCount}/{totalEgresos} asignados
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {assignedCount > 0 && (
              <button
                onClick={desassignAll}
                disabled={unassignLoading}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  unassignConfirm
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
                }`}
              >
                <Unlink2 size={12} />
                {unassignConfirm ? '¿Confirmar?' : 'Desasignar todo'}
              </button>
            )}
            <button
              onClick={autoAssign}
              disabled={autoLoading || unassignedExpenses.length === 0 || ingresos.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#534AB7] text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-all shadow-sm"
            >
              <Zap size={12} />
              {autoLoading ? 'Asignando…' : 'Auto-asignar'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%`, backgroundColor: barColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{Math.round(progressPercent)}% asignado</span>
          {unassignedExpenses.length > 0 && (
            <span className="text-[10px] text-amber-500 font-semibold">
              {unassignedExpenses.length} sin asignar
            </span>
          )}
        </div>
      </div>

      {/* ── Groups ── */}
      <div className="flex-1 overflow-y-auto pt-3 pb-24 bg-gray-50/60">
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
                expenses={group.expenses}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
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
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 shadow-lg z-30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedIds(new Set())} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-700">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setReassignOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            Reasignar
          </button>
        </div>
      )}

      <ReassignModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        ingresos={ingresos}
        userNames={userNames}
        selectedCount={selectedIds.size}
        onReassign={reassignSelected}
      />
    </div>
  )
}
