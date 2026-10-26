'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { upsertBudget, deleteBudget } from '@finanzas/core/lib/budgets'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import Sheet, { FieldLabel, amountFieldClass } from '@/components/ui/Sheet'
import Segmented from '@/components/ui/Segmented'

interface Props {
  open: boolean
  onClose: () => void
  categoria: string
  mes: string
}

const CURRENCIES = ['ARS', 'COP', 'USD']

export default function BudgetModal({ open, onClose, categoria, mes }: Props) {
  const { getBudget } = useBudgetStore()
  const existing = getBudget(categoria)
  const settings = useSettingsStore((st) => st.settings)
  // Busca también en categorías custom (antes solo en los defaults)
  const cat = getCatFromSettings(categoria, settings)

  const [limite,  setLimite]  = useState('')
  const [moneda,  setMoneda]  = useState('ARS')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setLimite(String(existing.limite))
      setMoneda(existing.moneda)
    } else {
      setLimite('')
      setMoneda('ARS')
    }
  }, [open, existing])

  async function handleSave() {
    if (!limite) return
    setSaving(true)
    try {
      await upsertBudget(mes, categoria, parseFloat(limite), moneda, existing?.id)
      onClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!existing?.id) return
    setSaving(true)
    try { await deleteBudget(existing.id); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Presupuesto"
      subtitle={cat && <span className="font-semibold" style={{ color: cat.color }}>{cat.nombre}</span>}
      bodyClassName="px-5 pb-4 space-y-4"
      zIndex={60}
      footer={
        <div className="flex gap-2">
          {existing && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleDelete}
              disabled={saving}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/15"
              aria-label="Eliminar presupuesto"
            >
              <Trash2 size={17} />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || !limite}
            className="flex-1 h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
          >
            {saving ? 'Guardando...' : existing ? 'Actualizar' : 'Guardar presupuesto'}
          </motion.button>
        </div>
      }
    >
      <div>
        <FieldLabel>Límite mensual</FieldLabel>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          className={amountFieldClass}
        />
        <Segmented
          id="budget-moneda"
          size="sm"
          value={moneda}
          onChange={setMoneda}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          variant="solid"
          className="mt-2"
        />
      </div>
    </Sheet>
  )
}
