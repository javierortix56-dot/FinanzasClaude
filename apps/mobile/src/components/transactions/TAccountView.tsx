'use client'

import { useMemo } from 'react'
import { CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { Transaction, Currency, Settings } from '@finanzas/core/types'
import { getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { markEjecutado } from '@finanzas/core/lib/transactions'

interface TxRowProps {
  tx: Transaction
  hideAmounts: boolean
  settings: Settings | null
  monedaBase: Currency
  onEdit: (tx: Transaction) => void
}

function TxRow({ tx, hideAmounts, settings, monedaBase, onEdit }: TxRowProps) {
  const { transactions } = useTransactionStore()
  const showToast = useUIStore((s) => s.showToast)
  const cat = getCatFromSettings(tx.categoria, settings)

  async function toggleEjecutado() {
    try {
      await markEjecutado(tx.id!, !tx.ejecutado)
    } catch (err) {
      console.error('[TxRow] markEjecutado error:', err)
      showToast(err instanceof Error ? err.message : 'Error al actualizar el estado', 'error')
    }
  }
  const isIngreso = tx.tipo === 'ingreso'
  const dateStr = tx.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const dotColor = cat?.color ?? (isIngreso ? '#22c55e' : '#f87171')
  const montoBase = toBase(tx.monto, tx.moneda, monedaBase, settings ?? DEFAULT_SETTINGS)
  const linkedIngreso = tx.tipo === 'egreso' && tx.asignadoA
    ? transactions.find((t) => t.id === tx.asignadoA)
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(tx)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(tx) }}
      className={`w-full min-w-0 text-left px-2.5 py-2 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors overflow-hidden cursor-pointer ${tx.ejecutado ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <p className={`text-[11px] font-medium text-gray-900 truncate leading-tight flex-1 min-w-0 ${tx.ejecutado ? 'line-through' : ''}`}>
          {tx.descripcion || cat?.nombre || '-'}
        </p>
        {tx.tipo === 'egreso' && (
          linkedIngreso
            ? <span className="text-[9px] font-semibold text-[#534AB7] shrink-0 truncate max-w-[45%]">{linkedIngreso.descripcion?.trim() || getCatFromSettings(linkedIngreso.categoria, settings)?.nombre || linkedIngreso.categoria}</span>
            : <span className="text-[9px] font-semibold text-amber-400 shrink-0">Sin asignar</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5 gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 shrink">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <span className="text-[10px] text-gray-400 truncate">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 max-w-[55%]">
          <div className="flex flex-col items-end min-w-0">
            <span
              className={`text-[11px] font-semibold tabular-nums truncate ${
                isIngreso ? 'text-green-600' : 'text-red-400'
              } ${hideAmounts ? 'blur-sm' : ''} ${tx.ejecutado ? 'line-through' : ''}`}
            >
              {formatAmount(montoBase, monedaBase)}
            </span>
            {tx.moneda !== monedaBase && (
              <span className={`text-[9px] text-gray-400 tabular-nums truncate leading-tight ${hideAmounts ? 'blur-sm' : ''} ${tx.ejecutado ? 'line-through' : ''}`}>
                {formatAmount(tx.monto, tx.moneda)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleEjecutado() }}
            className="p-1 -m-1 flex-shrink-0 inline-flex"
            title={tx.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
          >
            {tx.ejecutado
              ? <CheckCircle2 size={13} className="text-green-500" />
              : <div className="w-[13px] h-[13px] rounded-full border border-gray-300" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ tipo }: { tipo: 'ingreso' | 'egreso' }) {
  const isIngreso = tipo === 'ingreso'
  return (
    <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
        isIngreso ? 'bg-green-50' : 'bg-red-50'
      }`}>
        {isIngreso
          ? <TrendingUp size={20} className="text-green-300" />
          : <TrendingDown size={20} className="text-red-300" />
        }
      </div>
      <p className="text-xs font-medium text-gray-500">
        Sin {isIngreso ? 'ingresos' : 'egresos'}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">Tocá + para agregar</p>
    </div>
  )
}

interface Props {
  search?: string
}

export default function TAccountView({ search = '' }: Props) {
  const { transactions, isLoading } = useTransactionStore()
  const { settings, hideAmounts } = useSettingsStore()
  const { openEditModal } = useUIStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions
    const q = search.toLowerCase()
    return transactions.filter((t) => {
      const cat = getCatFromSettings(t.categoria, settings)
      return (
        t.descripcion.toLowerCase().includes(q) ||
        (cat?.nombre ?? '').toLowerCase().includes(q) ||
        t.moneda.toLowerCase().includes(q)
      )
    })
  }, [transactions, search, settings])

  const ingresos = useMemo(
    () => filtered.filter((t) => t.tipo === 'ingreso').sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [filtered],
  )
  const egresos = useMemo(
    () => filtered.filter((t) => t.tipo === 'egreso').sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime()),
    [filtered],
  )

  const totalIngresos = useMemo(
    () => ingresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0),
    [ingresos, base, s],
  )
  const totalEgresos = useMemo(
    () => egresos.reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0),
    [egresos, base, s],
  )

  const pctGastado = totalIngresos > 0 ? Math.min((totalEgresos / totalIngresos) * 100, 100) : 0
  const pctColor = pctGastado >= 90 ? 'bg-red-400' : pctGastado >= 70 ? 'bg-amber-400' : 'bg-green-500'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-14">
        <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Columna Ingresos ── */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col border-r-2 border-gray-200 overflow-hidden">
        <div className="px-3 py-2.5 bg-green-50 border-b border-green-100 flex-shrink-0">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">
            Ingresos <span className="font-normal opacity-60">({ingresos.length})</span>
          </p>
          <p className={`text-sm font-bold text-green-700 tabular-nums mt-0.5 ${hideAmounts ? 'blur-sm' : ''}`}>
            {formatAmount(totalIngresos, base)}
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {ingresos.length === 0
            ? <EmptyState tipo="ingreso" />
            : ingresos.map((tx) => (
                <TxRow key={tx.id} tx={tx} hideAmounts={hideAmounts} settings={settings} monedaBase={base} onEdit={openEditModal} />
              ))
          }
        </div>
      </div>

      {/* ── Columna Egresos ── */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 bg-red-50 border-b border-red-100 flex-shrink-0">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
            Egresos <span className="font-normal opacity-60">({egresos.length})</span>
          </p>
          <p className={`text-sm font-bold text-red-400 tabular-nums mt-0.5 ${hideAmounts ? 'blur-sm' : ''}`}>
            {formatAmount(totalEgresos, base)}
          </p>
          {/* Barra de progreso: % del ingreso gastado */}
          {totalIngresos > 0 && (
            <div className="mt-1.5">
              <div className="h-1 bg-red-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pctColor}`}
                  style={{ width: `${pctGastado}%` }}
                />
              </div>
              <p className={`text-[9px] text-red-400 mt-0.5 ${hideAmounts ? 'blur-sm' : ''}`}>
                {Math.round(pctGastado)}% del ingreso
              </p>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {egresos.length === 0
            ? <EmptyState tipo="egreso" />
            : egresos.map((tx) => (
                <TxRow key={tx.id} tx={tx} hideAmounts={hideAmounts} settings={settings} monedaBase={base} onEdit={openEditModal} />
              ))
          }
        </div>
      </div>
    </div>
  )
}
