'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestCurrencyPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [march, setMarch] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function run() {
      // Fetch config
      const { data: configData } = await supabase
        .from('configuracion')
        .select('*')
        .maybeSingle()
      setConfig(configData)

      // Fetch March transactions (not deleted)
      const { data: txData } = await supabase
        .from('movimientos')
        .select('id,date,amount,currency,type,category')
        .is('deleted_at', null)
        .gte('date', '2026-03-01')
        .lte('date', '2026-03-31')
        .eq('type', 'inc')
        .order('amount', { ascending: false })
      setMarch(txData ?? [])
      setLoading(false)
    }
    run()
  }, [])

  if (loading) return <div className="p-8">Cargando...</div>

  const tipoCambio = (config?.app_settings as Record<string, unknown> | null)?.tipoCambio as Record<string, number> | null
  const arsUsd = tipoCambio?.ARS_USD ?? 1200
  const copUsd = tipoCambio?.COP_USD ?? 4100

  // Group by currency
  const byCurrency: Record<string, { count: number; total: number }> = {}
  let totalARS = 0
  for (const tx of march) {
    const cur = tx.currency as string
    const amt = tx.amount as number
    byCurrency[cur] = byCurrency[cur] ?? { count: 0, total: 0 }
    byCurrency[cur].count++
    byCurrency[cur].total += amt
    // convert to ARS
    let inARS = 0
    if (cur === 'ARS') inARS = amt
    else if (cur === 'USD') inARS = amt * arsUsd
    else if (cur === 'COP') inARS = (amt / copUsd) * arsUsd
    totalARS += inARS
  }

  return (
    <div className="p-8 font-mono text-sm space-y-6">
      <h1 className="text-xl font-bold">Diagnóstico de moneda</h1>

      <section>
        <h2 className="font-bold text-base mb-2">tipoCambio en DB</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(tipoCambio ?? 'no encontrado', null, 2)}
        </pre>
        <p className="mt-2">ARS_USD usado: {arsUsd} | COP_USD usado: {copUsd}</p>
        <p className="text-xs text-gray-500 mt-1">app_settings raw: {JSON.stringify(config?.app_settings)}</p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Ingresos de Marzo — por moneda</h2>
        {Object.entries(byCurrency).map(([cur, v]) => (
          <div key={cur} className="bg-gray-50 p-3 rounded mb-2">
            <p><strong>{cur}</strong>: {v.count} transacciones, total bruto = {v.total.toLocaleString()}</p>
            {cur === 'ARS' && <p className="text-green-700">→ en ARS: {v.total.toLocaleString()}</p>}
            {cur === 'USD' && <p className="text-blue-700">→ en ARS: {(v.total * arsUsd).toLocaleString()} ({v.total} × {arsUsd})</p>}
            {cur === 'COP' && <p className="text-purple-700">→ en ARS: {((v.total / copUsd) * arsUsd).toLocaleString()} ({v.total} ÷ {copUsd} × {arsUsd})</p>}
          </div>
        ))}
        <p className="font-bold mt-2">Total convertido a ARS: {totalARS.toLocaleString()}</p>
      </section>

      <section>
        <h2 className="font-bold text-base mb-2">Top 10 ingresos de Marzo (bruto)</h2>
        <table className="text-xs border-collapse">
          <thead><tr><th className="border p-1">fecha</th><th className="border p-1">monto</th><th className="border p-1">moneda</th><th className="border p-1">categoría</th></tr></thead>
          <tbody>
            {march.slice(0, 10).map((tx) => (
              <tr key={tx.id as string}>
                <td className="border p-1">{tx.date as string}</td>
                <td className="border p-1 text-right">{(tx.amount as number).toLocaleString()}</td>
                <td className="border p-1">{tx.currency as string}</td>
                <td className="border p-1">{tx.category as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
