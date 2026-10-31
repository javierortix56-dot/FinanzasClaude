'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Transaction, Settings, Currency, CategoryGroup } from '@finanzas/core/types'
import {
  getCatFromSettings, formatAmount,
  DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS,
} from '@finanzas/core/lib/constants'
import { toBase, toUSD, txToBase } from '@finanzas/core/lib/currency'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import DonutChart, { DonutSlice } from './DonutChart'
import BudgetModal from './BudgetModal'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import Segmented from '@/components/ui/Segmented'
import ProgressBar from '@/components/ui/ProgressBar'
import { Money } from '@/components/ui/AnimatedNumber'
import { cuentaEnCategorias } from '@finanzas/core/lib/tarjetas'
import { CategoryIcon } from '@/lib/categoryIcons'

// High-contrast palette: colours spaced across the full hue wheel
const PALETTE = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#84CC16', // lime
]
const DEFAULT_GRAY = '#94A3B8'

function resolveColor(color: string | undefined, index: number): string {
  if (!color || color === DEFAULT_GRAY) return PALETTE[index % PALETTE.length]
  return color
}

interface Props {
  transactions: Transaction[]
  settings: Settings
  monedaBase: Currency
  mes: string
}

type TipoTab = 'egreso' | 'ingreso'
type Slice = DonutSlice & { nombre: string; amount: number; percent: number }

export default function CategoryDonut({ transactions, settings, monedaBase, mes }: Props) {
  const { getBudget } = useBudgetStore()
  const hideAmounts = useSettingsStore((st) => st.hideAmounts)
  const blur = hideAmounts ? 'blur-[4px] select-none' : ''
  const [tipoTab,        setTipoTab]        = useState<TipoTab>('egreso')
  const [selectedGroup,  setSelectedGroup]  = useState<string | null>(null)
  const [selectedSub,    setSelectedSub]    = useState<string | null>(null)
  const [budgetCat,      setBudgetCat]      = useState<string | null>(null)
  const [budgetOpen,     setBudgetOpen]     = useState(false)

  // Los pagos de tarjeta no son una categoría de gasto: sus consumos ya cuentan
  const filtered = transactions.filter((t) => t.tipo === tipoTab && cuentaEnCategorias(t))

  // Árbol de grupos activos según el tipo seleccionado
  const groups: CategoryGroup[] = useMemo(() => {
    const raw = tipoTab === 'egreso'
      ? (settings.categoriasGasto.length   > 0 ? settings.categoriasGasto   : DEFAULT_GASTO_CATEGORY_GROUPS)
      : (settings.categoriasIngreso.length > 0 ? settings.categoriasIngreso : DEFAULT_INGRESO_CATEGORY_GROUPS)
    return raw.filter((g) => g.activa)
  }, [tipoTab, settings])

  // Mapa: subcatId / grupoId → groupId padre
  const idToGroup = useMemo(() => {
    const m = new Map<string, string>()
    groups.forEach((g) => {
      m.set(g.id, g.id) // si la tx está categorizada al grupo directo
      g.subcategorias.forEach((s) => m.set(s.id, g.id))
    })
    return m
  }, [groups])

  // ── Slices según el nivel actual ───────────────────────────────────────
  const slices: Slice[] = useMemo(() => {
    if (selectedGroup === null) {
      // Nivel 0: agregar por grupo
      const map = new Map<string, number>()
      filtered.forEach((t) => {
        const groupId = idToGroup.get(t.categoria) ?? t.categoria
        const val = txToBase(t, monedaBase, settings)
        map.set(groupId, (map.get(groupId) ?? 0) + val)
      })
      const tot = [...map.values()].reduce((a, b) => a + b, 0)
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([gId, amount], idx) => {
          const grp = groups.find((g) => g.id === gId)
          return {
            id: gId,
            nombre: grp?.nombre ?? gId,
            color: resolveColor(grp?.color, idx),
            amount,
            percent: tot > 0 ? (amount / tot) * 100 : 0,
            dimmed: false,
          }
        })
    }
    // Nivel 1: subcategorías del grupo seleccionado
    const map = new Map<string, number>()
    filtered.forEach((t) => {
      const gId = idToGroup.get(t.categoria) ?? t.categoria
      if (gId !== selectedGroup) return
      const val = txToBase(t, monedaBase, settings)
      map.set(t.categoria, (map.get(t.categoria) ?? 0) + val)
    })
    const tot = [...map.values()].reduce((a, b) => a + b, 0)
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, amount], idx) => {
        const cat = getCatFromSettings(id, settings)
        const grp = groups.find((g) => g.id === selectedGroup)
        const fallbackName = id === selectedGroup ? `${grp?.nombre ?? ''} (sin subcategoría)` : id
        return {
          id,
          nombre: cat?.nombre && id !== selectedGroup ? cat.nombre : fallbackName,
          color: resolveColor(cat?.color, idx),
          amount,
          percent: tot > 0 ? (amount / tot) * 100 : 0,
          dimmed: selectedSub !== null && selectedSub !== id,
        }
      })
  }, [filtered, idToGroup, groups, selectedGroup, selectedSub, monedaBase, settings])

  const total = slices.reduce((a, s) => a + s.amount, 0)

  // ── Detail (nivel 2): transacciones en la subcategoría seleccionada ──
  const detailTxs = selectedSub
    ? filtered.filter((t) => t.categoria === selectedSub)
    : []
  const detailTotal = detailTxs.reduce(
    (s, t) => s + txToBase(t, monedaBase, settings),
    0
  )

  // ── Centro del donut ─────────────────────────────────────────────────
  const centerSlice = selectedSub
    ? slices.find((s) => s.id === selectedSub)
    : selectedGroup
      ? null
      : null
  const groupSlice = selectedGroup && !selectedSub
    ? { amount: total, nombre: groups.find((g) => g.id === selectedGroup)?.nombre ?? '' }
    : null
  const centerLabel = (
    <Money
      value={centerSlice ? centerSlice.amount : groupSlice ? groupSlice.amount : total}
      currency={monedaBase}
    />
  )
  const centerSub = centerSlice
    ? centerSlice.nombre
    : groupSlice
      ? groupSlice.nombre
      : (tipoTab === 'egreso' ? 'Total gastos' : 'Total ingresos')

  function fmtShort(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
    return n.toFixed(0)
  }

  const breadcrumb = selectedGroup
    ? groups.find((g) => g.id === selectedGroup)?.nombre ?? ''
    : ''

  const level = selectedSub ? 2 : selectedGroup ? 1 : 0
  const levelKey = `${tipoTab}-${selectedGroup ?? 'root'}-${selectedSub ?? ''}`

  return (
    <div className="px-4 pb-4">
      {/* Inner tabs */}
      <Segmented
        id="donut-tipo"
        size="sm"
        value={tipoTab}
        onChange={(t) => { setTipoTab(t); setSelectedGroup(null); setSelectedSub(null) }}
        options={[
          { value: 'egreso',  label: 'Gastos',   activeColor: '#f43f5e' },
          { value: 'ingreso', label: 'Ingresos', activeColor: '#10b981' },
        ]}
        className="mt-2"
      />

      {/* Donut */}
      <div className="flex justify-center py-4">
        <DonutChart
          slices={slices}
          total={total}
          centerLabel={centerLabel}
          centerSub={centerSub}
          size={164}
          animationKey={`${tipoTab}-${selectedGroup ?? 'root'}`}
        />
      </div>

      {/* Breadcrumb / back navigation */}
      <AnimatePresence initial={false}>
        {(selectedGroup || selectedSub) && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            onClick={() => {
              if (selectedSub) setSelectedSub(null)
              else setSelectedGroup(null)
            }}
            className="flex items-center gap-1 h-8 pl-1.5 pr-3 mb-1 rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            <ChevronLeft size={14} />
            {selectedSub ? `Volver a ${breadcrumb}` : 'Volver a categorías'}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Legend / Detail */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={levelKey}
          initial={{ opacity: 0, x: level > 0 ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: level > 0 ? -16 : 16 }}
          transition={{ duration: 0.2 }}
        >
          {selectedSub ? (
            /* ── Nivel 2: transacciones ── */
            <div className="space-y-1 mt-1">
              {detailTxs.length === 0 ? (
                <p className="text-xs text-gray-400">Sin movimientos en esta categoría</p>
              ) : (
                detailTxs.map((tx) => {
                  const amt = txToBase(tx, monedaBase, settings)
                  const pct = detailTotal > 0 ? (amt / detailTotal) * 100 : 0
                  const cat = getCatFromSettings(tx.categoria, settings)
                  return (
                    <div key={tx.id} className="flex items-center gap-2 px-2 py-2 rounded-xl bg-gray-500/[0.05]">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat?.color ?? DEFAULT_GRAY }}
                      />
                      <span className="flex-1 text-xs font-medium text-gray-700 truncate">
                        {tx.descripcion || cat?.nombre || tx.categoria}
                      </span>
                      <span className="text-[11px] text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
                      <span className={`text-xs font-bold text-gray-800 text-right tabular-nums ${blur}`}>
                        {formatAmount(amt, monedaBase)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            /* ── Nivel 0 (grupos) o Nivel 1 (subcategorías) ── */
            <div className="space-y-1 mt-1">
              {slices.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">
                  No hay movimientos en este período
                </p>
              ) : (
                slices.map((slice, i) => {
                  const budget = getBudget(slice.id)
                  let budgetPct = 0
                  let spentInBudgetMoneda = 0
                  if (budget) {
                    const spentUSD   = toUSD(slice.amount, monedaBase, settings, budget.mes)
                    const limiteUSD  = toUSD(budget.limite, budget.moneda as Currency, settings, budget.mes)
                    budgetPct        = limiteUSD > 0 ? Math.min((spentUSD / limiteUSD) * 100, 100) : 0
                    spentInBudgetMoneda = toBase(spentUSD, 'USD', budget.moneda as Currency, settings, budget.mes)
                  }
                  const budgetColor = budgetPct >= 100 ? '#f43f5e' : budgetPct >= 80 ? '#f59e0b' : '#10b981'

                  return (
                    <motion.div
                      key={slice.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl hover:bg-gray-500/[0.05] transition-colors"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center gap-2 px-2 py-2 cursor-pointer"
                        onClick={() => {
                          if (selectedGroup === null) setSelectedGroup(slice.id)
                          else setSelectedSub(slice.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          if (selectedGroup === null) setSelectedGroup(slice.id)
                          else setSelectedSub(slice.id)
                        }}
                      >
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: slice.color + '22', color: slice.color }}
                        >
                          <CategoryIcon cat={getCatFromSettings(slice.id, settings) ?? { id: slice.id }} size={12} />
                        </span>
                        <span className="flex-1 text-xs font-semibold text-gray-700 text-left truncate">
                          {slice.nombre}
                        </span>
                        <span className="text-[11px] text-gray-400 tabular-nums w-8 text-right">
                          {slice.percent.toFixed(0)}%
                        </span>
                        <span className={`text-xs font-bold text-gray-800 tabular-nums w-12 text-right ${blur}`}>
                          {fmtShort(slice.amount)}
                        </span>
                        {tipoTab === 'egreso' && !budget ? (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setBudgetCat(slice.id); setBudgetOpen(true) }}
                            title="Agregar presupuesto"
                            aria-label="Agregar presupuesto"
                          >
                            <SlidersHorizontal size={12} />
                          </button>
                        ) : (
                          <ChevronRight size={14} className="text-gray-300 w-6" />
                        )}
                      </div>

                      {/* Budget bar (only when budget exists) */}
                      {budget && (
                        <div className="pl-6 pr-2 pb-2">
                          <ProgressBar value={budgetPct} color={budgetColor} height={4} />
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                            <span className={blur}>{budget.moneda} {fmtShort(spentInBudgetMoneda)} / {fmtShort(budget.limite)}</span>
                            <span className="font-bold" style={{ color: budgetColor }}>{Math.round(budgetPct)}%</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Budget modal */}
      <BudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        categoria={budgetCat ?? ''}
        mes={mes}
      />
    </div>
  )
}
