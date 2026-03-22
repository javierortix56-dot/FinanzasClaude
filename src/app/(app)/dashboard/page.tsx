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

function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings, hideAmounts, toggleHideAmounts } = useSettingsStore()
  const { transactions, currentMonth, prevMonth, nextMonth } = useTransactionStore()

  const [mainTab, setMainTab] = useState<MainTab>('movimientos')
  const [subTab, setSubTab]   = useState<SubTab>('ingreso')
  const [search, setSearch]   = useState('')
  const [searching, setSearching] = useState(false)

  const s    = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const totalIngresos = transactions
    .filter((t) => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const totalEgresos = transactions
    .filter((t) => t.tipo === 'egreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const balance    = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s)
  const blur       = hideAmounts ? 'blur-sm select-none' : ''

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── HEADER ── */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">

        {/* Row 1: avatar · greeting · controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#534AB7] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">J&M</span>
            </div>
            <div>
              <p className="text-gray-800 font-semibold text-sm leading-tight">
                {greet()}, Javier
              </p>
              <p className="text-gray-400 text-xs capitalize">{monthLabel(currentMonth)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleHideAmounts}
              className="flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1.5 text-gray-500 text-xs font-medium"
            >
              {hideAmounts ? <EyeOff size={11} /> : <Eye size={11} />}
              <span>{hideAmounts ? 'Mostrar' : 'Ocultar'}</span>
            </button>
            <button onClick={prevMonth} className="p-1.5 border border-gray-200 rounded-full">
              <ChevronLeft size={13} className="text-gray-500" />
            </button>
            <button onClick={nextMonth} className="p-1.5 border border-gray-200 rounded-full">
              <ChevronRight size={13} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Row 2: rate pills (right-aligned) */}
        <div className="flex justify-end gap-1.5 mb-4">
          <span className="bg-gray-100 text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-full">
            ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}
          </span>
          <span className="bg-gray-100 text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-full">
            COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </span>
        </div>

        {/* Balance */}
        <div className="mb-4">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest mb-0.5">
            Balance del mes
          </p>
          <p className={`text-gray-900 text-3xl font-bold leading-tight ${blur}`}>
            {formatAmount(balance, base)}
          </p>
          <p className={`text-gray-400 text-xs mt-0.5 ${blur}`}>
            = {formatAmount(balanceUSD, 'USD')}
          </p>
        </div>

        {/* Ingresos / Gastos chips */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-2xl px-4 py-3">
            <p className="text-green-700 text-[10px] font-bold uppercase tracking-wide mb-1">
              Ingresos
            </p>
            <p className={`text-green-700 font-bold text-sm ${blur}`}>
              {formatAmount(totalIngresos, base)}
            </p>
          </div>
          <div className="bg-red-50 rounded-2xl px-4 py-3">
            <p className="text-red-600 text-[10px] font-bold uppercase tracking-wide mb-1">
              Gastos
            </p>
            <p className={`text-red-600 font-bold text-sm ${blur}`}>
              {formatAmount(totalEgresos, base)}
            </p>
          </div>
        </div>
      </div>

      {/* ── CONTENT CARD ── */}
      <div className="flex-1 bg-white mt-2 overflow-hidden flex flex-col">

        {/* Main tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3">
          {(['movimientos', 'asignacion'] as MainTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`flex-1 pb-2.5 text-sm font-semibold transition-colors ${
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
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-50">
              {searching ? (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    placeholder="Buscar movimiento..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none text-gray-900 placeholder:text-gray-400"
                  />
                  <button onClick={() => { setSearch(''); setSearching(false) }}>
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearching(true)}
                  className="flex items-center gap-2 w-full bg-gray-50 rounded-xl px-3 py-2"
                >
                  <Search size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-400">Buscar movimientos...</span>
                </button>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-4 pt-2 border-b border-gray-50">
              {(['ingreso', 'egreso'] as SubTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                    subTab === t
                      ? t === 'egreso'
                        ? 'text-red-500 border-b-2 border-red-400'
                        : 'text-green-600 border-b-2 border-green-500'
                      : 'text-gray-400'
                  }`}
                >
                  {t === 'egreso' ? 'Egresos' : 'Ingresos'}
                </button>
              ))}
            </div>

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
