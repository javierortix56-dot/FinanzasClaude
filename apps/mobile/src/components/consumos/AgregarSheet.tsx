'use client'

import { useState } from 'react'
import { CalendarPlus, ReceiptText } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useConsumos } from '@finanzas/core/lib/useConsumos'
import Sheet from '@/components/ui/Sheet'
import ConsumoSheet from '@/components/consumos/ConsumoSheet'
import { haptic } from '@/lib/haptics'

function Opcion({ icon: Icon, titulo, texto, onClick, principal }: {
  icon: typeof ReceiptText; titulo: string; texto: string; onClick: () => void; principal?: boolean
}) {
  return (
    <button type="button" onClick={() => { haptic(); onClick() }}
      className={`w-full flex items-center gap-3 rounded-2xl p-3.5 text-left ${principal ? 'bg-brand text-white shadow-soft' : 'glass text-gray-900'}`}>
      <span className={`h-11 w-11 shrink-0 rounded-xl inline-flex items-center justify-center ${principal ? 'bg-white/15' : 'bg-primary/12 text-primary'}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold">{titulo}</span>
        <span className={`block text-xs leading-snug ${principal ? 'text-white/75' : 'text-gray-500'}`}>{texto}</span>
      </span>
    </button>
  )
}

/**
 * Lo que abre el botón "+": registrar un gasto real (lo de todos los días:
 * llena el cupo de lo planificado) o planificar un movimiento del mes.
 */
export default function AgregarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openAddModal = useUIStore((st) => st.openAddModal)
  const currentMonth = useTransactionStore((st) => st.currentMonth)
  const consumos = useConsumos(currentMonth)
  const [registrar, setRegistrar] = useState(false)

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Agregar" bodyClassName="px-5 pb-6 space-y-2.5">
        <Opcion icon={ReceiptText} principal titulo="Registrar gasto"
          texto="Lo que ya gastó: a mano, foto del ticket o captura. Llena el cupo de lo planificado."
          onClick={() => { onClose(); setRegistrar(true) }} />
        <Opcion icon={CalendarPlus} titulo="Planificar"
          texto="Un ingreso o un gasto previsto del mes (el presupuesto)."
          onClick={() => { onClose(); openAddModal() }} />
      </Sheet>
      <ConsumoSheet open={registrar} onClose={() => setRegistrar(false)} existentes={consumos ?? []} />
    </>
  )
}
