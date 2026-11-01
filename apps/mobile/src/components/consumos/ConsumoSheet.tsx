'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Images } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { usuarioId } from '@finanzas/core/lib/resumenes'
import { describirDestino, destinoGasto, fetchMovimientosDe, registrarGastosReales } from '@finanzas/core/lib/modoGasto'
import { fetchReglas, reglaParaNombre } from '@finanzas/core/lib/comercioReglas'
import { getCatFromSettings, toLocalDateString } from '@finanzas/core/lib/constants'
import { evalExpr } from '@finanzas/core/lib/calc'
import { Consumo, Currency, MedioPago, Settings, Transaction } from '@finanzas/core/types'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import CategoriaSelect from '@/components/consumos/CategoriaSelect'
import CapturaSheet from '@/components/consumos/CapturaSheet'
import { haptic } from '@/lib/haptics'

/**
 * Registrar un gasto real: a mano, con foto del ticket o con captura de los
 * movimientos del día. Según la categoría: llena su cupo (Mercado, Uber…),
 * marca como pagado el pago único planificado (con el monto real) o queda
 * como gasto no planificado.
 */
export default function ConsumoSheet({ open, onClose, existentes, categoriaInicial }: {
  open: boolean
  onClose: () => void
  existentes: Consumo[]
  categoriaInicial?: string | null
}) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const showToast = useUIStore((st) => st.showToast)
  const { user } = useAuthStore()
  const tarjetas = s.tarjetas ?? []

  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>('ARS')
  const [comercio, setComercio] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [fecha, setFecha] = useState(toLocalDateString())
  const [medio, setMedio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [archivo, setArchivo] = useState<{ file: File; modo: 'ticket' | 'movimientos' } | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)
  const capturaRef = useRef<HTMLInputElement>(null)
  const reglasRef = useRef<Awaited<ReturnType<typeof fetchReglas>> | null>(null)
  // Movimientos del mes del gasto: para encontrar el pago planificado que corresponde
  const [movs, setMovs] = useState<Transaction[]>([])
  const mes = fecha.slice(0, 7)
  useEffect(() => {
    if (!open) return
    let cancel = false
    fetchMovimientosDe([mes]).then((t) => { if (!cancel) setMovs(t) }).catch(() => { if (!cancel) setMovs([]) })
    return () => { cancel = true }
  }, [open, mes])
  const destino = useMemo(() => (categoria ? destinoGasto({ categoria, fecha }, movs, s) : null), [categoria, fecha, movs, s])
  // Pago planificado: se propone su monto (se corrige si vino otro)
  useEffect(() => {
    if (destino?.tipo === 'pago' && !monto) setMonto(String(Math.round(destino.linea.montoPlanificado ?? destino.linea.monto)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino])

  useEffect(() => {
    if (!open) return
    setMonto(''); setComercio(''); setFecha(toLocalDateString()); setCategoria(categoriaInicial ?? null)
    // Un solo medio: si hay una tarjeta, es la opción más común
    setMedio(tarjetas.length === 1 ? `t:${tarjetas[0].id}` : '')
    fetchReglas().then((r) => { reglasRef.current = r }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Al escribir el comercio, sugiere la categoría que ya aprendió de los resúmenes
  function cambiarComercio(v: string) {
    setComercio(v)
    const r = reglasRef.current ? reglaParaNombre(v, reglasRef.current) : undefined
    if (r?.categoria && !categoria) setCategoria(r.categoria)
  }

  // "20.000" = veinte mil (punto de miles); la coma es el decimal; se admiten cuentas ("12.500+7.500")
  const valor = evalExpr(monto.replace(/\.(?=\d{3}(?!\d))/g, '')) ?? 0
  const valido = valor > 0 && !!categoria

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    try {
      const esTarjeta = medio.startsWith('t:')
      await registrarGastosReales([{
        fecha, monto: Math.round(valor * 100) / 100, moneda, categoria: categoria!,
        comercio: comercio.trim(), descripcion: comercio.trim(),
        medio: esTarjeta ? 'credito' : ((medio || null) as MedioPago | null),
        tarjetaId: esTarjeta ? medio.slice(2) : null,
      }], s, usuarioId(user), 'manual', movs)
      haptic('success')
      onClose()
    } catch (err) {
      showToast(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>, modo: 'ticket' | 'movimientos') {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) { haptic(); setArchivo({ file: f, modo }) }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Registrar gasto"
        subtitle="Llena un cupo, paga lo planificado o queda como no planificado"
        footer={
          <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
            <button onClick={onClose} className="h-11 rounded-2xl glass text-sm font-semibold text-gray-700">Cancelar</button>
            <button onClick={guardar} disabled={!valido || guardando}
              className="h-11 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-60">
              {guardando ? 'Guardando…' : !categoria && valor > 0 ? 'Elija la categoría' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => fotoRef.current?.click()}
            className="h-11 rounded-2xl glass text-[13px] font-semibold text-gray-700 inline-flex items-center justify-center gap-1.5">
            <Camera size={15} className="text-primary" /> Foto del ticket
          </button>
          <button type="button" onClick={() => capturaRef.current?.click()}
            className="h-11 rounded-2xl glass text-[13px] font-semibold text-gray-700 inline-flex items-center justify-center gap-1.5">
            <Images size={15} className="text-primary" /> Captura del día
          </button>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => elegirArchivo(e, 'ticket')} />
          <input ref={capturaRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegirArchivo(e, 'movimientos')} />
        </div>

        <p className="text-center text-[11px] text-gray-400">o a mano</p>

        <div>
          <FieldLabel>Monto</FieldLabel>
          <div className="flex gap-2">
            <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="20.000"
              className={`${fieldClass} text-lg font-bold tabular-nums`} />
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)} className={`${fieldClass} !w-24`} aria-label="Moneda">
              {(['ARS', 'USD', 'COP'] as Currency[]).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel>Categoría</FieldLabel>
          <CategoriaSelect value={categoria} onChange={setCategoria} s={s} className={fieldClass} />
          {destino && categoria && (
            <p className={`mt-1 text-[11px] font-medium ${destino.tipo === 'puntual' ? 'text-amber-600' : 'text-primary'}`}>
              {describirDestino(destino, getCatFromSettings(categoria, s)?.nombre ?? 'la categoría')}
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Comercio</FieldLabel>
          <input value={comercio} onChange={(e) => cambiarComercio(e.target.value)} placeholder="Mini market, Carnico…" className={fieldClass} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Fecha</FieldLabel>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <FieldLabel>Medio de pago</FieldLabel>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={fieldClass}>
              <option value="">Sin indicar</option>
              {tarjetas.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.nombre}</option>)}
              <option value="debito">Débito</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Con tarjeta de crédito, se contrasta con el resumen cuando lo suba.
        </p>
      </Sheet>

      <CapturaSheet archivo={archivo?.file ?? null} modo={archivo?.modo ?? 'movimientos'} existentes={existentes}
        onClose={(n) => { setArchivo(null); if (n > 0) onClose() }} />
    </>
  )
}
