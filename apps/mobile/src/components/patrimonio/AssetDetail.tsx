'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Landmark, Pencil, RefreshCw, X } from 'lucide-react'
import { Asset, Currency, Settings } from '@finanzas/core/types'
import { toUSD } from '@finanzas/core/lib/currency'
import { proyeccionMeta } from '@finanzas/core/lib/assets'
import { formatAmount, monthLabel } from '@finanzas/core/lib/constants'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { Money } from '@/components/ui/AnimatedNumber'
import ProgressBar from '@/components/ui/ProgressBar'
import Sparkline from '@/components/ui/Sparkline'
import { TIPO_ICONS } from './AssetCard'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corto = (m: string) => `${MES[parseInt(m.split('-')[1], 10) - 1]} ${m.slice(2, 4)}`

/**
 * Detalle de una cuenta: la tarjeta de la lista se expande (layoutId
 * compartido) y muestra la evolución del saldo, la meta y el historial de
 * snapshots, con accesos a editar y actualizar el mes.
 */
export default function AssetDetail({ asset, settings, onClose, onEdit, onSnapshot }: {
  asset: Asset | null
  settings: Settings
  onClose: () => void
  onEdit: (a: Asset) => void
  onSnapshot: (a: Asset) => void
}) {
  const hideAmounts = useSettingsStore((st) => st.hideAmounts)
  const blur = hideAmounts ? 'blur-[5px] select-none' : ''

  return (
    <AnimatePresence>
      {asset && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="detail"
            layoutId={`asset-${asset.id}`}
            role="dialog"
            aria-label={asset.nombre}
            className="fixed z-50 inset-x-0 mx-auto w-[calc(100%-24px)] max-w-[366px] top-[max(3rem,env(safe-area-inset-top))] bottom-[104px] sheet-surface rounded-[28px] overflow-hidden flex flex-col"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100) onClose() }}
          >
            <Contenido asset={asset} settings={settings} blur={blur} onClose={onClose} onEdit={onEdit} onSnapshot={onSnapshot} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Contenido({ asset, settings, blur, onClose, onEdit, onSnapshot }: {
  asset: Asset
  settings: Settings
  blur: string
  onClose: () => void
  onEdit: (a: Asset) => void
  onSnapshot: (a: Asset) => void
}) {
  const isActivo = asset.clase === 'activo'
  const color = isActivo ? '#4e7d5b' : '#b4533f'
  const snaps = [...(asset.snapshots ?? [])].sort((a, b) => a.month.localeCompare(b.month))
  const usd = toUSD(asset.saldo, asset.moneda, settings)
  const icon = TIPO_ICONS[asset.tipo.toLowerCase()] ?? <Landmark size={18} />

  let metaPct = 0
  if (asset.metaObjetivo && asset.metaMoneda) {
    const goal = toUSD(asset.metaObjetivo, asset.metaMoneda as Currency, settings)
    metaPct = goal > 0 ? Math.min((usd / goal) * 100, 100) : 0
  }
  const proy = asset.metaObjetivo ? proyeccionMeta(asset, settings) : null

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.12 } }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      {/* Header (zona de arrastre) */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 flex-shrink-0">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
          isActivo ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-500'
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{asset.nombre}</p>
          <p className="text-xs text-gray-400 capitalize">{asset.tipo} · {asset.moneda}</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-500/10 text-gray-600" aria-label="Cerrar detalle">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pb-4 space-y-4">
        <div>
          <p className={`text-[32px] font-bold tracking-tight leading-tight ${isActivo ? 'text-gray-900' : 'text-rose-500'}`}>
            {isActivo ? '' : '-'}<Money value={asset.saldo} currency={asset.moneda} />
          </p>
          {asset.moneda !== 'USD' && (
            <p className="text-xs text-gray-400">≈ <Money value={usd} currency="USD" animated={false} /></p>
          )}
        </div>

        {/* Evolución */}
        {snaps.length >= 2 ? (
          <div className="rounded-2xl bg-gray-500/[0.05] px-3 pt-3 pb-2">
            <p className="eyebrow mb-2">Evolución del saldo</p>
            <Sparkline values={snaps.map((s) => s.saldo)} color={color} width={310} height={84} strokeWidth={2} className="w-full h-auto" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 capitalize">
              <span>{corto(snaps[0].month)}</span>
              <span>{corto(snaps[snaps.length - 1].month)}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 rounded-2xl bg-gray-500/[0.05] px-3 py-3">
            Con dos o más meses actualizados vas a ver la evolución del saldo acá.
          </p>
        )}

        {/* Meta */}
        {asset.metaObjetivo != null && (
          <div className="rounded-2xl bg-primary/[0.06] px-3 py-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Meta: <span className="font-semibold">{asset.metaMoneda} {new Intl.NumberFormat('es-AR').format(asset.metaObjetivo)}</span></span>
              <span className="font-bold text-primary">{Math.round(metaPct)}%</span>
            </div>
            <ProgressBar value={metaPct} color="linear-gradient(90deg, var(--primary-2), var(--primary))" trackClassName="bg-primary/10" />
            {proy && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                {proy.meses === 0 ? '🎉 ¡Meta cumplida!' : <>A este ritmo llegan en <b className="text-primary">{proy.meses} mes{proy.meses !== 1 ? 'es' : ''}</b> (<span className="capitalize">{monthLabel(proy.mes).replace(' de ', ' ')}</span>)</>}
              </p>
            )}
          </div>
        )}

        {/* Historial */}
        {snaps.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Historial mensual</p>
            <div className="rounded-2xl bg-gray-500/[0.05] divide-y divide-[var(--hairline)]">
              {[...snaps].reverse().map((sn, i) => (
                <motion.div
                  key={sn.month}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + Math.min(i * 0.03, 0.3) }}
                  className="flex items-center justify-between px-3 py-2.5 text-xs"
                >
                  <span className="text-gray-600 capitalize w-16">{corto(sn.month)}</span>
                  <span className={`tabular-nums flex-1 text-center ${sn.aporte >= 0 ? 'text-emerald-600' : 'text-rose-500'} ${blur}`}>
                    {sn.aporte >= 0 ? '+' : ''}{formatAmount(sn.aporte, asset.moneda)}
                  </span>
                  <span className={`tabular-nums font-semibold text-gray-900 ${blur}`}>{formatAmount(sn.saldo, asset.moneda)}</span>
                </motion.div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">Mes · aporte/retiro · saldo al cierre</p>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-2 px-4 pb-4 pt-2 flex-shrink-0 border-t border-hairline">
        {isActivo && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => onSnapshot(asset)}
            className="flex-1 h-11 rounded-2xl bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={14} /> Actualizar mes
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => onEdit(asset)}
          className="flex-1 h-11 rounded-2xl bg-brand text-white text-sm font-semibold shadow-soft flex items-center justify-center gap-1.5"
        >
          <Pencil size={14} /> Editar cuenta
        </motion.button>
      </div>
    </motion.div>
  )
}
