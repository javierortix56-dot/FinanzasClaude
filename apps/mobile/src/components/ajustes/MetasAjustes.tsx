'use client'

import { useState } from 'react'
import { Target, Pencil, Trash2, Plus, Check } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import {
  METAS_SUGERIDAS, TIPO_META, describirMeta, guardarMetas, opcionesCategoriaMeta,
} from '@finanzas/core/lib/resumenExtras'
import { Currency, MetaResumen, MetaResumenTipo, Settings } from '@finanzas/core/types'

const inputCls = 'w-full min-w-0 bg-gray-500/[0.06] rounded-xl px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-primary/25'
const TIPOS = Object.keys(TIPO_META) as MetaResumenTipo[]

type Borrador = { id: string | null; nombre: string; tipo: MetaResumenTipo; palabras: string; categoria: string; tope: string; moneda: Currency }

const vacio = (): Borrador => ({ id: null, nombre: '', tipo: 'comercios', palabras: '', categoria: '', tope: '', moneda: 'ARS' })
const aBorrador = (m: MetaResumen): Borrador => ({
  id: m.id, nombre: m.nombre, tipo: m.tipo, palabras: (m.palabras ?? []).join(', '),
  categoria: m.categoria ?? '', tope: String(m.tope), moneda: m.moneda,
})

/** Alta, edición y baja de las metas que sigue el análisis de Resúmenes */
export default function MetasAjustes({ s }: { s: Settings }) {
  const showToast = useUIStore((st) => st.showToast)
  const metas = s.metasResumen ?? []
  const cats = opcionesCategoriaMeta(s)
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
    <div className="space-y-2 pt-1">
      <p className="text-xs text-gray-500 leading-snug">
        Topes mensuales que se controlan con cada resumen subido. Un tope en USD no lo mueve la inflación.
      </p>
      {metas.map((m) => (
        <div key={m.id} className="flex items-center gap-2.5 rounded-2xl bg-gray-500/[0.06] p-2.5">
          <span className="h-8 w-8 shrink-0 rounded-xl flex items-center justify-center bg-primary/12 text-primary"><Target size={15} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{m.nombre}</p>
            <p className="text-[11px] text-gray-500 truncate">{describirMeta(m, s)}</p>
          </div>
          <button onClick={() => setB(aBorrador(m))} aria-label="Editar" className="p-1.5 text-gray-400"><Pencil size={14} /></button>
          <button disabled={busy} onClick={() => guardar(metas.filter((x) => x.id !== m.id), `${m.nombre} eliminada`)} aria-label="Eliminar" className="p-1.5 text-red-400"><Trash2 size={14} /></button>
        </div>
      ))}

      {metas.length === 0 && !b && (
        <div className="flex flex-wrap gap-1.5">
          {METAS_SUGERIDAS.map((m) => (
            <button key={m.nombre} disabled={busy} onClick={() => guardar([...metas, { ...m, id: crypto.randomUUID() }], 'Meta agregada')}
              className="rounded-full bg-primary/10 px-3 h-8 text-xs font-semibold text-primary">
              + {m.nombre}
            </button>
          ))}
        </div>
      )}

      {b ? (
        <div className="space-y-2.5 rounded-2xl border border-dashed border-gray-300 p-3">
          <input value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Nombre (p. ej. Delivery y Uber)" className={inputCls} />
          <div className="grid grid-cols-2 gap-1.5">
            {TIPOS.map((t) => (
              <button key={t} type="button" onClick={() => setB({ ...b, tipo: t })}
                className={`h-9 rounded-xl text-xs font-semibold ${b.tipo === t ? 'bg-primary text-white' : 'bg-gray-500/[0.06] text-gray-600'}`}>
                {TIPO_META[t].nombre}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 leading-snug">{TIPO_META[b.tipo].ayuda}</p>
          {b.tipo === 'comercios' && (
            <input value={b.palabras} onChange={(e) => setB({ ...b, palabras: e.target.value })} placeholder="Palabras, separadas por coma: rappi, uber" className={inputCls} />
          )}
          {b.tipo === 'categoria' && (
            <select value={b.categoria} onChange={(e) => setB({ ...b, categoria: e.target.value })} className={inputCls}>
              <option value="">Elegir categoría…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <input inputMode="decimal" value={b.tope} onChange={(e) => setB({ ...b, tope: e.target.value })} placeholder="Tope mensual" className={inputCls} />
            <div className="flex shrink-0 rounded-xl bg-gray-500/[0.06] p-0.5">
              {(['ARS', 'USD'] as Currency[]).map((m) => (
                <button key={m} type="button" onClick={() => setB({ ...b, moneda: m })}
                  className={`px-2.5 rounded-lg text-xs font-semibold ${b.moneda === m ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500'}`}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setB(null)} className="h-10 rounded-xl glass text-sm font-semibold text-gray-600">Cancelar</button>
            <button onClick={confirmar} disabled={busy || !valido}
              className="h-10 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-40">
              <Check size={14} /> {b.id ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setB(vacio())}
          className="w-full h-10 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-primary flex items-center justify-center gap-1">
          <Plus size={14} /> Nueva meta
        </button>
      )}
    </div>
  )
}
