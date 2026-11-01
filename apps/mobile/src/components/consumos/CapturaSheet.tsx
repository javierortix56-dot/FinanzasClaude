'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { usuarioId } from '@finanzas/core/lib/resumenes'
import { fetchReglas } from '@finanzas/core/lib/comercioReglas'
import { GastoLeido, guardarGastosLeidos, leerComprobante } from '@finanzas/core/lib/comprobantes'
import { Destino, describirDestino, destinoGasto, fetchMovimientosDe } from '@finanzas/core/lib/modoGasto'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { Consumo, MedioPago, Settings, Transaction } from '@finanzas/core/types'
import CategoriaSelect from '@/components/consumos/CategoriaSelect'
import Sheet from '@/components/ui/Sheet'
import { Money } from '@/components/ui/AnimatedNumber'
import { haptic } from '@/lib/haptics'

const selectCls = 'h-8 min-w-0 rounded-lg bg-gray-500/[0.06] px-2 text-[11.5px] text-gray-700 outline-none'

/** Medio de pago como valor de un <select>: "t:<id>" para una tarjeta */
const medioValor = (g: GastoLeido) => (g.tarjetaId ? `t:${g.tarjetaId}` : g.medio && g.medio !== 'credito' ? g.medio : '')

/**
 * Lee una captura de movimientos (o un ticket) con IA y muestra los consumos
 * para revisar: categoría (obligatoria; se puede crear una nueva), medio de
 * pago y cuáles guardar. Los que parecen ya registrados quedan destildados.
 * Cada uno va adonde corresponde: llena un cupo, paga lo planificado o queda
 * como gasto no planificado (se muestra antes de guardar).
 */
export default function CapturaSheet({ archivo, modo, existentes, onClose }: {
  archivo: File | null
  modo: 'ticket' | 'movimientos'
  existentes: Consumo[]
  onClose: (guardados: number) => void
}) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const showToast = useUIStore((st) => st.showToast)
  const { user } = useAuthStore()
  const tarjetas = s.tarjetas ?? []

  const [estado, setEstado] = useState<'leyendo' | 'revisar' | 'guardando' | 'error'>('leyendo')
  const [error, setError] = useState<string | null>(null)
  const [gastos, setGastos] = useState<GastoLeido[]>([])
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [movs, setMovs] = useState<Transaction[]>([])

  useEffect(() => {
    if (!archivo) return
    let cancel = false
    setEstado('leyendo'); setError(null); setGastos([])
    ;(async () => {
      try {
        const reglas = await fetchReglas().catch(() => new Map())
        const leidos = await leerComprobante(archivo, modo, s, reglas, existentes)
        const meses = [...new Set(leidos.map((g) => g.fecha.slice(0, 7)))]
        const tx = await fetchMovimientosDe(meses).catch(() => [] as Transaction[])
        if (cancel) return
        setMovs(tx)
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
  const sinCategoria = seleccion.filter((g) => !g.categoria).length
  // Adónde va cada uno (en orden: dos gastos no pagan la misma línea)
  const destinos = useMemo(() => {
    const usadas = new Set<string>()
    const out = new Map<string, Destino>()
    for (const g of gastos) {
      if (!g.categoria || !elegidos.has(g.key)) continue
      const d = destinoGasto({ categoria: g.categoria, fecha: g.fecha }, movs, s, usadas)
      if (d.tipo === 'pago') usadas.add(d.linea.id!)
      out.set(g.key, d)
    }
    return out
  }, [gastos, elegidos, movs, s])

  async function guardar() {
    setEstado('guardando')
    try {
      const r = await guardarGastosLeidos(seleccion, modo === 'ticket' ? 'ticket' : 'captura', usuarioId(user), s, movs)
      const n = r.cupo + r.pagos + r.puntuales
      haptic('success')
      const partes = [r.cupo && `${r.cupo} a cupos`, r.pagos && `${r.pagos} pago${r.pagos !== 1 ? 's' : ''}`, r.puntuales && `${r.puntuales} no planificado${r.puntuales !== 1 ? 's' : ''}`].filter(Boolean)
      showToast(`${n} gasto${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}: ${partes.join(' · ')}`)
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
      subtitle={estado === 'revisar' ? 'Elija la categoría de cada uno' : undefined}
      zIndex={70}
      footer={estado === 'revisar' || estado === 'guardando' ? (
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <button onClick={() => onClose(0)} className="h-11 rounded-2xl glass text-sm font-semibold text-gray-700">Cancelar</button>
          <button onClick={guardar} disabled={seleccion.length === 0 || sinCategoria > 0 || estado === 'guardando'}
            className="h-11 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-60">
            {estado === 'guardando' ? 'Guardando…' : sinCategoria > 0 ? `Falta categoría (${sinCategoria})` : `Guardar ${seleccion.length || ''}`}
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
                        <CheckCircle2 size={11} /> Parece ya registrado: “{g.duplicado.comercio || 'sin nombre'}”
                      </p>
                    )}
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <CategoriaSelect value={g.categoria} onChange={(id) => editar(g.key, { categoria: id })} s={s} className={selectCls} />
                      <select value={medioValor(g)} onChange={(e) => cambiarMedio(g, e.target.value)} className={selectCls} aria-label="Medio de pago">
                        <option value="">Medio sin indicar</option>
                        {tarjetas.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.nombre}</option>)}
                        <option value="debito">Débito</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    {destinos.get(g.key) && (
                      <p className={`mt-1 text-[10.5px] font-medium ${destinos.get(g.key)!.tipo === 'puntual' ? 'text-amber-600' : 'text-primary'}`}>
                        {describirDestino(destinos.get(g.key)!, getCatFromSettings(g.categoria!, s)?.nombre ?? 'la categoría')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-[10.5px] text-gray-400 leading-relaxed">
            Las categorías con cupo (Ajustes → Gastos con cupo) se van llenando; las demás marcan como pagado lo planificado o, si no estaba, quedan como no planificado. Los de tarjeta de crédito se contrastan con el resumen cuando lo suba.
          </p>
        </div>
      )}
    </Sheet>
  )
}
