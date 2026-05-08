'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { X, PiggyBank, ExternalLink } from 'lucide-react'
import { useAssetStore } from '@/store/useAssetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { addTransaction } from '@/lib/transactions'
import { upsertSnapshot } from '@/lib/assets'
import { SHARED_USER_ID, getCurrentMonth } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Currency } from '@/types'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Props {
  open: boolean
  onClose: () => void
}

export default function AhorrarModal({ open, onClose }: Props) {
  const { assets } = useAssetStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const ahorroAssets = assets.filter((a) => a.clase === 'activo')

  const [assetId, setAssetId] = useState('')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState<Currency>(base)
  const [descripcion, setDescripcion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setMonto(''); setDescripcion(''); setError(null); return }
    if (ahorroAssets.length > 0 && !assetId) setAssetId(ahorroAssets[0].id ?? '')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const parsed = parseFloat(monto.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 0 && !!assetId

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const asset = assets.find((a) => a.id === assetId)
      if (!asset) throw new Error('Cuenta no encontrada')

      const now = new Date()
      await addTransaction({
        userId: SHARED_USER_ID,
        tipo: 'egreso',
        monto: parsed,
        moneda,
        categoria: 'ahorro',
        descripcion: descripcion.trim() || `Ahorro → ${asset.nombre}`,
        nota: '',
        tags: [],
        fecha: { toDate: () => now },
        ejecutado: true,
        asignadoA: null,
        creadoPor: SHARED_USER_ID,
        recurrente: false,
        ahorroAssetId: assetId,
      })

      // If saving in same currency as asset, update its saldo + snapshot
      if (moneda === asset.moneda) {
        const currentMonth = getCurrentMonth()
        const existingSnap = asset.snapshots.find((sn) => sn.month === currentMonth)
        await upsertSnapshot(asset, {
          month: currentMonth,
          aporte: (existingSnap?.aporte ?? 0) + parsed,
          saldo: asset.saldo + parsed,
        })
      }

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-3xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-9 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 pb-4">
            <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <PiggyBank size={20} className="text-[#534AB7]" />
              Ahorrar
            </Dialog.Title>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <X size={15} className="text-gray-600" />
            </button>
          </div>

          <div className="px-5 pb-8 space-y-5">
            {/* Cuenta destino */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Cuenta destino</label>
                <Link
                  href="/patrimonio"
                  onClick={onClose}
                  className="flex items-center gap-1 text-[10px] text-[#534AB7] font-medium"
                >
                  <ExternalLink size={10} />
                  Administrar cuentas
                </Link>
              </div>
              {ahorroAssets.length === 0 ? (
                <p className="text-xs text-gray-400">No hay cuentas activas. Creá una en Patrimonio.</p>
              ) : (
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30"
                >
                  {ahorroAssets.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} ({a.moneda})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Monto + moneda */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Monto</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="flex-1 text-3xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7]"
                />
                <div className="flex flex-col gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMoneda(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        moneda === c ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Descripción <span className="font-normal normal-case text-gray-300">— opcional</span></label>
              <input
                type="text"
                placeholder="Ej: Fondo de emergencia"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full bg-gray-50 rounded-xl px-3.5 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#534AB7]/30 focus:bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600">{error}</div>
            )}

            <div className="flex gap-2.5">
              <button onClick={onClose} disabled={saving} className="h-12 px-5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-500">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !valid}
                className="flex-1 h-12 rounded-2xl text-sm font-bold text-white bg-[#534AB7] disabled:opacity-40 transition-all"
              >
                {saving ? 'Guardando…' : 'Ahorrar'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
