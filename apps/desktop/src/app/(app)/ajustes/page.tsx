'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { updateSettings, DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { cloneMonthTransactions, createRecurringTransactions, countMonthTransactions } from '@finanzas/core/lib/transactions'
import { shiftMonth, monthLabel } from '@finanzas/core/lib/constants'
import { Currency } from '@finanzas/core/types'

export default function AjustesPage() {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const setSettings = useSettingsStore((s) => s.setSettings)
  const setMonedaBase = useAuthStore((s) => s.setMonedaBase)
  const { currentMonth } = useTransactionStore()
  const showToast = useUIStore((s) => s.showToast)

  const [arsUsd, setArsUsd] = useState(String(settings.tipoCambio.ARS_USD))
  const [copUsd, setCopUsd] = useState(String(settings.tipoCambio.COP_USD))
  const [savingRates, setSavingRates] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [creatingRecurring, setCreatingRecurring] = useState(false)

  // Refrescar los inputs cuando llega un update en tiempo real (p. ej. el
  // otro dispositivo guardó un tipo de cambio nuevo).
  useEffect(() => {
    setArsUsd(String(settings.tipoCambio.ARS_USD))
    setCopUsd(String(settings.tipoCambio.COP_USD))
  }, [settings.tipoCambio.ARS_USD, settings.tipoCambio.COP_USD])

  async function saveRates() {
    const ars = parseFloat(arsUsd)
    const cop = parseFloat(copUsd)
    // Un tipo de cambio en 0 rompería todas las conversiones
    if (!Number.isFinite(ars) || !Number.isFinite(cop) || ars <= 0 || cop <= 0) {
      showToast('Los tipos de cambio deben ser números mayores a 0', 'error')
      return
    }
    setSavingRates(true)
    try {
      await updateSettings('shared', {
        tipoCambio: { ARS_USD: ars, COP_USD: cop },
      })
      showToast('Tipos de cambio guardados')
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSavingRates(false)
    }
  }

  async function changeMonedaBase(m: Currency) {
    if ((settings.monedaBase ?? 'ARS') === m) return
    try {
      await updateSettings('shared', { monedaBase: m })
      setSettings({ ...settings, monedaBase: m })
      setMonedaBase(m)
      showToast('Moneda base actualizada')
    } catch {
      showToast('Error al cambiar la moneda base', 'error')
    }
  }

  async function handleClone() {
    const prev = shiftMonth(currentMonth, -1)
    setCloning(true)
    try {
      const existing = await countMonthTransactions(currentMonth)
      if (existing > 0) {
        if (!confirm(`Ya hay ${existing} movimientos en ${monthLabel(currentMonth)}. ¿Clonar igual desde ${monthLabel(prev)}?`)) return
      }
      const n = await cloneMonthTransactions(prev, currentMonth)
      showToast(`Clonados ${n} movimientos de ${monthLabel(prev)}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al clonar', 'error')
    } finally {
      setCloning(false)
    }
  }

  async function handleRecurring() {
    setCreatingRecurring(true)
    try {
      const existing = await countMonthTransactions(currentMonth)
      if (existing > 0) {
        if (!confirm(`Ya hay ${existing} movimientos en ${monthLabel(currentMonth)}. ¿Crear los recurrentes igual?`)) return
      }
      const n = await createRecurringTransactions(currentMonth)
      showToast(`Creados ${n} recurrentes`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear recurrentes', 'error')
    } finally {
      setCreatingRecurring(false)
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Moneda base (totales)</Label>
              <Select value={settings.monedaBase ?? 'ARS'} onChange={(e) => changeMonedaBase(e.target.value as Currency)}>
                {(['ARS', 'COP', 'USD'] as Currency[]).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
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
            <Button variant="secondary" onClick={handleClone} disabled={cloning || creatingRecurring}>
              {cloning ? 'Clonando…' : 'Clonar'}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium">Crear recurrentes</div>
              <div className="text-xs text-muted">Trae los movimientos marcados como recurrentes del mes anterior.</div>
            </div>
            <Button variant="secondary" onClick={handleRecurring} disabled={cloning || creatingRecurring}>
              {creatingRecurring ? 'Creando…' : 'Crear'}
            </Button>
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
