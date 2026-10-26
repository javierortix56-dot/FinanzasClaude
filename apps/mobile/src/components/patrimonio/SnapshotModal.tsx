'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Asset } from '@finanzas/core/types'
import { upsertSnapshot } from '@finanzas/core/lib/assets'
import { formatAmount, getCurrentMonth, monthLabel } from '@finanzas/core/lib/constants'
import Sheet, { FieldLabel, fieldClass, amountFieldClass } from '@/components/ui/Sheet'

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
  const [month, setMonth]   = useState(getCurrentMonth())
  const [aporte, setAporte] = useState('')
  const [saldo, setSaldo]   = useState('')
  const [saving, setSaving] = useState(false)

  // Saldo del mes inmediato anterior al seleccionado (para calcular reval.)
  const saldoPrev = useMemo(() => {
    if (!asset) return 0
    const prev = (asset.snapshots ?? [])
      .filter((s) => s.month < month)
      .sort((a, b) => b.month.localeCompare(a.month))[0]
    if (prev) return prev.saldo
    // Si no hay snapshot anterior, el saldo previo es el saldo inicial sólo
    // si fechaAlta es ANTERIOR al mes editado. Si es el mismo mes o posterior,
    // no había nada → saldoPrev = 0.
    const fechaAltaMonth = `${asset.fechaAlta.toDate().getFullYear()}-${String(
      asset.fechaAlta.toDate().getMonth() + 1
    ).padStart(2, '0')}`
    return fechaAltaMonth < month ? asset.saldo : 0
  }, [asset, month])

  const aporteNum = parseFloat((aporte || '0').replace(',', '.')) || 0
  const saldoNum  = parseFloat((saldo || '0').replace(',', '.')) || 0
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

  // Cuando cambia el mes, precarga snapshot existente si lo hay
  useEffect(() => {
    if (!asset) return
    const existing = asset.snapshots?.find((s) => s.month === month)
    if (existing) {
      setAporte(String(existing.aporte))
      setSaldo(String(existing.saldo))
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
    } finally {
      setSaving(false)
    }
  }

  const revalIcon = reval > 0 ? <TrendingUp size={12} /> : reval < 0 ? <TrendingDown size={12} /> : <Minus size={12} />
  const revalColor = reval > 0 ? 'text-emerald-600' : reval < 0 ? 'text-rose-500' : 'text-gray-400'

  return (
    <Sheet
      open={open && !!asset}
      onClose={onClose}
      title="Actualizar mes"
      subtitle={asset?.nombre}
      bodyClassName="px-5 pb-4 space-y-5"
      footer={
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || saldo === ''}
          className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar snapshot'}
        </motion.button>
      }
    >
      {asset && (
        <>
          {/* Selector de mes */}
          <div>
            <FieldLabel>Mes</FieldLabel>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={`${fieldClass} capitalize`}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          {/* Aporte / retiro */}
          <div>
            <FieldLabel>Aporte / retiro del mes ({asset.moneda})</FieldLabel>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={aporte}
              onChange={(e) => setAporte(e.target.value)}
              className={amountFieldClass}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Positivo si compraste / depositaste, negativo si vendiste / retiraste
            </p>
          </div>

          {/* Saldo al cierre */}
          <div>
            <FieldLabel>Saldo al cierre del mes ({asset.moneda})</FieldLabel>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
              className={amountFieldClass}
            />
          </div>

          {/* Resumen calculado */}
          <div className="rounded-[20px] bg-primary/[0.06] ring-1 ring-primary/15 p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Saldo previo</span>
              <span className="tabular-nums">{formatAmount(saldoPrev, asset.moneda)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Aporte / retiro</span>
              <span className="tabular-nums">
                {aporteNum >= 0 ? '+' : ''}{formatAmount(aporteNum, asset.moneda)}
              </span>
            </div>
            <div className="h-px bg-primary/15" />
            <motion.div
              key={Math.sign(reval)}
              initial={{ opacity: 0.4, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex justify-between text-sm font-bold ${revalColor}`}
            >
              <span className="flex items-center gap-1">
                {revalIcon} Revalorización
              </span>
              <span className="tabular-nums">
                {reval >= 0 ? '+' : ''}{formatAmount(reval, asset.moneda)}
              </span>
            </motion.div>
          </div>
        </>
      )}
    </Sheet>
  )
}
