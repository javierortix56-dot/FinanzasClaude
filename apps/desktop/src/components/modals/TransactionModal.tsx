'use client'

import { useState, KeyboardEvent } from 'react'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency, Transaction, TransactionType, CategoryGroup } from '@finanzas/core/types'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { Trash2, X, ChevronDown } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  initialType?: TransactionType
  editing?: Transaction | null
}

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

function flattenCategories(groups: CategoryGroup[]): { id: string; nombre: string; group: string }[] {
  const out: { id: string; nombre: string; group: string }[] = []
  for (const g of groups) {
    if (!g.activa) continue
    for (const sub of g.subcategorias) {
      if (sub.activa) out.push({ id: sub.id, nombre: sub.nombre, group: g.nombre })
    }
    if (g.subcategorias.length === 0) out.push({ id: g.id, nombre: g.nombre, group: g.nombre })
  }
  return out
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted mb-1">{label}</div>
      {children}
    </div>
  )
}

const inputCls = 'h-8 w-full rounded border border-border bg-surface px-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/50'
const selectCls = 'h-8 w-full rounded border border-border bg-surface px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50'

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
  const [creadoPor, setCreadoPor]     = useState(editing?.creadoPor || SHARED_USERS[0].id)
  const [ejecutado, setEjecutado]     = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente]   = useState(editing?.recurrente ?? false)
  const [tags, setTags]               = useState<string[]>(editing?.tags ?? [])
  const [tagInput, setTagInput]       = useState('')
  const [asignadoA, setAsignadoA]     = useState<string | null>(editing?.asignadoA ?? null)
  const [saving, setSaving]           = useState(false)
  const [expanded, setExpanded]       = useState(!!(editing?.nota || (editing?.tags?.length) || editing?.asignadoA))

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso' && t.id && t.id !== editing?.id)
  const cats = flattenCategories(tipo === 'ingreso' ? settings.categoriasIngreso : settings.categoriasGasto)

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
      ejecutado, asignadoA: tipo === 'egreso' ? asignadoA : null, creadoPor, recurrente,
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
      {/* Tipo toggle */}
      <div className="inline-flex p-0.5 rounded-md bg-surface-2 border border-border">
        {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
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

      {/* Fila 1: Monto + Moneda + Fecha */}
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

      {/* Fila 2: Categoría */}
      <Field label="Categoría">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={selectCls}>
          <option value="">Seleccionar…</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.group} · {c.nombre}</option>
          ))}
        </select>
      </Field>

      {/* Fila 3: Concepto */}
      <Field label="Concepto">
        <input
          value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Alquiler, Sueldo, Supermercado"
          className={inputCls}
        />
      </Field>

      {/* Fila 4: Cargado por + checkboxes */}
      <div className="flex items-end gap-4">
        <div className="w-32">
          <Field label="Cargado por">
            <select value={creadoPor} onChange={(e) => setCreadoPor(e.target.value)} className={selectCls}>
              {SHARED_USERS.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-4 pb-0.5">
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
      </div>

      {/* Más opciones (nota, etiquetas, asignación) */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Menos opciones' : 'Más opciones'}
      </button>

      {expanded && (
        <div className="space-y-3 pt-0.5">
          <Field label="Nota (opcional)">
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
