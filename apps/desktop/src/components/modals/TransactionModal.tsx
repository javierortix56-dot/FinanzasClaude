'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { addTransaction, updateTransaction, deleteTransaction } from '@finanzas/core/lib/transactions'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase } from '@finanzas/core/lib/currency'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Transaction, TransactionType, CategoryGroup } from '@finanzas/core/types'
import { SHARED_USERS, toLocalDateString } from '@finanzas/core/lib/constants'
import { formatMoney } from '@/lib/money'
import { Check, Trash2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  initialType?: TransactionType
  editing?: Transaction | null
}

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

function activeGroups(groups: CategoryGroup[]): CategoryGroup[] {
  return groups.filter((g) => g.activa)
}

/** Subcategorías elegibles de un grupo. Un grupo sin subcategorías es él mismo. */
function optionsOf(group: CategoryGroup): { id: string; nombre: string; color: string }[] {
  const subs = group.subcategorias.filter((s) => s.activa)
  if (subs.length > 0) return subs.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color }))
  return [{ id: group.id, nombre: group.nombre, color: group.color }]
}

/** Grupo al que pertenece una categoría (o el grupo mismo si no tiene hijas). */
function groupOf(categoriaId: string, groups: CategoryGroup[]): CategoryGroup | undefined {
  return groups.find(
    (g) => g.id === categoriaId || g.subcategorias.some((s) => s.id === categoriaId),
  )
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
  const base = useAuthStore((s) => s.monedaBase) as Currency

  const [tipo, setTipo]             = useState<TransactionType>(editing?.tipo ?? initialType)
  const [monto, setMonto]           = useState(editing ? String(editing.monto) : '')
  const [moneda, setMoneda]         = useState<Currency>(editing?.moneda ?? 'ARS')
  const [categoria, setCategoria]   = useState(editing?.categoria ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [nota, setNota]             = useState(editing?.nota ?? '')
  const [fecha, setFecha]           = useState(
    editing ? toLocalDateString(editing.fecha.toDate()) : toLocalDateString(),
  )
  const [creadoPor, setCreadoPor]   = useState(editing?.creadoPor || SHARED_USERS[0].id)
  const [ejecutado, setEjecutado]   = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente] = useState(editing?.recurrente ?? false)
  const [saving, setSaving]         = useState(false)

  const groups = activeGroups(
    tipo === 'ingreso' ? settings.categoriasIngreso : settings.categoriasGasto,
  )

  // El grupo abierto se deriva de la categoría elegida; abrirlo a mano (sin
  // elegir subcategoría todavía) se guarda aparte.
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(
    () => groupOf(editing?.categoria ?? '', groups)?.id ?? null,
  )
  const grupoActivo = groupOf(categoria, groups)?.id ?? grupoAbierto
  const grupo = groups.find((g) => g.id === grupoActivo) ?? null

  function pickGrupo(g: CategoryGroup) {
    const opciones = optionsOf(g)
    setGrupoAbierto(g.id)
    // Un grupo sin subcategorías ya ES la categoría: no tiene sentido pedir
    // un segundo clic para confirmarlo.
    setCategoria(opciones.length === 1 && opciones[0].id === g.id ? g.id : '')
  }

  function pickTipo(t: TransactionType) {
    if (t === tipo) return
    setTipo(t)
    // Las categorías de ingreso y de gasto son listas distintas: al cambiar de
    // tipo, lo elegido antes ya no aplica.
    setCategoria('')
    setGrupoAbierto(null)
  }

  // Vista previa de la conversión: el movimiento se guarda en su moneda
  // original, pero los totales y los listados lo muestran en la moneda base.
  const montoNum = parseFloat(monto)
  const montoEnBase =
    moneda !== base && Number.isFinite(montoNum) && montoNum > 0
      ? toBase(montoNum, moneda, base, settings)
      : null

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
      asignaciones: editing?.asignaciones ?? [],
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

  const income = tipo === 'ingreso'

  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { value: 'egreso', label: 'Egreso' },
          { value: 'ingreso', label: 'Ingreso' },
        ]}
        value={tipo}
        onChange={(v) => pickTipo(v as TransactionType)}
        tone={income ? 'income' : 'expense'}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Label>Monto</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="h-11 text-lg font-semibold tabular-nums"
            autoFocus
          />
        </div>
        <div>
          <Label>Moneda</Label>
          <Segmented
            className="h-11"
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            value={moneda}
            onChange={(v) => setMoneda(v as Currency)}
          />
        </div>
      </div>

      {montoEnBase !== null && (
        <p className="-mt-1 text-xs text-muted">
          {montoEnBase > 0
            ? <>Equivale a <span className="font-semibold text-foreground tabular-nums">{formatMoney(montoEnBase, base)}</span> con el tipo de cambio actual.</>
            : <>Falta configurar el tipo de cambio de {moneda} en Ajustes para convertirlo a {base}.</>}
        </p>
      )}

      <div>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <Chip
              key={g.id}
              color={g.color}
              selected={g.id === grupoActivo}
              onClick={() => pickGrupo(g)}
            >
              {g.nombre}
            </Chip>
          ))}
        </div>

        {grupo && optionsOf(grupo).length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-[10px] border border-border bg-surface-2 p-2">
            {optionsOf(grupo).map((c) => (
              <Chip
                key={c.id}
                color={c.color}
                selected={c.id === categoria}
                onClick={() => setCategoria(c.id)}
              >
                {c.nombre}
              </Chip>
            ))}
          </div>
        )}

        {!grupo && (
          <p className="mt-2 text-xs text-muted-2">
            Elegí un grupo para ver sus categorías.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <Label>Cargado por</Label>
          <Segmented
            className="h-10"
            options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre }))}
            value={creadoPor}
            onChange={setCreadoPor}
          />
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
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-[64px]" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Toggle active={ejecutado} onClick={() => setEjecutado((v) => !v)}>
          {income ? 'Recibido' : 'Pagado'}
        </Toggle>
        <Toggle active={recurrente} onClick={() => setRecurrente((v) => !v)}>
          Recurrente mensual
        </Toggle>
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

function Segmented({
  options, value, onChange, tone, className,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  tone?: 'income' | 'expense'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-[3px] rounded-[10px] border border-border bg-surface-2 p-[3px]',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        const activeTone =
          tone === undefined
            ? 'bg-surface text-foreground shadow-card'
            : o.value === 'ingreso'
              ? 'bg-income text-white'
              : 'bg-expense text-white'
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'h-full rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
              active ? activeTone : 'text-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Chip({
  color, selected, onClick, children,
}: {
  color: string
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        selected
          ? 'border-transparent text-white'
          : 'border-border bg-surface text-foreground hover:bg-surface-2',
      )}
      style={selected ? { backgroundColor: color } : undefined}
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: selected ? 'rgba(255,255,255,0.85)' : color }}
      />
      {children}
    </button>
  )
}

function Toggle({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-surface text-muted hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'grid h-[15px] w-[15px] place-items-center rounded-full border-2 transition-colors',
          active ? 'border-primary bg-primary text-white' : 'border-border-strong text-transparent',
        )}
      >
        <Check className="h-2 w-2" strokeWidth={4} />
      </span>
      {children}
    </button>
  )
}
