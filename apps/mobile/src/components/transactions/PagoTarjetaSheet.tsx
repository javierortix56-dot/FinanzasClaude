'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CreditCard, ChevronDown, Check } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { updateTransaction } from '@finanzas/core/lib/transactions'
import { registrarAbono, detallePago, tarjetaDe, type DetallePago } from '@finanzas/core/lib/tarjetas'
import { formatAmount, getCatFromSettings, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toBase, txToBase, txMonth } from '@finanzas/core/lib/currency'
import { evalExpr } from '@finanzas/core/lib/calc'
import { haptic } from '@/lib/haptics'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import Collapse from '@/components/ui/Collapse'
import { Asignacion, Currency, Transaction } from '@finanzas/core/types'

/**
 * Pago automático de una tarjeta: el total no se edita (sale de los consumos,
 * las cuotas y el saldo anterior); sí cuánto se abona, con qué ingreso y si
 * ya se pagó. Lo que no se abona pasa al pago del mes siguiente.
 */
export default function PagoTarjetaSheet({ open, pago, onClose }: { open: boolean; pago: Transaction; onClose: () => void }) {
  const showToast = useUIStore((st) => st.showToast)
  const { settings, hideAmounts } = useSettingsStore()
  const { transactions } = useTransactionStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency
  const p = pago.pagoTarjeta!
  const tarjeta = tarjetaDe(p.tarjetaId, s)
  const previo = shiftMonth(p.mes, -1)
  const siguiente = shiftMonth(p.mes, 1)
  const blur = hideAmounts ? 'blur-sm' : ''

  const [abono, setAbono] = useState(String(pago.monto))
  const [ingresoId, setIngresoId] = useState(pago.asignaciones.length === 1 ? pago.asignaciones[0].ingresoId : '')
  const [ejecutado, setEjecutado] = useState(pago.ejecutado)
  const [saving, setSaving] = useState(false)
  const [verDetalle, setVerDetalle] = useState(false)
  const [detalle, setDetalle] = useState<DetallePago | null>(null)

  // Al abrir otro pago se reinicia el formulario
  useEffect(() => {
    setAbono(String(pago.monto))
    setIngresoId(pago.asignaciones.length === 1 ? pago.asignaciones[0].ingresoId : '')
    setEjecutado(pago.ejecutado)
    setVerDetalle(false)
    setDetalle(null)
  }, [pago])

  useEffect(() => {
    if (!verDetalle || detalle) return
    let vivo = true
    detallePago(p, s).then((d) => { if (vivo) setDetalle(d) }).catch(() => { if (vivo) setDetalle({ consumos: [], cuotas: [] }) })
    return () => { vivo = false }
  }, [verDetalle, detalle, p, s])

  const abonoNum = evalExpr(abono) ?? NaN
  const abonoValido = abonoNum >= 0 && abonoNum <= p.total + 0.005
  const pasa = abonoValido ? Math.max(p.total - abonoNum, 0) : 0
  const dividido = pago.asignaciones.length > 1

  const ingresos = useMemo(() => transactions
    .filter((t) => t.tipo === 'ingreso')
    .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime())
    .map((ing) => {
      const used = transactions
        .filter((t) => t.tipo === 'egreso' && t.id !== pago.id)
        .reduce((sum, t) => sum + t.asignaciones
          .filter((a) => a.ingresoId === ing.id)
          .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s, txMonth(t)), 0), 0)
      return { ing, libre: txToBase(ing, base, s) - used }
    }), [transactions, pago.id, base, s])

  async function handleSave() {
    if (!abonoValido) return
    const monto = Math.round(abonoNum * 100) / 100
    setSaving(true)
    try {
      if (monto !== pago.monto) await registrarAbono(pago, monto)
      // Dividido entre varios ingresos: registrarAbono ya reescaló las partes
      if (!dividido) {
        const asignaciones: Asignacion[] = ingresoId && monto > 0 ? [{ ingresoId, monto }] : []
        await updateTransaction(pago.id!, { asignaciones, ejecutado })
      } else {
        await updateTransaction(pago.id!, { ejecutado })
      }
      haptic('success')
      showToast(pasa > 0 ? `Abono guardado · pasan ${formatAmount(pasa, p.moneda)} a ${monthLabel(siguiente)}` : 'Pago actualizado')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lineas = [
    { label: `Consumos de ${monthLabel(previo)}`, monto: p.consumos },
    { label: `Cuotas de ${monthLabel(p.mes)}`, monto: p.cuotas },
    { label: `Saldo impago de ${monthLabel(previo)}`, monto: p.saldoAnterior },
  ]

  const footer = (
    <div className="flex gap-2">
      <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} disabled={saving}
        className="h-12 px-4 rounded-2xl bg-gray-500/10 text-sm font-semibold text-gray-600">
        Cancelar
      </motion.button>
      <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving || !abonoValido}
        className="flex-1 h-12 rounded-2xl text-sm font-bold text-white bg-brand disabled:opacity-40">
        {saving ? 'Guardando…' : 'Guardar'}
      </motion.button>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title="Pago de tarjeta" footer={footer} bodyClassName="px-5 pb-5 space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white" style={{ background: tarjeta?.color ?? '#64748b' }}>
          <CreditCard size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-gray-900 truncate">{tarjeta?.nombre ?? 'Tarjeta eliminada'}{p.moneda !== 'ARS' ? ` · ${p.moneda}` : ''}</p>
          <p className="text-xs text-gray-500">Pago de {monthLabel(p.mes)} · automático, no se puede borrar</p>
        </div>
      </div>

      <div className="rounded-2xl bg-gray-500/[0.06] p-4 space-y-2 text-sm">
        {lineas.map((l) => (
          <div key={l.label} className={`flex justify-between gap-3 ${l.monto === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
            <span>{l.label}</span>
            <span className={`tabular-nums ${blur}`}>{formatAmount(l.monto, p.moneda)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-hairline pt-2 font-semibold text-gray-900">
          <span>Total a pagar</span>
          <span className={`tabular-nums ${blur}`}>{formatAmount(p.total, p.moneda)}</span>
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setVerDetalle((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-primary">
          <ChevronDown size={14} className={`transition-transform ${verDetalle ? 'rotate-180' : ''}`} />
          {verDetalle ? 'Ocultar' : 'Ver'} qué lo compone
        </button>
        <Collapse open={verDetalle}>
          <div className="mt-2 space-y-1 text-xs">
            {!detalle ? <p className="text-gray-400">Cargando…</p> : (
              <>
                {detalle.consumos.map((c) => (
                  <div key={c.id} className="flex justify-between gap-3">
                    <span className="truncate text-gray-500">
                      {c.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · {c.descripcion || getCatFromSettings(c.categoria, s)?.nombre || '(sin descripción)'}
                    </span>
                    <span className={`tabular-nums text-gray-700 ${blur}`}>{formatAmount(c.monto, c.moneda)}</span>
                  </div>
                ))}
                {detalle.cuotas.map((c, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="truncate text-gray-500">{c.descripcion} · cuota {c.numero}/{c.totalCuotas}</span>
                    <span className={`tabular-nums text-gray-700 ${blur}`}>{formatAmount(c.monto, p.moneda)}</span>
                  </div>
                ))}
                {detalle.consumos.length === 0 && detalle.cuotas.length === 0 && <p className="text-gray-400">Sin consumos ni cuotas: es saldo anterior.</p>}
              </>
            )}
          </div>
        </Collapse>
      </div>

      <div>
        <FieldLabel hint={`— hasta ${formatAmount(p.total, p.moneda)}`}>Abono ({p.moneda})</FieldLabel>
        <input
          inputMode="decimal"
          value={abono}
          onChange={(e) => setAbono(e.target.value)}
          aria-invalid={!abonoValido}
          className={`${fieldClass} tabular-nums ${!abonoValido ? 'ring-2 ring-rose-500/40' : ''}`}
        />
        <div className="mt-1.5 flex items-center justify-between px-1 text-[11px]">
          {pasa > 0
            ? <span className={`font-semibold text-amber-600 ${blur}`}>Pasan {formatAmount(pasa, p.moneda)} a {monthLabel(siguiente)}</span>
            : <span className="text-gray-500">Se paga el total</span>}
          {abonoNum !== p.total && (
            <button type="button" onClick={() => setAbono(String(p.total))} className="font-semibold text-primary">Pagar total</button>
          )}
        </div>
      </div>

      {!dividido && (
        <div>
          <FieldLabel>Se paga con</FieldLabel>
          {ingresos.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1">No hay ingresos este mes</p>
          ) : (
            <div className="space-y-1.5">
              {ingresos.map(({ ing, libre }) => {
                const sel = ingresoId === ing.id
                return (
                  <button key={ing.id} type="button" onClick={() => setIngresoId(sel ? '' : ing.id!)}
                    className={`w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors ${sel ? 'bg-primary/[0.07] ring-1 ring-primary/35' : 'bg-gray-500/[0.06]'}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${sel ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                      {sel && <Check size={11} color="white" strokeWidth={3.5} />}
                    </span>
                    <span className="flex-1 min-w-0 text-xs font-semibold text-gray-800 truncate">
                      {ing.descripcion?.trim() || getCatFromSettings(ing.categoria, s)?.nombre || ing.categoria}
                    </span>
                    <span className={`text-[11px] font-semibold tabular-nums ${libre < 0 ? 'text-rose-500' : 'text-emerald-600'} ${blur}`}>
                      disp. {formatAmount(libre, base)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <button type="button" role="switch" aria-checked={ejecutado} onClick={() => setEjecutado((v) => !v)}
        className="flex items-center gap-2.5 text-sm text-gray-800">
        <span className={`relative h-6 w-10 rounded-full transition-colors ${ejecutado ? 'bg-primary' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${ejecutado ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        Pagado
      </button>
    </Sheet>
  )
}
