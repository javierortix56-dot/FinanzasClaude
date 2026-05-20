'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Currency, Transaction, TransactionType, CategoryGroup, Settings } from '@finanzas/core/types'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { Trash2, CalendarArrowUp, Check } from 'lucide-react'
import { MoneyText } from '@/components/MoneyText'

interface Props {
  open: boolean
  onClose: () => void
  initialType?: TransactionType
  editing?: Transaction | null
}

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

function advanceMonth(fecha: string) {
  const d = new Date(fecha + 'T12:00:00')
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

// ── Category chip picker ──────────────────────────────────────────────────────

function CategoryPicker({
  tipo, value, onChange, settings,
}: {
  tipo: TransactionType
  value: string
  onChange: (id: string) => void
  settings: Settings
}) {
  const groups = (tipo === 'ingreso' ? settings.categoriasIngreso : settings.categoriasGasto)
    .filter((g) => g.activa)

  const parentGroupId = useMemo(() => {
    for (const g of groups) {
      if (g.id === value) return g.id
      if (g.subcategorias.some((s) => s.id === value)) return g.id
    }
    return null
  }, [value, groups])

  const [expandedId, setExpandedId] = useState<string | null>(parentGroupId)
  const expandedGroup = groups.find((g) => g.id === expandedId) ?? null

  function handleGroupClick(g: CategoryGroup) {
    const subs = g.subcategorias.filter((s) => s.activa)
    if (subs.length === 0) {
      onChange(g.id)
      setExpandedId(g.id)
    } else {
      const next = expandedId === g.id ? null : g.id
      setExpandedId(next)
      if (next !== null && parentGroupId !== g.id) onChange('')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const active = parentGroupId === g.id || (expandedId === g.id && parentGroupId !== g.id)
          return (
            <button
              type="button"
              key={g.id}
              onClick={() => handleGroupClick(g)}
              className={`px-3 h-7 text-xs font-medium rounded-full border transition-all ${
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-surface text-muted border-border hover:text-foreground'
              }`}
              style={active ? { background: g.color } : {}}
            >
              {g.nombre}
            </button>
          )
        })}
      </div>
      {expandedGroup && expandedGroup.subcategorias.filter((s) => s.activa).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-2 border-l-2 border-border/50">
          {expandedGroup.subcategorias.filter((s) => s.activa).map((sub) => (
            <button
              type="button"
              key={sub.id}
              onClick={() => onChange(sub.id)}
              className={`px-2.5 h-6 text-xs rounded-full border transition-all ${
                value === sub.id
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-surface-2 text-foreground border-border hover:border-primary/50'
              }`}
              style={value === sub.id ? { background: sub.color } : {}}
            >
              {sub.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Ingreso assignment chips ──────────────────────────────────────────────────

function IngresoChips({
  ingresos, transactions, editingId, value, onChange, settings, base,
}: {
  ingresos: Transaction[]
  transactions: Transaction[]
  editingId?: string
  value: string | null
  onChange: (id: string | null) => void
  settings: Settings
  base: Currency
}) {
  if (ingresos.length === 0) {
    return <p className="text-xs text-muted">No hay ingresos en este mes.</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ingresos.map((ing) => {
        const total = toBase(ing.monto, ing.moneda, base, settings)
        const assigned = transactions
          .filter((t) => t.tipo === 'egreso' && t.asignadoA === ing.id && t.id !== editingId)
          .reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
        const remaining = total - assigned
        const over = remaining < 0
        const selected = value === ing.id
        const catName = getCatFromSettings(ing.categoria, settings)?.nombre ?? ''
        const label = ing.descripcion || catName || 'Ingreso'

        return (
          <button
            type="button"
            key={ing.id}
            onClick={() => onChange(selected ? null : ing.id!)}
            className={`group relative flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all ${
              selected
                ? over
                  ? 'border-expense bg-expense/10 text-expense'
                  : 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-2'
            }`}
          >
            {selected && (
              <span className="absolute top-1.5 right-1.5">
                <Check className="h-3 w-3" />
              </span>
            )}
            <span className="text-xs font-medium leading-tight pr-4">{label}</span>
            <span className={`text-[10px] mt-0.5 ${
              over ? 'text-expense' : selected ? 'text-primary/80' : 'text-muted'
            }`}>
              disp.&nbsp;
              <MoneyText amount={remaining} currency={base} className="inline" />
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

export function TransactionModal({ open, onClose, initialType = 'egreso', editing }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      size="lg"
    >
      {open && (
        <Form
          key={editing?.id ?? `new-${initialType}`}
          editing={editing ?? null}
          initialType={initialType}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-medium text-muted uppercase tracking-wide">{label}</span>
        {hint && <span className="text-[10px] text-muted-2">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/50'
const selectCls =
  'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50'

// ── Form ──────────────────────────────────────────────────────────────────────

function Form({
  editing, initialType, onClose,
}: {
  editing: Transaction | null
  initialType: TransactionType
  onClose: () => void
}) {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)
  const { transactions } = useTransactionStore()
  const { monedaBase } = useAuthStore()
  const base = monedaBase as Currency

  const [tipo, setTipo]               = useState<TransactionType>(editing?.tipo ?? initialType)
  const [monto, setMonto]             = useState(editing ? String(editing.monto) : '')
  const [moneda, setMoneda]           = useState<Currency>(editing?.moneda ?? 'ARS')
  const [categoria, setCategoria]     = useState(editing?.categoria ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [fecha, setFecha]             = useState(
    editing ? editing.fecha.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [ejecutado, setEjecutado]     = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente]   = useState(editing?.recurrente ?? false)
  const [asignadoA, setAsignadoA]     = useState<string | null>(editing?.asignadoA ?? null)
  const [saving, setSaving]           = useState(false)

  const ingresos = useMemo(
    () => transactions.filter((t) => t.tipo === 'ingreso' && t.id && t.id !== editing?.id),
    [transactions, editing?.id],
  )

  function handleTipoChange(t: TransactionType) {
    setTipo(t)
    setCategoria('')
    if (t === 'ingreso') setAsignadoA(null)
  }

  async function handleSave() {
    const m = parseFloat(monto)
    if (!m || m <= 0) return showToast('Ingresá un monto válido', 'error')
    if (!categoria) return showToast('Seleccioná una categoría', 'error')
    const payload = {
      userId: 'shared', tipo, monto: m, moneda, categoria, descripcion,
      nota: editing?.nota ?? '', tags: editing?.tags ?? [],
      fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
      ejecutado, asignadoA: tipo === 'egreso' ? asignadoA : null,
      creadoPor: editing?.creadoPor || SHARED_USERS[0].id,
      recurrente,
    }
    setSaving(true)
    try {
      if (editing?.id) {
        await updateTransaction(editing.id, payload)
        showToast('Movimiento actualizado')
      } else {
        await addTransaction(payload)
        showToast('Movimiento agregado')
      }
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('¿Eliminar este movimiento?')) return
    setSaving(true)
    try {
      await deleteTransaction(editing.id)
      showToast('Movimiento eliminado')
      onClose()
    } catch {
      showToast('Error al eliminar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const isIngreso = tipo === 'ingreso'
  const accentBg = isIngreso ? 'bg-income/8' : 'bg-expense/8'
  const accentRing = isIngreso ? 'ring-income/20' : 'ring-expense/20'

  return (
    <div className="space-y-4">
      {/* Tipo toggle */}
      <div className={`-mx-6 -mt-2 px-6 pt-4 pb-4 ${accentBg} ring-1 ${accentRing} mb-1`}>
        <div className="inline-flex p-0.5 rounded-lg bg-surface border border-border mb-4">
          {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTipoChange(t)}
              className={`px-5 h-8 text-sm font-semibold rounded-[6px] transition-all ${
                tipo === t
                  ? t === 'ingreso'
                    ? 'bg-income text-white shadow-sm'
                    : 'bg-expense text-white shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
            </button>
          ))}
        </div>

        {/* Monto + Moneda */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Monto">
              <input
                type="number" inputMode="decimal" value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className={`${inputCls} text-xl font-semibold h-11`}
              />
            </Field>
          </div>
          <div className="w-24">
            <Field label="Moneda">
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)} className={selectCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Categoría */}
      <Field label="Categoría">
        <CategoryPicker
          key={tipo}
          tipo={tipo}
          value={categoria}
          onChange={setCategoria}
          settings={settings as Settings}
        />
      </Field>

      {/* Concepto */}
      <Field label="Concepto">
        <input
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Alquiler, Sueldo, Supermercado"
          className={inputCls}
        />
      </Field>

      {/* Fecha + Mes siguiente */}
      <Field label="Fecha">
        <div className="flex gap-2">
          <input
            type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={() => setFecha(advanceMonth(fecha))}
            title="Enviar a mes siguiente"
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-surface text-xs text-muted hover:text-foreground hover:border-primary/50 hover:bg-surface-2 transition-all shrink-0"
          >
            <CalendarArrowUp className="h-3.5 w-3.5" />
            Mes siguiente
          </button>
        </div>
      </Field>

      {/* Checkboxes */}
      <div className="flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <span className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
            ejecutado ? 'bg-primary border-primary' : 'border-border bg-surface'
          }`} onClick={() => setEjecutado(!ejecutado)}>
            {ejecutado && <Check className="h-2.5 w-2.5 text-white" />}
          </span>
          <input type="checkbox" checked={ejecutado} onChange={(e) => setEjecutado(e.target.checked)} className="sr-only" />
          {isIngreso ? 'Recibido' : 'Pagado'}
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <span className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
            recurrente ? 'bg-primary border-primary' : 'border-border bg-surface'
          }`} onClick={() => setRecurrente(!recurrente)}>
            {recurrente && <Check className="h-2.5 w-2.5 text-white" />}
          </span>
          <input type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)} className="sr-only" />
          Recurrente
        </label>
      </div>

      {/* Asignar a ingreso — solo para egresos */}
      {tipo === 'egreso' && (
        <Field label="Asignar a ingreso" hint={asignadoA ? 'click para desasignar' : 'opcional'}>
          <IngresoChips
            ingresos={ingresos}
            transactions={transactions}
            editingId={editing?.id}
            value={asignadoA}
            onChange={setAsignadoA}
            settings={settings as Settings}
            base={base}
          />
        </Field>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 mt-2">
        {editing ? (
          <Button variant="ghost" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 text-expense" />
            <span className="text-expense">Eliminar</span>
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  )
}
