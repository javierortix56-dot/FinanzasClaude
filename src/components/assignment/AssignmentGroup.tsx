'use client'

import { ChevronDown, ChevronRight, Unlink, CheckCircle2 } from 'lucide-react'
import { Transaction, Settings, Currency } from '@/types'
import { getCatFromSettings, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { useSettingsStore } from '@/store/useSettingsStore'
import { markEjecutado } from '@/lib/transactions'

interface Props {
  income: Transaction | null
  expenses: Transaction[]
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
  expenses,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDesassign,
  isExpanded,
  onToggleExpand,
  userNames,
  settings,
  monedaBase,
}: Props) {
  const { hideAmounts } = useSettingsStore()
  const isUnassigned = income === null

  const totalGastado = expenses.reduce(
    (sum, e) => sum + toBase(e.monto, e.moneda, monedaBase, settings),
    0
  )
  const incomeBase = income ? toBase(income.monto, income.moneda, monedaBase, settings) : 0
  const disponible  = incomeBase - totalGastado
  const usedPercent = incomeBase > 0 ? Math.min((totalGastado / incomeBase) * 100, 100) : 0
  const isOver      = disponible < 0

  const barColor = isOver ? '#f87171' : usedPercent >= 85 ? '#fbbf24' : '#22c55e'

  const incomeDate = income?.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  return (
    <div className={`mx-3 mb-1.5 rounded-2xl overflow-hidden shadow-sm border ${
      isUnassigned ? 'border-amber-200' : 'border-gray-100'
    }`}>

      {/* ── Card header ── */}
      <div
        className={`px-4 pt-2 pb-2 cursor-pointer active:opacity-90 transition-opacity ${
          isUnassigned
            ? 'bg-gradient-to-r from-amber-50 to-orange-50'
            : 'bg-gradient-to-r from-white to-gray-50'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex items-start gap-2">
          {/* Chevron */}
          <div className="mt-0.5 flex-shrink-0">
            {isExpanded
              ? <ChevronDown size={15} className={isUnassigned ? 'text-amber-400' : 'text-gray-400'} />
              : <ChevronRight size={15} className={isUnassigned ? 'text-amber-400' : 'text-gray-400'} />
            }
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            {isUnassigned ? (
              <p className="text-sm font-bold text-amber-600">Sin asignar</p>
            ) : (
              <>
                <p className="text-xs font-medium text-gray-900 truncate leading-tight">
                  {income!.descripcion || getCatFromSettings(income!.categoria, settings)?.nombre || income!.categoria}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {incomeDate}
                </p>
              </>
            )}
          </div>

          {/* Right side: count of expenses (amount is already conveyed by the
              progress bar + "Disponible") */}
          <div className="flex-shrink-0 text-right">
            {isUnassigned ? (
              <p className={`text-sm font-bold text-amber-600 ${hideAmounts ? 'blur-sm' : ''}`}>
                -{formatAmount(totalGastado, monedaBase)}
              </p>
            ) : null}
            <p className="text-[10px] text-gray-400">
              {expenses.length} egreso{expenses.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Desasignar grupo */}
          {!isUnassigned && expenses.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onDesassign() }}
              className="flex-shrink-0 ml-1 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Desasignar todos"
            >
              <Unlink size={13} className="text-gray-300 hover:text-red-400 transition-colors" />
            </button>
          )}
        </div>

        {/* ── Barra de progreso ── */}
        {!isUnassigned && incomeBase > 0 && (
          <div className="mt-1.5">
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="text-[10px] text-gray-400">
                Ingreso:{' '}
                <span className={`font-semibold text-green-600 ${hideAmounts ? 'blur-sm' : ''}`}>
                  +{formatAmount(incomeBase, monedaBase)}
                </span>
              </span>
              <span className={`text-[10px] font-semibold ${isOver ? 'text-red-400' : 'text-gray-500'}`}>
                <span className={hideAmounts ? 'blur-sm' : ''}>
                  {isOver ? 'Excedido' : 'Disponible'}: {formatAmount(Math.abs(disponible), monedaBase)}
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${usedPercent}%`, backgroundColor: barColor }}
              />
            </div>
            <div className="flex justify-end mt-0.5">
              <span className="text-[9px] font-semibold" style={{ color: barColor }}>
                {Math.round(usedPercent)}% usado
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Expense list ── */}
      {isExpanded && (
        <div className="bg-white divide-y divide-gray-50">
          {expenses.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3 italic">
              Ningún egreso asignado aún
            </p>
          ) : (
            expenses.map((exp) => {
              const cat = getCatFromSettings(exp.categoria, settings)
              const isSelected = selectedIds.has(exp.id!)
              const dateStr = exp.fecha.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

              return (
                <div
                  key={exp.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    isSelected ? 'bg-[#534AB7]/5' : 'hover:bg-gray-50'
                  } ${exp.ejecutado ? 'opacity-50' : ''}`}
                >
                  {/* Checkbox — solo selección */}
                  <button
                    type="button"
                    onClick={() => onToggleSelect(exp.id!)}
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-[#534AB7] border-[#534AB7]' : 'border-gray-200'
                    }`}
                  >
                    {isSelected && (
                      <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Description + meta — abre edición */}
                  <button
                    type="button"
                    onClick={() => onEdit(exp)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className={`text-xs font-medium text-gray-900 truncate ${exp.ejecutado ? 'line-through' : ''}`}>
                      {exp.descripcion || cat?.nombre || exp.categoria}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-px">
                      {dateStr}{cat ? ` · ${cat.nombre}` : ''}
                    </p>
                  </button>

                  {/* Amount + status */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <p className={`text-xs font-semibold text-red-400 ${hideAmounts ? 'blur-sm' : ''} ${exp.ejecutado ? 'line-through' : ''}`}>
                      -{formatAmount(toBase(exp.monto, exp.moneda, monedaBase, settings), monedaBase)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markEjecutado(exp.id!, !exp.ejecutado) }}
                      className="p-1 -m-1 flex-shrink-0 inline-flex"
                      title={exp.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
                    >
                      {exp.ejecutado
                        ? <CheckCircle2 size={13} className="text-green-500" />
                        : <div className="w-[13px] h-[13px] rounded-full border border-gray-300" />
                      }
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
