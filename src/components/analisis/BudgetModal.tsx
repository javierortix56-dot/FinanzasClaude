'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import { useBudgetStore } from '@/store/useBudgetStore'
import { upsertBudget, deleteBudget } from '@/lib/budgets'
import { getCategoryById, SHARED_USER_ID } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  const cat = getCategoryById(categoria)

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
      await upsertBudget(SHARED_USER_ID, mes, categoria, parseFloat(limite), moneda, existing?.id)
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
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-[60] shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Presupuesto
              </Dialog.Title>
              {cat && (
                <p className="text-xs font-medium mt-0.5" style={{ color: cat.color }}>
                  {cat.nombre}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="px-5 pt-4 pb-8 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Límite mensual
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  className="flex-1 text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7]"
                />
                <div className="flex flex-col gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMoneda(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        moneda === c ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {existing && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={17} />
                </button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !limite}
                className="flex-1 h-11 font-semibold"
              >
                {saving ? 'Guardando...' : existing ? 'Actualizar' : 'Guardar presupuesto'}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
