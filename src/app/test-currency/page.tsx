'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestCurrencyPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function run() {
      const { data } = await supabase
        .from('movimientos')
        .select('*')
        .is('deleted_at', null)
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-31')
        .order('date', { ascending: false })
        .limit(15)
      setRows(data ?? [])
      setLoading(false)
    }
    run()
  }, [])

  if (loading) return <div className="p-8">Cargando...</div>

  // Get all unique column names
  const cols = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="p-4 font-mono text-xs space-y-6 overflow-x-auto">
      <h1 className="text-lg font-bold">Esquema completo — movimientos (marzo, no eliminados)</h1>
      <p className="text-gray-500">Columnas detectadas: {cols.join(', ')}</p>

      <table className="border-collapse text-xs">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="border border-gray-300 p-1 bg-gray-100 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {cols.map((c) => {
                const val = row[c]
                const display = val === null ? <span className="text-gray-400">null</span>
                  : typeof val === 'object' ? <span className="text-blue-600">{JSON.stringify(val).slice(0, 40)}</span>
                  : String(val).slice(0, 30)
                return <td key={c} className="border border-gray-200 p-1 whitespace-nowrap max-w-[200px] overflow-hidden">{display}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section>
        <h2 className="font-bold text-base mb-2">Comparación amount vs orig_amt (COP y USD)</h2>
        {rows
          .filter((r) => r.currency !== 'ARS')
          .map((r, i) => (
            <div key={i} className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2">
              <p><strong>{r.currency as string}</strong> | fecha: {r.date as string} | categoría: {r.category as string}</p>
              <p>amount = <strong>{String(r.amount)}</strong></p>
              <p>orig_amt = <strong>{String(r.orig_amt)}</strong></p>
              <p className="text-gray-500 text-xs mt-1">type: {r.type as string}</p>
            </div>
          ))}
      </section>
    </div>
  )
}
