'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Wallet } from 'lucide-react'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { toUSD } from '@finanzas/core/lib/currency'
import { getCurrentMonth, shiftMonth } from '@finanzas/core/lib/constants'
import { Asset } from '@finanzas/core/types'
import AssetCard from '@/components/patrimonio/AssetCard'
import AssetModal from '@/components/patrimonio/AssetModal'
import SnapshotModal from '@/components/patrimonio/SnapshotModal'
import PatrimonioChart from '@/components/patrimonio/PatrimonioChart'
import PageHeader, { HeaderButton, PrivacyToggle } from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { Money } from '@/components/ui/AnimatedNumber'
import { easeOut, stagger } from '@/components/ui/motion'

type Tab = 'activo' | 'pasivo'

export default function PatrimonioPage() {
  const { assets, isLoading } = useAssetStore()
  const { settings } = useSettingsStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [tab,         setTab]         = useState<Tab>('activo')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState<Asset | null>(null)
  const [snapAsset,   setSnapAsset]   = useState<Asset | null>(null)
  const [snapOpen,    setSnapOpen]    = useState(false)

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
  function openSnap(a: Asset) { setSnapAsset(a); setSnapOpen(true) }

  const listed = tab === 'activo' ? activos : pasivos

  const totalBruto = totalActivosUSD + totalPasivosUSD
  const pctActivos = totalBruto > 0 ? (totalActivosUSD / totalBruto) * 100 : 100

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Patrimonio"
        subtitle="Cuentas, inversiones y deudas"
        actions={<>
          <PrivacyToggle />
          <HeaderButton onClick={openAdd} label="Agregar cuenta" active>
            <Plus size={16} /> <span className="pr-0.5">Cuenta</span>
          </HeaderButton>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-28 no-scrollbar">
        {/* ── Hero: patrimonio neto ── */}
        <motion.section
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={easeOut}
          className="relative mx-4 rounded-[26px] bg-brand text-white px-4 pt-4 pb-3.5 shadow-lift overflow-hidden"
        >
          <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Patrimonio neto</p>
          <p className={`relative text-[32px] leading-tight font-bold tracking-tight mt-0.5 ${netoUSD < 0 ? 'text-rose-200' : ''}`}>
            <Money value={netoUSD} currency="USD" />
          </p>

          {/* Proporción activos / pasivos */}
          <div className="relative mt-3 h-2 rounded-full bg-white/15 overflow-hidden flex">
            <motion.div
              className="h-full bg-emerald-300"
              initial={{ width: 0 }}
              animate={{ width: `${pctActivos}%` }}
              transition={{ type: 'spring', stiffness: 110, damping: 22 }}
            />
            <motion.div
              className="h-full bg-rose-300"
              initial={{ width: 0 }}
              animate={{ width: `${100 - pctActivos}%` }}
              transition={{ type: 'spring', stiffness: 110, damping: 22 }}
            />
          </div>
          <div className="relative flex justify-between mt-2 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              <span className="text-white/70">Activos</span>
              <span className="font-semibold"><Money value={totalActivosUSD} currency="USD" /></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
              <span className="text-white/70">Pasivos</span>
              <span className="font-semibold"><Money value={totalPasivosUSD} currency="USD" /></span>
            </span>
          </div>
        </motion.section>

        {/* ── Chart ── */}
        {assets.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...easeOut, delay: 0.06 }}
            className="mx-4 mt-3 glass rounded-[24px]"
          >
            <PatrimonioChart data={chartData} currency="USD" />
          </motion.section>
        )}

        {/* ── Tabs ── */}
        <div className="mx-4 mt-4 mb-2">
          <Segmented
            id="patrimonio-tab"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'activo', label: <>Activos <span className="opacity-50 tabular-nums">{activos.length}</span></> },
              { value: 'pasivo', label: <>Pasivos <span className="opacity-50 tabular-nums">{pasivos.length}</span></> },
            ]}
          />
        </div>

        {/* ── List ── */}
        <div className="px-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[76px] rounded-[22px]" />)}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: tab === 'activo' ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === 'activo' ? 16 : -16 }}
                transition={{ duration: 0.2 }}
              >
                {listed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6 glass rounded-[24px]">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2.5">
                      <Wallet size={20} className="text-primary" />
                    </div>
                    <p className="text-gray-500 text-sm font-semibold">
                      No hay {tab === 'activo' ? 'activos' : 'pasivos'} registrados
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={openAdd}
                      className="mt-3 px-4 h-9 rounded-full bg-brand text-white text-xs font-semibold shadow-soft"
                    >
                      + Agregar cuenta
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listed.map((a, i) => (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: stagger(i, 0.04), ease: [0.22, 1, 0.36, 1] }}
                      >
                        <AssetCard
                          asset={a}
                          settings={s}
                          onClick={() => openEdit(a)}
                          onUpdateSnapshot={() => openSnap(a)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Modales */}
      <AssetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
      <SnapshotModal
        open={snapOpen}
        onClose={() => setSnapOpen(false)}
        asset={snapAsset}
      />
    </div>
  )
}
