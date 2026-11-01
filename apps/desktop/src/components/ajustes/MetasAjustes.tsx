'use client'

import { useState } from 'react'
import { Target, Pencil, Trash2, Plus, Check } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import {
  METAS_SUGERIDAS, TIPO_META, describirMeta, guardarMetas, opcionesCategoriaMeta,
} from '@finanzas/core/lib/resumenExtras'
import { Currency, MetaResumen, MetaResumenTipo, Settings } from '@finanzas/core/types'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'

const TIPOS = Object.keys(TIPO_META) as MetaResumenTipo[]

type Borrador = { id: string | null; nombre: string; tipo: MetaResumenTipo; palabras: string; categoria: string; tope: string; moneda: Currency }

const vacio = (): Borrador => ({ id: null, nombre: '', tipo: 'comercios', palabras: '', categoria: '', tope: '', moneda: 'ARS' })
const aBorrador = (m: MetaResumen): Borrador => ({
  id: m.id, nombre: m.nombre, tipo: m.tipo, palabras: (m.palabras ?? []).join(', '),
  categoria: m.categoria ?? '', tope: String(m.tope), moneda: m.moneda,
})

/** Alta, edición y baja de las metas que sigue el análisis de Resúmenes */
export function MetasAjustes({ settings }: { settings: Settings }) {
  const showToast = useUIStore((st) => st.showToast)
  const metas = settings.metasResumen ?? []
  const cats = opcionesCategoriaMeta(settings)
  const [b, setB] = useState<Borrador | null>(null)
  const [busy, setBusy] = useState(false)

  const topeN = b ? parseFloat(b.tope.replace(/\./g, '').replace(',', '.')) : NaN
  const palabras = b ? b.palabras.split(',').map((w) => w.trim()).filter(Boolean) : []
  const valido = !!b && b.nombre.trim() !== '' && topeN >= 0
    && (b.tipo !== 'comercios' || palabras.length > 0)
    && (b.tipo !== 'categoria' || b.categoria !== '')

  async function guardar(lista: MetaResumen[], ok: string) {
    setBusy(true)
    try {
      await guardarMetas(lista)
      showToast(ok)
      return true
    } catch {
      showToast('Error al guardar', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function confirmar() {
    if (!b || !valido) return
    const meta: MetaResumen = {
      id: b.id ?? crypto.randomUUID(),
      nombre: b.nombre.trim(),
      tipo: b.tipo,
      tope: topeN,
      moneda: b.moneda,
      ...(b.tipo === 'comercios' ? { palabras } : {}),
      ...(b.tipo === 'categoria' ? { categoria: b.categoria } : {}),
    }
    const lista = b.id ? metas.map((m) => (m.id === b.id ? meta : m)) : [...metas, meta]
    if (await guardar(lista, b.id ? 'Meta actualizada' : 'Meta agregada')) setB(null)
  }

  return (
    <div className="space-y-2">
      {metas.length === 0 && !b && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Todavía no hay metas. Sugeridas:
          {METAS_SUGERIDAS.map((m) => (
            <Button key={m.nombre} size="sm" variant="secondary" disabled={busy}
              onClick={() => guardar([...metas, { ...m, id: crypto.randomUUID() }], 'Meta agregada')}>
              <Plus className="h-3.5 w-3.5" /> {m.nombre}
            </Button>
          ))}
        </div>
      )}
      {metas.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
          <span className="h-9 w-9 shrink-0 rounded-xl inline-flex items-center justify-center bg-primary/12 text-primary"><Target className="h-4 w-4" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{m.nombre}</div>
            <div className="text-xs text-muted truncate">{describirMeta(m, settings)}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setB(aBorrador(m))} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => guardar(metas.filter((x) => x.id !== m.id), `${m.nombre} eliminada`)} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5 text-expense" />
          </Button>
        </div>
      ))}

      {b ? (
        <form onSubmit={(e) => { e.preventDefault(); confirmar() }} className="space-y-3 rounded-xl border border-dashed border-hairline p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="meta-nombre">Nombre</Label>
              <Input id="meta-nombre" value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Delivery y Uber" />
            </div>
            <div>
              <Label>Qué controla</Label>
              <Segmented id="meta-tipo" size="sm" value={b.tipo} onChange={(t) => setB({ ...b, tipo: t })}
                options={TIPOS.map((t) => ({ value: t, label: TIPO_META[t].nombre }))} />
            </div>
          </div>
          <p className="text-xs text-muted">{TIPO_META[b.tipo].ayuda}</p>
          {b.tipo === 'comercios' && (
            <div>
              <Label htmlFor="meta-palabras">Palabras (separadas por coma)</Label>
              <Input id="meta-palabras" value={b.palabras} onChange={(e) => setB({ ...b, palabras: e.target.value })} placeholder="rappi, pedidosya, uber" />
            </div>
          )}
          {b.tipo === 'categoria' && (
            <div>
              <Label htmlFor="meta-cat">Categoría</Label>
              <Select id="meta-cat" value={b.categoria} onChange={(e) => setB({ ...b, categoria: e.target.value })}>
                <option value="">Elegir…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <Label htmlFor="meta-tope">Tope mensual</Label>
              <Input id="meta-tope" inputMode="decimal" value={b.tope} onChange={(e) => setB({ ...b, tope: e.target.value })} placeholder="300000" />
            </div>
            <Segmented id="meta-moneda" size="sm" value={b.moneda} onChange={(m) => setB({ ...b, moneda: m })}
              options={[{ value: 'ARS' as Currency, label: 'ARS' }, { value: 'USD' as Currency, label: 'USD' }]} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setB(null)}>Cancelar</Button>
            <Button type="submit" disabled={busy || !valido}><Check className="h-4 w-4" /> {b.id ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setB(vacio())}><Plus className="h-4 w-4" /> Nueva meta</Button>
      )}
    </div>
  )
}
