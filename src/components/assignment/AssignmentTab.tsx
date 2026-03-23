'use client'

import { useState, useMemo, useEffect } from 'react'
import { Zap, X } from 'lucide-react'
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

  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['unassigned']))
  const [reassignOpen, setReassignOpen]   = useState(false)
  const [autoLoading, setAutoLoading]     = useState(false)
  const userNames = Object.fromEntries(SHARED_USERS.map((u) => [u.id, u.nombre]))

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso').sort(
      (a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime()
    ),
    [transactions]
  )
  const egresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'egreso'),
    [transactions]
  )

  // Progress
  const assignedCount   = egresos.filter((e) => e.asignadoA !== null).length
  const totalEgresos    = egresos.length
  const progressPercent = totalEgresos > 0 ? (assignedCount / totalEgresos) * 100 : 0

  // Build groups: incomeId → expenses[]  +  'unassigned' → []
  const groups = useMemo(() => {
    const map = new Map<string, { income: Transaction | null; expenses: Transaction[] }>()

    // One entry per ingreso
    ingresos.forEach((inc) => map.set(inc.id!, { income: inc, expenses: [] }))
    // Unassigned group
    map.set('unassigned', { income: null, expenses: [] })

    egresos.forEach((exp) => {
      const key = exp.asignadoA ?? 'unassigned'
      if (!map.has(key)) {
        // Orphaned reference (ingreso deleted) — treat as unassigned
        map.get('unassigned')!.expenses.push(exp)
      } else {
        map.get(key)!.expenses.push(exp)
      }
    })

    return map
  }, [ingresos, egresos])

  // Auto-asignar: asigna al ingreso más cercano que tenga capacidad disponible
  async function autoAssign() {
    const unassigned = egresos.filter((e) => e.asignadoA === null)
    if (ingresos.length === 0 || unassigned.length === 0) return
    setAutoLoading(true)

    // Calcular capacidad restante por ingreso (en moneda base)
    const capacity = new Map<string, number>()
    ingresos.forEach((inc) => {
      const incBase = toBase(inc.monto, inc.moneda, base, s)
      const yaAsignado = egresos
        .filter((e) => e.asignadoA === inc.id)
        .reduce((sum, e) => sum + toBase(e.monto, e.moneda, base, s), 0)
      capacity.set(inc.id!, incBase - yaAsignado)
    })

    try {
      // Procesar secuencialmente para que la capacidad se actualice correctamente
      for (const exp of unassigned) {
        const expBase = toBase(exp.monto, exp.moneda, base, s)
        const expTime = exp.fecha.toDate().getTime()

        // Solo considerar ingresos con capacidad suficiente
        const elegibles = ingresos.filter((inc) => (capacity.get(inc.id!) ?? 0) >= expBase)
        if (elegibles.length === 0) continue // no cabe en ningún ingreso → queda sin asignar

        const closest = elegibles.reduce((prev, curr) =>
          Math.abs(curr.fecha.toDate().getTime() - expTime) <
          Math.abs(prev.fecha.toDate().getTime() - expTime)
            ? curr : prev
        )

        capacity.set(closest.id!, (capacity.get(closest.id!) ?? 0) - expBase)
        await updateTransaction(exp.id!, { asignadoA: closest.id! })
      }
    } finally {
      setAutoLoading(false)
    }
  }

  // Desasignar todos los egresos de un grupo
  async function desassignGroup(incomeId: string) {
    const group = groups.get(incomeId)
    if (!group) return
    await Promise.all(group.expenses.map((e) => updateTransaction(e.id!, { asignadoA: null })))
  }

  // Reasignar seleccionados a otro ingreso
  async function reassignSelected(newIncomeId: string) {
    await Promise.all(
      [...selectedIds].map((id) => updateTransaction(id, { asignadoA: newIncomeId }))
    )
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

  // Render order: ingresos groups first, unassigned last
  const groupEntries = [
    ...ingresos
      .map((inc) => ({ key: inc.id!, group: groups.get(inc.id!)! }))
      .filter(({ group }) => group.expenses.length > 0 || ingresos.length <= 5), // show even empty if few ingresos
    { key: 'unassigned', group: { income: null, expenses: unassignedExpenses } },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Progress + Auto-asignar ── */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold text-gray-500">
              {assignedCount} de {totalEgresos} egresos asignados
            </p>
          </div>
          <button
            onClick={autoAssign}
            disabled={autoLoading || unassignedExpenses.length === 0 || ingresos.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#534AB7] text-white text-xs font-semibold disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Zap size={13} />
            {autoLoading ? 'Asignando...' : 'Auto-asignar'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#534AB7] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">asignado</span>
          <span className="text-[10px] text-[#534AB7] font-semibold">
            {Math.round(progressPercent)}%
          </span>
        </div>
      </div>

      {/* ── Groups ── */}
      <div className="flex-1 overflow-y-auto pt-3 pb-24">
        {egresos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-gray-400 text-sm">No hay egresos este mes</p>
            <p className="text-gray-300 text-xs mt-1">Agregá egresos con el botón +</p>
          </div>
        ) : (
          groupEntries.map(({ key, group }) => {
            if (key !== 'unassigned' && group.expenses.length === 0) return null
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
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
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

      {/* ── Reassign modal ── */}
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
