'use client'

import { useTransactionStore } from '@/store/useTransactionStore'
import SwipeableItem from './SwipeableItem'
import { Transaction } from '@/types'
import { getCategoryById, SHARED_USERS } from '@/lib/constants'

interface Props {
  filter?: 'all' | 'ingreso' | 'egreso'
  search?: string
}

const USER_NAMES: Record<string, string> = Object.fromEntries(
  SHARED_USERS.map((u) => [u.id, u.nombre])
)

export default function TransactionList({ filter = 'all', search = '' }: Props) {
  const { transactions, isLoading } = useTransactionStore()

  const filtered: Transaction[] = transactions
    .filter((t) => filter === 'all' || t.tipo === filter)
    .filter((t) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const cat = getCategoryById(t.categoria)
      return (
        t.descripcion.toLowerCase().includes(q) ||
        cat?.nombre.toLowerCase().includes(q) ||
        t.moneda.toLowerCase().includes(q) ||
        (USER_NAMES[t.creadoPor] ?? '').toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-14">
        <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center px-6">
        <p className="text-gray-400 text-sm">
          {search ? 'Sin resultados para esa búsqueda' : 'Sin movimientos'}
        </p>
        {!search && <p className="text-gray-300 text-xs mt-1">Tocá + para agregar uno</p>}
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {filtered.map((tx) => (
        <SwipeableItem key={tx.id} tx={tx} userName={USER_NAMES[tx.creadoPor]} />
      ))}
    </div>
  )
}
