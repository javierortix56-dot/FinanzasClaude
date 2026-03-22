'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTransactionStore } from '@/store/useTransactionStore'
import { subscribeToTransactions } from '@/lib/transactions'
import SwipeableItem from './SwipeableItem'
import { Transaction } from '@/types'
import { getCategoryById } from '@/lib/constants'

interface Props {
  filter?: 'all' | 'ingreso' | 'egreso'
  search?: string
}

export default function TransactionList({ filter = 'all', search = '' }: Props) {
  const { transactions, currentMonth, setTransactions, isLoading } = useTransactionStore()
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  // Subscribe to Firestore on month change
  useEffect(() => {
    const unsub = subscribeToTransactions(currentMonth, setTransactions)
    return () => unsub()
  }, [currentMonth, setTransactions])

  // Fetch user names once
  useEffect(() => {
    getDocs(collection(db, 'users')).then((snap) => {
      const map: Record<string, string> = {}
      snap.docs.forEach((d) => {
        map[d.id] = (d.data() as { nombre: string }).nombre
      })
      setUserNames(map)
    })
  }, [])

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
        (userNames[t.creadoPor] ?? '').toLowerCase().includes(q) ||
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
        <SwipeableItem key={tx.id} tx={tx} userName={userNames[tx.creadoPor]} />
      ))}
    </div>
  )
}
