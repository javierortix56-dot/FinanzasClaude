'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useAssetStore } from '@/store/useAssetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { subscribeToAssets } from '@/lib/assets'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { toUSD } from '@/lib/currency'
import { formatAmount, getCurrentMonth, shiftMonth } from '@/lib/constants'
import { fetchLastNMonths } from '@/lib/analytics'
import { Asset, Transaction } from '@/types'
import AssetCard from '@/components/patrimonio/AssetCard'
import AssetModal from '@/components/patrimonio/AssetModal'
import PatrimonioChart from '@/components/patrimonio/PatrimonioChart'

type Tab = 'activo' | 'pasivo'

export default function PatrimonioPage() {
  const { assets, setAssets, isLoading } = useAssetStore()
  const { settings } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [tab,     setTab]     = useState<Tab>('activo')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Asset | null>(null)

  useEffect(() => {
    const unsub = subscribeToAssets(setAssets)
    return () => unsub()
  }, [setAssets])

  // Flujos de caja por mes (últimos 6 meses, incluye mes actual)
  const [monthlyFlows, setMonthlyFlows] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    const s = settings ?? DEFAULT_SETTINGS
    fetchLastNMonths(6, getCurrentMonth())
      .then((grouped) => {
        if (cancelled) return
        const flows: Record<string, number> = {}
        for (const [month, txs] of Object.entries(grouped)) {
          flows[month] = (txs as Transaction[])
            .filter((t) => t.ejecutado)
            .reduce((acc, t) => {
              const usd = toUSD(t.monto, t.moneda, s)
              return acc + (t.tipo === 'ingreso' ? usd : -usd)
            }, 0)
        }
        setMonthlyFlows(flows)
      })
      .catch((err) => console.error('[patrimonio] fetchLastNMonths error:', err))
    return () => { cancelled = true }
  }, [settings])

  const activos = assets.filter((a) => a.clase === 'activo')
  const pasivos = assets.filter((a) => a.clase === 'pasivo')

  const totalActivosUSD  = activos.reduce((s, a) => s + toUSD(a.saldo, a.moneda, settings ?? DEFAULT_SETTINGS), 0)
  const totalPasivosUSD  = pasivos.reduce((s, a) => s + toUSD(a.saldo, a.moneda, settings ?? DEFAULT_SETTINGS), 0)
  const netoUSD          = totalActivosUSD - totalPasivosUSD

  // Chart data — evolución estimada del neto a partir de los flujos ejecutados.
  // El mes actual tiene el valor real; los meses previos se calculan hacia atrás
  // restando el flujo neto de cada mes posterior. Para meses anteriores a la
  // primera fechaAlta de cualquier activo, el neto es 0 (no existía nada).
  const chartData = useMemo(() => {
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const current = getCurrentMonth()
    const earliestAssetMonth = assets.length > 0
      ? assets.reduce<string>((min, a) => {
          const d = a.fechaAlta.toDate()
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          return m < min ? m : min
        }, current)
      : current
    const points: { label: string; neto: number; estimated?: boolean; current?: boolean }[] = []
    let running = netoUSD
    for (let i = 0; i <= 5; i++) {
      const m = shiftMonth(current, -i)
      if (i > 0) {
        // Restamos el flujo del mes siguiente para retroceder
        const nextMonth = shiftMonth(current, -i + 1)
        running -= monthlyFlows[nextMonth] ?? 0
      }
      const [, mon] = m.split('-')
      const beforeAnyAsset = m < earliestAssetMonth
      points.unshift({
        label: monthNames[parseInt(mon) - 1],
        neto: beforeAnyAsset ? 0 : running,
        estimated: i > 0 && !beforeAnyAsset,
        current: i === 0,
      })
    }
    return points
  }, [netoUSD, monthlyFlows, assets])

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(a: Asset) { setEditing(a); setModalOpen(true) }

  const listed = tab === 'activo' ? activos : pasivos

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-gray-800 font-bold text-xl">Patrimonio</h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#534AB7]/10 hover:bg-[#534AB7]/20 transition-colors"
          >
            <Plus size={15} className="text-[#534AB7]" />
            <span className="text-[#534AB7] text-xs font-semibold">Cuenta</span>
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-xl px-3 py-3 text-center">
            <p className="text-gray-400 text-[10px] mb-1">Activos</p>
            <p className="text-green-700 text-sm font-bold">{formatAmount(totalActivosUSD, 'USD')}</p>
          </div>
          <div className="bg-red-50 rounded-xl px-3 py-3 text-center">
            <p className="text-gray-400 text-[10px] mb-1">Pasivos</p>
            <p className="text-red-500 text-sm font-bold">{formatAmount(totalPasivosUSD, 'USD')}</p>
          </div>
          <div className="bg-[#534AB7]/10 rounded-xl px-3 py-3 text-center border border-[#534AB7]/20">
            <p className="text-gray-400 text-[10px] mb-1">Neto</p>
            <p className={`text-sm font-bold ${netoUSD >= 0 ? 'text-[#534AB7]' : 'text-red-500'}`}>
              {formatAmount(netoUSD, 'USD')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="flex-1 min-h-0 bg-white overflow-hidden flex flex-col">

        {/* Chart */}
        {assets.length > 0 && (
          <div className="border-b border-gray-50">
            <PatrimonioChart data={chartData} currency="USD" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4">
          {(['activo', 'pasivo'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'text-[#534AB7] border-b-2 border-[#534AB7]'
                  : 'text-gray-400'
              }`}
            >
              {t === 'activo' ? `Activos (${activos.length})` : `Pasivos (${pasivos.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : listed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <p className="text-gray-400 text-sm">
                No hay {tab === 'activo' ? 'activos' : 'pasivos'} registrados
              </p>
              <button
                onClick={openAdd}
                className="mt-3 px-4 py-2 rounded-full bg-[#534AB7]/10 text-[#534AB7] text-sm font-semibold"
              >
                + Agregar cuenta
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {listed.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  settings={s}
                  onClick={() => openEdit(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AssetModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
      />
    </div>
  )
}
