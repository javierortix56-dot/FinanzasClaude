'use client'

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, PiggyBank } from 'lucide-react'
import { useAssetStore } from '@/store/useAssetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useUIStore } from '@/store/useUIStore'
import { addTransaction } from '@/lib/transactions'
import { adjustAssetSaldo } from '@/lib/assets'
import { toBase } from '@/lib/currency'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { SHARED_USER_ID, SHARED_USERS, formatAmount, monthLabel } from '@/lib/constants'
import { Transaction } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Saldo sugerido — siempre en ARS, ya calculado por el caller. */
  defaultAmountArs: number
  /** Mes en formato YYYY-MM. */
  month: string
}

export default function AhorrarBalanceModal({ open, onClose, defaultAmountArs, month }: Props) {
  const { assets } = useAssetStore()
  const { settings } = useSettingsStore()
  const { showToast } = useUIStore()
  const s = settings ?? DEFAULT_SETTINGS

  const ahorroAssets = assets.filter(
    (a) => a.clase === 'activo' && a.tipo.toLowerCase() === 'ahorro',
  )

  const [amount, setAmount] = useState('')
  const [assetId, setAssetId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setSaving(false)
      return
    }
    setAmount(defaultAmountArs > 0 ? defaultAmountArs.toFixed(2) : '')
    setAssetId(ahorroAssets[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAmountArs])

  const parsed = parseFloat(amount.replace(',', '.'))
  const valid  = Number.isFinite(parsed) && parsed > 0 && !!assetId

  async function handleConfirm() {
    if (!valid) return
    const asset = ahorroAssets.find((a) => a.id === assetId)
    if (!asset) return
    setSaving(true)
    setError(null)
    try {
      // Convertimos el monto (ARS) a la moneda del activo para sumar exactamente esa cantidad.
      const deltaInAssetCurrency = toBase(parsed, 'ARS', asset.moneda, s)

      // 1) Crear el movimiento egreso vinculado
      const today = new Date().toISOString().split('T')[0]
      const tx: Omit<Transaction, 'id'> = {
        userId: SHARED_USER_ID,
        tipo: 'egreso',
        monto: parsed,
        moneda: 'ARS',
        categoria: 'ahorro',
        descripcion: `Ahorro ${monthLabel(month)}`,
        nota: '',
        tags: [],
        fecha: { toDate: () => new Date(today + 'T12:00:00') },
        ejecutado: true,
        asignadoA: null,
        creadoPor: SHARED_USERS[0].id,
        recurrente: false,
        ahorroAssetId: asset.id!,
        ahorroDelta: deltaInAssetCurrency,
      }
      await addTransaction(tx)
      // 2) Sumar al activo
      await adjustAssetSaldo(asset.id!, deltaInAssetCurrency)

      showToast(`Sumado ${formatAmount(deltaInAssetCurrency, asset.moneda)} a ${asset.nombre}`)
      onClose()
    } catch (err) {
      console.error('[AhorrarBalanceModal] error:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-3xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-9 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 pb-3">
            <Dialog.Title className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PiggyBank size={18} className="text-[#534AB7]" />
              Ahorrar saldo
            </Dialog.Title>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X size={15} className="text-gray-600" />
            </button>
          </div>

          <div className="px-5 pb-6">
            <p className="text-xs text-gray-500 leading-snug mb-4">
              Vamos a crear un movimiento de egreso con categoría <b>Ahorro</b> y sumar el monto a la cuenta que elijas.
              Si después borrás el movimiento, el aporte se revierte automáticamente.
            </p>

            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Monto a ahorrar (ARS)
            </label>
            <div className="rounded-2xl px-4 pt-3 pb-4 mt-2 mb-4 bg-[#534AB7]/5">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-3xl font-bold bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-300"
              />
              <p className="text-[10px] text-gray-400 mt-1">Sugerido: {formatAmount(defaultAmountArs, 'ARS')}</p>
            </div>

            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              Cuenta destino
            </label>
            {ahorroAssets.length === 0 ? (
              <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                No tenés cuentas de tipo <b>Ahorro</b>. Creá una desde Patrimonio antes de continuar.
              </p>
            ) : (
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-2 w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30 focus:bg-white"
              >
                {ahorroAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — {formatAmount(a.saldo, a.moneda)}
                  </option>
                ))}
              </select>
            )}

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600 break-all">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={onClose}
                disabled={saving}
                className="h-12 px-5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !valid}
                className="flex-1 h-12 rounded-2xl text-sm font-bold text-white bg-[#534AB7] disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Confirmar y ahorrar'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
