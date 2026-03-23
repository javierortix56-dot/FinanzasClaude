'use client'

import { Transaction } from '@/types'
import { useUIStore } from '@/store/useUIStore'
import { getCategoryById, formatAmount } from '@/lib/constants'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  tx: Transaction
  userName?: string
}

export default function TransactionItem({ tx, userName }: Props) {
  const { openEditModal } = useUIStore()
  const cat = getCategoryById(tx.categoria)
  const dotColor = tx.tipo === 'ingreso' ? '#22c55e' : '#ef4444'

  const date = tx.fecha.toDate()
  const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  return (
    <button
      onClick={() => openEditModal(tx)}
      className="w-full flex items-center gap-2.5 py-2 px-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate leading-tight">
          {tx.descripcion || cat?.nombre || tx.categoria}
        </p>
        <p className="text-[10px] text-gray-400 leading-tight mt-px truncate">
          {dateStr}{userName ? ` · ${userName}` : ''}
        </p>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5">
        <p className={`text-xs font-semibold tabular-nums ${tx.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
          {tx.tipo === 'ingreso' ? '+' : '-'}{formatAmount(tx.monto, tx.moneda)}
        </p>
        {tx.ejecutado
          ? <CheckCircle2 size={11} className="text-green-400 flex-shrink-0" />
          : <div className="w-[11px] h-[11px] rounded-full border border-gray-200 flex-shrink-0" />
        }
      </div>
    </button>
  )
}
