'use client'

import { useState, useSyncExternalStore } from 'react'
import { motion } from 'motion/react'
import { Save, Copy, Repeat, Monitor, Sun, Moon, ChevronRight, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import Collapse from '@/components/ui/Collapse'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { updateSettings, DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { cloneMonthTransactions, createRecurringTransactions, countMonthTransactions } from '@finanzas/core/lib/transactions'
import { shiftMonth, monthLabel } from '@finanzas/core/lib/constants'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { currentThemePref, setThemePref, subscribeTheme, ThemePref } from '@/lib/theme'
import { CategoryGroup, FuenteCambio } from '@finanzas/core/types'
import { cambiarFuenteCambio, syncCotizaciones, haceCuanto, FUENTES_CAMBIO } from '@finanzas/core/lib/cotizaciones'
import { PageScroll } from '@/components/shell/PageScroll'

const parseRate = (v: string) => parseFloat(v.replace(',', '.'))

export default function AjustesPage() {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const { currentMonth } = useTransactionStore()
  const showToast = useUIStore((s) => s.showToast)
  const theme = useSyncExternalStore(subscribeTheme, currentThemePref, () => 'system' as ThemePref)

  const [arsUsd, setArsUsd] = useState(String(settings.tipoCambio.ARS_USD))
  const [copUsd, setCopUsd] = useState(String(settings.tipoCambio.COP_USD))
  const [savingRates, setSavingRates] = useState(false)
  const [confirmClone, setConfirmClone] = useState<number | null>(null)
  const [busy, setBusy] = useState<'clone' | 'rec' | null>(null)

  // Antes un valor vacío o inválido se guardaba como 0 y rompía todas las
  // conversiones (división por cero → montos infinitos).
  const ars = parseRate(arsUsd)
  const cop = parseRate(copUsd)
  const ratesValid = ars > 0 && cop > 0
  const ratesDirty = ars !== settings.tipoCambio.ARS_USD || cop !== settings.tipoCambio.COP_USD

  async function saveRates() {
    if (!ratesValid) return showToast('Los tipos de cambio deben ser mayores a 0', 'error')
    setSavingRates(true)
    try {
      await updateSettings('shared', { tipoCambio: { ARS_USD: ars, COP_USD: cop } })
      showToast('Tipos de cambio guardados')
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSavingRates(false)
    }
  }

  const fuente: FuenteCambio = settings.fuenteCambio ?? 'mep'
  const [syncing, setSyncing] = useState(false)
  const historial = [...(settings.historialTipoCambio ?? [])].reverse().slice(0, 12)

  async function handleFuente(f: FuenteCambio) {
    setSyncing(true)
    try {
      await cambiarFuenteCambio(settings, f)
      showToast(f === 'manual' ? 'Tipo de cambio manual' : `Cotización ${FUENTES_CAMBIO.find((x) => x.value === f)?.label} aplicada`)
    } catch {
      showToast('No se pudo actualizar la cotización', 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncAhora() {
    setSyncing(true)
    const ok = await syncCotizaciones(settings, { force: true })
    setSyncing(false)
    showToast(ok ? 'Cotización actualizada' : 'No se pudo obtener la cotización', ok ? 'success' : 'error')
  }

  const prev = shiftMonth(currentMonth, -1)

  async function requestClone() {
    const existing = await countMonthTransactions(currentMonth)
    if (existing > 0) setConfirmClone(existing)
    else doClone()
  }

  async function doClone() {
    setConfirmClone(null)
    setBusy('clone')
    try {
      const n = await cloneMonthTransactions(prev, currentMonth)
      showToast(`Clonados ${n} movimientos de ${monthLabel(prev)}`)
    } catch {
      showToast('Error al clonar', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleRecurring() {
    setBusy('rec')
    try {
      const n = await createRecurringTransactions(currentMonth)
      showToast(n > 0 ? `Creados ${n} recurrentes` : 'No había recurrentes pendientes')
    } catch {
      showToast('Error', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <PageScroll className="space-y-5 max-w-3xl">
      <Section title="Apariencia" sub="Se guarda en este dispositivo." delay={0}>
        <Segmented
          id="ajustes-theme"
          value={theme}
          onChange={setThemePref}
          options={[
            { value: 'system', label: <><Monitor className="h-3.5 w-3.5" /> Sistema</> },
            { value: 'light', label: <><Sun className="h-3.5 w-3.5" /> Claro</> },
            { value: 'dark', label: <><Moon className="h-3.5 w-3.5" /> Oscuro</> },
          ]}
        />
      </Section>

      <Section
        title="Tipos de cambio"
        sub="Cada mes pasado se convierte con su propio promedio; el mes en curso, con la cotización del día."
        delay={0.04}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            id="ajustes-fuente"
            value={fuente}
            onChange={(f) => { if (!syncing) handleFuente(f) }}
            options={FUENTES_CAMBIO.map((f) => ({ value: f.value, label: f.label }))}
          />
          <span className="text-xs text-muted">{FUENTES_CAMBIO.find((f) => f.value === fuente)?.detalle}</span>
        </div>

        {fuente !== 'manual' ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-center gap-4">
            <RateValue label="ARS por USD" value={settings.tipoCambio.ARS_USD} />
            <RateValue label="COP por USD (TRM)" value={settings.tipoCambio.COP_USD} />
            <div className="flex flex-col items-start sm:items-end gap-1">
              <Button variant="secondary" size="sm" onClick={handleSyncAhora} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Actualizando…' : 'Actualizar ahora'}
              </Button>
              <span className="text-[11px] text-muted-2">Actualizado {haceCuanto(settings.cambioActualizado)}</span>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); saveRates() }}
            className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-end gap-4"
          >
            <RateInput id="rate-ars" label="ARS por USD" value={arsUsd} onChange={setArsUsd} invalid={!(ars > 0)} />
            <RateInput id="rate-cop" label="COP por USD" value={copUsd} onChange={setCopUsd} invalid={!(cop > 0)} />
            <Button type="submit" disabled={savingRates || !ratesValid || !ratesDirty}>
              <Save className="h-4 w-4" /> {savingRates ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        )}

        {historial.length > 0 && (
          <div className="mt-5">
            <div className="eyebrow mb-2">Promedios mensuales</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6">
              {historial.map((h) => (
                <div key={h.mes} className="flex justify-between border-b border-hairline py-1.5 text-xs tnum">
                  <span className="capitalize text-muted">{monthLabel(h.mes)}{h.fuente ? '' : ' · manual'}</span>
                  <span className="text-foreground">{h.ARS_USD.toLocaleString('es-AR')} · {h.COP_USD.toLocaleString('es-AR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Operaciones del mes" sub={`Sobre ${monthLabel(currentMonth)}.`} delay={0.08}>
        <div className="space-y-2">
          <ActionRow
            icon={Copy}
            title="Clonar mes anterior"
            sub={`Duplica los movimientos de ${monthLabel(prev)} en este mes (como pendientes).`}
            label={busy === 'clone' ? 'Clonando…' : 'Clonar'}
            disabled={busy !== null}
            onClick={requestClone}
          />
          <ActionRow
            icon={Repeat}
            title="Crear recurrentes"
            sub="Trae los movimientos marcados como recurrentes del mes anterior."
            label={busy === 'rec' ? 'Creando…' : 'Crear'}
            disabled={busy !== null}
            onClick={handleRecurring}
          />
        </div>
      </Section>

      <Section title="Categorías" sub="Vista de solo lectura. Para editarlas, usá la app móvil por ahora." delay={0.12}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CategoryList title="Egresos" groups={settings.categoriasGasto} />
          <CategoryList title="Ingresos" groups={settings.categoriasIngreso} />
        </div>
      </Section>

      <Section title="Acerca de" delay={0.16}>
        <div className="text-sm text-muted space-y-1">
          <p>Finanzas J&amp;M Desktop · v0.2</p>
          <p>Sincronizado con la app móvil mediante el mismo proyecto Supabase.</p>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmClone !== null}
        title="¿Clonar igual?"
        message={<>Ya hay <b className="text-foreground">{confirmClone} movimientos</b> en {monthLabel(currentMonth)}. Clonar {monthLabel(prev)} puede duplicar partidas.</>}
        confirmLabel="Clonar"
        onConfirm={doClone}
        onCancel={() => setConfirmClone(null)}
      />
    </PageScroll>
  )
}

function Section({ title, sub, delay, children }: { title: string; sub?: string; delay?: number; children: React.ReactNode }) {
  return (
    <Card delay={delay}>
      <div className="px-6 pt-5 pb-4">
        <div className="text-[15px] font-semibold">{title}</div>
        {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      </div>
      <div className="px-6 pb-6">{children}</div>
    </Card>
  )
}

function RateValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="text-[22px] font-semibold tnum">{value.toLocaleString('es-AR')}</div>
    </div>
  )
}

function RateInput({ id, label, value, onChange, invalid }: {
  id: string; label: string; value: string; onChange: (v: string) => void; invalid: boolean
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className={invalid ? 'border-expense/50 ring-4 ring-expense/10 tnum' : 'tnum'}
      />
    </div>
  )
}

function ActionRow({ icon: Icon, title, sub, label, disabled, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  title: string; sub: string; label: string; disabled: boolean; onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted">{sub}</div>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onClick} disabled={disabled}>{label}</Button>
    </div>
  )
}

function CategoryList({ title, groups }: { title: string; groups: CategoryGroup[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div>
      <div className="eyebrow mb-2">{title}</div>
      <div className="space-y-1">
        {groups.map((g) => {
          const isOpen = open === g.id
          return (
            <div key={g.id} className="rounded-xl transition-colors hover:bg-surface-2">
              <button
                onClick={() => setOpen(isOpen ? null : g.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-sm"
              >
                <span className="h-7 w-7 shrink-0 rounded-lg inline-flex items-center justify-center" style={{ background: `${g.color}22`, color: g.color }}>
                  <CategoryIcon cat={g} size={14} />
                </span>
                <span className="flex-1 font-medium truncate">{g.nombre}</span>
                <span className="text-xs text-muted-2 tnum">{g.subcategorias.length}</span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }}>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-2" />
                </motion.span>
              </button>
              <Collapse open={isOpen}>
                <div className="flex flex-wrap gap-1.5 px-2 pb-2.5 pl-11">
                  {g.subcategorias.length === 0 ? (
                    <span className="text-xs text-muted-2">(sin subcategorías)</span>
                  ) : g.subcategorias.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                      <CategoryIcon cat={s} size={11} />
                      {s.nombre}
                    </span>
                  ))}
                </div>
              </Collapse>
            </div>
          )
        })}
      </div>
    </div>
  )
}
