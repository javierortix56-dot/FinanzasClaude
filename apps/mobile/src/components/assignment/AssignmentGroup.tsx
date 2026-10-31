'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Unlink, Check, Split, CreditCard } from 'lucide-react'
import { Transaction, Settings, Currency, Tarjeta } from '@finanzas/core/types'
import { getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { toBase, txToBase, txMonth } from '@finanzas/core/lib/currency'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { markEjecutado } from '@finanzas/core/lib/transactions'
import { haptic } from '@/lib/haptics'
import Collapse from '@/components/ui/Collapse'
import ProgressBar from '@/components/ui/ProgressBar'
import { spring, springPop, pulse } from '@/components/ui/motion'

/** Un egreso dentro de un grupo: si está dividido, montoAsignado < exp.monto */
export interface GroupItem {
  exp: Transaction
  /** Parte asignada a ESTE ingreso, en la moneda del egreso */
  montoAsignado: number
  esParcial: boolean
}

interface Props {
  income: Transaction | null
  /** Grupo de consumos con tarjeta (en lugar de un ingreso) */
  tarjeta?: Tarjeta
  /** Mes en que se pagan los consumos de la tarjeta (etiqueta) */
  mesPago?: string
  items: GroupItem[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onEdit: (tx: Transaction) => void
  onDesassign: () => void
  isExpanded: boolean
  onToggleExpand: () => void
  userNames: Record<string, string>
  settings: Settings
  monedaBase: Currency
}

export default function AssignmentGroup({
  income,
  tarjeta,
  mesPago,
  items,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDesassign,
  isExpanded,
  onToggleExpand,
  settings,
  monedaBase,
}: Props) {
  const { hideAmounts } = useSettingsStore()
  const isUnassigned = income === null && !tarjeta

  const totalGastado = items.reduce(
    (sum, { exp, montoAsignado }) => sum + toBase(montoAsignado, exp.moneda, monedaBase, settings, txMonth(exp)),
    0
  )
  const incomeBase = income ? txToBase(income, monedaBase, settings) : 0
  const disponible  = incomeBase - totalGastado
  const usedPercent = incomeBase > 0 ? Math.min((totalGastado / incomeBase) * 100, 100) : 0
  const isOver      = disponible < 0

  const barColor = isOver ? '#f43f5e' : usedPercent >= 85 ? '#f59e0b' : '#10b981'

  const incomeDate = income?.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  const blur = hideAmounts ? 'blur-sm select-none' : ''

  return (
    <div className={`mx-3 mb-2 rounded-[20px] overflow-hidden transition-shadow ${
      isUnassigned
        ? 'bg-amber-500/[0.07] ring-1 ring-amber-500/25'
        : 'bg-surface/75 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.12)]'
    } ${isExpanded ? 'shadow-soft' : ''}`}>

      {/* ── Card header ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="px-3.5 pt-2.5 pb-2.5 cursor-pointer select-none"
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter') onToggleExpand() }}
      >
        <div className="flex items-center gap-2">
          {/* Chevron */}
          <motion.span
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={spring}
            className={`flex-shrink-0 inline-flex ${isUnassigned ? 'text-amber-500' : 'text-gray-400'}`}
          >
            <ChevronDown size={16} />
          </motion.span>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            {tarjeta ? (
              <>
                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight flex items-center gap-1.5">
                  <CreditCard size={13} style={{ color: tarjeta.color }} /> {tarjeta.nombre}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {items.length} egreso{items.length !== 1 ? 's' : ''} · se pagan en {mesPago}
                </p>
              </>
            ) : isUnassigned ? (
              <p className="text-sm font-bold text-amber-600">Sin asignar</p>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                  {income!.descripcion || getCatFromSettings(income!.categoria, settings)?.nombre || income!.categoria}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {incomeDate} · {items.length} egreso{items.length !== 1 ? 's' : ''}
                </p>
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex-shrink-0 text-right">
            {tarjeta ? (
              <p className={`text-sm font-bold text-gray-700 tabular-nums ${blur}`}>
                {formatAmount(totalGastado, monedaBase)}
              </p>
            ) : isUnassigned ? (
              <>
                <p className={`text-sm font-bold text-amber-600 tabular-nums ${blur}`}>
                  -{formatAmount(totalGastado, monedaBase)}
                </p>
                <p className="text-[11px] text-amber-600/70">
                  {items.length} egreso{items.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full" style={{ color: barColor, backgroundColor: barColor + '18' }}>
                {Math.round(usedPercent)}%
              </span>
            )}
          </div>

          {/* Desasignar grupo */}
          {!isUnassigned && items.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); onDesassign() }}
              className="flex-shrink-0 w-8 h-8 -mr-1 flex items-center justify-center rounded-full text-gray-300 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
              title="Desasignar todos"
              aria-label="Desasignar todos"
            >
              <Unlink size={14} />
            </motion.button>
          )}
        </div>

        {/* ── Barra de progreso ── */}
        {!isUnassigned && incomeBase > 0 && (
          <div className="mt-2 pl-6">
            <ProgressBar value={usedPercent} color={barColor} height={5} />
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-[11px] text-gray-400">
                Ingreso{' '}
                <span className={`font-semibold text-emerald-600 tabular-nums ${blur}`}>
                  +{formatAmount(incomeBase, monedaBase)}
                </span>
              </span>
              <span className={`text-[11px] font-semibold ${isOver ? 'text-rose-500' : 'text-gray-500'}`}>
                {isOver ? 'Excedido' : 'Disponible'}{' '}
                <span className={`tabular-nums ${blur}`}>{formatAmount(Math.abs(disponible), monedaBase)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Expense list ── */}
      <Collapse open={isExpanded}>
        <div className="border-t border-hairline px-1.5 py-1.5 space-y-0.5">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2 italic">
              Ningún egreso asignado aún
            </p>
          ) : (
            items.map(({ exp, montoAsignado, esParcial }) => {
              const cat = getCatFromSettings(exp.categoria, settings)
              const isSelected = selectedIds.has(exp.id!)
              const dateStr = exp.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

              return (
                <motion.div
                  key={exp.id}
                  layout="position"
                  animate={{ opacity: exp.ejecutado ? 0.5 : 1 }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl transition-colors ${
                    isSelected ? 'bg-primary/[0.08]' : 'hover:bg-gray-500/[0.05]'
                  }`}
                >
                  {/* Checkbox — solo selección */}
                  <button
                    type="button"
                    onClick={() => onToggleSelect(exp.id!)}
                    aria-label={isSelected ? 'Quitar de la selección' : 'Seleccionar'}
                    className={`hit-44 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}
                  >
                    <AnimatePresence>
                      {isSelected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springPop} className="inline-flex">
                          <Check size={11} strokeWidth={3.5} className="text-white" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Color de categoría */}
                  <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color ?? '#94a3b8' }} />

                  {/* Description + meta — abre edición */}
                  <button
                    type="button"
                    onClick={() => onEdit(exp)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={`text-xs font-semibold text-gray-900 truncate ${exp.ejecutado ? 'line-through' : ''}`}>
                      {exp.descripcion || cat?.nombre || exp.categoria}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-px flex items-center gap-1 min-w-0">
                      <span className="truncate">{dateStr}{cat ? ` · ${cat.nombre}` : ''}</span>
                      {esParcial && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                          <Split size={9} /> dividido
                        </span>
                      )}
                    </p>
                  </button>

                  {/* Amount + status */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <div className="text-right">
                      <p className={`text-xs font-bold text-rose-500 tabular-nums ${blur} ${exp.ejecutado ? 'line-through' : ''}`}>
                        -{formatAmount(toBase(montoAsignado, exp.moneda, monedaBase, settings, txMonth(exp)), monedaBase)}
                      </p>
                      {esParcial && (
                        <p className={`text-[10px] text-gray-400 tabular-nums leading-tight ${blur}`}>
                          de {formatAmount(txToBase(exp, monedaBase, settings), monedaBase)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); haptic('light'); markEjecutado(exp.id!, !exp.ejecutado) }}
                      className="hit-44 p-1 -m-1 flex-shrink-0 inline-flex"
                      title={exp.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
                      aria-label={exp.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
                    >
                      <motion.span
                        className={`w-4 h-4 rounded-full flex items-center justify-center border ${exp.ejecutado ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}
                        animate={{ scale: exp.ejecutado ? [1, 1.25, 1] : 1 }}
                        transition={pulse}
                      >
                        {exp.ejecutado && <Check size={10} strokeWidth={3.5} className="text-white" />}
                      </motion.span>
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </Collapse>
    </div>
  )
}
