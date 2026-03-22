'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MonthSummary {
  month: string
  total: number
  ingresos: number
  egresos: number
  incomeTotal: number
  duplicates: string[]
}

export default function TestSupabase() {
  const [summaries, setSummaries] = useState<MonthSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function run() {
      const months = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']
      const results: MonthSummary[] = []

      for (const month of months) {
        const [y, m] = month.split('-').map(Number)
        const start = `${y}-${String(m).padStart(2,'0')}-01`
        const lastDay = new Date(y, m, 0).getDate()
        const end = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

        const { data } = await supabase
          .from('movimientos').select('id,date,amount,currency,type')
          .gte('date', start).lte('date', end)

        if (!data) continue

        const ingresos = data.filter(r => r.type === 'inc' || r.type === 'ingreso')
        const egresos  = data.filter(r => r.type === 'exp' || r.type === 'egreso')
        const incomeTotal = ingresos.reduce((s, r) => s + (r.amount ?? 0), 0)

        // Detect duplicates: same date+amount+type+currency
        const seen = new Map<string, number>()
        const dups: string[] = []
        for (const r of data) {
          const key = `${r.date}|${r.amount}|${r.type}|${r.currency}`
          seen.set(key, (seen.get(key) ?? 0) + 1)
        }
        seen.forEach((count, key) => {
          if (count > 1) dups.push(`${key} (×${count})`)
        })

        results.push({ month, total: data.length, ingresos: ingresos.length, egresos: egresos.length, incomeTotal, duplicates: dups })
      }

      setSummaries(results)
      setLoading(false)
    }
    run()
  }, [])

  if (loading) return <div className="p-6 font-mono">Cargando...</div>

  return (
    <div className="p-6 font-mono text-sm space-y-4">
      <h1 className="text-xl font-bold">Diagnóstico duplicados</h1>
      {summaries.map(s => (
        <div key={s.month} className="border rounded p-3 space-y-1">
          <p className="font-bold">{s.month} — {s.total} tx ({s.ingresos} ing / {s.egresos} egr)</p>
          <p>Ingreso total: {s.incomeTotal.toLocaleString()}</p>
          {s.duplicates.length > 0
            ? <p className="text-red-600">⚠ Duplicados: {s.duplicates.slice(0,3).join(' | ')}</p>
            : <p className="text-green-600">✅ Sin duplicados exactos</p>
          }
        </div>
      ))}
    </div>
  )
}
