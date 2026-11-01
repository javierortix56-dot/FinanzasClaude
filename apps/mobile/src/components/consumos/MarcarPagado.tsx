'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { useConsumos } from '@finanzas/core/lib/useConsumos'
import { markEjecutado } from '@finanzas/core/lib/transactions'
import { desmarcarPagado, esCupo, marcarPagado } from '@finanzas/core/lib/modoGasto'
import { formatAmount, getCatFromSettings } from '@finanzas/core/lib/constants'
import { evalExpr } from '@finanzas/core/lib/calc'
import { MedioPago, Settings, Transaction } from '@finanzas/core/types'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import ConsumoSheet from '@/components/consumos/ConsumoSheet'
import { haptic } from '@/lib/haptics'

// Una sola hoja para toda la app: la abre cualquier check de un movimiento
const usePagoStore = create<{
  linea: Transaction | null
  cupo: { categoria: string; mes: string } | null
  set: (p: { linea?: Transaction | null; cupo?: { categoria: string; mes: string } | null }) => void
}>((set) => ({ linea: null, cupo: null, set: (p) => set(p) }))

const mesDe = (t: Transaction) => {
  const d = t.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Lo que hace el check (o el swipe) de un movimiento:
 *  - ingreso o pago de tarjeta: alterna cobrado/pagado
 *  - gasto con cupo (Mercado, Uber…): no se tilda; abre "Registrar gasto" con su categoría
 *  - pago único pendiente: pide el monto real y lo marca pagado
 *  - pago único ya pagado: vuelve a pendiente con lo planificado
 */
export function alternarEjecutado(tx: Transaction, s: Settings) {
  if (tx.tipo !== 'egreso' || tx.pagoTarjeta) { markEjecutado(tx.id!, !tx.ejecutado); return }
  if (tx.ejecutado) { desmarcarPagado(tx); return }
  if (esCupo(tx.categoria, s)) {
    useUIStore.getState().showToast(`${getCatFromSettings(tx.categoria, s)?.nombre ?? 'Esta categoría'} tiene cupo: registre lo que gasta y se va llenando`)
    usePagoStore.getState().set({ cupo: { categoria: tx.categoria, mes: mesDe(tx) } })
    return
  }
  usePagoStore.getState().set({ linea: tx })
}

/** Se monta una vez (layout): hoja de pago y registro de gasto de un cupo */
export default function MarcarPagadoHost() {
  const { linea, cupo, set } = usePagoStore()
  return (
    <>
      <MarcarPagadoSheet linea={linea} onClose={() => set({ linea: null })} />
      {cupo && <RegistrarCupo categoria={cupo.categoria} mes={cupo.mes} onClose={() => set({ cupo: null })} />}
    </>
  )
}

function RegistrarCupo({ categoria, mes, onClose }: { categoria: string; mes: string; onClose: () => void }) {
  const consumos = useConsumos(mes)
  return <ConsumoSheet open onClose={onClose} existentes={consumos ?? []} categoriaInicial={categoria} />
}

function MarcarPagadoSheet({ linea, onClose }: { linea: Transaction | null; onClose: () => void }) {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const showToast = useUIStore((st) => st.showToast)
  const tarjetas = s.tarjetas ?? []
  const [monto, setMonto] = useState('')
  const [medio, setMedio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const planificado = linea ? (linea.montoPlanificado ?? linea.monto) : 0

  useEffect(() => {
    if (!linea) return
    setMonto(String(Math.round(planificado * 100) / 100))
    setMedio(linea.tarjetaId ? `t:${linea.tarjetaId}` : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linea])

  const valor = evalExpr(monto.replace(/\.(?=\d{3}(?!\d))/g, '')) ?? 0
  const desvio = valor - planificado

  async function guardar() {
    if (!linea || valor <= 0) return
    setGuardando(true)
    try {
      const esTarjeta = medio.startsWith('t:')
      await marcarPagado(linea, Math.round(valor * 100) / 100,
        esTarjeta ? 'credito' : ((medio || null) as MedioPago | null), esTarjeta ? medio.slice(2) : null)
      haptic('success')
      onClose()
    } catch (err) {
      showToast(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet
      open={linea !== null}
      onClose={onClose}
      title="Marcar pagado"
      subtitle={linea ? (linea.descripcion || getCatFromSettings(linea.categoria, s)?.nombre) : undefined}
      zIndex={70}
      footer={
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
          <button onClick={onClose} className="h-11 rounded-2xl glass text-sm font-semibold text-gray-700">Cancelar</button>
          <button onClick={guardar} disabled={valor <= 0 || guardando}
            className="h-11 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Pagado'}
          </button>
        </div>
      }
    >
      {linea && (
        <>
          <div>
            <FieldLabel>Monto real pagado</FieldLabel>
            <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus
              className={`${fieldClass} text-lg font-bold tabular-nums`} />
            <p className="mt-1 text-[11px] text-gray-500">
              Planificado {formatAmount(planificado, linea.moneda)}
              {valor > 0 && Math.abs(desvio) >= 1 && (
                <span className={`font-semibold ${desvio > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {' · '}{desvio > 0 ? '+' : '−'}{formatAmount(Math.abs(desvio), linea.moneda)} {desvio > 0 ? 'más' : 'menos'}
                </span>
              )}
            </p>
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
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Se guarda lo planificado para ver el desvío en el cierre del mes. Con tarjeta de crédito pasa al pago de la tarjeta.
          </p>
        </>
      )}
    </Sheet>
  )
}
