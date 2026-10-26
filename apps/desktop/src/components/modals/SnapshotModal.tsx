'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MoneyText } from '@/components/MoneyText'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { upsertSnapshot } from '@finanzas/core/lib/assets'
import { getCurrentMonth, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { Asset } from '@finanzas/core/types'
import { cn } from '@finanzas/core/lib/utils'

/**
 * Registrar el saldo de un mes (paridad con mobile). Desktop no tenía forma
 * de cargar snapshots, así que el historial y la proyección de metas solo
 * se alimentaban desde el teléfono.
 *   - aporte: cuánto se puso o sacó ese mes (positivo = aporte)
 *   - saldo: saldo al cierre del mes
 * Revalorización = saldo − saldo anterior − aporte.
 */
export function SnapshotModal({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  return (
    <Modal
      open={!!asset}
      onClose={onClose}
      title="Actualizar saldo"
      description={asset ? `${asset.nombre} · ${asset.moneda}` : undefined}
      size="sm"
    >
      {asset && <Form key={asset.id} asset={asset} onClose={onClose} />}
    </Modal>
  )
}

const parseNum = (v: string) => parseFloat((v || '0').replace(',', '.')) || 0

function Form({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const showToast = useUIStore((s) => s.showToast)
  const current = getCurrentMonth()
  const snapOf = (m: string) => asset.snapshots?.find((s) => s.month === m)

  const [month, setMonth] = useState(current)
  const [aporte, setAporte] = useState(() => String(snapOf(current)?.aporte ?? ''))
  const [saldo, setSaldo] = useState(() => String(snapOf(current)?.saldo ?? asset.saldo))
  const [saving, setSaving] = useState(false)

  // Meses desde el alta hasta hoy (más reciente primero, máx. 5 años)
  const monthOptions = useMemo(() => {
    const fa = asset.fechaAlta.toDate()
    let m = `${fa.getFullYear()}-${String(fa.getMonth() + 1).padStart(2, '0')}`
    const out: string[] = []
    while (m <= current && out.length < 60) { out.push(m); m = shiftMonth(m, 1) }
    if (out.length === 0) out.push(current)
    return out.reverse()
  }, [asset, current])

  const saldoPrev = useMemo(() => {
    const prev = (asset.snapshots ?? [])
      .filter((s) => s.month < month)
      .sort((a, b) => b.month.localeCompare(a.month))[0]
    if (prev) return prev.saldo
    const fa = asset.fechaAlta.toDate()
    const altaMonth = `${fa.getFullYear()}-${String(fa.getMonth() + 1).padStart(2, '0')}`
    return altaMonth < month ? asset.saldo : 0
  }, [asset, month])

  const aporteNum = parseNum(aporte)
  const saldoNum = parseNum(saldo)
  const reval = saldoNum - saldoPrev - aporteNum

  function changeMonth(m: string) {
    setMonth(m)
    const ex = snapOf(m)
    if (ex) { setAporte(String(ex.aporte)); setSaldo(String(ex.saldo)) }
  }

  async function handleSave() {
    if (saldo.trim() === '') return
    setSaving(true)
    try {
      await upsertSnapshot(asset, { month, aporte: aporteNum, saldo: saldoNum })
      showToast(`Saldo de ${monthLabel(month)} guardado`)
      onClose()
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const RevalIcon = reval > 0 ? TrendingUp : reval < 0 ? TrendingDown : Minus

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
      <div>
        <Label htmlFor="snap-mes">Mes</Label>
        <Select id="snap-mes" value={month} onChange={(e) => changeMonth(e.target.value)}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}{snapOf(m) ? ' · cargado' : ''}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="snap-aporte">Aporte / retiro</Label>
          <Input id="snap-aporte" inputMode="decimal" value={aporte} onChange={(e) => setAporte(e.target.value)} placeholder="0" className="tnum" />
        </div>
        <div>
          <Label htmlFor="snap-saldo">Saldo al cierre</Label>
          <Input id="snap-saldo" autoFocus inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} className="tnum font-semibold" />
        </div>
      </div>

      <div className="rounded-xl bg-surface-2 px-4 py-3 space-y-1.5 text-[13px]">
        <div className="flex justify-between text-muted">
          <span>Saldo anterior</span>
          <span className="tnum"><MoneyText amount={saldoPrev} currency={asset.moneda} /></span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Aporte</span>
          <span className="tnum">{aporteNum >= 0 ? '+' : ''}<MoneyText amount={aporteNum} currency={asset.moneda} /></span>
        </div>
        <div className="flex justify-between border-t border-hairline pt-1.5 font-semibold">
          <span>Revalorización</span>
          <span className={cn('inline-flex items-center gap-1 tnum', reval > 0 ? 'text-income' : reval < 0 ? 'text-expense' : 'text-muted')}>
            <RevalIcon className="h-3.5 w-3.5" />
            <MoneyText amount={reval} currency={asset.moneda} />
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" disabled={saving || saldo.trim() === ''}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}
