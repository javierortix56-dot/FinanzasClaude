'use client'

import { useEffect, useMemo, useState } from 'react'
import { PiggyBank, TrendingUp, Calendar, Trophy } from 'lucide-react'
import { useAssetStore } from '@/store/useAssetStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { fetchAllAhorroTx } from '@/lib/analytics'
import { toUSD } from '@/lib/currency'
import { formatAmount, monthLabel } from '@/lib/constants'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { Transaction } from '@/types'

export default function AhorroTab() {
  const { assets } = useAssetStore()
  const { settings } = useSettingsStore()
  const s = settings ?? DEFAULT_SETTINGS

  const [txs, setTxs]         = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAllAhorroTx()
      .then((data) => { if (!cancelled) { setTxs(data); setLoading(false) } })
      .catch((err) => {
        console.error('[AhorroTab] fetch error:', err)
        if (!cancelled) { setError(String(err)); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [])

  const ahorroAccounts = useMemo(
    () => assets.filter((a) => a.clase === 'activo' && a.tipo.toLowerCase() === 'ahorro'),
    [assets],
  )

  const accountsById = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, a])),
    [assets],
  )

  // Agrupado por mes (USD para totalizar comparable)
  const byMonth = useMemo(() => {
    const map: Record<string, { totalUsd: number; count: number }> = {}
    for (const t of txs) {
      const d = t.fecha.toDate()
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const usd = toUSD(t.monto, t.moneda, s)
      if (!map[key]) map[key] = { totalUsd: 0, count: 0 }
      map[key].totalUsd += usd
      map[key].count    += 1
    }
    return map
  }, [txs, s])

  const monthsSorted = useMemo(
    () => Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])),
    [byMonth],
  )

  const bestMonth = useMemo(() => {
    if (monthsSorted.length === 0) return null
    return monthsSorted.reduce((best, cur) => cur[1].totalUsd > best[1].totalUsd ? cur : best)
  }, [monthsSorted])

  const totalUsd     = monthsSorted.reduce((s, [, v]) => s + v.totalUsd, 0)
  const avgMonthUsd  = monthsSorted.length > 0 ? totalUsd / monthsSorted.length : 0

  const totalSaldoUsd = ahorroAccounts.reduce((sum, a) => sum + toUSD(a.saldo, a.moneda, s), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 break-all">
          Error al cargar historial: {error}
        </p>
      </div>
    )
  }

  if (ahorroAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#534AB7]/10 flex items-center justify-center mb-3">
          <PiggyBank size={22} className="text-[#534AB7]" />
        </div>
        <p className="text-sm font-semibold text-gray-700">No tenés cuentas de ahorro</p>
        <p className="text-xs text-gray-400 mt-1">
          Creá una cuenta de tipo &quot;Ahorro&quot; para empezar a registrar aportes
        </p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* ── Resumen ── */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-2">
        <div className="bg-[#534AB7]/5 border border-[#534AB7]/15 rounded-xl px-2.5 py-3 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Acumulado</p>
          <p className="text-xs font-bold text-[#534AB7]">{formatAmount(totalSaldoUsd, 'USD')}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl px-2.5 py-3 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Promedio/mes</p>
          <p className="text-xs font-bold text-green-700">{formatAmount(avgMonthUsd, 'USD')}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-3 text-center">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">Aportado</p>
          <p className="text-xs font-bold text-amber-700">{formatAmount(totalUsd, 'USD')}</p>
        </div>
      </div>

      {/* ── Mes destacado ── */}
      {bestMonth && bestMonth[1].totalUsd > 0 && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-[#534AB7]/10 to-[#534AB7]/5 border border-[#534AB7]/20 rounded-xl px-3 py-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <Trophy size={16} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Mes que más ahorraste</p>
            <p className="text-xs font-bold text-gray-800 capitalize truncate">
              {monthLabel(bestMonth[0])}
            </p>
          </div>
          <p className="text-sm font-bold text-[#534AB7] flex-shrink-0">
            {formatAmount(bestMonth[1].totalUsd, 'USD')}
          </p>
        </div>
      )}

      {/* ── Por mes (mini-gráfico de barras) ── */}
      {monthsSorted.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <TrendingUp size={12} /> Por mes
          </h3>
          <div className="space-y-1.5">
            {monthsSorted.map(([month, info]) => {
              const max = Math.max(...monthsSorted.map(([, v]) => v.totalUsd))
              const pct = max > 0 ? (info.totalUsd / max) * 100 : 0
              return (
                <div key={month} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 capitalize w-20 flex-shrink-0">
                    {monthLabel(month)}
                  </span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#534AB7] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 tabular-nums w-16 text-right">
                    {formatAmount(info.totalUsd, 'USD')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      <div className="px-4 mt-5">
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Calendar size={12} /> Historial de aportes
        </h3>
        {txs.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            Sin aportes registrados todavía
          </p>
        ) : (
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
            {txs.map((t) => {
              const acc = t.ahorroAssetId ? accountsById[t.ahorroAssetId] : null
              const dateStr = t.fecha.toDate().toLocaleDateString('es-AR', {
                day: 'numeric', month: 'short', year: '2-digit',
              })
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#534AB7]/10 flex items-center justify-center flex-shrink-0">
                    <PiggyBank size={13} className="text-[#534AB7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {t.descripcion || 'Aporte de ahorro'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {dateStr} {acc ? `· ${acc.nombre}` : '· cuenta eliminada'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-[#534AB7] tabular-nums">
                      {formatAmount(t.monto, t.moneda)}
                    </p>
                    {acc && t.ahorroDelta != null && t.moneda !== acc.moneda && (
                      <p className="text-[9px] text-gray-400 tabular-nums">
                        ≈ {formatAmount(t.ahorroDelta, acc.moneda)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
