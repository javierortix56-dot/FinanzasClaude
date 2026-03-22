'use client'

interface DataPoint {
  label: string
  activos: number
  pasivos: number
}

interface Props {
  data: DataPoint[]
  currency: string
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return n.toFixed(0)
}

export default function PatrimonioChart({ data, currency }: Props) {
  if (data.length === 0) return null

  const maxVal = Math.max(...data.flatMap((d) => [d.activos, d.pasivos]), 1)
  const BAR_H  = 100 // max bar height in px

  return (
    <div className="px-4 pt-2 pb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Evolución ({currency})
      </p>
      <div className="flex items-end gap-2 justify-around">
        {data.map((d, i) => {
          const activosH = Math.round((d.activos / maxVal) * BAR_H)
          const pasivosH = Math.round((d.pasivos / maxVal) * BAR_H)
          const neto     = d.activos - d.pasivos
          const isLast   = i === data.length - 1

          return (
            <div key={d.label} className="flex flex-col items-center gap-1 flex-1">
              {/* Bars side by side */}
              <div
                className="flex items-end gap-0.5 w-full justify-center"
                style={{ height: `${BAR_H + 4}px` }}
              >
                {/* Activos bar */}
                <div
                  className={`w-4 rounded-t-sm transition-all ${isLast ? 'bg-green-500' : 'bg-green-300'}`}
                  style={{ height: `${activosH}px` }}
                  title={`Activos: ${currency} ${fmt(d.activos)}`}
                />
                {/* Pasivos bar */}
                <div
                  className={`w-4 rounded-t-sm transition-all ${isLast ? 'bg-red-400' : 'bg-red-200'}`}
                  style={{ height: `${pasivosH}px` }}
                  title={`Pasivos: ${currency} ${fmt(d.pasivos)}`}
                />
              </div>
              {/* Neto label */}
              <p className={`text-[10px] font-semibold ${neto >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {neto >= 0 ? '+' : ''}{fmt(neto)}
              </p>
              {/* Month label */}
              <p className={`text-[10px] ${isLast ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                {d.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-[10px] text-gray-500">Activos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
          <span className="text-[10px] text-gray-500">Pasivos</span>
        </div>
      </div>
    </div>
  )
}
