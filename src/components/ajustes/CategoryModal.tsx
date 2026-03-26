'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Category } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const PRESET_COLORS = [
  '#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B',
  '#EC4899','#6366F1','#14B8A6','#534AB7','#6B7280',
  '#F97316','#84CC16','#06B6D4','#A855F7','#E11D48',
]

interface Props {
  open: boolean
  category: Category | null   // null = new
  onClose: () => void
  onSave: (cat: Category) => void
  onDelete?: (id: string) => void
  title?: string
}

export default function CategoryModal({ open, category, onClose, onSave, onDelete, title }: Props) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [activa, setActiva] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) { setDeleteConfirm(false); return }
    if (category) {
      setNombre(category.nombre)
      setColor(category.color)
      setActiva(category.activa)
    } else {
      setNombre('')
      setColor(PRESET_COLORS[0])
      setActiva(true)
    }
  }, [open, category])

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
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {title ?? (category ? 'Editar categoría' : 'Nueva categoría')}
            </Dialog.Title>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="px-5 pt-4 pb-8 space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nombre</label>
              <Input
                placeholder="Nombre de la categoría"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="mt-2">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {nombre || 'Categoría'}
                </span>
              </div>
            </div>

            {/* Activa toggle */}
            <button
              type="button"
              onClick={() => setActiva((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                activa ? 'border-[#534AB7] bg-[#534AB7]/5' : 'border-gray-200'
              }`}
            >
              <span className="text-sm font-medium text-gray-700">Categoría activa</span>
              <div className={`w-10 h-5 rounded-full transition-colors ${activa ? 'bg-[#534AB7]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform shadow-sm ${activa ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {category && onDelete && (
                <button
                  onClick={() => {
                    if (!deleteConfirm) { setDeleteConfirm(true); return }
                    onDelete(category.id)
                  }}
                  className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-colors ${
                    deleteConfirm ? 'bg-red-500 border-red-500 text-white' : 'border-red-100 text-red-500'
                  }`}
                >
                  <X size={17} />
                </button>
              )}
              <Button
                onClick={handleSave}
                disabled={!nombre.trim()}
                className="flex-1 h-11 text-base font-semibold"
              >
                {category ? 'Guardar' : 'Crear'}
              </Button>
            </div>
            {deleteConfirm && (
              <p className="text-xs text-red-500 text-center -mt-2">
                Tocá el ícono rojo de nuevo para confirmar
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
