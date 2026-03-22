'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchMonthTransactions } from '@/lib/analytics'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { shiftMonth, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { Transaction, Currency } from '@/types'

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

function ProjectionCard({ label, projected, previous, currency, higherIsBetter = true }: CardProps) {
  const diff = previous === 0 ? 0 : ((projected - previous) / previous) * 100
  const improved = higherIsBetter ? projected >= previous : projected <= previous

  const Icon = diff === 0 ? Minus : improved ? TrendingUp : TrendingDown
  const color = diff === 0 ? 'text-gray-400' : improved ? 'text-green-500' : 'text-red-500'

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
      <p className="text-xl font-bold text-gray-900 mb-1">
        {formatAmount(projected, currency)}
      </p>
      <div className="flex items-center gap-1">
        <Icon size={13} className={color} />
        <span className={`text-xs font-semibold ${color}`}>
          {diff === 0 ? 'Sin cambio' : `${Math.abs(diff).toFixed(0)}% vs mes anterior`}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">
        Mes anterior: {formatAmount(previous, currency)}
      </p>
    </div>
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
      (acc, t) => acc + toBase(t.monto, t.moneda, base, s), 0
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
    <div className="overflow-y-auto px-4 pt-4 pb-8">
      {/* Progress indicator */}
      {isCurrentMonth && (
        <div className="mb-5 bg-[#534AB7]/5 rounded-2xl px-4 py-3 border border-[#534AB7]/10">
          <div className="flex justify-between mb-1.5">
            <p className="text-xs font-semibold text-[#534AB7]">Avance del mes</p>
            <p className="text-xs font-bold text-[#534AB7]">
              Día {daysPassed} de {totalDays} ({Math.round(completionPct * 100)}%)
            </p>
          </div>
          <div className="h-2 bg-[#534AB7]/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#534AB7] rounded-full"
              style={{ width: `${completionPct * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#534AB7]/60 mt-1.5">
            Proyección basada en el ritmo de gasto actual
          </p>
        </div>
      )}

      {!isCurrentMonth && (
        <div className="mb-4 bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-400 text-center">
            Las proyecciones solo están disponibles para el mes actual
          </p>
        </div>
      )}

      {/* Projection cards */}
      <div className="space-y-3">
        <ProjectionCard
          label={isCurrentMonth ? 'Proyección ingresos' : 'Ingresos del mes'}
          projected={projInc}
          previous={prevInc}
          currency={base}
          higherIsBetter
        />
        <ProjectionCard
          label={isCurrentMonth ? 'Proyección egresos' : 'Egresos del mes'}
          projected={projExp}
          previous={prevExp}
          currency={base}
          higherIsBetter={false}
        />
        <ProjectionCard
          label={isCurrentMonth ? 'Proyección balance' : 'Balance del mes'}
          projected={projBal}
          previous={prevBal}
          currency={base}
          higherIsBetter
        />
      </div>
    </div>
  )
}
