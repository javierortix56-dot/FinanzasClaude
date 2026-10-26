'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Search, X } from 'lucide-react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import TAccountView from '@/components/transactions/TAccountView'
import AssignmentTab from '@/components/assignment/AssignmentTab'
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Currency } from '@finanzas/core/types'
import { Money } from '@/components/ui/AnimatedNumber'
import Segmented from '@/components/ui/Segmented'
import { MonthSwitcher, PrivacyToggle } from '@/components/ui/PageHeader'
import { easeOut } from '@/components/ui/motion'

type MainTab = 'movimientos' | 'asignacion'

export default function DashboardPage() {
  const { monedaBase } = useAuthStore()
  const { settings } = useSettingsStore()
  const { transactions, currentMonth, prevMonth, nextMonth } = useTransactionStore()

  const [mainTab, setMainTab] = useState<MainTab>('movimientos')
  const [search, setSearch]   = useState('')

  const s    = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const totalIngresos = transactions
    .filter((t) => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const totalEgresos = transactions
    .filter((t) => t.tipo === 'egreso')
    .reduce((sum, t) => sum + toBase(t.monto, t.moneda, base, s), 0)

  const balance    = totalIngresos - totalEgresos
  const balanceUSD = toBase(balance, base, 'USD', s)
  const pctGastado = totalIngresos > 0 ? Math.min((totalEgresos / totalIngresos) * 100, 100) : 0
  const pctColor   = pctGastado >= 90 ? '#fda4af' : pctGastado >= 70 ? '#fcd34d' : '#6ee7b7'

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar: marca · mes · privacidad ── */}
      <header className="flex items-center gap-2 px-4 pt-[max(2.75rem,env(safe-area-inset-top))] pb-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-[12px] bg-brand shadow-soft flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[11px] tracking-tight">J&amp;M</span>
        </div>
        <div className="flex-1 flex justify-center">
          <MonthSwitcher month={currentMonth} onPrev={prevMonth} onNext={nextMonth} />
        </div>
        <PrivacyToggle />
      </header>

      {/* ── Hero: balance del mes ── */}
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={easeOut}
        className="relative mx-4 mb-3 rounded-[26px] bg-brand text-white px-4 pt-3 pb-3 shadow-lift overflow-hidden flex-shrink-0"
      >
        {/* Brillos decorativos */}
        <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-[#22d3ee]/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Balance del mes</p>
          <p className="text-[10px] font-medium text-white/60 tabular-nums">
            US$1 = ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')} · COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}
          </p>
        </div>

        <div className="relative flex items-baseline gap-2 mt-0.5 min-w-0">
          <p className="text-[30px] leading-tight font-bold tracking-tight truncate">
            <Money value={balance} currency={base} />
          </p>
          <p className="text-[11px] font-medium text-white/70 whitespace-nowrap">
            ≈ <Money value={balanceUSD} currency="USD" />
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-2 mt-2">
          <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 px-2.5 py-2 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-400/25 flex items-center justify-center flex-shrink-0">
              <ArrowUpRight size={15} className="text-emerald-200" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-white/65 leading-none">Ingresos</p>
              <p className="text-[13px] font-semibold truncate mt-0.5"><Money value={totalIngresos} currency={base} /></p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/15 px-2.5 py-2 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-rose-400/25 flex items-center justify-center flex-shrink-0">
              <ArrowDownRight size={15} className="text-rose-200" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-white/65 leading-none">Egresos</p>
              <p className="text-[13px] font-semibold truncate mt-0.5"><Money value={totalEgresos} currency={base} /></p>
            </div>
          </div>
        </div>

        {/* % del ingreso gastado + tipos de cambio */}
        <div className="relative mt-2.5 flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: pctColor }}
              initial={{ width: 0 }}
              animate={{ width: `${pctGastado}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
          <span className="text-[10px] font-semibold text-white/80 tabular-nums whitespace-nowrap">
            {totalIngresos > 0 ? `${Math.round(pctGastado)}% gastado` : 'Sin ingresos'}
          </span>
        </div>
      </motion.section>

      {/* ── Contenedor glass: tabs + contenido ── */}
      <section className="flex-1 min-h-0 glass rounded-t-[28px] border-b-0 overflow-hidden flex flex-col">
        <div className="px-3 pt-3 pb-2 flex-shrink-0 space-y-2">
          <Segmented
            id="dashboard-tab"
            value={mainTab}
            onChange={setMainTab}
            options={[
              { value: 'movimientos', label: 'Movimientos' },
              { value: 'asignacion',  label: 'Asignación'  },
            ]}
          />

          <AnimatePresence initial={false}>
            {mainTab === 'movimientos' && (
              <motion.div
                key="search"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <label className="flex items-center gap-2 h-9 rounded-xl bg-gray-500/[0.07] px-3 focus-within:ring-2 focus-within:ring-primary/25 focus-within:bg-surface transition-all">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    placeholder="Buscar movimientos"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-xs outline-none text-gray-900 placeholder:text-gray-400"
                  />
                  <AnimatePresence>
                    {search && (
                      <motion.button
                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        type="button"
                        onClick={() => setSearch('')}
                        className="w-5 h-5 rounded-full bg-gray-400/30 flex items-center justify-center"
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={11} className="text-gray-600" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mainTab}
            initial={{ opacity: 0, x: mainTab === 'movimientos' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mainTab === 'movimientos' ? 16 : -16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
          >
            {mainTab === 'movimientos'
              ? <TAccountView search={search} />
              : <AssignmentTab />
            }
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  )
}
