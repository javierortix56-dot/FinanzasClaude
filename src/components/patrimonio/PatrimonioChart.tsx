'use client'

interface DataPoint {
  label: string
  neto: number
  /** true si el valor es estimado (a partir de flujos de caja) en lugar de real */
  estimated?: boolean
  /** true si es el mes actual (valor real) */
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

export default function PatrimonioChart({ data, currency }: Props) {
  if (data.length === 0) return null

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.neto)), 1)
  const BAR_H  = 100 // max bar height in px

  return (
    <div className="px-4 pt-2 pb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Evolución del neto ({currency})
        </p>
        {data.some((d) => d.estimated) && (
          <p className="text-[9px] text-gray-400 italic">* estimado</p>
        )}
      </div>
      <div className="flex items-end gap-2 justify-around" style={{ height: `${BAR_H + 24}px` }}>
        {data.map((d) => {
          const h = Math.max(4, Math.round((Math.abs(d.neto) / maxAbs) * BAR_H))
          const positivo = d.neto >= 0
          const colorClass = d.current
            ? positivo ? 'bg-[#534AB7]' : 'bg-red-500'
            : positivo ? 'bg-[#534AB7]/40' : 'bg-red-300'
          return (
            <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="w-full flex justify-center items-end" style={{ height: `${BAR_H}px` }}>
                <div
                  className={`w-6 rounded-t-md transition-all ${colorClass}`}
                  style={{ height: `${h}px` }}
                  title={`${currency} ${fmt(d.neto)}${d.estimated ? ' (estimado)' : ''}`}
                />
              </div>
              <p className={`text-[10px] font-semibold ${positivo ? 'text-[#534AB7]' : 'text-red-500'}`}>
                {fmt(d.neto)}{d.estimated && <span className="text-gray-400">*</span>}
              </p>
              <p className={`text-[10px] ${d.current ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {d.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
