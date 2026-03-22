'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import TransactionList from '@/components/transactions/TransactionList'
import AssignmentTab from '@/components/assignment/AssignmentTab'
import { monthLabel, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Currency } from '@/types'

type MainTab = 'movimientos' | 'asignacion'
type SubTab  = 'egreso' | 'ingreso'

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings, hideAmounts, toggleHideAmounts } = useSettingsStore()
  const { transactions, currentMonth, prevMonth, nextMonth } = useTransactionStore()

  const [mainTab, setMainTab]   = useState<MainTab>('movimientos')
  const [subTab, setSubTab]     = useState<SubTab>('egreso')
  const [search, setSearch]     = useState('')
  const [searching, setSearching] = useState(false)

  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  // Compute totals in base currency
  const totalIngresos = transactions
    .filter((t) => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const totalEgresos = transactions
    .filter((t) => t.tipo === 'egreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const balance     = totalIngresos - totalEgresos
  const balanceUSD  = toBase(balance, base, 'USD', s)

  const blurClass = hideAmounts ? 'blur-sm select-none' : ''

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── HEADER (purple) ── */}
      <div className="bg-[#534AB7] px-4 pt-10 pb-6">

        {/* Row 1: avatar + greeting + eye */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">J&M</span>
            </div>
            <div>
              <p className="text-white/70 text-xs">Hola,</p>
              <p className="text-white font-semibold text-sm leading-tight">Javier & Mary</p>
            </div>
          </div>
          <button
            onClick={toggleHideAmounts}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={hideAmounts ? 'Mostrar cifras' : 'Ocultar cifras'}
          >
            {hideAmounts
              ? <EyeOff size={18} className="text-white" />
              : <Eye    size={18} className="text-white" />
            }
          </button>
        </div>

        {/* Row 2: month nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <ChevronLeft size={18} className="text-white/80" />
          </button>
          <span className="text-white font-semibold text-sm capitalize">
            {monthLabel(currentMonth)}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
            <ChevronRight size={18} className="text-white/80" />
          </button>
        </div>

        {/* Balance card */}
        <div className="bg-white/15 rounded-2xl px-4 py-4 mb-4">
          <p className="text-white/70 text-xs font-medium mb-1">Balance del mes</p>
          <p className={`text-white text-3xl font-bold mb-1 transition-all ${blurClass}`}>
            {formatAmount(balance, base)}
          </p>
          <p className={`text-white/60 text-xs transition-all ${blurClass}`}>
            ≈ {formatAmount(balanceUSD, 'USD')}
          </p>
        </div>

        {/* Income / Expense cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/10 rounded-xl px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white/70 text-xs">Ingresos</span>
            </div>
            <p className={`text-white font-semibold text-base transition-all ${blurClass}`}>
              {formatAmount(totalIngresos, base)}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-white/70 text-xs">Egresos</span>
            </div>
            <p className={`text-white font-semibold text-base transition-all ${blurClass}`}>
              {formatAmount(totalEgresos, base)}
            </p>
          </div>
        </div>

        {/* Exchange rate pills */}
        <div className="flex gap-2 flex-wrap">
          <span className="bg-white/10 text-white/80 text-xs font-medium px-3 py-1 rounded-full">
            USD/ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}
          </span>
          <span className="bg-white/10 text-white/80 text-xs font-medium px-3 py-1 rounded-full">
            USD/COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT CARD ── */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-3 overflow-hidden flex flex-col">

        {/* Main tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3">
          {(['movimientos', 'asignacion'] as MainTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`flex-1 pb-2.5 text-sm font-semibold capitalize transition-colors ${
                mainTab === t
                  ? 'text-[#534AB7] border-b-2 border-[#534AB7]'
                  : 'text-gray-400'
              }`}
            >
              {t === 'movimientos' ? 'Movimientos' : 'Asignación'}
            </button>
          ))}
        </div>

        {mainTab === 'movimientos' ? (
          <>
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-gray-50">
              {searching ? (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Search size={15} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    placeholder="Buscar movimiento..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder:text-gray-400"
                  />
                  <button onClick={() => { setSearch(''); setSearching(false) }}>
                    <X size={15} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearching(true)}
                  className="flex items-center gap-2 w-full bg-gray-50 rounded-xl px-3 py-2"
                >
                  <Search size={15} className="text-gray-400" />
                  <span className="text-sm text-gray-400">Buscar movimiento...</span>
                </button>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-gray-50">
              {(['egreso', 'ingreso'] as SubTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    subTab === t
                      ? t === 'egreso'
                        ? 'text-red-500 border-b-2 border-red-400 bg-red-50/50'
                        : 'text-green-600 border-b-2 border-green-500 bg-green-50/50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t === 'egreso' ? 'Egresos' : 'Ingresos'}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              <TransactionList filter={subTab} search={search} />
            </div>
          </>
        ) : (
          <AssignmentTab />
        )}
      </div>
    </div>
  )
}
