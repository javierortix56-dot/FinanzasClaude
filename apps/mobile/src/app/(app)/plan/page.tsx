'use client'

import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { Currency } from '@finanzas/core/types'
import PageHeader, { MonthSwitcher, PrivacyToggle } from '@/components/ui/PageHeader'
import CuposDelMes from '@/components/consumos/CuposDelMes'
import PlanVsRealTab from '@/components/consumos/PlanVsRealTab'

/**
 * Planificado vs real: el cupo de cada categoría del mes (lo que se registra
 * lo va llenando), el cierre del mes y el desvío mes a mes.
 */
export default function PlanPage() {
  const { currentMonth, transactions, prevMonth, nextMonth } = useTransactionStore()
  const base = useAuthStore((st) => st.monedaBase) as Currency
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Plan vs real"
        actions={<><PrivacyToggle /><MonthSwitcher month={currentMonth} onPrev={prevMonth} onNext={nextMonth} compact /></>}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <PlanVsRealTab encabezado={<CuposDelMes transactions={transactions} month={currentMonth} base={base} />} />
      </div>
    </div>
  )
}
