'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { categoriasDeGasto, usuarioId } from '@finanzas/core/lib/resumenes'
import { fetchReglas } from '@finanzas/core/lib/comercioReglas'
import { GastoLeido, MedioPago, categoriaPorDefecto, guardarGastosLeidos, leerComprobante } from '@finanzas/core/lib/comprobantes'
import { Settings } from '@finanzas/core/types'
import Sheet from '@/components/ui/Sheet'
import { Money } from '@/components/ui/AnimatedNumber'
import { haptic } from '@/lib/haptics'

const selectCls = 'h-8 min-w-0 rounded-lg bg-gray-500/[0.06] px-2 text-[11.5px] text-gray-700 outline-none'

/** Medio de pago como valor de un <select>: "t:<id>" para una tarjeta */
const medioValor = (g: GastoLeido) => (g.tarjetaId ? `t:${g.tarjetaId}` : g.medio && g.medio !== 'credito' ? g.medio : '')

/**
 * Lee una captura de movimientos (o un ticket) con IA y muestra los gastos para
 * revisar: categoría, medio de pago y cuáles guardar. Los que parecen ya
 * cargados quedan destildados.
 */
export default function CapturaSheet({ archivo, modo, onClose }: {
  archivo: File | null
  modo: 'ticket' | 'movimientos'
  onClose: (guardados: number) => void
}) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const txs = useTransactionStore((st) => st.transactions)
  const showToast = useUIStore((st) => st.showToast)
  const { user } = useAuthStore()
  const cats = useMemo(() => categoriasDeGasto(s), [s])
  const tarjetas = s.tarjetas ?? []

  const [estado, setEstado] = useState<'leyendo' | 'revisar' | 'guardando' | 'error'>('leyendo')
  const [error, setError] = useState<string | null>(null)
  const [gastos, setGastos] = useState<GastoLeido[]>([])
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!archivo) return
    let cancel = false
    setEstado('leyendo'); setError(null); setGastos([])
    ;(async () => {
      try {
        const reglas = await fetchReglas().catch(() => new Map())
        const leidos = await leerComprobante(archivo, modo, s, reglas, txs)
        if (cancel) return
        setGastos(leidos)
        setElegidos(new Set(leidos.filter((g) => !g.duplicado).map((g) => g.key)))
        setEstado('revisar')
      } catch (err) {
        if (cancel) return
        setError(err instanceof Error ? err.message : String(err))
        setEstado('error')
      }
    })()
    return () => { cancel = true }
    // Se lee una sola vez por archivo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo])

  const editar = (key: string, cambio: Partial<GastoLeido>) =>
    setGastos((gs) => gs.map((g) => (g.key === key ? { ...g, ...cambio } : g)))

  function cambiarMedio(g: GastoLeido, v: string) {
    if (v.startsWith('t:')) editar(g.key, { medio: 'credito', tarjetaId: v.slice(2) })
    else editar(g.key, { medio: (v || null) as MedioPago | null, tarjetaId: null })
  }

  const seleccion = gastos.filter((g) => elegidos.has(g.key))

  async function guardar() {
    setEstado('guardando')
    try {
      const n = await guardarGastosLeidos(seleccion, categoriaPorDefecto(s), usuarioId(user))
      haptic('success')
      showToast(`${n} gasto${n !== 1 ? 's' : ''} guardado${n !== 1 ? 's' : ''}`)
      onClose(n)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setEstado('revisar')
    }
  }

  return (
    <Sheet
      open={archivo !== null}
      onClose={() => onClose(0)}
      title={modo === 'ticket' ? 'Gasto del ticket' : 'Gastos de la captura'}
      subtitle={estado === 'revisar' ? 'Revise categoría y medio de pago antes de guardar' : undefined}
      zIndex={70}
      footer={estado === 'revisar' || estado === 'guardando' ? (
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <button onClick={() => onClose(0)} className="h-11 rounded-2xl glass text-sm font-semibold text-gray-700">Cancelar</button>
          <button onClick={guardar} disabled={seleccion.length === 0 || estado === 'guardando'}
            className="h-11 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-60">
            {estado === 'guardando' ? 'Guardando…' : `Guardar ${seleccion.length || ''}`}
          </button>
        </div>
      ) : undefined}
    >
      {estado === 'leyendo' && (
        <div className="flex items-center gap-3 py-6">
          <span className="h-10 w-10 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center shrink-0">
            <Sparkles size={17} className="animate-pulse" />
          </span>
          <p className="text-xs text-gray-500">Leyendo la imagen con IA… suele tardar entre 5 y 20 segundos.</p>
        </div>
      )}
      {estado === 'error' && (
        <div className="rounded-2xl bg-rose-500/10 px-3.5 py-3 text-xs text-rose-600 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <span>No se pudo leer: {error}</span>
        </div>
      )}
      {(estado === 'revisar' || estado === 'guardando') && (
        <div className="space-y-2 pb-2">
          {gastos.length === 0 && <p className="py-4 text-xs text-gray-500">No se encontraron gastos en la imagen.</p>}
          {error && <p className="text-xs text-rose-500">{error}</p>}
          {gastos.map((g) => {
            const activo = elegidos.has(g.key)
            return (
              <div key={g.key} className={`rounded-2xl p-2.5 transition-opacity ${activo ? 'bg-gray-500/[0.06]' : 'bg-gray-500/[0.03] opacity-60'}`}>
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" checked={activo} aria-label={`Guardar ${g.comercio}`}
                    onChange={() => { haptic('light'); setElegidos((st) => { const n = new Set(st); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n }) }}
                    className="mt-1 h-4 w-4 accent-[var(--primary)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <input value={g.comercio} onChange={(e) => editar(g.key, { comercio: e.target.value })}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-gray-900 outline-none" />
                      <span className="text-[13px] font-bold text-gray-900 shrink-0"><Money value={g.monto} currency={g.moneda} animated={false} /></span>
                    </div>
                    <p className="text-[10.5px] text-gray-400">
                      {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      {g.cuotas && <> · {g.cuotas} cuotas (cárguelas desde Cuotas)</>}
                    </p>
                    {g.duplicado && (
                      <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-amber-600">
                        <CheckCircle2 size={11} /> Parece ya cargado: “{g.duplicado.descripcion || 'sin descripción'}”
                      </p>
                    )}
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <select value={g.categoria ?? ''} onChange={(e) => editar(g.key, { categoria: e.target.value || null })} className={selectCls} aria-label="Categoría">
                        <option value="">Sin categoría</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <select value={medioValor(g)} onChange={(e) => cambiarMedio(g, e.target.value)} className={selectCls} aria-label="Medio de pago">
                        <option value="">Medio sin indicar</option>
                        {tarjetas.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.nombre}</option>)}
                        <option value="debito">Débito</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-[10.5px] text-gray-400 leading-relaxed">
            Los gastos con tarjeta de crédito se suman al pago de la tarjeta y se contrastan con el resumen. Los de débito, efectivo o transferencia quedan para asignar a un ingreso.
          </p>
        </div>
      )}
    </Sheet>
  )
}
