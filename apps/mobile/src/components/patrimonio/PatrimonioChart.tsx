'use client'

import { motion } from 'motion/react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'

interface DataPoint {
  label: string
  /** Saldo total (neto) USD a fin del mes */
  neto: number
  /** Aportes acumulados (init_bal + suma de aportes hasta este mes) en USD */
  aportes: number
  /** Revalorización acumulada en USD = neto - aportes */
  reval: number
  /** Variación de aportes vs mes anterior (USD) */
  deltaAportes: number
  /** Variación por revalorización vs mes anterior (USD) */
  deltaReval: number
  /** true si es el mes actual */
  current?: boolean
}

interface Props {
  data: DataPoint[]
  currency: string
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}k`
  return `${sign}${abs.toFixed(0)}`
}

const COLOR_APORTES = 'var(--primary)' // violeta
const COLOR_REVAL_POS = '#10b981' // verde
const COLOR_REVAL_NEG = '#f43f5e' // rojo

export default function PatrimonioChart({ data, currency }: Props) {
  const hideAmounts = useSettingsStore((st) => st.hideAmounts)
  if (data.length === 0) return null
  const blur = hideAmounts ? 'blur-[4px] select-none' : ''

  // Para escalar las barras usamos el mayor neto absoluto de la serie
  const maxAbs = Math.max(
    ...data.map((d) => Math.abs(d.aportes) + Math.abs(d.reval)),
    1
  )
  const BAR_H = 64

  const last = data[data.length - 1]

  return (
    <div className="px-4 pt-3.5 pb-3">
      {/* Título + leyenda en una sola fila */}
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Evolución del neto · {currency}</p>
        <div className="flex items-center gap-2.5 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-[3px] inline-block" style={{ backgroundColor: COLOR_APORTES }} />
            <span className="text-gray-400">Aportes</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-[3px] inline-block" style={{ backgroundColor: COLOR_REVAL_POS }} />
            <span className="text-gray-400">Reval.</span>
          </span>
        </div>
      </div>

      {/* Barras apiladas */}
      <div className="flex items-end gap-1 justify-around" style={{ height: `${BAR_H + 28}px` }}>
        {data.map((d, i) => {
          const aportH = Math.round((Math.abs(d.aportes) / maxAbs) * BAR_H)
          const revalH = Math.round((Math.abs(d.reval)   / maxAbs) * BAR_H)
          const revalColor = d.reval >= 0 ? COLOR_REVAL_POS : COLOR_REVAL_NEG
          const opacity = d.current ? 1 : 0.45

          return (
            <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="w-full flex justify-center items-end" style={{ height: `${BAR_H}px` }}>
                <motion.div
                  className="w-6 rounded-[7px] overflow-hidden flex flex-col-reverse origin-bottom"
                  style={{ height: `${Math.max(3, aportH + revalH)}px` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.05 }}
                >
                  {aportH > 0 && (
                    <div style={{ height: `${aportH}px`, backgroundColor: COLOR_APORTES, opacity }} />
                  )}
                  {revalH > 0 && (
                    <div style={{ height: `${revalH}px`, backgroundColor: revalColor, opacity }} />
                  )}
                </motion.div>
              </div>
              <p className={`text-[10px] font-semibold tabular-nums ${d.neto >= 0 ? 'text-primary' : 'text-rose-500'} ${blur}`}>
                {fmt(d.neto)}
              </p>
              <p className={`text-[10px] leading-none ${d.current ? 'text-gray-800 font-bold' : 'text-gray-400'}`}>
                {d.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Resumen delta del último mes */}
      {data.length > 1 && (last.deltaAportes !== 0 || last.deltaReval !== 0) && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-gray-500/[0.06] px-3 py-2">
            <p className="text-gray-400">Aportes este mes</p>
            <p className={`text-xs font-bold tabular-nums mt-0.5 ${blur}`} style={{ color: COLOR_APORTES }}>
              {last.deltaAportes >= 0 ? '+' : ''}{fmt(last.deltaAportes)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-500/[0.06] px-3 py-2">
            <p className="text-gray-400">Revalorización</p>
            <p className={`text-xs font-bold tabular-nums mt-0.5 ${blur}`} style={{ color: last.deltaReval >= 0 ? COLOR_REVAL_POS : COLOR_REVAL_NEG }}>
              {last.deltaReval >= 0 ? '+' : ''}{fmt(last.deltaReval)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
