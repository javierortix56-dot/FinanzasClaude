'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { Transaction, Settings, Currency, CategoryGroup } from '@finanzas/core/types'
import {
  getCatFromSettings, formatAmount,
  DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS,
} from '@finanzas/core/lib/constants'
import { toBase, toUSD } from '@finanzas/core/lib/currency'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import Amount from '@/components/ui/Amount'
import DonutChart, { DonutSlice } from './DonutChart'
import BudgetModal from './BudgetModal'

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
  const [tipoTab,        setTipoTab]        = useState<TipoTab>('egreso')
  const [selectedGroup,  setSelectedGroup]  = useState<string | null>(null)
  const [selectedSub,    setSelectedSub]    = useState<string | null>(null)
  const [budgetCat,      setBudgetCat]      = useState<string | null>(null)

  const filtered = transactions.filter((t) => t.tipo === tipoTab)

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
        const val = toBase(t.monto, t.moneda, monedaBase, settings)
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
      const val = toBase(t.monto, t.moneda, monedaBase, settings)
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
    (s, t) => s + toBase(t.monto, t.moneda, monedaBase, settings),
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
  // El centro del donut es <text> SVG: con modo incógnito se enmascara
  const centerAmount = centerSlice?.amount ?? groupSlice?.amount ?? total
  const centerLabel = hideAmounts ? '$ ••••' : formatAmount(centerAmount, monedaBase)
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

  return (
    <div>
      {/* Inner tabs */}
      <div className="flex gap-1 px-4 pt-2.5 border-b border-gray-50">
        {(['egreso', 'ingreso'] as TipoTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTipoTab(t); setSelectedGroup(null); setSelectedSub(null) }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors ${
              tipoTab === t
                ? t === 'egreso'
                  ? 'text-red-400 border-b-2 border-red-400'
                  : 'text-green-600 border-b-2 border-green-500'
                : 'text-gray-400'
            }`}
          >
            {t === 'egreso' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {/* Donut */}
      <div className="flex justify-center py-3">
        <DonutChart
          slices={slices}
          total={total}
          centerLabel={centerLabel}
          centerSub={centerSub}
          size={140}
        />
      </div>

      {/* Breadcrumb / back navigation */}
      {(selectedGroup || selectedSub) && (
        <div className="px-4 pb-1">
          <button
            onClick={() => {
              if (selectedSub) setSelectedSub(null)
              else setSelectedGroup(null)
            }}
            className="flex items-center gap-1 text-xs font-semibold text-[#534AB7]"
          >
            <ChevronLeft size={14} />
            {selectedSub ? `Volver a ${breadcrumb}` : 'Volver a categorías'}
          </button>
        </div>
      )}

      {/* Legend / Detail */}
      <div className="px-4 pb-3">
        {selectedSub ? (
          /* ── Nivel 2: transacciones ── */
          <div className="space-y-2 mt-2">
            {detailTxs.length === 0 ? (
              <p className="text-xs text-gray-400">Sin movimientos en esta categoría</p>
            ) : (
              detailTxs.map((tx) => {
                const amt = toBase(tx.monto, tx.moneda, monedaBase, settings)
                const pct = detailTotal > 0 ? (amt / detailTotal) * 100 : 0
                const cat = getCatFromSettings(tx.categoria, settings)
                return (
                  <div key={tx.id} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat?.color ?? DEFAULT_GRAY }}
                    />
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      {tx.descripcion || cat?.nombre || tx.categoria}
                    </span>
                    <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                    <span className="text-sm font-semibold text-gray-800 text-right">
                      <Amount amount={amt} currency={monedaBase} />
                    </span>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* ── Nivel 0 (grupos) o Nivel 1 (subcategorías) ── */
          <div className="space-y-1 mt-2">
            {slices.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                No hay movimientos en este período
              </p>
            ) : (
              slices.map((slice) => {
                const budget = getBudget(slice.id)
                let budgetPct = 0
                let spentInBudgetMoneda = 0
                if (budget) {
                  const spentUSD   = toUSD(slice.amount, monedaBase, settings)
                  const limiteUSD  = toUSD(budget.limite, budget.moneda as Currency, settings)
                  // El % real se muestra sin tope (un 250% debe verse como 250%);
                  // solo el ANCHO de la barra se limita a 100%.
                  budgetPct        = limiteUSD > 0 ? (spentUSD / limiteUSD) * 100 : 0
                  spentInBudgetMoneda = toBase(spentUSD, 'USD', budget.moneda as Currency, settings)
                }

                return (
                  <div key={slice.id}>
                    {/* "Agregar presupuesto" es HERMANO del botón de la fila:
                        un <button> dentro de otro es HTML inválido */}
                    <div className="w-full flex items-center gap-2 hover:bg-gray-50 rounded-lg px-1 py-1.5 transition-colors">
                      <button
                        className="flex-1 min-w-0 flex items-center gap-2"
                        onClick={() => {
                          if (selectedGroup === null) setSelectedGroup(slice.id)
                          else setSelectedSub(slice.id)
                        }}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="flex-1 text-xs font-medium text-gray-700 text-left truncate">
                          {slice.nombre}
                        </span>
                        <span className="text-[10px] text-gray-400 tabular-nums w-7 text-right">
                          {slice.percent.toFixed(0)}%
                        </span>
                        <span className={`text-xs font-semibold text-gray-800 tabular-nums w-12 text-right ${hideAmounts ? 'blur-sm select-none' : ''}`}>
                          {fmtShort(slice.amount)}
                        </span>
                      </button>
                      {tipoTab === 'egreso' && !budget && (
                        <button
                          className="text-gray-300 hover:text-[#534AB7] transition-colors ml-0.5"
                          onClick={() => setBudgetCat(slice.id)}
                          title="Agregar presupuesto"
                          aria-label="Agregar presupuesto"
                        >
                          <SlidersHorizontal size={11} />
                        </button>
                      )}
                    </div>

                    {/* Budget bar (only when budget exists) */}
                    {budget && (
                      <div className="ml-4 mb-0.5">
                        <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                          <span className={hideAmounts ? 'blur-sm select-none' : ''}>{budget.moneda} {fmtShort(spentInBudgetMoneda)} / {fmtShort(budget.limite)}</span>
                          <span className={`font-semibold ${
                            budgetPct >= 100 ? 'text-red-400' : budgetPct >= 80 ? 'text-orange-400' : 'text-green-600'
                          }`}>{Math.round(budgetPct)}%</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              budgetPct >= 100 ? 'bg-red-400' : budgetPct >= 80 ? 'bg-orange-300' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(budgetPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Budget modal */}
      {budgetCat && (
        <BudgetModal
          open={true}
          onClose={() => setBudgetCat(null)}
          categoria={budgetCat}
          mes={mes}
        />
      )}
    </div>
  )
}
