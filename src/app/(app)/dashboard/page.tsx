'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, X, PiggyBank } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import TAccountView from '@/components/transactions/TAccountView'
import AssignmentTab from '@/components/assignment/AssignmentTab'
import AhorrarModal from '@/components/transactions/AhorrarModal'
import { monthLabel, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Currency } from '@/types'

type MainTab = 'movimientos' | 'asignacion'

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings, hideAmounts, toggleHideAmounts } = useSettingsStore()
  const { transactions, currentMonth, prevMonth, nextMonth } = useTransactionStore()

  const [mainTab, setMainTab] = useState<MainTab>('movimientos')
  const [search, setSearch]   = useState('')
  const [searching, setSearching] = useState(false)
  const [ahorrarOpen, setAhorrarOpen] = useState(false)

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
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── HEADER compacto ── */}
      <div className="bg-white px-4 pt-10 pb-2 shadow-sm">

        {/* Fila única: avatar · mes · nav · ojo · rates */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#534AB7] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-[9px]">J&M</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={prevMonth} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
              <ChevronLeft size={12} className="text-gray-400" />
            </button>
            <p className="text-gray-700 font-semibold text-xs capitalize leading-none whitespace-nowrap">
              {monthLabel(currentMonth)}
            </p>
            <button onClick={nextMonth} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
              <ChevronRight size={12} className="text-gray-400" />
            </button>
          </div>
          <div className="flex-1" />
          <span className="bg-gray-100 text-gray-400 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
            ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}
          </span>
          <span className="bg-gray-100 text-gray-400 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
            COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </span>
          <button
            onClick={toggleHideAmounts}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            title={hideAmounts ? 'Mostrar' : 'Ocultar'}
          >
            {hideAmounts ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
          </button>
        </div>

        {/* Balance + stats inline */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-gray-900 text-2xl font-black leading-none tabular-nums ${blur}`}>
                {formatAmount(balance, base)}
              </p>
              <button
                onClick={() => setAhorrarOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#534AB7]/10 hover:bg-[#534AB7]/20 transition-colors"
                title="Ahorrar"
              >
                <PiggyBank size={13} className="text-[#534AB7]" />
                <span className="text-[10px] font-semibold text-[#534AB7]">Ahorrar</span>
              </button>
            </div>
            <div className={`flex items-center gap-2 mt-1 ${blur}`}>
              <span className="flex items-center gap-0.5 text-[11px] text-green-600 font-semibold">
                <span className="text-[9px]">▲</span>{formatAmount(totalIngresos, base)}
              </span>
              <span className="text-gray-200 text-xs">|</span>
              <span className="flex items-center gap-0.5 text-[11px] text-red-500 font-semibold">
                <span className="text-[9px]">▼</span>{formatAmount(totalEgresos, base)}
              </span>
              <span className="text-gray-200 text-xs">|</span>
              <span className="text-[11px] text-gray-400">{formatAmount(balanceUSD, 'USD')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT CARD ── */}
      <div className="flex-1 min-h-0 bg-white mt-2 overflow-hidden flex flex-col">

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
            <div className="px-4 py-2 border-b border-gray-50">
              {searching ? (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                  <Search size={13} className="text-gray-400 flex-shrink-0" />
                  <input
                    autoFocus
                    placeholder="Buscar movimiento..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs outline-none text-gray-900 placeholder:text-gray-400"
                  />
                  <button onClick={() => { setSearch(''); setSearching(false) }}>
                    <X size={13} className="text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearching(true)}
                  className="flex items-center gap-2 w-full bg-gray-50 rounded-lg px-3 py-1.5"
                >
                  <Search size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-400">Buscar movimientos...</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <TAccountView search={search} />
            </div>
          </>
        ) : (
          <AssignmentTab />
        )}
      </div>

      <AhorrarModal open={ahorrarOpen} onClose={() => setAhorrarOpen(false)} />
    </div>
  )
}
