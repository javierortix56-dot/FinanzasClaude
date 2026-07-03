'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { monthLabel } from '@finanzas/core/lib/constants'
import HistoricoTab from '@/components/analisis/HistoricoTab'
import PilotoTab    from '@/components/analisis/PilotoTab'

type Tab = 'historico' | 'piloto'

export default function AnalisisPage() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const [tab, setTab] = useState<Tab>('historico')

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-surface px-4 pt-10 pb-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-gray-800 font-bold text-xl">Análisis</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 border border-gray-200 rounded-full">
              <ChevronLeft size={13} className="text-gray-500" />
            </button>
            <span className="text-gray-600 text-xs font-medium px-2 capitalize">
              {monthLabel(currentMonth)}
            </span>
            <button onClick={nextMonth} className="p-1.5 border border-gray-200 rounded-full">
              <ChevronRight size={13} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="flex-1 min-h-0 bg-surface overflow-hidden flex flex-col">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-1">
          {(['historico', 'piloto'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-400'
              }`}
            >
              {t === 'historico' ? 'Histórico' : 'Piloto'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === 'historico' ? <HistoricoTab /> : <PilotoTab />}
        </div>
      </div>
    </div>
  )
}
