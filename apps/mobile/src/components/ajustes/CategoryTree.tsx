'use client'

import { useState } from 'react'
import { Reorder, motion, useDragControls } from 'motion/react'
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Category, CategoryGroup } from '@finanzas/core/types'
import Collapse from '@/components/ui/Collapse'
import { spring } from '@/components/ui/motion'
import { CategoryIcon } from '@/lib/categoryIcons'
import { haptic } from '@/lib/haptics'

interface Props {
  groups: CategoryGroup[]
  /** Nuevo orden (grupos y/o subcategorías). Se llama al soltar. */
  onReorder: (groups: CategoryGroup[]) => void
  onAddGroup: () => void
  onEditGroup: (g: CategoryGroup) => void
  onDeleteGroup: (g: CategoryGroup) => void
  onAddSub: (g: CategoryGroup) => void
  onEditSub: (g: CategoryGroup, sub: Category) => void
  onDeleteSub: (g: CategoryGroup, sub: Category) => void
}

/**
 * Árbol de categorías editable: grupos y subcategorías se reordenan
 * arrastrando el handle (⋮⋮). El orden se guarda al soltar.
 */
export default function CategoryTree(props: Props) {
  const { groups, onReorder, onAddGroup } = props
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Orden local mientras se arrastra; se resincroniza si cambian los grupos
  const [order, setOrder] = useState(groups)
  const [prevGroups, setPrevGroups] = useState(groups)
  if (prevGroups !== groups) {
    setPrevGroups(groups)
    setOrder(groups)
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function commit(next: CategoryGroup[]) {
    const changed = next.some((g, i) => g.id !== groups[i]?.id ||
      g.subcategorias.some((s, j) => s.id !== groups[i]?.subcategorias[j]?.id))
    if (changed) onReorder(next)
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={onAddGroup}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed border-primary/35 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
      >
        <Plus size={14} /> Nueva categoría padre
      </button>

      <p className="text-[11px] text-gray-400 px-1">Arrastrá desde ⋮⋮ para reordenar.</p>

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-1.5">
        {order.map((group) => (
          <GroupItem
            key={group.id}
            group={group}
            isOpen={expanded.has(group.id)}
            onToggle={() => toggle(group.id)}
            onDragEnd={() => commit(order)}
            onSubsReorder={(subs) => setOrder((prev) => prev.map((g) => (g.id === group.id ? { ...g, subcategorias: subs } : g)))}
            onSubsDragEnd={() => commit(order)}
            {...props}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function GroupItem({ group, isOpen, onToggle, onDragEnd, onSubsReorder, onSubsDragEnd, onEditGroup, onDeleteGroup, onAddSub, onEditSub, onDeleteSub }: Props & {
  group: CategoryGroup
  isOpen: boolean
  onToggle: () => void
  onDragEnd: () => void
  onSubsReorder: (subs: Category[]) => void
  onSubsDragEnd: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={group}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.25)' }}
      className="rounded-2xl bg-surface/70 overflow-hidden"
    >
      <div className="flex items-center gap-1 pl-1 pr-1.5 py-1.5">
        <span
          className="w-8 h-10 flex items-center justify-center text-gray-300 touch-none cursor-grab active:cursor-grabbing flex-shrink-0"
          onPointerDown={(e) => { haptic('light'); controls.start(e) }}
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical size={16} />
        </span>
        <button onClick={onToggle} aria-expanded={isOpen} className="flex items-center gap-2 flex-1 min-w-0 text-left h-10">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: group.color + '1f', color: group.color }}>
            <CategoryIcon cat={group} size={14} />
          </span>
          <span className={`text-sm font-semibold truncate ${!group.activa ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {group.nombre}
          </span>
          <span className="text-[11px] text-gray-400">({group.subcategorias.length})</span>
          <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={spring} className="text-gray-400 flex-shrink-0 ml-auto inline-flex">
            <ChevronDown size={14} />
          </motion.span>
        </button>
        <IconButton label="Editar grupo" onClick={() => onEditGroup(group)} className="text-gray-400 hover:bg-gray-500/10"><Pencil size={14} /></IconButton>
        <IconButton label="Eliminar grupo" onClick={() => onDeleteGroup(group)} className="text-rose-500 hover:bg-rose-500/10"><Trash2 size={14} /></IconButton>
      </div>

      <Collapse open={isOpen}>
        <div className="border-t border-hairline px-1.5 py-1">
          {group.subcategorias.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-2 italic">Sin subcategorías</p>
          ) : (
            <Reorder.Group axis="y" values={group.subcategorias} onReorder={onSubsReorder}>
              {group.subcategorias.map((sub) => (
                <SubItem
                  key={sub.id}
                  sub={sub}
                  onDragEnd={onSubsDragEnd}
                  onEdit={() => onEditSub(group, sub)}
                  onDelete={() => onDeleteSub(group, sub)}
                />
              ))}
            </Reorder.Group>
          )}
          <button
            onClick={() => onAddSub(group)}
            className="w-full flex items-center gap-2 h-10 pl-3 rounded-xl text-xs font-semibold text-primary hover:bg-primary/5"
          >
            <Plus size={14} /> Nueva subcategoría
          </button>
        </div>
      </Collapse>
    </Reorder.Item>
  )
}

function SubItem({ sub, onDragEnd, onEdit, onDelete }: {
  sub: Category
  onDragEnd: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={sub}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02 }}
      className="flex items-center gap-1.5 pr-1 rounded-xl bg-surface/0 hover:bg-gray-500/[0.05]"
    >
      <span
        className="w-8 h-10 flex items-center justify-center text-gray-300 touch-none cursor-grab flex-shrink-0"
        onPointerDown={(e) => { haptic('light'); controls.start(e) }}
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={14} />
      </span>
      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sub.color + '1f', color: sub.color }}>
        <CategoryIcon cat={sub} size={12} />
      </span>
      <span className={`flex-1 text-xs truncate ${!sub.activa ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {sub.nombre}
      </span>
      <IconButton label="Editar subcategoría" onClick={onEdit} className="text-gray-400 hover:bg-gray-500/10"><Pencil size={13} /></IconButton>
      <IconButton label="Eliminar subcategoría" onClick={onDelete} className="text-rose-500 hover:bg-rose-500/10"><Trash2 size={13} /></IconButton>
    </Reorder.Item>
  )
}

/** Botón de ícono con área táctil de 44 px */
function IconButton({ label, onClick, className, children }: {
  label: string
  onClick: () => void
  className: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-9 h-10 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
