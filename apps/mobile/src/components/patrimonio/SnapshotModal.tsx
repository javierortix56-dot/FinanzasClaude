'use client'

import { useState, useEffect, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Asset } from '@finanzas/core/types'
import { upsertSnapshot } from '@finanzas/core/lib/assets'
import { formatAmount, getCurrentMonth, monthLabel } from '@finanzas/core/lib/constants'
import { parseAmount } from '@finanzas/core/lib/parse'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { Button } from '@/components/ui/button'

/** Saldo del mes inmediato anterior a `month` para el activo dado. */
function calcSaldoPrev(asset: Asset, month: string): number {
  const prev = (asset.snapshots ?? [])
    .filter((s) => s.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0]
  if (prev) return prev.saldo
  // Si no hay snapshot anterior, el saldo previo es el saldo inicial sólo
  // si fechaAlta es ANTERIOR al mes editado. Si es el mismo mes o posterior,
  // no había nada → saldoPrev = 0.
  const fa = asset.fechaAlta.toDate()
  const fechaAltaMonth = `${fa.getFullYear()}-${String(fa.getMonth() + 1).padStart(2, '0')}`
  return fechaAltaMonth < month ? asset.saldo : 0
}

interface Props {
  open: boolean
  onClose: () => void
  asset: Asset | null
}

/**
 * Modal para registrar / editar el snapshot de un mes.
 * Pide dos números:
 *   - aporte: cuánto pusiste o sacaste este mes (positivo = aporte, negativo = retiro)
 *   - saldo:  el saldo al cierre de ese mes
 * Con eso se calcula la revalorización: saldo - saldo_anterior - aporte.
 */
export default function SnapshotModal({ open, onClose, asset }: Props) {
  const showToast = useUIStore((st) => st.showToast)
  const [month, setMonth]   = useState(getCurrentMonth())
  const [aporte, setAporte] = useState('')
  const [saldo, setSaldo]   = useState('')
  const [saving, setSaving] = useState(false)

  // Saldo del mes inmediato anterior al seleccionado (para calcular reval.)
  const saldoPrev = useMemo(() => (asset ? calcSaldoPrev(asset, month) : 0), [asset, month])

  // El aporte puede ser negativo (retiro); el saldo no.
  const aporteNum = parseAmount(aporte || '0', { allowNegative: true }) ?? 0
  const saldoNum  = parseAmount(saldo || '0') ?? 0
  const reval     = saldoNum - saldoPrev - aporteNum

  // Lista de meses disponibles: desde fechaAlta hasta mes actual
  // Debe estar antes del early-return para no violar las Rules of Hooks
  const monthOptions = useMemo(() => {
    if (!asset) return []
    const out: string[] = []
    const fa = asset.fechaAlta.toDate()
    let m = `${fa.getFullYear()}-${String(fa.getMonth() + 1).padStart(2, '0')}`
    const current = getCurrentMonth()
    while (m <= current && out.length < 60) {
      out.push(m)
      const [y, mn] = m.split('-').map(Number)
      const nxt = new Date(y, mn, 1)
      m = `${nxt.getFullYear()}-${String(nxt.getMonth() + 1).padStart(2, '0')}`
    }
    return out.reverse()
  }, [asset])

  // Reset cuando se abre / se cambia de activo
  useEffect(() => {
    if (!open || !asset) return
    const cm = getCurrentMonth()
    setMonth(cm)
    const existing = asset.snapshots?.find((s) => s.month === cm)
    if (existing) {
      setAporte(String(existing.aporte))
      setSaldo(String(existing.saldo))
    } else {
      setAporte('')
      setSaldo(String(asset.saldo))
    }
  }, [open, asset])

  // Cuando cambia el mes, precarga el snapshot existente; si el mes no tiene
  // snapshot, limpia el aporte y propone el saldo previo correcto de ESE mes
  // (no los valores que quedaron del mes anterior seleccionado).
  useEffect(() => {
    if (!asset) return
    const existing = asset.snapshots?.find((s) => s.month === month)
    if (existing) {
      setAporte(String(existing.aporte))
      setSaldo(String(existing.saldo))
    } else {
      setAporte('')
      setSaldo(String(calcSaldoPrev(asset, month)))
    }
  }, [month, asset])

  async function handleSave() {
    if (!asset || saldo === '') return
    setSaving(true)
    try {
      await upsertSnapshot(asset, {
        month,
        aporte: aporteNum,
        saldo: saldoNum,
      })
      onClose()
    } catch (err) {
      console.error('[SnapshotModal] save error:', err)
      showToast(err instanceof Error ? err.message : 'Error al guardar el snapshot', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!asset) return null

  const revalIcon = reval > 0 ? <TrendingUp size={12} /> : reval < 0 ? <TrendingDown size={12} /> : <Minus size={12} />
  const revalColor = reval > 0 ? 'text-green-600' : reval < 0 ? 'text-red-400' : 'text-gray-400'

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <div>
              <Dialog.Title className="text-base font-semibold text-gray-900">
                Actualizar mes
              </Dialog.Title>
              <p className="text-xs text-gray-400">{asset.nombre}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="px-5 pt-4 pb-8 space-y-5">
            {/* Selector de mes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Mes
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full h-11 px-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-[#534AB7]/30 capitalize"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>

            {/* Aporte / retiro */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Aporte / retiro del mes ({asset.moneda})
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={aporte}
                onChange={(e) => setAporte(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7]"
              />
              <p className="text-[11px] text-gray-400">
                Positivo si compraste / depositaste, negativo si vendiste / retiraste
              </p>
            </div>

            {/* Saldo al cierre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Saldo al cierre del mes ({asset.moneda})
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7]"
              />
            </div>

            {/* Resumen calculado */}
            <div className="rounded-xl bg-[#534AB7]/5 border border-[#534AB7]/10 p-3 space-y-1.5">
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Saldo previo</span>
                <span className="tabular-nums">{formatAmount(saldoPrev, asset.moneda)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Aporte / retiro</span>
                <span className="tabular-nums">
                  {aporteNum >= 0 ? '+' : ''}{formatAmount(aporteNum, asset.moneda)}
                </span>
              </div>
              <div className={`flex justify-between text-xs font-semibold ${revalColor}`}>
                <span className="flex items-center gap-1">
                  {revalIcon} Revalorización
                </span>
                <span className="tabular-nums">
                  {reval >= 0 ? '+' : ''}{formatAmount(reval, asset.moneda)}
                </span>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving || saldo === ''} className="w-full h-11">
              {saving ? 'Guardando...' : 'Guardar snapshot'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
