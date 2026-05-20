'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoneyText, PercentText } from '@/components/MoneyText'
import { AssetModal } from '@/components/modals/AssetModal'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Asset } from '@finanzas/core/types'

type Tab = 'activo' | 'pasivo'

export default function CuentasPage() {
  const { assets } = useAssetStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS

  const [tab, setTab] = useState<Tab>('activo')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)

  const totals = useMemo(() => {
    const activos = assets.filter((a) => a.clase === 'activo')
    const pasivos = assets.filter((a) => a.clase === 'pasivo')
    const totalActivosUSD = activos.reduce((s, a) => s + toBase(a.saldo, a.moneda, 'USD', settings), 0)
    const totalPasivosUSD = pasivos.reduce((s, a) => s + toBase(a.saldo, a.moneda, 'USD', settings), 0)
    return {
      activos, pasivos, totalActivosUSD, totalPasivosUSD,
      neto: totalActivosUSD - totalPasivosUSD,
    }
  }, [assets, settings])

  const list = tab === 'activo' ? totals.activos : totals.pasivos

  function openNew() { setEditing(null); setOpen(true) }
  function openEdit(a: Asset) { setEditing(a); setOpen(true) }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Cuentas y patrimonio</h2>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-muted">Activos totales</div>
            <div className="mt-2 text-2xl font-semibold text-income">
              <MoneyText amount={totals.totalActivosUSD} currency="USD" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-muted">Pasivos totales</div>
            <div className="mt-2 text-2xl font-semibold text-expense">
              <MoneyText amount={totals.totalPasivosUSD} currency="USD" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-muted">Patrimonio neto</div>
            <div className={`mt-2 text-2xl font-semibold ${totals.neto >= 0 ? 'text-foreground' : 'text-expense'}`}>
              <MoneyText amount={totals.neto} currency="USD" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="inline-flex p-1 rounded-md bg-surface-2 border border-border">
            {(['activo', 'pasivo'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 h-8 text-sm font-medium rounded transition-colors capitalize ${
                  tab === t ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                }`}
              >
                {t === 'activo' ? `Activos (${totals.activos.length})` : `Pasivos (${totals.pasivos.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted bg-surface-2/60">
              <tr>
                <th className="px-5 py-2.5 font-medium">Nombre</th>
                <th className="px-5 py-2.5 font-medium">Tipo</th>
                <th className="px-5 py-2.5 font-medium">Moneda</th>
                <th className="px-5 py-2.5 font-medium text-right">Saldo</th>
                <th className="px-5 py-2.5 font-medium text-right">USD</th>
                <th className="px-5 py-2.5 font-medium">Meta</th>
                <th className="px-5 py-2.5 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-muted text-sm">
                    No hay {tab === 'activo' ? 'activos' : 'pasivos'} cargados.
                  </td>
                </tr>
              ) : list.map((a) => {
                const usd = toBase(a.saldo, a.moneda, 'USD', settings)
                const meta = a.metaObjetivo ?? 0
                const metaUSD = a.metaMoneda
                  ? toBase(meta, a.metaMoneda as 'ARS'|'COP'|'USD', 'USD', settings)
                  : 0
                const metaPct = metaUSD > 0 ? Math.min(100, (usd / metaUSD) * 100) : 0
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-5 py-3 font-medium text-foreground">{a.nombre}</td>
                    <td className="px-5 py-3"><Badge tone="neutral">{a.tipo}</Badge></td>
                    <td className="px-5 py-3 text-muted text-xs font-medium">{a.moneda}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <MoneyText amount={a.saldo} currency={a.moneda} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted text-xs">
                      <MoneyText amount={usd} currency="USD" />
                    </td>
                    <td className="px-5 py-3 min-w-[180px]">
                      {a.metaObjetivo ? (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted">
                              <MoneyText amount={meta} currency={a.metaMoneda ?? 'USD'} />
                            </span>
                            <span className="font-semibold"><PercentText value={metaPct} /></span>
                          </div>
                          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${metaPct}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-muted-2">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AssetModal open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  )
}
