'use client'

import {
  Landmark, Banknote, TrendingUp, PiggyBank, Bitcoin,
  CreditCard, HandCoins, AlertCircle, RefreshCw,
} from 'lucide-react'
import { Asset, Settings, Currency } from '@/types'
import { toUSD } from '@/lib/currency'
import { formatAmount, getCurrentMonth, monthLabel } from '@/lib/constants'

const TIPO_ICONS: Record<string, React.ReactNode> = {
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
  const iconBg = isActivo ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'

  // Estado del snapshot del mes actual
  const currentMonth = getCurrentMonth()
  const currentSnap = asset.snapshots?.find((s) => s.month === currentMonth)
  const lastSnap = asset.snapshots?.length
    ? asset.snapshots[asset.snapshots.length - 1]
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left cursor-pointer"
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate pr-2">{asset.nombre}</p>
          <p className={`text-sm font-bold flex-shrink-0 ${isActivo ? 'text-gray-900' : 'text-red-400'}`}>
            {isActivo ? '' : '-'}{formatAmount(asset.saldo, asset.moneda)}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 capitalize">{asset.tipo}</span>
          <span className="text-xs text-gray-400">≈ {formatAmount(usdValue, 'USD')}</span>
        </div>

        {/* Meta progress */}
        {asset.metaObjetivo != null && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Meta: {metaLabel}</span>
              <span className="font-medium text-[#534AB7]">{Math.round(metaPercent)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#534AB7] rounded-full transition-all"
                style={{ width: `${metaPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Snapshot status + button */}
        {onUpdateSnapshot && isActivo && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {currentSnap
                ? <>Actualizado este mes</>
                : lastSnap
                  ? <>Último: <span className="capitalize">{monthLabel(lastSnap.month)}</span></>
                  : <>Sin snapshots</>
              }
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateSnapshot() }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                currentSnap
                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                  : 'bg-[#534AB7]/10 text-[#534AB7] hover:bg-[#534AB7]/20'
              }`}
              title="Actualizar snapshot del mes"
            >
              <RefreshCw size={9} />
              {currentSnap ? 'Editar mes' : 'Actualizar mes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
