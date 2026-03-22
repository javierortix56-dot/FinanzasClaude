'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabase() {
  const [status, setStatus] = useState<string>('Probando conexión...')
  const [rows, setRows] = useState<unknown[]>([])
  const [envUrl, setEnvUrl] = useState<string>('')

  useEffect(() => {
    setEnvUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(no configurada)')

    async function test() {
      try {
        const { data, error, status: httpStatus } = await supabase
          .from('movimientos')
          .select('id, date, amount, currency, type')
          .limit(5)

        if (error) {
          setStatus(`❌ Error ${httpStatus}: ${error.message} (code: ${error.code})`)
        } else {
          setStatus(`✅ Conexión OK — ${data?.length ?? 0} filas recibidas`)
          setRows(data ?? [])
        }
      } catch (e) {
        setStatus(`💥 Excepción: ${String(e)}`)
      }
    }

    test()
  }, [])

  return (
    <div className="p-6 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Diagnóstico Supabase</h1>
      <p className="mb-2"><strong>URL:</strong> {envUrl}</p>
      <p className="mb-4"><strong>Estado:</strong> {status}</p>
      {rows.length > 0 && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  )
}
