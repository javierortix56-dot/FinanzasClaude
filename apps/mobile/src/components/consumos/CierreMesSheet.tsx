'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CreditCard, Lock } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { monthLabel } from '@finanzas/core/lib/constants'
import { presentarPago, tarjetaDe } from '@finanzas/core/lib/tarjetas'
import {
  Cierre, FilaCierre, OpcionPropuesta, aplicarPlanSiguiente, armarCierre, cargarDatosCierre, cerrarMes, marcarEjecutadas,
} from '@finanzas/core/lib/cierreMes'
import { montoCorto } from '@finanzas/core/lib/resumenAnalisis'
import { Currency, Settings } from '@finanzas/core/types'
import Sheet from '@/components/ui/Sheet'
import { Money } from '@/components/ui/AnimatedNumber'
import { haptic } from '@/lib/haptics'

const mesNombre = (m: string) => monthLabel(m).replace(/ de \d{4}$/, '')
const ETIQUETA: Record<OpcionPropuesta, string> = { plan: 'Plan', real: 'Real', promedio: 'Prom. 4m' }
const claveFila = (f: FilaCierre) => `${f.tipo}|${f.clave}`

/**
 * Cierre de mes: planificado contra real de cada categoría, el pago de la
 * tarjeta con su estado, propuesta para el mes siguiente y cierre.
 */
export default function CierreMesSheet({ mes, open, onClose }: { mes: string; open: boolean; onClose: () => void }) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const base = useAuthStore((st) => st.monedaBase) as Currency
  const showToast = useUIStore((st) => st.showToast)
  const [cierre, setCierre] = useState<Cierre | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const { txs, consumos } = await cargarDatosCierre(mes)
      const c = armarCierre(txs, consumos, mes, base, useSettingsStore.getState().settings ?? s)
      setCierre(c)
      setMontos((prev) => {
        const next: Record<string, string> = {}
        for (const f of c.filas) next[claveFila(f)] = prev[claveFila(f)] ?? String(Math.round(f.opciones[f.sugerida] ?? f.planBase))
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [mes, base, s])

  useEffect(() => { if (open) { setCierre(null); setMontos({}); cargar() } }, [open, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const valor = (k: string) => Number((montos[k] ?? '').replace(/\./g, '').replace(',', '.')) || 0
  const egresos = cierre?.filas.filter((f) => f.tipo === 'egreso') ?? []
  const ingresos = cierre?.filas.filter((f) => f.tipo === 'ingreso') ?? []
  const totalPropuesto = useMemo(() => egresos.reduce((a, f) => a + valor(claveFila(f)), 0), [egresos, montos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function correr(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id)
    try {
      await fn()
      haptic('success')
      showToast(ok)
      await cargar()
    } catch (err) {
      showToast(`No se pudo: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const armar = () => correr('armar', async () => {
    const m: Record<string, number> = {}
    for (const f of cierre!.filas) m[claveFila(f)] = valor(claveFila(f))
    const r = await aplicarPlanSiguiente(cierre!, m, base)
    if (r.creadas + r.ajustadas === 0) throw new Error('no había nada para cambiar')
  }, `Plan de ${mesNombre(cierre?.siguiente ?? mes)} armado`)

  const cerrar = () => correr('cerrar', () => cerrarMes(cierre!, useSettingsStore.getState().settings ?? s), `${mesNombre(mes)} cerrado`)

  return (
    <Sheet open={open} onClose={onClose} title={`Cierre de ${mesNombre(mes)}`}
      subtitle="Lo planificado contra lo real, y el plan del mes siguiente" zIndex={60}
      footer={cierre && (
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <button onClick={armar} disabled={!!busy}
            className="h-11 rounded-2xl glass text-[13px] font-semibold text-gray-800 disabled:opacity-50">
            {busy === 'armar' ? 'Armando…' : `Armar ${mesNombre(cierre.siguiente)}`}
          </button>
          <button onClick={cerrar} disabled={!!busy || cierre.cerrado}
            className="h-11 rounded-2xl bg-brand text-white text-[13px] font-bold shadow-soft disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            <Lock size={13} /> {cierre.cerrado ? 'Mes cerrado' : busy === 'cerrar' ? 'Cerrando…' : `Cerrar ${mesNombre(mes)}`}
          </button>
        </div>
      )}>
      {error && <p className="rounded-2xl bg-rose-500/10 px-3 py-2.5 text-xs text-rose-600">No se pudo cargar: {error}</p>}
      {!cierre && !error && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>}
      {cierre && (
        <div className="space-y-4 pb-2">
          {/* Totales */}
          <div className="grid grid-cols-2 gap-2">
            <Total label="Gastos" plan={cierre.totales.planEgresos} real={cierre.totales.realEgresos} base={base} gasto />
            <Total label="Ingresos" plan={cierre.totales.planIngresos} real={cierre.totales.realIngresos} base={base} />
          </div>

          {/* Pagos de tarjeta */}
          {cierre.pagos.length > 0 && (
            <div className="space-y-1.5">
              <p className="eyebrow">Pago de tarjeta</p>
              {cierre.pagos.map((p) => {
                const pp = presentarPago(p.pagoTarjeta!)
                return (
                  <div key={p.id} className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5 min-w-0">
                        <CreditCard size={13} className="text-primary shrink-0" />
                        <span className="truncate">{tarjetaDe(p.pagoTarjeta!.tarjetaId, s)?.nombre ?? 'Tarjeta'}{p.moneda !== 'ARS' ? ` · ${p.moneda}` : ''}</span>
                      </p>
                      <span className="text-[13px] font-bold text-gray-900 shrink-0"><Money value={p.monto} currency={p.moneda} animated={false} /></span>
                    </div>
                    <p className={`text-[10.5px] font-semibold ${pp.confirmado ? 'text-emerald-600' : 'text-gray-400'}`}>{pp.estado}</p>
                    {pp.desvio && (
                      <p className={`text-[10.5px] ${pp.desvio.dif > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        Planificado {montoCorto(pp.desvio.planificado)} · desvío {pp.desvio.dif > 0 ? '+' : ''}{montoCorto(pp.desvio.dif)} ({Math.round(pp.desvio.pct)} %)
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <Seccion titulo="Gastos" filas={egresos} base={base} montos={montos} setMontos={setMontos} siguiente={cierre.siguiente}
            busy={busy} onEjecutar={(f) => correr(`ej-${f.clave}`, () => marcarEjecutadas(f.pendientes), `${f.nombre} ejecutado`)} />
          {ingresos.length > 0 && (
            <Seccion titulo="Ingresos" filas={ingresos} base={base} montos={montos} setMontos={setMontos} siguiente={cierre.siguiente}
              busy={busy} onEjecutar={(f) => correr(`ej-${f.clave}`, () => marcarEjecutadas(f.pendientes), `${f.nombre} cobrado`)} />
          )}

          <p className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed">
            Plan de gastos propuesto para {mesNombre(cierre.siguiente)}: <b className="text-gray-900"><Money value={totalPropuesto} currency={base} animated={false} /></b>{' '}
            (sin el pago de la tarjeta, que se calcula solo). «Armar» copia las líneas con esos montos, o ajusta las que ya existan; 0 = no planificar.
            «Cerrar» marca como ejecutado lo que siguió con consumos y fija el mes.
          </p>
        </div>
      )}
    </Sheet>
  )
}

function Total({ label, plan, real, base, gasto }: { label: string; plan: number; real: number; base: Currency; gasto?: boolean }) {
  const dif = real - plan
  const malo = gasto ? dif > 0 : dif < 0
  return (
    <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-[15px] font-bold text-gray-900"><Money value={real} currency={base} animated={false} /></p>
      <p className="text-[10.5px] text-gray-400">plan <Money value={plan} currency={base} animated={false} /></p>
      {Math.abs(dif) >= 1 && (
        <p className={`text-[10.5px] font-semibold ${malo ? 'text-rose-500' : 'text-emerald-600'}`}>{dif > 0 ? '+' : ''}<Money value={dif} currency={base} animated={false} /></p>
      )}
    </div>
  )
}

function Seccion({ titulo, filas, base, montos, setMontos, siguiente, busy, onEjecutar }: {
  titulo: string; filas: FilaCierre[]; base: Currency; siguiente: string
  montos: Record<string, string>; setMontos: React.Dispatch<React.SetStateAction<Record<string, string>>>
  busy: string | null; onEjecutar: (f: FilaCierre) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="eyebrow">{titulo}</p>
      {filas.map((f) => {
        const k = claveFila(f)
        const pasa = f.difBase !== null && (f.tipo === 'egreso' ? f.difBase > 0 : f.difBase < 0)
        return (
          <div key={k} className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-semibold text-gray-900">{f.nombre}</p>
              <p className="shrink-0 text-[11.5px] text-gray-500">
                {f.planBase > 0 ? montoCorto(f.planBase) : 'sin plan'} → <b className="text-gray-900">{f.realBase !== null ? montoCorto(f.realBase) : '¿?'}</b>
                {f.difBase !== null && Math.abs(f.difBase) >= 1 && (
                  <span className={`ml-1 font-bold ${pasa ? 'text-rose-500' : 'text-emerald-600'}`}>{f.difBase > 0 ? '+' : ''}{montoCorto(f.difBase)}</span>
                )}
              </p>
            </div>
            <p className="text-[10.5px] text-gray-400">
              {f.seguimiento === 'consumos' && 'Real según los consumos registrados'}
              {f.seguimiento === 'sin_plan' && 'Hubo consumos sin planificar'}
              {f.seguimiento === 'ejecutado' && <span className="inline-flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" /> Ejecutado como se planificó</span>}
              {f.seguimiento === 'pendiente' && `${f.pendientes.length} línea${f.pendientes.length !== 1 ? 's' : ''} sin marcar como ${f.tipo === 'ingreso' ? 'cobrada' : 'ejecutada'}`}
            </p>
            {f.seguimiento === 'pendiente' && (
              <button disabled={!!busy} onClick={() => onEjecutar(f)} className="mt-1 text-[11px] font-bold text-primary disabled:opacity-50">
                {busy === `ej-${f.clave}` ? 'Guardando…' : f.tipo === 'ingreso' ? 'Se cobró como se planificó' : 'Se pagó como se planificó'}
              </button>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10.5px] text-gray-500 shrink-0">{mesNombre(siguiente)}:</span>
              {(['plan', 'real', 'promedio'] as OpcionPropuesta[]).filter((o) => (f.opciones[o] ?? 0) > 0).map((o) => {
                const v = String(Math.round(f.opciones[o]!))
                const activo = montos[k] === v
                return (
                  <button key={o} type="button" onClick={() => { haptic('light'); setMontos((m) => ({ ...m, [k]: v })) }}
                    className={`h-6 px-2 rounded-full text-[10px] font-semibold shrink-0 ${activo ? 'bg-primary text-white' : 'bg-gray-500/[0.08] text-gray-600'}`}>
                    {ETIQUETA[o]}
                  </button>
                )
              })}
              <input inputMode="numeric" value={montos[k] ?? ''} onChange={(e) => setMontos((m) => ({ ...m, [k]: e.target.value.replace(/[^\d]/g, '') }))}
                aria-label={`Monto de ${f.nombre} para ${mesNombre(siguiente)}`}
                className="ml-auto w-24 h-7 rounded-lg bg-surface px-2 text-right text-[12px] font-semibold tabular-nums outline-none ring-1 ring-hairline focus:ring-primary/40" />
            </div>
            {f.siguiente.length > 0 && (
              <p className="mt-1 text-[10px] text-gray-400">Ya planificado en {mesNombre(siguiente)}: <Money value={f.siguienteBase} currency={base} animated={false} /> (se ajusta)</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
