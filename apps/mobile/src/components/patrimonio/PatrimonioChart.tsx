'use client'

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

const COLOR_APORTES = '#534AB7' // violeta
const COLOR_REVAL_POS = '#22c55e' // verde
const COLOR_REVAL_NEG = '#f87171' // rojo

export default function PatrimonioChart({ data, currency }: Props) {
  const hideAmounts = useSettingsStore((s) => s.hideAmounts)
  const blur = hideAmounts ? 'blur-sm select-none' : ''
  if (data.length === 0) return null

  // Para escalar las barras usamos el mayor neto absoluto de la serie
  const maxAbs = Math.max(
    ...data.map((d) => Math.abs(d.aportes) + Math.abs(d.reval)),
    1
  )
  const BAR_H = 64

  const last = data[data.length - 1]

  return (
    <div className="px-4 pt-2 pb-2">
      {/* Título + leyenda en una sola fila */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Evolución del neto ({currency})
        </p>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: COLOR_APORTES }} />
            <span className="text-gray-400">Aportes</span>
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-sm inline-block" style={{ backgroundColor: COLOR_REVAL_POS }} />
            <span className="text-gray-400">Reval.</span>
          </span>
        </div>
      </div>

      {/* Barras apiladas */}
      <div className="flex items-end gap-1 justify-around" style={{ height: `${BAR_H + 24}px` }}>
        {data.map((d) => {
          const aportH = Math.round((Math.abs(d.aportes) / maxAbs) * BAR_H)
          const revalH = Math.round((Math.abs(d.reval)   / maxAbs) * BAR_H)
          const revalColor = d.reval >= 0 ? COLOR_REVAL_POS : COLOR_REVAL_NEG
          const opacity = d.current ? 1 : 0.5

          return (
            <div key={d.label} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <div className="w-full flex justify-center items-end" style={{ height: `${BAR_H}px` }}>
                <div className="w-5 rounded-t overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(3, aportH + revalH)}px` }}>
                  {aportH > 0 && (
                    <div style={{ height: `${aportH}px`, backgroundColor: COLOR_APORTES, opacity }} />
                  )}
                  {revalH > 0 && (
                    <div style={{ height: `${revalH}px`, backgroundColor: revalColor, opacity }} />
                  )}
                </div>
              </div>
              <p className={`text-[9px] font-semibold tabular-nums ${d.neto >= 0 ? 'text-[#534AB7]' : 'text-red-400'} ${blur}`}>
                {fmt(d.neto)}
              </p>
              <p className={`text-[9px] ${d.current ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {d.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Resumen delta del último mes */}
      {data.length > 1 && (last.deltaAportes !== 0 || last.deltaReval !== 0) && (
        <div className="mt-1.5 flex items-center justify-around text-[9px] bg-gray-50 rounded-lg py-1.5 px-3">
          <div className="text-center">
            <p className="text-gray-400">Aportes este mes</p>
            <p className={`font-bold tabular-nums ${blur}`} style={{ color: COLOR_APORTES }}>
              {last.deltaAportes >= 0 ? '+' : ''}{fmt(last.deltaAportes)}
            </p>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="text-center">
            <p className="text-gray-400">Revalorización</p>
            <p className={`font-bold tabular-nums ${blur}`} style={{ color: last.deltaReval >= 0 ? COLOR_REVAL_POS : COLOR_REVAL_NEG }}>
              {last.deltaReval >= 0 ? '+' : ''}{fmt(last.deltaReval)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
