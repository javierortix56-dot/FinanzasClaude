'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { updateSettings, DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { cn } from '@finanzas/core/lib/utils'
import { Category, CategoryGroup, Settings } from '@finanzas/core/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const PRESET_COLORS = [
  '#8B5CF6', '#10B981', '#3B82F6', '#EF4444', '#F59E0B',
  '#EC4899', '#6366F1', '#14B8A6', '#534AB7', '#6B7280',
  '#F97316', '#84CC16', '#06B6D4', '#A855F7', '#E11D48',
]

type Tipo = 'gasto' | 'ingreso'

/** Qué se está editando en el modal: un grupo, o una subcategoría de un grupo. */
type Editing =
  | { kind: 'grupo'; group: CategoryGroup | null }
  | { kind: 'sub'; groupId: string; category: Category | null }

function listKey(tipo: Tipo) {
  return tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
}

function listOf(s: Settings, tipo: Tipo): CategoryGroup[] {
  return tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso
}

/**
 * ID estable a partir del nombre, único entre todas las categorías (grupos y
 * subcategorías, gastos e ingresos): los movimientos guardan este id, así que
 * un choque haría que dos categorías distintas se vean como la misma.
 */
function makeId(nombre: string, s: Settings): string {
  const bases = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'cat'
  const usados = new Set<string>()
  for (const g of [...s.categoriasGasto, ...s.categoriasIngreso]) {
    usados.add(g.id)
    for (const sub of g.subcategorias ?? []) usados.add(sub.id)
  }
  if (!usados.has(bases)) return bases
  let n = 2
  while (usados.has(`${bases}_${n}`)) n++
  return `${bases}_${n}`
}

export function CategoryTree({ tipo }: { tipo: Tipo }) {
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const setSettings = useSettingsStore((s) => s.setSettings)
  const showToast = useUIStore((s) => s.showToast)
  const transactions = useTransactionStore((s) => s.transactions)

  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Editing | null>(null)

  const groups = listOf(settings, tipo)

  async function persist(list: CategoryGroup[]) {
    const partial = { [listKey(tipo)]: list }
    // Optimista: el árbol responde al instante y Supabase reconcilia después.
    setSettings({ ...settings, ...partial } as Settings)
    try {
      await updateSettings('shared', partial)
    } catch {
      setSettings(settings)
      showToast('No se pudo guardar', 'error')
    }
  }

  function toggle(id: string) {
    setAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  /** Movimientos del mes en pantalla que quedarían apuntando a algo borrado. */
  function usos(ids: string[]): number {
    return transactions.filter((t) => ids.includes(t.categoria)).length
  }

  async function saveGrupo(datos: Category, original: CategoryGroup | null) {
    const list = [...groups]
    if (original) {
      const idx = list.findIndex((g) => g.id === original.id)
      if (idx < 0) return
      list[idx] = { ...list[idx], nombre: datos.nombre, color: datos.color, activa: datos.activa }
    } else {
      list.push({
        id: makeId(datos.nombre, settings),
        nombre: datos.nombre,
        color: datos.color,
        activa: datos.activa,
        subcategorias: [],
      })
    }
    setEditing(null)
    await persist(list)
  }

  async function deleteGrupo(g: CategoryGroup) {
    const ids = [g.id, ...(g.subcategorias ?? []).map((s) => s.id)]
    const enUso = usos(ids)
    const detalle = [
      (g.subcategorias?.length ?? 0) > 0
        ? `Se borran también sus ${g.subcategorias.length} subcategorías.`
        : '',
      enUso > 0
        ? `${enUso} movimiento(s) del mes en pantalla la usan y quedarían sin categoría.`
        : '',
      'Si solo querés sacarla de los selectores, marcala como inactiva.',
    ].filter(Boolean).join('\n')
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"?\n\n${detalle}`)) return
    setEditing(null)
    await persist(groups.filter((x) => x.id !== g.id))
  }

  async function saveSub(datos: Category, groupId: string, original: Category | null) {
    const list = [...groups]
    const gIdx = list.findIndex((g) => g.id === groupId)
    if (gIdx < 0) {
      // El grupo desapareció mientras el modal estaba abierto (lo borró la app
      // móvil, o falló el guardado que lo creó): cerrar sin dejarlo colgado.
      setEditing(null)
      return showToast('El grupo ya no existe', 'error')
    }
    const subs = [...(list[gIdx].subcategorias ?? [])]
    if (original) {
      const sIdx = subs.findIndex((c) => c.id === original.id)
      if (sIdx < 0) return
      subs[sIdx] = { ...subs[sIdx], nombre: datos.nombre, color: datos.color, activa: datos.activa }
    } else {
      subs.push({ ...datos, id: makeId(datos.nombre, settings) })
    }
    list[gIdx] = { ...list[gIdx], subcategorias: subs }
    setEditing(null)
    setAbiertos((prev) => ({ ...prev, [groupId]: true }))
    await persist(list)
  }

  async function deleteSub(groupId: string, sub: Category) {
    const enUso = usos([sub.id])
    const aviso = enUso > 0
      ? `\n\n${enUso} movimiento(s) del mes en pantalla la usan y quedarían sin categoría.`
      : ''
    if (!confirm(`¿Eliminar "${sub.nombre}"?${aviso}`)) return
    const list = [...groups]
    const gIdx = list.findIndex((g) => g.id === groupId)
    if (gIdx < 0) {
      setEditing(null)
      return showToast('El grupo ya no existe', 'error')
    }
    list[gIdx] = {
      ...list[gIdx],
      subcategorias: (list[gIdx].subcategorias ?? []).filter((c) => c.id !== sub.id),
    }
    setEditing(null)
    await persist(list)
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[10px] border border-border">
        {groups.length === 0 && (
          <p className="px-3.5 py-6 text-center text-[13px] text-muted">
            Todavía no hay grupos de {tipo === 'gasto' ? 'egreso' : 'ingreso'}.
          </p>
        )}

        {groups.map((g) => {
          const subs = g.subcategorias ?? []
          const open = abiertos[g.id] ?? false
          return (
            <div key={g.id} className="border-b border-border last:border-0">
              <div
                className={cn(
                  'group flex items-center gap-2 px-2.5 py-2 transition-colors hover:bg-surface-2',
                  !g.activa && 'opacity-60',
                )}
              >
                <button
                  onClick={() => toggle(g.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={open}
                >
                  {open
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-2" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-2" />}
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span className="truncate text-sm font-medium text-foreground">{g.nombre}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-2">({subs.length})</span>
                  {!g.activa && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted">
                      inactiva
                    </span>
                  )}
                </button>

                <RowActions
                  onAdd={() => setEditing({ kind: 'sub', groupId: g.id, category: null })}
                  addLabel="Nueva subcategoría"
                  onEdit={() => setEditing({ kind: 'grupo', group: g })}
                  onDelete={() => deleteGrupo(g)}
                />
              </div>

              {open && (
                <div className="border-t border-border bg-surface-2/50 pl-8">
                  {subs.length === 0 ? (
                    <p className="py-2.5 text-[12.5px] text-muted-2">Sin subcategorías.</p>
                  ) : (
                    subs.map((sub) => (
                      <div
                        key={sub.id}
                        className={cn(
                          'group flex items-center gap-2 border-b border-border py-1.5 pr-2.5 last:border-0',
                          !sub.activa && 'opacity-60',
                        )}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sub.color }} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                          {sub.nombre}
                          {!sub.activa && <span className="ml-1.5 text-[10px] text-muted-2">inactiva</span>}
                        </span>
                        <RowActions
                          onEdit={() => setEditing({ kind: 'sub', groupId: g.id, category: sub })}
                          onDelete={() => deleteSub(g.id, sub)}
                        />
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => setEditing({ kind: 'sub', groupId: g.id, category: null })}
                    className="inline-flex items-center gap-1.5 py-2 text-[12.5px] font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar subcategoría
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-2.5"
        onClick={() => setEditing({ kind: 'grupo', group: null })}
      >
        <Plus className="h-3.5 w-3.5" /> Nuevo grupo
      </Button>

      <CategoryModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(datos) => {
          if (!editing) return
          if (editing.kind === 'grupo') return saveGrupo(datos, editing.group)
          return saveSub(datos, editing.groupId, editing.category)
        }}
        onDelete={() => {
          if (!editing) return
          if (editing.kind === 'grupo' && editing.group) return deleteGrupo(editing.group)
          if (editing.kind === 'sub' && editing.category) return deleteSub(editing.groupId, editing.category)
        }}
      />
    </div>
  )
}

function RowActions({
  onAdd, addLabel, onEdit, onDelete,
}: {
  onAdd?: () => void
  addLabel?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {onAdd && (
        <button
          onClick={onAdd}
          title={addLabel}
          aria-label={addLabel}
          className="grid h-6 w-6 place-items-center rounded text-muted-2 hover:bg-surface hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onEdit}
        title="Editar"
        aria-label="Editar"
        className="grid h-6 w-6 place-items-center rounded text-muted-2 hover:bg-surface hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDelete}
        title="Eliminar"
        aria-label="Eliminar"
        className="grid h-6 w-6 place-items-center rounded text-muted-2 hover:bg-surface hover:text-expense"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

function CategoryModal({
  editing, onClose, onSave, onDelete,
}: {
  editing: Editing | null
  onClose: () => void
  onSave: (datos: Category) => void
  onDelete: () => void
}) {
  const actual = editing
    ? editing.kind === 'grupo' ? editing.group : editing.category
    : null
  const esGrupo = editing?.kind === 'grupo'
  const titulo = actual
    ? esGrupo ? 'Editar grupo' : 'Editar subcategoría'
    : esGrupo ? 'Nuevo grupo' : 'Nueva subcategoría'

  return (
    <Modal open={!!editing} onClose={onClose} title={titulo} size="sm">
      {editing && (
        <CategoryForm
          key={actual?.id ?? `nuevo-${editing.kind}`}
          actual={actual}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Modal>
  )
}

function CategoryForm({
  actual, onClose, onSave, onDelete,
}: {
  actual: Category | CategoryGroup | null
  onClose: () => void
  onSave: (datos: Category) => void
  onDelete: () => void
}) {
  const [nombre, setNombre] = useState(actual?.nombre ?? '')
  const [color, setColor] = useState(actual?.color ?? PRESET_COLORS[0])
  const [activa, setActiva] = useState(actual?.activa ?? true)

  const limpio = nombre.trim()

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Esenciales, Alquiler"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && limpio) onSave({ id: actual?.id ?? '', nombre: limpio, color, activa })
          }}
        />
      </div>

      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cn(
                'h-7 w-7 rounded-full transition-transform',
                color === c ? 'scale-110 ring-2 ring-ring ring-offset-2 ring-offset-surface' : 'hover:scale-105',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2.5">
        <span className="text-sm text-foreground">
          Activa
          <span className="block text-xs text-muted">Las inactivas no aparecen al cargar movimientos.</span>
        </span>
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) => setActiva(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
      </label>

      <div className="-mx-6 -mb-5 mt-5 flex items-center justify-between gap-2 border-t border-border px-6 pb-5 pt-3">
        {actual ? (
          <Button variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-expense" />
            <span className="text-expense">Eliminar</span>
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!limpio}
            onClick={() => onSave({ id: actual?.id ?? '', nombre: limpio, color, activa })}
          >
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
