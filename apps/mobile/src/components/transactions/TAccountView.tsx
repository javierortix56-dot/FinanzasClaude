'use client'

import { memo, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { Check, TrendingUp, TrendingDown, Trash2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { Transaction, Currency, Settings } from '@finanzas/core/types'
import { getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { markEjecutado } from '@finanzas/core/lib/transactions'
import { Money } from '@/components/ui/AnimatedNumber'
import { springPop, stagger, pulse } from '@/components/ui/motion'
import { deleteTransactionsWithUndo } from '@/lib/undo'
import { haptic } from '@/lib/haptics'
import { CategoryIcon } from '@/lib/categoryIcons'

/** Distancia de arrastre (px) que dispara la acción del swipe */
const SWIPE_THRESHOLD = 64

interface TxRowProps {
  tx: Transaction
  hideAmounts: boolean
  settings: Settings | null
  monedaBase: Currency
  /** Etiqueta del ingreso al que está asignado el egreso (resuelta en el padre) */
  linkedLabel: string | null
  onEdit: (tx: Transaction) => void
}

// memo + linkedLabel resuelto en el padre: cada fila ya no se suscribe al
// store completo ni re-renderiza cuando cambia cualquier otro movimiento.
const TxRow = memo(function TxRow({ tx, hideAmounts, settings, monedaBase, linkedLabel, onEdit, index }: TxRowProps & { index: number }) {
  const cat = getCatFromSettings(tx.categoria, settings)
  const isIngreso = tx.tipo === 'ingreso'
  const dateStr = tx.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const dotColor = cat?.color ?? (isIngreso ? '#10b981' : '#f43f5e')
  const montoBase = toBase(tx.monto, tx.moneda, monedaBase, settings ?? DEFAULT_SETTINGS)
  const blur = hideAmounts ? 'blur-[5px] select-none' : ''

  // Swipe: derecha = marcar ejecutado/pendiente · izquierda = eliminar (con Deshacer)
  const x = useMotionValue(0)
  const rightOpacity = useTransform(x, [12, SWIPE_THRESHOLD], [0, 1])
  const leftOpacity  = useTransform(x, [-12, -SWIPE_THRESHOLD], [0, 1])
  const iconScale    = useTransform(x, [-SWIPE_THRESHOLD * 1.4, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.4], [1.15, 1, 0.6, 1, 1.15])
  const dragged = useRef(false)
  const armed = useRef(false)

  function handleDrag(_: unknown, info: PanInfo) {
    dragged.current = true
    const past = Math.abs(info.offset.x) > SWIPE_THRESHOLD
    if (past !== armed.current) {
      armed.current = past
      if (past) haptic('light')
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    armed.current = false
    // El click que sigue al soltar no debe abrir el editor
    setTimeout(() => { dragged.current = false }, 0)
    if (info.offset.x > SWIPE_THRESHOLD) {
      haptic('success')
      markEjecutado(tx.id!, !tx.ejecutado)
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      deleteTransactionsWithUndo([tx]).catch((err) => console.error('[swipe] delete error:', err))
    }
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: tx.ejecutado ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.28, delay: stagger(index), ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full min-w-0 mb-1.5 rounded-2xl"
    >
      {/* Acciones que aparecen detrás de la fila al deslizar */}
      <motion.div
        aria-hidden
        style={{ opacity: rightOpacity }}
        className="absolute inset-0 rounded-2xl bg-emerald-500 flex items-center pl-3 text-white"
      >
        <motion.span style={{ scale: iconScale }} className="inline-flex"><Check size={18} strokeWidth={3} /></motion.span>
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: leftOpacity }}
        className="absolute inset-0 rounded-2xl bg-rose-500 flex items-center justify-end pr-3 text-white"
      >
        <motion.span style={{ scale: iconScale }} className="inline-flex"><Trash2 size={17} /></motion.span>
      </motion.div>

    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${tx.descripcion || cat?.nombre || 'Movimiento'}. Deslizá a la derecha para marcar ejecutado, a la izquierda para eliminar.`}
      onClick={() => { if (!dragged.current) onEdit(tx) }}
      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(tx) }}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.55}
      dragSnapToOrigin
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{ x }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full min-w-0 text-left px-2.5 py-2 rounded-2xl bg-surface hover:bg-surface transition-colors overflow-hidden cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      {/* Acento de color de la categoría */}
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: dotColor }} />

      <div className="flex items-center justify-between gap-1 min-w-0">
        <p className={`text-xs font-semibold text-gray-900 truncate leading-tight flex-1 min-w-0 ${tx.ejecutado ? 'line-through' : ''}`}>
          {tx.descripcion || cat?.nombre || '-'}
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); haptic('light'); markEjecutado(tx.id!, !tx.ejecutado) }}
          className="hit-44 p-1 -m-1 flex-shrink-0 inline-flex"
          title={tx.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
          aria-label={tx.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
        >
          <motion.span
            className={`w-4 h-4 rounded-full flex items-center justify-center border ${
              tx.ejecutado ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
            }`}
            animate={{ scale: tx.ejecutado ? [1, 1.25, 1] : 1 }}
            transition={pulse}
          >
            <AnimatePresence>
              {tx.ejecutado && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springPop} className="inline-flex">
                  <Check size={10} strokeWidth={3.5} className="text-white" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
        </button>
      </div>

      <p className={`text-[13px] font-bold tabular-nums truncate mt-1 leading-none ${
        isIngreso ? 'text-emerald-600' : 'text-rose-500'
      } ${blur} ${tx.ejecutado ? 'line-through' : ''}`}>
        {formatAmount(montoBase, monedaBase)}
      </p>

      <div className="flex items-center justify-between mt-1 gap-1 min-w-0">
        <span className="text-[10px] text-gray-400 truncate flex-shrink-0 inline-flex items-center gap-1">
          <span style={{ color: dotColor }} className="inline-flex"><CategoryIcon cat={cat} size={10} /></span>
          {dateStr}
        </span>
        {tx.moneda !== monedaBase ? (
          <span className={`text-[10px] text-gray-400 tabular-nums truncate ${blur}`}>
            {formatAmount(tx.monto, tx.moneda)}
          </span>
        ) : tx.tipo === 'egreso' && (
          linkedLabel
            ? <span className="text-[10px] font-semibold text-primary truncate max-w-[60%]">→ {linkedLabel}</span>
            : <span className="text-[10px] font-semibold text-amber-500 flex-shrink-0">Sin asignar</span>
        )}
      </div>
      {tx.moneda !== monedaBase && tx.tipo === 'egreso' && (
        linkedLabel
          ? <p className="text-[10px] font-semibold text-primary truncate mt-0.5">→ {linkedLabel}</p>
          : <p className="text-[10px] font-semibold text-amber-500 mt-0.5">Sin asignar</p>
      )}
    </motion.div>
    </motion.div>
  )
})

function SkeletonRows() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface/60 px-2.5 py-2.5 space-y-2">
          <div className="skeleton h-2.5 rounded-full w-3/4" />
          <div className="skeleton h-3 rounded-full w-1/2" />
          <div className="skeleton h-2 rounded-full w-1/4" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ tipo }: { tipo: 'ingreso' | 'egreso' }) {
  const isIngreso = tipo === 'ingreso'
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-10 px-3 text-center"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 ${
        isIngreso ? 'bg-emerald-500/10' : 'bg-rose-500/10'
      }`}>
        {isIngreso
          ? <TrendingUp size={22} className="text-emerald-500" />
          : <TrendingDown size={22} className="text-rose-500" />
        }
      </div>
      <p className="text-xs font-semibold text-gray-500">
        Sin {isIngreso ? 'ingresos' : 'egresos'}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5">Tocá + para agregar</p>
    </motion.div>
  )
}

interface Props {
  search?: string
  /** Posición de scroll de la columna que se está desplazando (para compactar el hero) */
  onScrollY?: (y: number) => void
}

export default function TAccountView({ search = '', onScrollY }: Props) {
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

  // Etiqueta del/los ingreso(s) asignados por id, resuelta una sola vez por render.
  // Egresos divididos muestran el primer ingreso + "+N".
  const linkedLabels = useMemo(() => {
    const byId = new Map(transactions.map((t) => [t.id, t]))
    const labels = new Map<string, string>()
    for (const t of transactions) {
      if (t.tipo !== 'egreso' || t.asignaciones.length === 0) continue
      const linked = t.asignaciones
        .map((a) => byId.get(a.ingresoId))
        .filter((ing): ing is Transaction => !!ing)
      if (linked.length === 0) continue
      const first = linked[0]
      let label = first.descripcion?.trim() || getCatFromSettings(first.categoria, settings)?.nombre || first.categoria
      if (linked.length > 1) label += ` +${linked.length - 1}`
      labels.set(t.id!, label)
    }
    return labels
  }, [transactions, settings])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <Column
        tipo="ingreso"
        count={ingresos.length}
        total={totalIngresos}
        base={base}
        onScrollY={onScrollY}
      >
        {isLoading
          ? <SkeletonRows />
          : ingresos.length === 0
            ? <EmptyState tipo="ingreso" />
            : (
              <AnimatePresence initial={true}>
                {ingresos.map((tx, i) => (
                  <TxRow key={tx.id} index={i} tx={tx} hideAmounts={hideAmounts} settings={settings} monedaBase={base} linkedLabel={null} onEdit={openEditModal} />
                ))}
              </AnimatePresence>
            )
        }
      </Column>

      <div className="w-px my-3 bg-hairline flex-shrink-0" />

      <Column
        tipo="egreso"
        count={egresos.length}
        total={totalEgresos}
        base={base}
        onScrollY={onScrollY}
      >
        {isLoading
          ? <SkeletonRows />
          : egresos.length === 0
            ? <EmptyState tipo="egreso" />
            : (
              <AnimatePresence initial={true}>
                {egresos.map((tx, i) => (
                  <TxRow key={tx.id} index={i} tx={tx} hideAmounts={hideAmounts} settings={settings} monedaBase={base} linkedLabel={linkedLabels.get(tx.id!) ?? null} onEdit={openEditModal} />
                ))}
              </AnimatePresence>
            )
        }
      </Column>
    </div>
  )
}

function Column({ tipo, count, total, base, onScrollY, children }: {
  tipo: 'ingreso' | 'egreso'
  count: number
  total: number
  base: Currency
  onScrollY?: (y: number) => void
  children: React.ReactNode
}) {
  const isIngreso = tipo === 'ingreso'
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <div className="px-3 pt-1 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isIngreso ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <p className="eyebrow">
            {isIngreso ? 'Ingresos' : 'Egresos'} <span className="opacity-60">· {count}</span>
          </p>
        </div>
        <p className={`text-[15px] font-bold mt-1 truncate ${isIngreso ? 'text-emerald-600' : 'text-rose-500'}`}>
          <Money value={total} currency={base} />
        </p>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1.5 pb-28 no-scrollbar"
        onScroll={(e) => onScrollY?.(e.currentTarget.scrollTop)}
      >
        {children}
      </div>
    </div>
  )
}
