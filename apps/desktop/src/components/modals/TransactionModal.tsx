'use client'

import { useMemo, useState, KeyboardEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency, Transaction, TransactionType, CategoryGroup, Settings } from '@finanzas/core/types'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { Trash2, X, ChevronDown } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  initialType?: TransactionType
  editing?: Transaction | null
}

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

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
      {/* Grupos */}
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

      {/* Subcategorías */}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted mb-1.5">{label}</div>
      {children}
    </div>
  )
}

const inputCls =
  'h-8 w-full rounded border border-border bg-surface px-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/50'
const selectCls =
  'h-8 w-full rounded border border-border bg-surface px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50'

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

  const [tipo, setTipo]               = useState<TransactionType>(editing?.tipo ?? initialType)
  const [monto, setMonto]             = useState(editing ? String(editing.monto) : '')
  const [moneda, setMoneda]           = useState<Currency>(editing?.moneda ?? 'ARS')
  const [categoria, setCategoria]     = useState(editing?.categoria ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [nota, setNota]               = useState(editing?.nota ?? '')
  const [fecha, setFecha]             = useState(
    editing ? editing.fecha.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [ejecutado, setEjecutado]     = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente]   = useState(editing?.recurrente ?? false)
  const [tags, setTags]               = useState<string[]>(editing?.tags ?? [])
  const [tagInput, setTagInput]       = useState('')
  const [asignadoA, setAsignadoA]     = useState<string | null>(editing?.asignadoA ?? null)
  const [saving, setSaving]           = useState(false)
  const [expanded, setExpanded]       = useState(
    !!(editing?.nota || editing?.tags?.length || editing?.asignadoA),
  )

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso' && t.id && t.id !== editing?.id)

  function handleTipoChange(t: TransactionType) {
    setTipo(t)
    setCategoria('')
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }
  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) setTags(tags.slice(0, -1))
  }

  async function handleSave() {
    const m = parseFloat(monto)
    if (!m || m <= 0) return showToast('Ingresá un monto válido', 'error')
    if (!categoria) return showToast('Seleccioná una categoría', 'error')
    const payload = {
      userId: 'shared', tipo, monto: m, moneda, categoria, descripcion, nota, tags,
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

  return (
    <div className="space-y-3">
      {/* Tipo */}
      <div className="inline-flex p-0.5 rounded-md bg-surface-2 border border-border">
        {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTipoChange(t)}
            className={`px-4 h-7 text-sm font-medium rounded transition-colors ${
              tipo === t
                ? t === 'ingreso' ? 'bg-income text-white' : 'bg-expense text-white'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
          </button>
        ))}
      </div>

      {/* Monto + Moneda + Fecha */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <Field label="Monto">
            <input
              type="number" inputMode="decimal" value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00" className={inputCls}
            />
          </Field>
        </div>
        <div>
          <Field label="Moneda">
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)} className={selectCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Categoría — chips */}
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

      {/* Checkboxes */}
      <div className="flex items-center gap-5">
        <label className="inline-flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox" checked={ejecutado} onChange={(e) => setEjecutado(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          {tipo === 'ingreso' ? 'Recibido' : 'Pagado'}
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox" checked={recurrente} onChange={(e) => setRecurrente(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          Recurrente
        </label>
      </div>

      {/* Más opciones */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Menos opciones' : 'Más opciones'}
      </button>

      {expanded && (
        <div className="space-y-3">
          <Field label="Nota">
            <textarea
              value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
          </Field>

          <Field label="Etiquetas">
            <div className="flex flex-wrap gap-1.5 min-h-[32px] w-full rounded border border-border bg-surface px-2 py-1 focus-within:ring-1 focus-within:ring-primary/50">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs bg-surface-2 border border-border rounded px-1.5 py-0.5">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="text-muted hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown} onBlur={addTag}
                placeholder={tags.length === 0 ? 'Enter para agregar…' : ''}
                className="flex-1 min-w-[100px] bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
              />
            </div>
          </Field>

          {tipo === 'egreso' && (
            <Field label="Asignado a ingreso">
              <select value={asignadoA ?? ''} onChange={(e) => setAsignadoA(e.target.value || null)} className={selectCls}>
                <option value="">Sin asignar</option>
                {ingresos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.descripcion || '(sin concepto)'} — {t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 mt-4">
        {editing ? (
          <Button variant="ghost" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 text-expense" />
            <span className="text-expense">Eliminar</span>
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </div>
  )
}
