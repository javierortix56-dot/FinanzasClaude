'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Trash2, Check } from 'lucide-react'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import { springPop } from '@/components/ui/motion'
import { Category } from '@finanzas/core/types'

const PRESET_COLORS = [
  '#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B',
  '#EC4899','#6366F1','#14B8A6','#534AB7','#6B7280',
  '#F97316','#84CC16','#06B6D4','#A855F7','#E11D48',
]

interface Props {
  open: boolean
  category: Category | null
  onClose: () => void
  onSave: (cat: Category) => void
  onDelete?: (id: string) => void
  title?: string
}

export default function CategoryModal({ open, category, onClose, onSave, onDelete, title }: Props) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title ?? (category ? 'Editar categoría' : 'Nueva categoría')}
      bodyClassName="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      {/* El contenido se monta al abrir: el estado se inicializa desde
          props sin necesidad de sincronizarlo con un effect. */}
      <ModalBody
        key={category?.id ?? 'new'}
        category={category}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Sheet>
  )
}

function ModalBody({ category, onSave, onDelete }: Pick<Props, 'category' | 'onSave' | 'onDelete'>) {
  const [nombre, setNombre] = useState(category?.nombre ?? '')
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0])
  const [activa, setActiva] = useState(category?.activa ?? true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function handleSave() {
    if (!nombre.trim()) return
    onSave({
      id: category?.id ?? nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      nombre: nombre.trim(),
      color,
      activa,
    })
  }

  return (
    <div className="space-y-5">
      {/* Nombre */}
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <input
          type="text"
          placeholder="Nombre de la categoría"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={fieldClass}
        />
      </div>

      {/* Color */}
      <div>
        <FieldLabel>Color</FieldLabel>
        <div className="grid grid-cols-8 gap-2.5">
          {PRESET_COLORS.map((c) => (
            <motion.button
              key={c}
              whileTap={{ scale: 0.85 }}
              onClick={() => setColor(c)}
              className="relative w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${c}` : undefined }}
              aria-label={`Color ${c}`}
            >
              {color === c && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springPop} className="inline-flex">
                  <Check size={15} strokeWidth={3} className="text-white" />
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>
        {/* Preview chip */}
        {nombre.trim() && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex gap-2">
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {nombre}
            </span>
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: color + '18', color }}
            >
              {nombre}
            </span>
          </motion.div>
        )}
      </div>

      {/* Toggle activa */}
      <button
        type="button"
        role="switch"
        aria-checked={activa}
        onClick={() => setActiva((v) => !v)}
        className="w-full flex items-center justify-between px-4 h-14 rounded-2xl bg-gray-500/[0.06]"
      >
        <span className={`text-sm font-semibold ${activa ? 'text-gray-900' : 'text-gray-400'}`}>
          Categoría activa
        </span>
        <span className={`w-12 h-7 rounded-full p-0.5 flex transition-colors flex-shrink-0 ${activa ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'}`}>
          <motion.span layout transition={springPop} className="w-6 h-6 bg-white rounded-full shadow" />
        </span>
      </button>

      {deleteConfirm && (
        <p className="text-xs text-rose-500 text-center">
          Tocá el ícono rojo de nuevo para confirmar
        </p>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        {category && onDelete && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              if (!deleteConfirm) { setDeleteConfirm(true); return }
              onDelete(category.id)
            }}
            className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors ${
              deleteConfirm ? 'bg-rose-500 text-white' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/15'
            }`}
            aria-label={deleteConfirm ? 'Confirmar eliminación' : 'Eliminar categoría'}
          >
            <Trash2 size={17} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={!nombre.trim()}
          className="flex-1 h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
        >
          {category ? 'Guardar cambios' : 'Crear categoría'}
        </motion.button>
      </div>
    </div>
  )
}
