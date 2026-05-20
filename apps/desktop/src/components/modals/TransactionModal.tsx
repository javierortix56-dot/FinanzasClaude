'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency, Transaction, TransactionType, CategoryGroup } from '@finanzas/core/types'
import { SHARED_USERS } from '@finanzas/core/lib/constants'
import { Trash2 } from 'lucide-react'

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

function Form({
  editing, initialType, onClose,
}: {
  editing: Transaction | null
  initialType: TransactionType
  onClose: () => void
}) {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)

  const [tipo, setTipo]             = useState<TransactionType>(editing?.tipo ?? initialType)
  const [monto, setMonto]           = useState(editing ? String(editing.monto) : '')
  const [moneda, setMoneda]         = useState<Currency>(editing?.moneda ?? 'ARS')
  const [categoria, setCategoria]   = useState(editing?.categoria ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [nota, setNota]             = useState(editing?.nota ?? '')
  const [fecha, setFecha]           = useState(
    editing ? editing.fecha.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [creadoPor, setCreadoPor]   = useState(editing?.creadoPor || SHARED_USERS[0].id)
  const [ejecutado, setEjecutado]   = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente] = useState(editing?.recurrente ?? false)
  const [saving, setSaving]         = useState(false)

  const cats = flattenCategories(
    tipo === 'ingreso' ? settings.categoriasIngreso : settings.categoriasGasto,
  )

  async function handleSave() {
    const m = parseFloat(monto)
    if (!m || m <= 0) return showToast('Ingresá un monto válido', 'error')
    if (!categoria) return showToast('Seleccioná una categoría', 'error')

    const payload = {
      userId: 'shared',
      tipo,
      monto: m,
      moneda,
      categoria,
      descripcion,
      nota,
      tags: [],
      fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
      ejecutado,
      asignadoA: editing?.asignadoA ?? null,
      creadoPor,
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
    <div className="space-y-4">
      <div className="inline-flex p-1 rounded-md bg-surface-2 border border-border">
        {(['egreso', 'ingreso'] as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-4 h-8 text-sm font-medium rounded transition-colors ${
              tipo === t
                ? t === 'ingreso'
                  ? 'bg-income text-white'
                  : 'bg-expense text-white'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label>Monto</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoría</Label>
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Seleccionar…</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.group} · {c.nombre}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Concepto</Label>
        <Input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Sueldo, Supermercado, Alquiler"
        />
      </div>

      <div>
        <Label>Nota (opcional)</Label>
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cargado por</Label>
          <Select value={creadoPor} onChange={(e) => setCreadoPor(e.target.value)}>
            {SHARED_USERS.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={ejecutado}
              onChange={(e) => setEjecutado(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            {tipo === 'ingreso' ? 'Recibido' : 'Pagado'}
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={recurrente}
              onChange={(e) => setRecurrente(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Recurrente mensual
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 mt-5">
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
