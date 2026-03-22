'use client'

import { useEffect, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTransactionStore } from '@/store/useTransactionStore'
import { subscribeToTransactions } from '@/lib/transactions'
import TransactionItem from './TransactionItem'
import { Transaction } from '@/types'

interface Props {
  filter?: 'all' | 'ingreso' | 'egreso'
}

export default function TransactionList({ filter = 'all' }: Props) {
  const { transactions, currentMonth, setTransactions, isLoading } = useTransactionStore()

  // Subscribe to Firestore on month change
  useEffect(() => {
    const unsub = subscribeToTransactions(currentMonth, setTransactions)
    return () => unsub()
  }, [currentMonth, setTransactions])

  // User name cache
  const userNames = useMemo(() => {
    const map: Record<string, string> = {}
    getDocs(collection(db, 'users')).then((snap) => {
      snap.docs.forEach((d) => {
        map[d.id] = (d.data() as { nombre: string }).nombre
      })
    })
    return map
  }, [])

  const filtered: Transaction[] =
    filter === 'all' ? transactions : transactions.filter((t) => t.tipo === filter)

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
        <p className="text-gray-400 text-sm">Sin movimientos</p>
        <p className="text-gray-300 text-xs mt-1">Tocá + para agregar uno</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {filtered.map((tx) => (
        <TransactionItem key={tx.id} tx={tx} userName={userNames[tx.creadoPor]} />
      ))}
    </div>
  )
}
