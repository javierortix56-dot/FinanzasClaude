'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabase() {
  const [total, setTotal] = useState('...')
  const [march, setMarch] = useState('...')
  const [april, setApril] = useState('...')
  const [marchFilter, setMarchFilter] = useState('...')

  useEffect(() => {
    async function run() {
      // Total sin filtro
      const r0 = await supabase.from('movimientos').select('id', { count: 'exact' })
      setTotal(r0.error ? `❌ ${r0.error.message}` : `Total en DB: ${r0.count} filas`)

      // Marzo con gte/lte (método original)
      const r1 = await supabase
        .from('movimientos').select('id,date')
        .gte('date', '2026-03-01').lte('date', '2026-03-31')
      setMarch(r1.error
        ? `❌ ${r1.error.message}`
        : `Marzo con gte/lte: ${r1.data?.length} filas — fechas: ${r1.data?.slice(0,3).map(r=>r.date).join(', ')}`)

      // Marzo con filter (método alternativo)
      const r2 = await supabase
        .from('movimientos').select('id,date')
        .filter('date', 'gte', '2026-03-01').filter('date', 'lte', '2026-03-31')
      setMarchFilter(r2.error
        ? `❌ ${r2.error.message}`
        : `Marzo con filter(): ${r2.data?.length} filas — fechas: ${r2.data?.slice(0,3).map(r=>r.date).join(', ')}`)

      // Abril
      const r3 = await supabase
        .from('movimientos').select('id,date')
        .gte('date', '2026-04-01').lte('date', '2026-04-30')
      setApril(r3.error
        ? `❌ ${r3.error.message}`
        : `Abril con gte/lte: ${r3.data?.length} filas — fechas: ${r3.data?.slice(0,3).map(r=>r.date).join(', ')}`)
    }
    run()
  }, [])

  return (
    <div className="p-6 font-mono text-sm space-y-3">
      <h1 className="text-xl font-bold">Diagnóstico fechas</h1>
      <p>{total}</p>
      <p>{march}</p>
      <p>{marchFilter}</p>
      <p>{april}</p>
    </div>
  )
}
