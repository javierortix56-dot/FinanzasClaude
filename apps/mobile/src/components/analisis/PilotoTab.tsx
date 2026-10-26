'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { fetchMonthTransactions } from '@finanzas/core/lib/analytics'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { shiftMonth } from '@finanzas/core/lib/constants'
import { txToBase } from '@finanzas/core/lib/currency'
import { Transaction, Currency } from '@finanzas/core/types'
import { motion } from 'motion/react'
import { Money } from '@/components/ui/AnimatedNumber'
import ProgressBar from '@/components/ui/ProgressBar'
import Card from '@/components/ui/Card'

function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function todayDayNumber() {
  return new Date().getDate()
}

interface CardProps {
  label: string
  projected: number
  previous: number
  currency: string
  higherIsBetter?: boolean
}

function ProjectionCard({ label, projected, previous, currency, higherIsBetter = true, index = 0 }: CardProps & { index?: number }) {
  const diff = previous === 0 ? 0 : ((projected - previous) / previous) * 100
  const improved = higherIsBetter ? projected >= previous : projected <= previous

  const Icon = diff === 0 ? Minus : improved ? TrendingUp : TrendingDown
  const tone = diff === 0
    ? 'bg-gray-500/10 text-gray-500'
    : improved ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-[24px] p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">{label}</p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${tone}`}>
          <Icon size={12} />
          {diff === 0 ? 'Sin cambio' : `${Math.abs(diff).toFixed(0)}%`}
        </span>
      </div>
      <p className="text-[26px] font-bold tracking-tight text-gray-900 leading-tight">
        <Money value={projected} currency={currency} />
      </p>
      <p className="text-[11px] text-gray-400 mt-1">
        Mes anterior: <Money value={previous} currency={currency} animated={false} className="font-semibold text-gray-500" />
      </p>
    </motion.div>
  )
}

export default function PilotoTab() {
  const { transactions, currentMonth } = useTransactionStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const s    = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [prevTxs, setPrevTxs] = useState<Transaction[]>([])

  const prevMonth = shiftMonth(currentMonth, -1)
  useEffect(() => {
    fetchMonthTransactions(prevMonth).then(setPrevTxs)
  }, [prevMonth])

  // Progress of current month
  const totalDays   = daysInMonth(currentMonth)
  const daysPassed  = Math.min(todayDayNumber(), totalDays)
  const completionPct = daysPassed / totalDays
  const isCurrentMonth = currentMonth === (() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()

  function sumBase(txs: Transaction[], tipo: 'ingreso' | 'egreso') {
    return txs.filter((t) => t.tipo === tipo).reduce(
      (acc, t) => acc + txToBase(t, base, s), 0
    )
  }

  const curInc  = sumBase(transactions, 'ingreso')
  const curExp  = sumBase(transactions, 'egreso')
  const prevInc = sumBase(prevTxs, 'ingreso')
  const prevExp = sumBase(prevTxs, 'egreso')

  // Project only if viewing current month and we have some data
  const projInc = isCurrentMonth && completionPct > 0 ? curInc / completionPct : curInc
  const projExp = isCurrentMonth && completionPct > 0 ? curExp / completionPct : curExp
  const projBal = projInc - projExp
  const prevBal = prevInc - prevExp

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-1 pb-28 space-y-3 no-scrollbar">
      {/* Progress indicator */}
      {isCurrentMonth ? (
        <Card>
          <div className="flex justify-between items-baseline mb-2">
            <p className="eyebrow !text-primary">Avance del mes</p>
            <p className="text-xs font-bold text-primary tabular-nums">
              Día {daysPassed} de {totalDays} · {Math.round(completionPct * 100)}%
            </p>
          </div>
          <ProgressBar
            value={completionPct * 100}
            color="linear-gradient(90deg, var(--primary-2), var(--primary))"
            trackClassName="bg-primary/10"
            height={8}
          />
          <p className="text-[11px] text-gray-400 mt-2">
            Proyección basada en el ritmo de gasto actual
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-xs text-gray-400 text-center">
            Las proyecciones solo están disponibles para el mes actual
          </p>
        </Card>
      )}

      {/* Projection cards */}
      <ProjectionCard
        index={0}
        label={isCurrentMonth ? 'Proyección ingresos' : 'Ingresos del mes'}
        projected={projInc}
        previous={prevInc}
        currency={base}
        higherIsBetter
      />
      <ProjectionCard
        index={1}
        label={isCurrentMonth ? 'Proyección egresos' : 'Egresos del mes'}
        projected={projExp}
        previous={prevExp}
        currency={base}
        higherIsBetter={false}
      />
      <ProjectionCard
        index={2}
        label={isCurrentMonth ? 'Proyección balance' : 'Balance del mes'}
        projected={projBal}
        previous={prevBal}
        currency={base}
        higherIsBetter
      />
    </div>
  )
}
