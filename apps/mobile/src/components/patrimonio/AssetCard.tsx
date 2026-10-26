'use client'

import {
  Landmark, Banknote, TrendingUp, PiggyBank, Bitcoin,
  CreditCard, HandCoins, AlertCircle, RefreshCw,
} from 'lucide-react'
import { Asset, Settings, Currency } from '@finanzas/core/types'
import { toUSD } from '@finanzas/core/lib/currency'
import { proyeccionMeta } from '@finanzas/core/lib/assets'
import { getCurrentMonth, monthLabel } from '@finanzas/core/lib/constants'
import { motion } from 'motion/react'
import { Money } from '@/components/ui/AnimatedNumber'
import ProgressBar from '@/components/ui/ProgressBar'
import Sparkline from '@/components/ui/Sparkline'

export const TIPO_ICONS: Record<string, React.ReactNode> = {
  banco:        <Landmark     size={18} />,
  efectivo:     <Banknote     size={18} />,
  cripto:       <Bitcoin      size={18} />,
  inversiones:  <TrendingUp   size={18} />,
  ahorro:       <PiggyBank    size={18} />,
  // pasivos (lowercase match)
  'tarjeta de crédito': <CreditCard  size={18} />,
  'préstamo':           <HandCoins   size={18} />,
  deuda:                <AlertCircle size={18} />,
}

interface Props {
  asset: Asset
  settings: Settings
  onClick: () => void
  onUpdateSnapshot?: () => void
}

export default function AssetCard({ asset, settings, onClick, onUpdateSnapshot }: Props) {
  const usdValue = toUSD(asset.saldo, asset.moneda, settings)
  const isActivo = asset.clase === 'activo'

  // Meta progress
  let metaPercent = 0
  let metaLabel   = ''
  if (asset.metaObjetivo && asset.metaMoneda) {
    const currentUSD = toUSD(asset.saldo, asset.moneda, settings)
    const goalUSD    = toUSD(asset.metaObjetivo, asset.metaMoneda as Currency, settings)
    metaPercent = goalUSD > 0 ? Math.min((currentUSD / goalUSD) * 100, 100) : 0
    metaLabel = `${asset.metaMoneda} ${new Intl.NumberFormat('es-AR').format(asset.metaObjetivo)}`
  }

  const icon = TIPO_ICONS[asset.tipo.toLowerCase()] ?? <Landmark size={18} />
  const iconBg = isActivo
    ? 'bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 text-emerald-600'
    : 'bg-gradient-to-br from-rose-400/20 to-rose-500/10 text-rose-500'

  // Estado del snapshot del mes actual
  const currentMonth = getCurrentMonth()
  const currentSnap = asset.snapshots?.find((s) => s.month === currentMonth)
  const lastSnap = asset.snapshots?.length
    ? asset.snapshots[asset.snapshots.length - 1]
    : null

  // Tendencia del saldo según los snapshots mensuales
  const serie = (asset.snapshots ?? []).map((sn) => sn.saldo)

  return (
    <motion.div
      layoutId={asset.id ? `asset-${asset.id}` : undefined}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      whileTap={{ scale: 0.985 }}
      className="w-full glass rounded-[22px] px-3.5 py-3.5 text-left cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{asset.nombre}</p>
            <p className={`text-sm font-bold flex-shrink-0 ${isActivo ? 'text-gray-900' : 'text-rose-500'}`}>
              {isActivo ? '' : '-'}<Money value={asset.saldo} currency={asset.moneda} />
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className="text-xs text-gray-400 capitalize">{asset.tipo}</span>
            <Sparkline values={serie} color={isActivo ? '#10b981' : '#f43f5e'} width={56} height={18} className="flex-shrink-0 opacity-90" />
            {asset.moneda !== 'USD' && (
              <span className="text-xs text-gray-400">≈ <Money value={usdValue} currency="USD" animated={false} /></span>
            )}
          </div>
        </div>
      </div>

      {/* Meta progress */}
      {asset.metaObjetivo != null && (
        <div className="mt-3 rounded-2xl bg-primary/[0.06] px-3 py-2.5">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
            <span>Meta: <span className="font-semibold">{metaLabel}</span></span>
            <span className="font-bold text-primary tabular-nums">{Math.round(metaPercent)}%</span>
          </div>
          <ProgressBar
            value={metaPercent}
            color="linear-gradient(90deg, var(--primary-2), var(--primary))"
            trackClassName="bg-primary/10"
          />
          {/* Proyección: a este ritmo de aportes, ¿cuándo llegan? */}
          {(() => {
            const proy = proyeccionMeta(asset, settings)
            if (!proy) return null
            if (proy.meses === 0) {
              return <p className="text-[11px] text-emerald-600 font-semibold mt-1.5">🎉 ¡Meta cumplida!</p>
            }
            return (
              <p className="text-[11px] text-gray-500 mt-1.5">
                A este ritmo llegan en <span className="font-semibold text-primary">{proy.meses} mes{proy.meses !== 1 ? 'es' : ''}</span>
                {' '}(<span className="capitalize">{monthLabel(proy.mes).replace(' de ', ' ')}</span>)
              </p>
            )
          })()}
        </div>
      )}

      {/* Snapshot status + button */}
      {onUpdateSnapshot && isActivo && (
        <div className="mt-2.5 pt-2.5 border-t border-hairline flex items-center justify-between">
          <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${currentSnap ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {currentSnap
              ? <>Actualizado este mes</>
              : lastSnap
                ? <>Último: <span className="capitalize">{monthLabel(lastSnap.month).replace(' de ', ' ')}</span></>
                : <>Sin snapshots</>
            }
          </span>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={(e) => { e.stopPropagation(); onUpdateSnapshot() }}
            className={`flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-semibold transition-colors ${
              currentSnap
                ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15'
                : 'bg-primary/10 text-primary hover:bg-primary/15'
            }`}
            title="Actualizar snapshot del mes"
          >
            <RefreshCw size={11} />
            {currentSnap ? 'Editar mes' : 'Actualizar mes'}
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}
