'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUIStore } from '@/store/useUIStore'
import { useTransactionStore } from '@/store/useTransactionStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { updateSettings, DEFAULT_SETTINGS } from '@/lib/settings'
import { cloneMonthTransactions, createRecurringTransactions, countMonthTransactions } from '@/lib/transactions'
import { shiftMonth, monthLabel } from '@/lib/constants'

export default function AjustesPage() {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const { currentMonth } = useTransactionStore()
  const showToast = useUIStore((s) => s.showToast)

  const [arsUsd, setArsUsd] = useState(String(settings.tipoCambio.ARS_USD))
  const [copUsd, setCopUsd] = useState(String(settings.tipoCambio.COP_USD))
  const [savingRates, setSavingRates] = useState(false)

  async function saveRates() {
    setSavingRates(true)
    try {
      await updateSettings('shared', {
        tipoCambio: {
          ARS_USD: parseFloat(arsUsd) || 0,
          COP_USD: parseFloat(copUsd) || 0,
        },
      })
      showToast('Tipos de cambio guardados')
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSavingRates(false)
    }
  }

  async function handleClone() {
    const prev = shiftMonth(currentMonth, -1)
    const existing = await countMonthTransactions(currentMonth)
    if (existing > 0) {
      if (!confirm(`Ya hay ${existing} movimientos en ${monthLabel(currentMonth)}. ¿Clonar igual desde ${monthLabel(prev)}?`)) return
    }
    try {
      const n = await cloneMonthTransactions(prev, currentMonth)
      showToast(`Clonados ${n} movimientos de ${monthLabel(prev)}`)
    } catch {
      showToast('Error al clonar', 'error')
    }
  }

  async function handleRecurring() {
    try {
      const n = await createRecurringTransactions(currentMonth)
      showToast(`Creados ${n} recurrentes`)
    } catch {
      showToast('Error', 'error')
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">Ajustes</h2>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Tipos de cambio</div>
          <div className="text-xs text-muted mt-0.5">Se aplican a todas las conversiones a USD y a la moneda base.</div>
        </div>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>USD / ARS</Label>
              <Input type="number" value={arsUsd} onChange={(e) => setArsUsd(e.target.value)} />
            </div>
            <div>
              <Label>USD / COP</Label>
              <Input type="number" value={copUsd} onChange={(e) => setCopUsd(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={saveRates} disabled={savingRates}>
              <Save className="h-4 w-4" /> {savingRates ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Operaciones del mes</div>
          <div className="text-xs text-muted mt-0.5">Sobre {monthLabel(currentMonth)}.</div>
        </div>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium">Clonar mes anterior</div>
              <div className="text-xs text-muted">Duplica los movimientos de {monthLabel(shiftMonth(currentMonth, -1))} en este mes (como pendientes).</div>
            </div>
            <Button variant="secondary" onClick={handleClone}>Clonar</Button>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium">Crear recurrentes</div>
              <div className="text-xs text-muted">Trae los movimientos marcados como recurrentes del mes anterior.</div>
            </div>
            <Button variant="secondary" onClick={handleRecurring}>Crear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Categorías</div>
          <div className="text-xs text-muted mt-0.5">Vista de solo lectura. Para editar, usá la app móvil por ahora.</div>
        </div>
        <CardContent className="pt-5 space-y-4">
          <div>
            <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Egresos</div>
            <div className="space-y-2">
              {settings.categoriasGasto.map((g) => (
                <div key={g.id} className="text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                    {g.nombre}
                  </div>
                  <div className="text-xs text-muted ml-4 mt-1">
                    {g.subcategorias.map((s) => s.nombre).join(' · ') || '(sin subcategorías)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Ingresos</div>
            <div className="space-y-2">
              {settings.categoriasIngreso.map((g) => (
                <div key={g.id} className="text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                    {g.nombre}
                  </div>
                  <div className="text-xs text-muted ml-4 mt-1">
                    {g.subcategorias.map((s) => s.nombre).join(' · ') || '(sin subcategorías)'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Acerca de</div>
        </div>
        <CardContent className="pt-5 text-sm text-muted space-y-1">
          <p>Finanzas J&amp;M Desktop · v0.1</p>
          <p>Sincronizado con la app móvil mediante el mismo proyecto Supabase.</p>
        </CardContent>
      </Card>
    </div>
  )
}
