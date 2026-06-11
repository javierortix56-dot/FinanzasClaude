'use client'

import { useRef, useState } from 'react'
import { CheckCheck, Edit3, Trash2, Unlink, CheckCircle2, Link2 } from 'lucide-react'
import { Transaction } from '@finanzas/core/types'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { markEjecutado, deleteTransaction, updateTransaction } from '@finanzas/core/lib/transactions'
import { getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency } from '@finanzas/core/types'

interface Props {
  tx: Transaction
}

const THRESHOLD = 65
const RIGHT_OPEN = 170

export default function SwipeableItem({ tx }: Props) {
  const { openEditModal } = useUIStore()
  const { hideAmounts, settings } = useSettingsStore()
  const { transactions } = useTransactionStore()
  const { monedaBase } = useAuthStore()
  const cat = getCatFromSettings(tx.categoria, settings ?? null)
  const base = monedaBase as Currency
  const montoBase = toBase(tx.monto, tx.moneda, base, settings ?? DEFAULT_SETTINGS)

  // Para egresos: buscar el ingreso vinculado
  const linkedIngreso = tx.tipo === 'egreso' && tx.asignadoA
    ? transactions.find((t) => t.id === tx.asignadoA)
    : null

  const [offset, setOffset] = useState(0)
  const [held, setHeld] = useState<'left' | 'right' | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const startX = useRef(0)
  const dragging = useRef(false)

  const dotColor = tx.tipo === 'ingreso' ? '#22c55e' : '#f87171'
  const dateStr = tx.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  function onTouchStart(e: React.TouchEvent) {
    if (held) return
    startX.current = e.touches[0].clientX
    dragging.current = true
    setTransitioning(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return
    const delta = e.touches[0].clientX - startX.current
    // left swipe: item goes left (negative), max -80
    // right swipe: item goes right (positive), max RIGHT_OPEN
    if (delta < 0) setOffset(Math.max(delta, -80))
    else setOffset(Math.min(delta, RIGHT_OPEN))
  }

  async function onTouchEnd() {
    dragging.current = false
    setTransitioning(true)

    if (offset <= -THRESHOLD) {
      // Left swipe → toggle ejecutado
      setOffset(0)
      await markEjecutado(tx.id!, !tx.ejecutado)
    } else if (offset >= THRESHOLD) {
      // Right swipe → hold open action menu
      setOffset(RIGHT_OPEN)
      setHeld('right')
    } else {
      setOffset(0)
    }
  }

  function closeMenu() {
    setTransitioning(true)
    setOffset(0)
    setHeld(null)
  }

  async function handleDelete() {
    closeMenu()
    await deleteTransaction(tx.id!)
  }

  async function handleDesasignar() {
    closeMenu()
    await updateTransaction(tx.id!, { asignadoA: null })
  }

  return (
    <div className="relative overflow-hidden select-none">
      {/* ── Left strip: ejecutado (revealed by left swipe) ── */}
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-green-500">
        <div className="flex flex-col items-center gap-1">
          <CheckCheck size={20} color="white" />
          <span className="text-white text-[10px] font-semibold">
            {tx.ejecutado ? 'Pendiente' : 'Ejecutado'}
          </span>
        </div>
      </div>

      {/* ── Right strip: actions (revealed by right swipe) ── */}
      <div className="absolute inset-y-0 left-0 flex items-stretch bg-gray-50">
        <button
          onTouchEnd={(e) => { e.stopPropagation(); openEditModal(tx); closeMenu() }}
          onClick={() => { openEditModal(tx); closeMenu() }}
          className="flex flex-col items-center justify-center gap-1 px-4 hover:bg-[#534AB7]/10 transition-colors"
        >
          <Edit3 size={17} className="text-[#534AB7]" />
          <span className="text-[10px] font-medium text-[#534AB7]">Editar</span>
        </button>
        <button
          onTouchEnd={(e) => { e.stopPropagation(); handleDelete() }}
          onClick={handleDelete}
          className="flex flex-col items-center justify-center gap-1 px-4 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={17} className="text-red-400" />
          <span className="text-[10px] font-medium text-red-400">Eliminar</span>
        </button>
        {tx.asignadoA && (
          <button
            onTouchEnd={(e) => { e.stopPropagation(); handleDesasignar() }}
            onClick={handleDesasignar}
            className="flex flex-col items-center justify-center gap-1 px-4 hover:bg-orange-50 transition-colors"
          >
            <Unlink size={17} className="text-orange-400" />
            <span className="text-[10px] font-medium text-orange-400">Desasignar</span>
          </button>
        )}
      </div>

      {/* ── Main row ── */}
      <div
        className={`relative bg-white flex items-center gap-2.5 py-2 px-4 ${tx.ejecutado ? 'opacity-50' : ''}`}
        style={{
          transform: `translateX(${offset}px)`,
          // `transitioning` ya es false durante el drag (onTouchStart lo
          // apaga), así que no hace falta leer el ref durante el render.
          transition: transitioning ? 'transform 0.2s ease' : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (held) { closeMenu(); return }
          openEditModal(tx)
        }}
      >
        {/* Dot */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />

        {/* Description + meta */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium text-gray-900 truncate leading-tight ${tx.ejecutado ? 'line-through' : ''}`}>
            {tx.descripcion || cat?.nombre || tx.categoria}
          </p>
          <p className="text-[10px] text-gray-400 leading-tight truncate mt-px">
            {dateStr}
            {tx.tipo === 'egreso' && (
              linkedIngreso
                ? <span className="text-[#534AB7] font-medium"> · {linkedIngreso.descripcion?.trim() || getCatFromSettings(linkedIngreso.categoria, settings ?? null)?.nombre || linkedIngreso.categoria}</span>
                : <span className="text-amber-400 font-medium"> · Sin asignar</span>
            )}
          </p>
        </div>

        {/* Amount + status inline */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <p
            className={`text-xs font-semibold tabular-nums leading-tight text-right transition-all ${
              tx.tipo === 'ingreso' ? 'text-green-600' : 'text-red-400'
            } ${hideAmounts ? 'blur-sm' : ''} ${tx.ejecutado ? 'line-through' : ''}`}
          >
            {tx.tipo === 'ingreso' ? '+' : '-'}{formatAmount(montoBase, base)}
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); markEjecutado(tx.id!, !tx.ejecutado) }}
            onTouchEnd={(e) => { e.stopPropagation() }}
            className="p-1 -m-1 flex-shrink-0"
            title={tx.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
          >
            {tx.ejecutado
              ? <CheckCircle2 size={14} className="text-green-500" />
              : <div className="w-[14px] h-[14px] rounded-full border border-gray-300" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
