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
      className="w-full flex items-center gap-3 py-3 px-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      {/* Color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: dotColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {tx.descripcion || cat?.nombre || tx.categoria}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {cat && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ backgroundColor: cat.color + '20', color: cat.color }}
            >
              {cat.nombre}
            </span>
          )}
          <span className="text-xs text-gray-400">{dateStr}</span>
          {userName && (
            <span className="text-xs text-gray-400">· {userName}</span>
          )}
        </div>
      </div>

      {/* Amount + status */}
      <div className="flex-shrink-0 text-right flex flex-col items-end gap-0.5">
        <p
          className={`text-sm font-semibold ${
            tx.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'
          }`}
        >
          {tx.tipo === 'ingreso' ? '+' : '-'}
          {formatAmount(tx.monto, tx.moneda)}
        </p>
        {tx.ejecutado ? (
          <CheckCircle2 size={13} className="text-green-400" />
        ) : (
          <span className="text-[10px] text-gray-400">pendiente</span>
        )}
      </div>
    </button>
  )
}
