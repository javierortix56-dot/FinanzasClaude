'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { marcarPagado } from '@finanzas/core/lib/modoGasto'
import { formatAmount, getCatFromSettings } from '@finanzas/core/lib/constants'
import { evalExpr } from '@finanzas/core/lib/calc'
import { MedioPago, Settings, Transaction } from '@finanzas/core/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'

/** Marca un pago único como pagado pidiendo el monto real (guarda lo planificado) */
export function MarcarPagadoModal({ linea, settings, onClose }: { linea: Transaction | null; settings: Settings; onClose: () => void }) {
  return (
    <Modal open={linea !== null} onClose={onClose} size="sm" title="Marcar pagado"
      description={linea ? (linea.descripcion || getCatFromSettings(linea.categoria, settings)?.nombre) : undefined}>
      {linea && <Formulario key={linea.id} linea={linea} settings={settings} onClose={onClose} />}
    </Modal>
  )
}

function Formulario({ linea, settings, onClose }: { linea: Transaction; settings: Settings; onClose: () => void }) {
  const showToast = useUIStore((s) => s.showToast)
  const planificado = linea.montoPlanificado ?? linea.monto
  const [monto, setMonto] = useState(String(Math.round(planificado * 100) / 100))
  const [medio, setMedio] = useState(linea.tarjetaId ? `t:${linea.tarjetaId}` : '')
  const [guardando, setGuardando] = useState(false)
  const valor = evalExpr(monto.replace(/\.(?=\d{3}(?!\d))/g, '')) ?? 0
  const desvio = valor - planificado

  async function guardar() {
    if (valor <= 0) return
    setGuardando(true)
    try {
      const esTarjeta = medio.startsWith('t:')
      await marcarPagado(linea, Math.round(valor * 100) / 100,
        esTarjeta ? 'credito' : ((medio || null) as MedioPago | null), esTarjeta ? medio.slice(2) : null)
      onClose()
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar() }} className="space-y-4 px-6 py-5">
      <div>
        <Label htmlFor="pago-monto">Monto real pagado</Label>
        <Input id="pago-monto" inputMode="decimal" autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} className="tnum text-lg font-semibold" />
        <p className="mt-1 text-xs text-muted">
          Planificado {formatAmount(planificado, linea.moneda)}
          {valor > 0 && Math.abs(desvio) >= 1 && (
            <span className={desvio > 0 ? 'text-expense font-medium' : 'text-income font-medium'}>
              {' · '}{desvio > 0 ? '+' : '−'}{formatAmount(Math.abs(desvio), linea.moneda)} {desvio > 0 ? 'más' : 'menos'}
            </span>
          )}
        </p>
      </div>
      <div>
        <Label htmlFor="pago-medio">Medio de pago</Label>
        <Select id="pago-medio" value={medio} onChange={(e) => setMedio(e.target.value)}>
          <option value="">Sin indicar</option>
          {(settings.tarjetas ?? []).map((t) => <option key={t.id} value={`t:${t.id}`}>{t.nombre}</option>)}
          <option value="debito">Débito</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={valor <= 0 || guardando}><Check className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Pagado'}</Button>
      </div>
    </form>
  )
}
