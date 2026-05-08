'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useAssetStore } from '@/store/useAssetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { subscribeToAssets } from '@/lib/assets'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { toUSD } from '@/lib/currency'
import { formatAmount, getCurrentMonth, shiftMonth } from '@/lib/constants'
import { Asset } from '@/types'
import AssetCard from '@/components/patrimonio/AssetCard'
import AssetModal from '@/components/patrimonio/AssetModal'
import SnapshotModal from '@/components/patrimonio/SnapshotModal'
import PatrimonioChart from '@/components/patrimonio/PatrimonioChart'

type Tab = 'activo' | 'pasivo'

export default function PatrimonioPage() {
  const { assets, setAssets, isLoading } = useAssetStore()
  const { settings } = useSettingsStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [tab,         setTab]         = useState<Tab>('activo')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState<Asset | null>(null)
  const [snapAsset,   setSnapAsset]   = useState<Asset | null>(null)

  useEffect(() => {
    const unsub = subscribeToAssets(setAssets)
    return () => unsub()
  }, [setAssets])

  const activos = assets.filter((a) => a.clase === 'activo')
  const pasivos = assets.filter((a) => a.clase === 'pasivo')

  const totalActivosUSD  = activos.reduce((s, a) => s + toUSD(a.saldo, a.moneda, settings ?? DEFAULT_SETTINGS), 0)
  const totalPasivosUSD  = pasivos.reduce((s, a) => s + toUSD(a.saldo, a.moneda, settings ?? DEFAULT_SETTINGS), 0)
  const netoUSD          = totalActivosUSD - totalPasivosUSD

  // Chart data — barras apiladas de aportes acumulados vs revalorización
  // acumulada por mes en USD. Para cada mes y cada activo:
  //   - saldo del mes = snapshot del mes si existe, sino el saldo del mes anterior
  //   - aporte del mes = snapshot.aporte si existe, sino 0
  //   - revalorización del mes = saldo_mes - saldo_mes_anterior - aporte_mes
  // El chart arranca en la fechaAlta más temprana de cualquier activo.
  const chartData = useMemo(() => {
    if (assets.length === 0) return []
    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const current = getCurrentMonth()
    const earliest = assets.reduce<string>((min, a) => {
      const d = a.fechaAlta.toDate()
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return m < min ? m : min
    }, current)

    const months: string[] = []
    let m = earliest
    while (m <= current && months.length < 60) {
      months.push(m)
      m = shiftMonth(m, 1)
    }
    const shown = months.length > 6 ? months.slice(months.length - 6) : months

    // Estado por activo: saldo "vigente" en su moneda
    const running: Record<string, number> = {}

    let aportesAcumUSD = 0
    let prevAportes = 0
    let prevReval   = 0

    return shown.map((mon) => {
      let saldoTotalUSD  = 0
      let aporteMesUSD   = 0

      for (const a of assets) {
        const fa = a.fechaAlta.toDate()
        const faMonth = `${fa.getFullYear()}-${String(fa.getMonth() + 1).padStart(2, '0')}`
        if (faMonth > mon) continue

        const id = a.id ?? a.nombre
        const sign = a.clase === 'pasivo' ? -1 : 1
        const snap = a.snapshots?.find((sn) => sn.month === mon)

        let saldoMes: number
        let aporteMes = 0
        if (snap) {
          saldoMes  = snap.saldo
          aporteMes = snap.aporte
        } else if (running[id] === undefined) {
          // Sin snapshots aún (columna no migrada o activo recién creado):
          // init_bal es el saldo actual — lo usamos como aporte inicial
          saldoMes  = a.saldo
          aporteMes = a.saldo
        } else {
          // Mes sin snapshot: el saldo se mantiene igual al del mes anterior
          saldoMes = running[id]
        }
        running[id] = saldoMes

        saldoTotalUSD += sign * toUSD(saldoMes,  a.moneda, s)
        aporteMesUSD  += sign * toUSD(aporteMes, a.moneda, s)
      }

      aportesAcumUSD += aporteMesUSD
      const reval = saldoTotalUSD - aportesAcumUSD
      const deltaAportes = aportesAcumUSD - prevAportes
      const deltaReval   = reval - prevReval
      prevAportes = aportesAcumUSD
      prevReval   = reval

      const [, monNum] = mon.split('-')
      return {
        label: monthNames[parseInt(monNum) - 1],
        neto: saldoTotalUSD,
        aportes: aportesAcumUSD,
        reval,
        deltaAportes,
        deltaReval,
        current: mon === current,
      }
    })
  }, [assets, s])

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(a: Asset) { setEditing(a); setModalOpen(true) }
  function openSnap(a: Asset) { setSnapAsset(a) }

  const listed = tab === 'activo' ? activos : pasivos

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white px-4 pt-10 pb-2 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-gray-800 font-bold text-xl">Patrimonio</h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#534AB7]/10 hover:bg-[#534AB7]/20 transition-colors"
          >
            <Plus size={13} className="text-[#534AB7]" />
            <span className="text-[#534AB7] text-xs font-semibold">Cuenta</span>
          </button>
        </div>

        {/* Summary cards — compact single row */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-green-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-gray-400 text-[9px] mb-0.5">Activos</p>
            <p className="text-green-700 text-xs font-bold">{formatAmount(totalActivosUSD, 'USD')}</p>
          </div>
          <div className="bg-red-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-gray-400 text-[9px] mb-0.5">Pasivos</p>
            <p className="text-red-400 text-xs font-bold">{formatAmount(totalPasivosUSD, 'USD')}</p>
          </div>
          <div className="bg-[#534AB7]/10 rounded-lg px-2 py-1.5 text-center border border-[#534AB7]/20">
            <p className="text-gray-400 text-[9px] mb-0.5">Neto</p>
            <p className={`text-xs font-bold ${netoUSD >= 0 ? 'text-[#534AB7]' : 'text-red-400'}`}>
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
                  onUpdateSnapshot={() => openSnap(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <AssetModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
      />
      <SnapshotModal
        open={snapAsset !== null}
        onClose={() => setSnapAsset(null)}
        asset={snapAsset}
      />
    </div>
  )
}
