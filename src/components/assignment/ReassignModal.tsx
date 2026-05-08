'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X, CheckCircle2 } from 'lucide-react'
import { Transaction, Settings, Currency } from '@/types'
import { getCatFromSettings, formatAmount } from '@/lib/constants'
import { toBase } from '@/lib/currency'

interface Props {
  open: boolean
  onClose: () => void
  ingresos: Transaction[]
  egresos: Transaction[]
  userNames: Record<string, string>
  selectedCount: number
  onReassign: (incomeId: string) => void
  settings: Settings
  monedaBase: Currency
}

export default function ReassignModal({
  open,
  onClose,
  ingresos,
  egresos,
  userNames,
  selectedCount,
  onReassign,
  settings,
  monedaBase,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Reasignar {selectedCount} egreso{selectedCount !== 1 ? 's' : ''}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="px-4 py-3 overflow-y-auto max-h-[60vh]">
            <p className="text-xs text-gray-400 mb-3">Seleccioná el ingreso al que querés asignarlos</p>

            {ingresos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No hay ingresos en este mes
              </p>
            ) : (
              <div className="space-y-2">
                {ingresos.map((inc) => {
                  const cat = getCatFromSettings(inc.categoria, settings)
                  const dateStr = inc.fecha.toDate().toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'short',
                  })

                  return (
                    <button
                      key={inc.id}
                      onClick={() => onReassign(inc.id!)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#534AB7]/40 hover:bg-[#534AB7]/5 transition-colors text-left"
                    >
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {inc.descripcion || cat?.nombre || inc.categoria}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {dateStr}
                          {userNames[inc.creadoPor] && ` · ${userNames[inc.creadoPor]}`}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {(() => {
                          const totalAsignado = egresos
                            .filter((e) => e.asignadoA === inc.id)
                            .reduce((sum, e) => sum + toBase(e.monto, e.moneda, monedaBase, settings), 0)
                          const disponible = toBase(inc.monto, inc.moneda, monedaBase, settings) - totalAsignado
                          const isOver = disponible < 0
                          return (
                            <p className={`text-sm font-semibold ${isOver ? 'text-red-400' : 'text-green-600'}`}>
                              {isOver ? 'Excedido' : 'Disponible'}: {formatAmount(Math.abs(disponible), monedaBase)}
                            </p>
                          )
                        })()}
                        {inc.ejecutado && (
                          <CheckCircle2 size={12} className="text-green-400 ml-auto" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
