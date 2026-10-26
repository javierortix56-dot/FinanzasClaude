'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Pencil, RefreshCw, Target, Landmark, Wallet } from 'lucide-react'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import ProgressBar from '@/components/ui/ProgressBar'
import Sparkline from '@/components/ui/Sparkline'
import { MoneyText } from '@/components/MoneyText'
import { AssetModal } from '@/components/modals/AssetModal'
import { SnapshotModal } from '@/components/modals/SnapshotModal'
import { toBase } from '@finanzas/core/lib/currency'
import { proyeccionMeta } from '@finanzas/core/lib/assets'
import { monthLabel } from '@finanzas/core/lib/constants'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Asset, Currency, Settings } from '@finanzas/core/types'
import { PageScroll } from '@/components/shell/PageScroll'
import { stagger } from '@/components/ui/motion'

type Tab = 'activo' | 'pasivo'

export default function CuentasPage() {
  const { assets } = useAssetStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS

  const [tab, setTab] = useState<Tab>('activo')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [snapFor, setSnapFor] = useState<Asset | null>(null)

  const totals = useMemo(() => {
    const usd = (a: Asset) => toBase(a.saldo, a.moneda, 'USD', settings)
    const activos = assets.filter((a) => a.clase === 'activo').sort((a, b) => usd(b) - usd(a))
    const pasivos = assets.filter((a) => a.clase === 'pasivo').sort((a, b) => usd(b) - usd(a))
    const totalActivosUSD = activos.reduce((s, a) => s + usd(a), 0)
    const totalPasivosUSD = pasivos.reduce((s, a) => s + usd(a), 0)
    return {
      activos, pasivos, totalActivosUSD, totalPasivosUSD,
      neto: totalActivosUSD - totalPasivosUSD,
    }
  }, [assets, settings])

  // Composición del patrimonio (barra apilada por cuenta, en USD)
  const composicion = totals.totalActivosUSD > 0
    ? totals.activos.map((a) => ({
        a,
        pct: (toBase(a.saldo, a.moneda, 'USD', settings) / totals.totalActivosUSD) * 100,
      }))
    : []

  const list = tab === 'activo' ? totals.activos : totals.pasivos

  function openNew() { setEditing(null); setOpen(true) }
  function openEdit(a: Asset) { setEditing(a); setOpen(true) }

  return (
    <PageScroll className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="eyebrow">Valores en USD al tipo de cambio actual</div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[20px] bg-brand text-white px-6 py-5 shadow-card-md"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Patrimonio neto</div>
          <div className="mt-2 text-[32px] font-semibold tracking-tight tnum leading-none">
            <MoneyText amount={totals.neto} currency="USD" animated />
          </div>
          {composicion.length > 0 && (
            <>
              <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-white/15">
                {composicion.map(({ a, pct }, i) => (
                  <motion.div
                    key={a.id}
                    title={`${a.nombre} · ${pct.toFixed(0)}%`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22, delay: 0.1 + i * 0.05 }}
                    className="h-full border-r border-white/30 last:border-0"
                    style={{ background: `rgba(255,255,255,${Math.max(0.9 - i * 0.14, 0.3)})` }}
                  />
                ))}
              </div>
              <div className="mt-2 text-[11px] text-white/70 truncate">
                {composicion.slice(0, 3).map(({ a, pct }) => `${a.nombre} ${pct.toFixed(0)}%`).join(' · ')}
              </div>
            </>
          )}
        </motion.div>
        <Card delay={0.05} className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Activos</div>
            <span className="h-9 w-9 rounded-xl bg-income-soft text-income inline-flex items-center justify-center"><Wallet className="h-4.5 w-4.5" /></span>
          </div>
          <div className="mt-2 text-[22px] font-semibold text-income tnum">
            <MoneyText amount={totals.totalActivosUSD} currency="USD" animated />
          </div>
          <div className="text-xs text-muted mt-1">{totals.activos.length} {totals.activos.length === 1 ? 'cuenta' : 'cuentas'}</div>
        </Card>
        <Card delay={0.1} className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Pasivos</div>
            <span className="h-9 w-9 rounded-xl bg-expense-soft text-expense inline-flex items-center justify-center"><Landmark className="h-4.5 w-4.5" /></span>
          </div>
          <div className="mt-2 text-[22px] font-semibold text-expense tnum">
            <MoneyText amount={totals.totalPasivosUSD} currency="USD" animated />
          </div>
          <div className="text-xs text-muted mt-1">{totals.pasivos.length} {totals.pasivos.length === 1 ? 'cuenta' : 'cuentas'}</div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Segmented
          id="cuentas-tab"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'activo', label: <>Activos <span className="opacity-60 tnum">{totals.activos.length}</span></> },
            { value: 'pasivo', label: <>Pasivos <span className="opacity-60 tnum">{totals.pasivos.length}</span></> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 items-start gap-4"
        >
          {list.length === 0 ? (
            <Card className="md:col-span-2 2xl:col-span-3 py-14 text-center text-sm text-muted">
              No hay {tab === 'activo' ? 'activos' : 'pasivos'} cargados.
            </Card>
          ) : list.map((a, i) => (
            <AccountCard
              key={a.id}
              asset={a}
              index={i}
              settings={settings}
              onEdit={() => openEdit(a)}
              onSnapshot={() => setSnapFor(a)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      <AssetModal open={open} onClose={() => setOpen(false)} editing={editing} />
      <SnapshotModal asset={snapFor} onClose={() => setSnapFor(null)} />
    </PageScroll>
  )
}

function AccountCard({ asset: a, index, settings, onEdit, onSnapshot }: {
  asset: Asset
  index: number
  settings: Settings
  onEdit: () => void
  onSnapshot: () => void
}) {
  const activo = a.clase === 'activo'
  const usd = toBase(a.saldo, a.moneda, 'USD', settings)
  const snaps = (a.snapshots ?? []).slice(-8)
  const serie = snaps.map((s) => s.saldo)
  const ultimo = snaps[snaps.length - 1]
  const anterior = snaps[snaps.length - 2]
  const reval = ultimo && anterior ? ultimo.saldo - anterior.saldo - ultimo.aporte : null

  const metaUSD = a.metaObjetivo && a.metaMoneda
    ? toBase(a.metaObjetivo, a.metaMoneda as Currency, 'USD', settings)
    : 0
  const metaPct = metaUSD > 0 ? (usd / metaUSD) * 100 : 0
  const proy = activo ? proyeccionMeta(a, settings) : null

  return (
    <Card delay={stagger(index, 0.04)} className="group px-5 py-4 flex flex-col gap-3 hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-foreground">{a.nombre}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{a.tipo}</span>
            <span>{a.moneda}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {activo && (
            <button
              onClick={onSnapshot}
              title="Actualizar saldo del mes"
              aria-label={`Actualizar saldo de ${a.nombre}`}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Editar"
            aria-label={`Editar ${a.nombre}`}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[22px] font-semibold tnum leading-tight ${activo ? 'text-foreground' : 'text-expense'}`}>
            <MoneyText amount={a.saldo} currency={a.moneda} />
          </div>
          {a.moneda !== 'USD' && (
            <div className="text-xs text-muted tnum mt-0.5">≈ <MoneyText amount={usd} currency="USD" /></div>
          )}
        </div>
        {serie.length >= 2 && (
          <Sparkline values={serie} width={96} height={32} color={activo ? 'var(--income)' : 'var(--expense)'} />
        )}
      </div>

      {(reval !== null || ultimo) && (
        <div className="flex items-center justify-between text-[11.5px] text-muted border-t border-hairline pt-2.5">
          <span>{ultimo ? `Último registro: ${monthLabel(ultimo.month)}` : ''}</span>
          {reval !== null && (
            <span className={`font-semibold tnum ${reval >= 0 ? 'text-income' : 'text-expense'}`}>
              {reval >= 0 ? '+' : ''}<MoneyText amount={reval} currency={a.moneda} /> reval.
            </span>
          )}
        </div>
      )}

      {activo && a.metaObjetivo ? (
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Target className="h-3.5 w-3.5 text-primary" />
              Meta <MoneyText amount={a.metaObjetivo} currency={a.metaMoneda ?? 'USD'} />
            </span>
            <span className={`font-semibold tnum ${metaPct >= 100 ? 'text-income' : 'text-foreground'}`}>{Math.min(metaPct, 999).toFixed(0)}%</span>
          </div>
          <ProgressBar
            value={metaPct}
            className="mt-2"
            color={metaPct >= 100 ? 'var(--income)' : 'linear-gradient(90deg, var(--primary-2), var(--primary))'}
          />
          {proy && (
            <div className="mt-1.5 text-[11px] text-muted-2">
              {proy.meses === 0 ? '¡Meta cumplida!' : `A este ritmo se alcanza en ${monthLabel(proy.mes)} (${proy.meses} ${proy.meses === 1 ? 'mes' : 'meses'})`}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}
