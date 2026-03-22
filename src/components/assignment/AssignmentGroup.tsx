'use client'

import { ChevronDown, ChevronRight, Unlink, CheckCircle2 } from 'lucide-react'
import { Transaction } from '@/types'
import { getCategoryById, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'
import { Settings } from '@/types'
import { Currency } from '@/types'

interface Props {
  income: Transaction | null         // null = "Sin asignar"
  expenses: Transaction[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
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
  onDesassign,
  isExpanded,
  onToggleExpand,
  userNames,
  settings,
  monedaBase,
}: Props) {
  const isUnassigned = income === null

  // Total egresos en moneda base
  const total = expenses.reduce(
    (sum, e) => sum + toBase(e.monto, e.moneda, monedaBase, settings),
    0
  )

  const incomeDate = income?.fecha.toDate().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <div
      className={`mx-3 mb-2 rounded-2xl overflow-hidden border ${
        isUnassigned
          ? 'border-orange-200 bg-orange-50/50'
          : 'border-gray-100 bg-white'
      }`}
    >
      {/* ── Group header ── */}
      <div
        className={`flex items-center gap-2 px-4 py-3 cursor-pointer active:opacity-80 ${
          isUnassigned ? 'bg-orange-50' : 'bg-gray-50/50'
        }`}
        onClick={onToggleExpand}
      >
        {/* Chevron */}
        {isExpanded
          ? <ChevronDown size={16} className={isUnassigned ? 'text-orange-400' : 'text-gray-400'} />
          : <ChevronRight size={16} className={isUnassigned ? 'text-orange-400' : 'text-gray-400'} />
        }

        {/* Income dot */}
        {!isUnassigned && (
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isUnassigned ? (
            <p className="text-sm font-semibold text-orange-600">Sin asignar</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {income!.descripcion ||
                  getCategoryById(income!.categoria)?.nombre ||
                  income!.categoria}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {incomeDate}
                {userNames[income!.creadoPor] && ` · ${userNames[income!.creadoPor]}`}
              </p>
            </>
          )}
        </div>

        {/* Total + count */}
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-semibold ${isUnassigned ? 'text-orange-600' : 'text-gray-600'}`}>
            {formatAmount(total, monedaBase)}
          </p>
          <p className="text-[10px] text-gray-400">{expenses.length} egreso{expenses.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Desasignar (only for assigned groups) */}
        {!isUnassigned && expenses.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onDesassign() }}
            className="ml-1 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Desasignar todos"
          >
            <Unlink size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* ── Expense list ── */}
      {isExpanded && (
        <div className="divide-y divide-gray-50">
          {expenses.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">
              No hay egresos asignados a este ingreso
            </p>
          ) : (
            expenses.map((exp) => {
              const cat = getCategoryById(exp.categoria)
              const isSelected = selectedIds.has(exp.id!)
              const dateStr = exp.fecha.toDate().toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
              })

              return (
                <button
                  key={exp.id}
                  onClick={() => onToggleSelect(exp.id!)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? 'bg-[#534AB7]/8' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#534AB7] border-[#534AB7]'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {exp.descripcion || cat?.nombre || exp.categoria}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cat && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: cat.color + '20', color: cat.color }}
                        >
                          {cat.nombre}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{dateStr}</span>
                    </div>
                  </div>

                  {/* Amount + status */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-red-500">
                      -{formatAmount(exp.monto, exp.moneda)}
                    </p>
                    {exp.ejecutado
                      ? <CheckCircle2 size={12} className="text-green-400 ml-auto" />
                      : <span className="text-[10px] text-gray-400">pendiente</span>
                    }
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
