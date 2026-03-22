'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useAuthStore } from '@/store/useAuthStore'
import TransactionList from '@/components/transactions/TransactionList'
import { monthLabel, formatAmount } from '@/lib/constants'
import { useState } from 'react'

type Tab = 'ingreso' | 'egreso'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { transactions, currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const [tab, setTab] = useState<Tab>('egreso')

  const firstName = user?.email?.split('@')[0] ?? 'Usuario'

  const totalIngresos = transactions
    .filter((t) => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + t.monto, 0)

  const totalEgresos = transactions
    .filter((t) => t.tipo === 'egreso')
    .reduce((sum, t) => sum + t.monto, 0)

  // Use the moneda of the first transaction as a rough "base currency" for the summary
  const monedaRef = transactions[0]?.moneda ?? 'ARS'

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <p className="text-xs text-gray-400 mb-0.5">Hola,</p>
        <h1 className="text-xl font-bold text-gray-900 capitalize mb-4">{firstName} 👋</h1>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-700 capitalize">
            {monthLabel(currentMonth)}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-xs font-medium text-green-600 mb-1">Ingresos</p>
            <p className="text-lg font-bold text-green-700">
              {formatAmount(totalIngresos, monedaRef)}
            </p>
          </div>
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-xs font-medium text-red-500 mb-1">Egresos</p>
            <p className="text-lg font-bold text-red-600">
              {formatAmount(totalEgresos, monedaRef)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="flex gap-1 pt-2">
          {(['egreso', 'ingreso'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors capitalize ${
                tab === t
                  ? t === 'egreso'
                    ? 'text-red-500 border-b-2 border-red-400'
                    : 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'egreso' ? 'Egresos' : 'Ingresos'}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex-1 bg-white mt-1 rounded-t-2xl overflow-hidden">
        <TransactionList filter={tab} />
      </div>
    </div>
  )
}
