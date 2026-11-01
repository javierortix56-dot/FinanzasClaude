'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { categoriasDeGasto } from '@finanzas/core/lib/resumenes'
import { crearCategoriaGasto } from '@finanzas/core/lib/consumos'
import { Settings } from '@finanzas/core/types'

const NUEVA = '__nueva__'

/**
 * Selector de categoría de gasto con opción de crear una nueva (subcategoría
 * dentro de un grupo) sin salir del formulario.
 */
export default function CategoriaSelect({ value, onChange, s, className }: {
  value: string | null
  onChange: (id: string) => void
  s: Settings
  className: string
}) {
  const showToast = useUIStore((st) => st.showToast)
  const grupos = s.categoriasGasto.filter((g) => g.activa)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [grupo, setGrupo] = useState(grupos[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  async function crear() {
    setBusy(true)
    try {
      const id = await crearCategoriaGasto(s, nombre, grupo)
      onChange(id)
      showToast(`Categoría "${nombre.trim()}" creada`)
      setCreando(false); setNombre('')
    } catch (err) {
      showToast(`No se pudo crear: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (creando) {
    return (
      <div className="col-span-full flex items-center gap-1.5">
        <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva categoría"
          className={`${className} flex-1`} onKeyDown={(e) => { if (e.key === 'Enter' && nombre.trim()) crear() }} />
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={`${className} max-w-[42%]`} aria-label="Grupo">
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
        <button type="button" disabled={busy || !nombre.trim()} onClick={crear} aria-label="Crear categoría" className="p-1.5 text-primary disabled:opacity-40"><Check size={16} /></button>
        <button type="button" onClick={() => setCreando(false)} aria-label="Cancelar" className="p-1.5 text-gray-400"><X size={16} /></button>
      </div>
    )
  }
  return (
    <select value={value ?? ''} aria-label="Categoría" className={`${className} ${value ? '' : 'text-rose-500'}`}
      onChange={(e) => { if (e.target.value === NUEVA) setCreando(true); else onChange(e.target.value) }}>
      <option value="" disabled>Elegir categoría…</option>
      {categoriasDeGasto(s).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      <option value={NUEVA}>+ Nueva categoría…</option>
    </select>
  )
}
