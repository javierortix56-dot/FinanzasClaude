'use client'

import { useState } from 'react'
import { ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { Transaction, Settings, Currency } from '@/types'
import { getCategoryById, DEFAULT_GASTO_CATEGORIES, DEFAULT_INGRESO_CATEGORIES, formatAmount } from '@/lib/constants'
import { toBase, toUSD } from '@/lib/currency'
import { useBudgetStore } from '@/store/useBudgetStore'
import DonutChart, { DonutSlice } from './DonutChart'
import BudgetModal from './BudgetModal'

interface Props {
  transactions: Transaction[]
  settings: Settings
  monedaBase: Currency
  mes: string
}

type TipoTab = 'egreso' | 'ingreso'

export default function CategoryDonut({ transactions, settings, monedaBase, mes }: Props) {
  const { getBudget } = useBudgetStore()
  const [tipoTab,  setTipoTab]  = useState<TipoTab>('egreso')
  const [selected, setSelected] = useState<string | null>(null)
  const [budgetCat, setBudgetCat] = useState<string | null>(null)

  const filtered = transactions.filter((t) => t.tipo === tipoTab)

  // Aggregate by category
  const catMap = new Map<string, number>()
  filtered.forEach((t) => {
    const val = toBase(t.monto, t.moneda, monedaBase, settings)
    catMap.set(t.categoria, (catMap.get(t.categoria) ?? 0) + val)
  })

  const defaultCats = tipoTab === 'egreso' ? DEFAULT_GASTO_CATEGORIES : DEFAULT_INGRESO_CATEGORIES
  const total = [...catMap.values()].reduce((a, b) => a + b, 0)

  // Build slices sorted by amount desc
  const allSettingsCats = [...settings.categoriasGasto, ...settings.categoriasIngreso]
  const slices: (DonutSlice & { nombre: string; amount: number; percent: number })[] = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, amount]) => {
      const cat = allSettingsCats.find((c) => c.id === id) ?? getCategoryById(id) ?? defaultCats.find((c) => c.id === id)
      return {
        id,
        nombre: cat?.nombre ?? id,
        color:  cat?.color  ?? '#6B7280',
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
        dimmed: selected !== null && selected !== id,
      }
    })

  // Detail: transactions in selected category
  const detailTxs = selected
    ? filtered.filter((t) => t.categoria === selected)
    : []
  const detailTotal = detailTxs.reduce(
    (s, t) => s + toBase(t.monto, t.moneda, monedaBase, settings),
    0
  )

  const centerSlice = selected ? slices.find((s) => s.id === selected) : null
  const centerLabel = centerSlice
    ? formatAmount(centerSlice.amount, monedaBase)
    : formatAmount(total, monedaBase)
  const centerSub = centerSlice ? centerSlice.nombre : (tipoTab === 'egreso' ? 'Total gastos' : 'Total ingresos')

  function fmtShort(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
    return n.toFixed(0)
  }

  return (
    <div>
      {/* Inner tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-gray-50">
        {(['egreso', 'ingreso'] as TipoTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTipoTab(t); setSelected(null) }}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              tipoTab === t
                ? t === 'egreso'
                  ? 'text-red-500 border-b-2 border-red-400'
                  : 'text-green-600 border-b-2 border-green-500'
                : 'text-gray-400'
            }`}
          >
            {t === 'egreso' ? 'Gastos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {/* Donut */}
      <div className="flex justify-center py-4">
        <DonutChart
          slices={slices}
          total={total}
          centerLabel={centerLabel}
          centerSub={centerSub}
          size={160}
        />
      </div>

      {/* Legend / Detail */}
      <div className="px-4 pb-4">
        {selected ? (
          /* ── Detail view ── */
          <>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs font-semibold text-[#534AB7] mb-3"
            >
              <ChevronLeft size={14} />
              Volver a categorías
            </button>
            <div className="space-y-2">
              {detailTxs.length === 0 ? (
                <p className="text-xs text-gray-400">Sin movimientos en esta categoría</p>
              ) : (
                detailTxs.map((tx) => {
                  const amt = toBase(tx.monto, tx.moneda, monedaBase, settings)
                  const pct = detailTotal > 0 ? (amt / detailTotal) * 100 : 0
                  const cat = getCategoryById(tx.categoria)
                  return (
                    <div key={tx.id} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: (allSettingsCats.find((c) => c.id === tx.categoria) ?? getCategoryById(tx.categoria))?.color ?? '#6B7280' }}
                      />
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {tx.descripcion || cat?.nombre || tx.categoria}
                      </span>
                      <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-gray-800 text-right">
                        {formatAmount(amt, monedaBase)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : (
          /* ── Category legend ── */
          <div className="space-y-3">
            {slices.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
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
                  budgetPct        = limiteUSD > 0 ? Math.min((spentUSD / limiteUSD) * 100, 100) : 0
                  spentInBudgetMoneda = toBase(spentUSD, 'USD', budget.moneda as Currency, settings)
                }

                return (
                  <div key={slice.id}>
                    <button
                      className="w-full flex items-center gap-2 hover:bg-gray-50 rounded-lg px-1 py-1 transition-colors"
                      onClick={() => setSelected(slice.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="flex-1 text-sm font-medium text-gray-800 text-left truncate">
                        {slice.nombre}
                      </span>
                      <span className="text-xs text-gray-400">{slice.percent.toFixed(0)}%</span>
                      <span className="text-sm font-semibold text-gray-900 ml-1">
                        {fmtShort(slice.amount)}
                      </span>
                    </button>

                    {/* Budget bar */}
                    {budget ? (
                      <div className="ml-5 mt-1">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>
                            {budget.moneda} {fmtShort(spentInBudgetMoneda)} de {fmtShort(budget.limite)}
                          </span>
                          <span
                            className={`font-semibold ${
                              budgetPct >= 100 ? 'text-red-500' : budgetPct >= 80 ? 'text-orange-500' : 'text-green-600'
                            }`}
                          >
                            {Math.round(budgetPct)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-orange-400' : 'bg-green-500'
                            }`}
                            style={{ width: `${budgetPct}%` }}
                          />
                        </div>
                      </div>
                    ) : tipoTab === 'egreso' ? (
                      <button
                        className="ml-5 mt-0.5 text-[10px] text-[#534AB7]/60 hover:text-[#534AB7] flex items-center gap-1"
                        onClick={(e) => { e.stopPropagation(); setBudgetCat(slice.id) }}
                      >
                        <SlidersHorizontal size={10} />
                        Agregar presupuesto
                      </button>
                    ) : null}
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
