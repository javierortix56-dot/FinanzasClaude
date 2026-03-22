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

  const totalIngresos = transactions
    .filter((t) => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const totalEgresos = transactions
    .filter((t) => t.tipo === 'egreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const balance    = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s)

  const blurClass = hideAmounts ? 'blur-sm select-none' : ''

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── HEADER (purple) ── */}
      <div className="bg-[#534AB7] px-4 pt-10 pb-7">

        {/* Row: avatar + greeting | controls + rates */}
        <div className="flex items-start justify-between mb-5">

          {/* Left: avatar + greeting */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">J&M</span>
            </div>
            <div>
              <p className="text-white font-semibold text-base leading-tight">Buen día, Javier</p>
              <p className="text-white/60 text-xs capitalize mt-0.5">{monthLabel(currentMonth)}</p>
            </div>
          </div>

          {/* Right: controls + rate chips */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleHideAmounts}
                className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1.5 text-white/80 text-xs font-medium"
              >
                {hideAmounts ? <EyeOff size={11} /> : <Eye size={11} />}
                <span>{hideAmounts ? 'Mostrar' : 'Ocultar'}</span>
              </button>
              <button onClick={prevMonth} className="p-1.5 bg-white/10 rounded-full">
                <ChevronLeft size={14} className="text-white/80" />
              </button>
              <button onClick={nextMonth} className="p-1.5 bg-white/10 rounded-full">
                <ChevronRight size={14} className="text-white/80" />
              </button>
            </div>
            <div className="flex gap-1.5">
              <span className="bg-white/10 text-white/70 text-[11px] font-medium px-2.5 py-1 rounded-full">
                ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}
              </span>
              <span className="bg-white/10 text-white/70 text-[11px] font-medium px-2.5 py-1 rounded-full">
                COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div>
          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1">Balance del mes</p>
          <p className={`text-white text-3xl font-bold leading-tight transition-all ${blurClass}`}>
            {formatAmount(balance, base)}
          </p>
          <p className={`text-white/50 text-xs mt-0.5 transition-all ${blurClass}`}>
            = {formatAmount(balanceUSD, 'USD')}
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT CARD ── */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 overflow-hidden flex flex-col">

        {/* Ingresos / Gastos chips */}
        <div className="grid grid-cols-2 gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="bg-green-50 rounded-2xl px-4 py-3">
            <p className="text-green-700 text-[10px] font-bold uppercase tracking-wide mb-1">Ingresos</p>
            <p className={`text-green-700 font-bold text-sm transition-all ${blurClass}`}>
              {formatAmount(totalIngresos, base)}
            </p>
          </div>
          <div className="bg-red-50 rounded-2xl px-4 py-3">
            <p className="text-red-600 text-[10px] font-bold uppercase tracking-wide mb-1">Gastos</p>
            <p className={`text-red-600 font-bold text-sm transition-all ${blurClass}`}>
              {formatAmount(totalEgresos, base)}
            </p>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-2">
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
                  <span className="text-sm text-gray-400">Buscar movimientos...</span>
                </button>
              )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-4 pt-2 pb-0 border-b border-gray-50">
              {(['ingreso', 'egreso'] as SubTab[]).map((t) => (
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
