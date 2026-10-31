'use client'

import { motion } from 'motion/react'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { Transaction, Settings, Currency } from '@finanzas/core/types'
import { getCatFromSettings, formatAmount } from '@finanzas/core/lib/constants'
import { toBase, txToBase, txMonth } from '@finanzas/core/lib/currency'
import Sheet from '@/components/ui/Sheet'
import ProgressBar from '@/components/ui/ProgressBar'

interface Props {
  open: boolean
  onClose: () => void
  ingresos: Transaction[]
  egresos: Transaction[]
  userNames: Record<string, string>
  selectedCount: number
  /** Id de ingreso, o `tc:<id>` para una tarjeta */
  onReassign: (destino: string) => void
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
    <Sheet
      open={open}
      onClose={onClose}
      title={`Reasignar ${selectedCount} egreso${selectedCount !== 1 ? 's' : ''}`}
      subtitle="Elegí un ingreso o una tarjeta"
      bodyClassName="px-4 pb-6"
    >
      {ingresos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No hay ingresos en este mes
        </p>
      ) : (
        <div className="space-y-2">
          {ingresos.map((inc, i) => {
            const cat = getCatFromSettings(inc.categoria, settings)
            const dateStr = inc.fecha.toDate().toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
            })
            const incBase = txToBase(inc, monedaBase, settings)
            const totalAsignado = egresos.reduce((sum, e) => sum + e.asignaciones
              .filter((a) => a.ingresoId === inc.id)
              .reduce((x, a) => x + toBase(a.monto, e.moneda, monedaBase, settings, txMonth(e)), 0), 0)
            const disponible = incBase - totalAsignado
            const isOver = disponible < 0
            const used = incBase > 0 ? Math.min((totalAsignado / incBase) * 100, 100) : 0

            return (
              <motion.button
                key={inc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onReassign(inc.id!)}
                className="w-full p-3 rounded-2xl bg-gray-500/[0.06] hover:bg-primary/[0.07] hover:ring-1 hover:ring-primary/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/12 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                      {inc.descripcion || cat?.nombre || inc.categoria}
                      {inc.ejecutado && <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {dateStr}
                      {userNames[inc.creadoPor] && ` · ${userNames[inc.creadoPor]}`}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold text-right flex-shrink-0 ${isOver ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {isOver ? 'Excedido' : 'Disponible'}<br />
                    <span className="tabular-nums">{formatAmount(Math.abs(disponible), monedaBase)}</span>
                  </p>
                </div>
                <ProgressBar value={used} color={isOver ? '#f43f5e' : used >= 85 ? '#f59e0b' : '#10b981'} height={4} className="mt-2.5" />
              </motion.button>
            )
          })}
        </div>
      )}
      {(settings.tarjetas ?? []).length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="eyebrow px-1">Tarjetas · se pagan el mes siguiente</p>
          {(settings.tarjetas ?? []).map((t) => (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => onReassign(`tc:${t.id}`)}
              className="w-full p-3 rounded-2xl bg-gray-500/[0.06] hover:bg-primary/[0.07] transition-colors text-left flex items-center gap-3"
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white" style={{ background: t.color }}>
                <CreditCard size={16} />
              </span>
              <span className="text-sm font-semibold text-gray-900 truncate">{t.nombre}</span>
            </motion.button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
