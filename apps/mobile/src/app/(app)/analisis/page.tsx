'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import HistoricoTab from '@/components/analisis/HistoricoTab'
import PilotoTab    from '@/components/analisis/PilotoTab'
import CuotasTab    from '@/components/cuotas/CuotasTab'
import ResumenesTab from '@/components/resumenes/ResumenesTab'
import PageHeader, { MonthSwitcher } from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'

type Tab = 'historico' | 'cuotas' | 'resumenes' | 'piloto'

const TABS: Tab[] = ['historico', 'cuotas', 'resumenes', 'piloto']

const TAB_LABELS: Record<Tab, string> = {
  historico: 'Histórico',
  cuotas:    'Cuotas',
  resumenes: 'Resúmenes',
  piloto:    'Piloto',
}

export default function AnalisisPage() {
  const { currentMonth, prevMonth, nextMonth } = useTransactionStore()
  const [tab, setTab] = useState<Tab>('historico')
  // Dirección del cambio de tab para deslizar el contenido hacia el lado correcto
  const [dir, setDir] = useState(1)

  function changeTab(t: Tab) {
    setDir(TABS.indexOf(t) > TABS.indexOf(tab) ? 1 : -1)
    setTab(t)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Análisis"
        actions={<MonthSwitcher month={currentMonth} onPrev={prevMonth} onNext={nextMonth} compact />}
      >
        <Segmented
          id="analisis-tab"
          value={tab}
          onChange={changeTab}
          options={TABS.map((t) => ({ value: t, label: TAB_LABELS[t] }))}
          className="mt-4"
        />
      </PageHeader>

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 24 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -24 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {tab === 'historico' ? <HistoricoTab /> : tab === 'cuotas' ? <CuotasTab /> : tab === 'resumenes' ? <ResumenesTab /> : <PilotoTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
