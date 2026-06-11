'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
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
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-3xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-9 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 pb-4">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {title ?? (category ? 'Editar categoría' : 'Nueva categoría')}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              aria-label="Cerrar"
            >
              <X size={15} className="text-gray-600" />
            </button>
          </div>

          {/* El form se remonta por key al abrir/cambiar de categoría: el
              estado inicial se toma en useState, sin setState en un effect. */}
          {open && (
            <Form
              key={category?.id ?? 'new'}
              category={category}
              onSave={onSave}
              onDelete={onDelete}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Form({ category, onSave, onDelete }: Pick<Props, 'category' | 'onSave' | 'onDelete'>) {
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
    <div className="px-5 pb-8 space-y-5">
            {/* Nombre */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Nombre</label>
              <input
                type="text"
                placeholder="Nombre de la categoría"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-2 w-full bg-gray-50 rounded-xl px-3.5 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#534AB7]/30 focus:bg-white transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Color */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Color</label>
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-9 h-9 rounded-full transition-all ${
                      color === c ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
              {/* Preview chip */}
              {nombre.trim() && (
                <div className="mt-3">
                  <span
                    className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {nombre}
                  </span>
                </div>
              )}
            </div>

            {/* Toggle activa */}
            <button
              type="button"
              onClick={() => setActiva((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${
                activa ? 'border-[#534AB7] bg-[#534AB7]/5' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <span className={`text-sm font-semibold ${activa ? 'text-[#534AB7]' : 'text-gray-400'}`}>
                Categoría activa
              </span>
              <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${activa ? 'bg-[#534AB7]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform shadow ${activa ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </button>

            {/* Acciones */}
            <div className="flex gap-2.5 pt-1">
              {category && onDelete && (
                <button
                  onClick={() => {
                    if (!deleteConfirm) { setDeleteConfirm(true); return }
                    onDelete(category.id)
                  }}
                  className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl border-2 transition-all ${
                    deleteConfirm ? 'bg-red-400 border-red-400 text-white' : 'border-red-100 text-red-400 hover:bg-red-50'
                  }`}
                >
                  <Trash2 size={17} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!nombre.trim()}
                className="flex-1 h-12 rounded-2xl bg-[#534AB7] text-white text-sm font-bold disabled:opacity-40 transition-all hover:bg-[#4238a8] active:scale-[0.98]"
              >
                {category ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
      {deleteConfirm && (
        <p className="text-[11px] text-red-400 text-center -mt-2">
          Tocá el ícono rojo de nuevo para confirmar
        </p>
      )}
    </div>
  )
}
