'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { getCurrentMonth, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import CierreMesSheet from '@/components/consumos/CierreMesSheet'
import { haptic } from '@/lib/haptics'

/** Los primeros 10 días del mes, si el mes anterior no se cerró, invita a cerrarlo */
export default function AvisoCierre() {
  const cerrados = useSettingsStore((st) => st.settings?.mesesCerrados)
  const [abierto, setAbierto] = useState(false)
  const anterior = shiftMonth(getCurrentMonth(), -1)
  if (new Date().getDate() > 10 || (cerrados ?? []).includes(anterior)) return null
  const nombre = monthLabel(anterior).replace(/ de \d{4}$/, '')
  return (
    <>
      <button type="button" onClick={() => { haptic(); setAbierto(true) }}
        className="mt-2 w-full rounded-[18px] bg-amber-500/10 ring-1 ring-amber-500/25 px-3.5 py-2.5 flex items-center gap-2.5 text-left">
        <Lock size={14} className="text-amber-600 shrink-0" />
        <span className="flex-1 min-w-0 text-[12px] text-gray-700">
          <b>Cierre de {nombre} pendiente</b> · planificado contra real y plan de este mes
        </span>
        <span className="text-[11px] font-bold text-amber-700 shrink-0">Revisar</span>
      </button>
      <CierreMesSheet mes={anterior} open={abierto} onClose={() => setAbierto(false)} />
    </>
  )
}
