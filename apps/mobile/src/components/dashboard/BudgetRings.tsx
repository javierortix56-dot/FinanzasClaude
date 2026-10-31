'use client'

import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { getCatFromSettings, getParentGroup } from '@finanzas/core/lib/constants'
import { toBase, txToBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency, Transaction } from '@finanzas/core/types'
import { cuentaEnCategorias } from '@finanzas/core/lib/tarjetas'
import { CategoryIcon } from '@/lib/categoryIcons'

const R = 15
const CIRC = 2 * Math.PI * R

/**
 * Presupuestos del mes como anillos en el Resumen: cuánto se gastó de cada
 * límite sin tener que ir a Análisis. Solo aparece si hay presupuestos.
 */
export default function BudgetRings({ transactions, month, base }: {
  transactions: Transaction[]
  month: string
  base: Currency
}) {
  const { budgets, setBudgets } = useBudgetStore()
  const settings = useSettingsStore((st) => st.settings)
  const s = settings ?? DEFAULT_SETTINGS

  useEffect(() => {
    const unsub = subscribeToBudgets(month, setBudgets)
    return () => unsub()
  }, [month, setBudgets])

  const items = useMemo(() => budgets
    .filter((b) => b.mes === month && b.limite > 0)
    .map((b) => {
      const spentBase = transactions
        .filter((t) => t.tipo === 'egreso' && cuentaEnCategorias(t) && (t.categoria === b.categoria || getParentGroup(t.categoria, s.categoriasGasto)?.id === b.categoria))
        .reduce((sum, t) => sum + txToBase(t, base, s), 0)
      const spent = toBase(spentBase, base, b.moneda as Currency, s, b.mes)
      const pct = (spent / b.limite) * 100
      return { b, cat: getCatFromSettings(b.categoria, s), pct }
    })
    .sort((x, y) => y.pct - x.pct), [budgets, month, transactions, base, s])

  if (items.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3 -mt-1">
      {items.map(({ b, cat, pct }, i) => {
        const color = pct >= 100 ? '#b4533f' : pct >= 80 ? '#b8873b' : '#4e7d5b'
        return (
          <motion.div
            key={b.id ?? b.categoria}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex-shrink-0 glass rounded-2xl pl-1.5 pr-3 py-1.5 flex items-center gap-2"
          >
            <div className="relative w-9 h-9">
              <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                <circle cx="18" cy="18" r={R} fill="none" stroke="var(--color-gray-200)" strokeWidth="3.5" />
                <motion.circle
                  cx="18" cy="18" r={R} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={{ strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: CIRC * (1 - Math.min(pct, 100) / 100) }}
                  transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.15 + i * 0.05 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center" style={{ color: cat?.color ?? color }}>
                <CategoryIcon cat={cat ?? { id: b.categoria }} size={13} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-700 leading-tight max-w-[92px] truncate">{cat?.nombre ?? b.categoria}</p>
              <p className="text-[11px] font-bold tabular-nums leading-tight" style={{ color }}>
                {Math.round(pct)}%
              </p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
