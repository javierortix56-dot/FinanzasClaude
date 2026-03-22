'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabase() {
  const [basic, setBasic] = useState<string>('...')
  const [withDeleted, setWithDeleted] = useState<string>('...')
  const [withDate, setWithDate] = useState<string>('...')

  useEffect(() => {
    async function run() {
      // Test 1: basic fetch
      const r1 = await supabase.from('movimientos').select('id,date,type').limit(3)
      setBasic(r1.error ? `❌ ${r1.error.message}` : `✅ ${r1.data?.length} filas — tipos: ${[...new Set(r1.data?.map(r => r.type))].join(', ')}`)

      // Test 2: with deleted_at filter
      const r2 = await supabase.from('movimientos').select('id').is('deleted_at', null).limit(3)
      setWithDeleted(r2.error ? `❌ ${r2.error.message}` : `✅ ${r2.data?.length} filas`)

      // Test 3: with March 2026 date range
      const r3 = await supabase.from('movimientos').select('id,date,type,amount').gte('date', '2026-03-01').lte('date', '2026-03-31')
      setWithDate(r3.error ? `❌ ${r3.error.message}` : `✅ ${r3.data?.length} filas en marzo 2026: ${JSON.stringify(r3.data?.slice(0,2))}`)
    }
    run()
  }, [])

  return (
    <div className="p-6 font-mono text-sm space-y-4">
      <h1 className="text-xl font-bold">Diagnóstico</h1>
      <p><strong>1. Fetch básico:</strong><br/>{basic}</p>
      <p><strong>2. Con filtro deleted_at:</strong><br/>{withDeleted}</p>
      <p><strong>3. Marzo 2026:</strong><br/>{withDate}</p>
    </div>
  )
}
