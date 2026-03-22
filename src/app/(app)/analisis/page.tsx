'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { monthLabel } from '@/lib/constants'
import HistoricoTab from '@/components/analisis/HistoricoTab'
import PilotoTab    from '@/components/analisis/PilotoTab'

type Tab = 'historico' | 'piloto'

export default function AnalisisPage() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const [tab, setTab] = useState<Tab>('historico')

  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-[#534AB7] px-4 pt-10 pb-5">
        <h1 className="text-xl font-bold text-white mb-4">Análisis</h1>
        <div className="flex items-center justify-between">
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
      </div>

      {/* ── Main card ── */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-3 overflow-hidden flex flex-col">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-1">
          {(['historico', 'piloto'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'text-[#534AB7] border-b-2 border-[#534AB7]'
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
