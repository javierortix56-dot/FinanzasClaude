'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, FileText, CreditCard, ChevronDown, Check } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { subscribeToCuotas, cuotaEnMes, cuotasRestantes, compromisoPorMes } from '@finanzas/core/lib/cuotas'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { formatAmount, monthLabel } from '@finanzas/core/lib/constants'
import { toBase } from '@finanzas/core/lib/currency'
import { CompraCuotas, Currency } from '@finanzas/core/types'
import CuotaModal from './CuotaModal'
import ImportExtractoModal from './ImportExtractoModal'
import { Money } from '@/components/ui/AnimatedNumber'
import ProgressBar from '@/components/ui/ProgressBar'
import Collapse from '@/components/ui/Collapse'
import Card from '@/components/ui/Card'
import { spring, stagger } from '@/components/ui/motion'

const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function CuotasTab() {
  const { settings, hideAmounts } = useSettingsStore()
  const { monedaBase } = useAuthStore()
  const { currentMonth } = useTransactionStore()
  const { showToast } = useUIStore()
  const s    = settings ?? DEFAULT_SETTINGS
  const base = monedaBase as Currency

  const [compras, setCompras] = useState<CompraCuotas[] | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CompraCuotas | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [verFinalizadas, setVerFinalizadas] = useState(false)

  useEffect(() => {
    const unsub = subscribeToCuotas(setCompras)
    return () => unsub()
  }, [])

  const lista = useMemo(() => compras ?? [], [compras])
  const activas     = useMemo(() => lista.filter((c) => cuotasRestantes(c, currentMonth) > 0), [lista, currentMonth])
  const finalizadas = useMemo(() => lista.filter((c) => cuotasRestantes(c, currentMonth) === 0), [lista, currentMonth])

  // Total de cuotas que vencen en el mes visible, en moneda base
  const totalMesBase = useMemo(
    () => activas.reduce((sum, c) => sum + (cuotaEnMes(c, currentMonth) !== null ? toBase(c.montoCuota, c.moneda, base, s) : 0), 0),
    [activas, currentMonth, base, s],
  )

  // Deuda restante total (todas las cuotas que faltan)
  const deudaRestanteBase = useMemo(
    () => activas.reduce((sum, c) => sum + cuotasRestantes(c, currentMonth) * toBase(c.montoCuota, c.moneda, base, s), 0),
    [activas, currentMonth, base, s],
  )

  // Proyección de compromiso para los próximos 6 meses
  const proyeccion = useMemo(() => {
    return compromisoPorMes(lista, currentMonth, 6).map(({ mes, porMoneda }) => ({
      mes,
      total: Object.entries(porMoneda).reduce(
        (sum, [mon, monto]) => sum + toBase(monto, mon as Currency, base, s), 0),
    }))
  }, [lista, currentMonth, base, s])
  const maxProy = Math.max(...proyeccion.map((p) => p.total), 1)

  // Activas agrupadas por tarjeta (como llega el resumen del banco), con el
  // total de cuotas que vencen este mes en cada una
  const porTarjeta = useMemo(() => {
    const map = new Map<string, CompraCuotas[]>()
    for (const c of activas) {
      const k = c.tarjeta.trim() || 'Sin tarjeta'
      map.set(k, [...(map.get(k) ?? []), c])
    }
    return [...map.entries()]
      .map(([tarjeta, items]) => ({
        tarjeta,
        items,
        totalMes: items.reduce((sum, c) => sum + (cuotaEnMes(c, currentMonth) !== null ? toBase(c.montoCuota, c.moneda, base, s) : 0), 0),
      }))
      .sort((a, b) => b.totalMes - a.totalMes)
  }, [activas, currentMonth, base, s])

  function abrirNueva()               { setEditing(null); setEditorOpen(true) }
  function abrirEdicion(c: CompraCuotas) { setEditing(c); setEditorOpen(true) }

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-1 pb-28 space-y-3 no-scrollbar">

      {/* ── Acciones ── */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={abrirNueva}
          className="h-11 flex items-center justify-center gap-1.5 rounded-2xl bg-brand text-white text-xs font-bold shadow-soft"
        >
          <Plus size={15} /> Agregar
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setImportOpen(true)}
          className="h-11 flex items-center justify-center gap-1.5 rounded-2xl glass text-primary text-xs font-bold"
        >
          <FileText size={15} /> Importar extracto
        </motion.button>
      </div>

      {/* ── Resumen del mes ── */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="!p-3.5">
          <p className="eyebrow mb-1.5">
            Cuotas de {monthLabel(currentMonth).split(' ')[0]}
          </p>
          <p className="text-[17px] font-bold text-gray-900 truncate">
            <Money value={totalMesBase} currency={base} />
          </p>
        </Card>
        <Card className="!p-3.5" delay={0.04}>
          <p className="eyebrow mb-1.5">Deuda restante</p>
          <p className="text-[17px] font-bold text-gray-900 truncate">
            <Money value={deudaRestanteBase} currency={base} />
          </p>
        </Card>
      </div>

      {/* ── Proyección próximos 6 meses ── */}
      {activas.length > 0 && (
        <Card title="Compromiso próximos meses" delay={0.08}>
          <div className="flex items-end gap-1.5 h-28 px-1">
            {proyeccion.map(({ mes, total }, i) => {
              const [, m] = mes.split('-')
              const esActual = mes === currentMonth
              return (
                <div key={mes} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <p className={`text-[10px] font-semibold tabular-nums leading-none ${hideAmounts ? 'blur-sm' : ''} ${esActual ? 'text-primary' : 'text-gray-400'}`}>
                    {total >= 1000 ? `${Math.round(total / 1000)}k` : Math.round(total)}
                  </p>
                  <div className="w-full flex items-end" style={{ height: 64 }}>
                    <motion.div
                      className={`w-full rounded-[8px] origin-bottom ${esActual ? 'bg-brand' : 'bg-primary/20'}`}
                      style={{ height: `${Math.max((total / maxProy) * 100, total > 0 ? 6 : 2)}%` }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.1 + i * 0.05 }}
                    />
                  </div>
                  <p className={`text-[10px] leading-none ${esActual ? 'text-primary font-bold' : 'text-gray-400'}`}>
                    {MONTH_ABBR[parseInt(m, 10) - 1]}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Lista de compras activas ── */}
      <p className="eyebrow pt-1 px-1">
        Compras activas {activas.length > 0 && <span className="opacity-60">· {activas.length}</span>}
      </p>

      {compras === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[76px] rounded-[22px]" />)}
        </div>
      ) : activas.length === 0 ? (
        <Card className="flex flex-col items-center !py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2.5">
            <CreditCard size={20} className="text-primary" />
          </div>
          <p className="text-sm font-semibold text-gray-500">Sin compras en cuotas activas</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Agregá una a mano o importá tu extracto</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {porTarjeta.map(({ tarjeta, items, totalMes }, gi) => (
            <div key={tarjeta}>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <CreditCard size={13} />
                </span>
                <p className="text-[13px] font-semibold text-gray-800 flex-1 truncate">
                  {tarjeta} <span className="text-gray-400 font-normal">· {items.length}</span>
                </p>
                <span className={`text-xs font-bold text-gray-900 tabular-nums ${hideAmounts ? 'blur-sm' : ''}`}>
                  {formatAmount(totalMes, base)}<span className="text-gray-400 font-normal text-[10px]"> este mes</span>
                </span>
              </div>
              <div className="space-y-2">
                {items.map((c, i) => {
                  const actual   = cuotaEnMes(c, currentMonth)
                  const restantes = cuotasRestantes(c, currentMonth)
                  const pagadas  = c.totalCuotas - restantes
                  const pct      = (pagadas / c.totalCuotas) * 100
                  const restanteBase = restantes * toBase(c.montoCuota, c.moneda, base, s)
                  return (
                    <motion.button
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: stagger(gi * 3 + i, 0.04), ease: [0.22, 1, 0.36, 1] }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => abrirEdicion(c)}
                      className="w-full text-left glass rounded-[22px] px-3.5 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center flex-shrink-0">
                          <CreditCard size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold text-gray-900 truncate flex-1 min-w-0">{c.descripcion}</p>
                            <span className={`text-[13px] font-bold tabular-nums flex-shrink-0 ${hideAmounts ? 'blur-sm' : ''} text-gray-900`}>
                              {formatAmount(c.montoCuota, c.moneda)}<span className="text-gray-400 font-normal text-[10px]">/mes</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold text-primary">
                              {actual !== null ? `${actual}/${c.totalCuotas}` : `arranca en ${monthLabel(c.primerMes)}`}
                            </span>
                            <span className={`text-[10px] text-gray-400 ml-auto tabular-nums ${hideAmounts ? 'blur-sm' : ''}`}>
                              faltan {formatAmount(restanteBase, base)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ProgressBar
                        value={pct}
                        color="linear-gradient(90deg, var(--primary-2), var(--primary))"
                        trackClassName="bg-primary/10"
                        height={5}
                        className="mt-2.5"
                      />
                    </motion.button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Finalizadas ── */}
      {finalizadas.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setVerFinalizadas((v) => !v)}
            className="eyebrow flex items-center gap-1 px-1 h-7"
            aria-expanded={verFinalizadas}
          >
            Finalizadas · {finalizadas.length}
            <motion.span animate={{ rotate: verFinalizadas ? 0 : -90 }} transition={spring} className="inline-flex">
              <ChevronDown size={13} />
            </motion.span>
          </button>
          <Collapse open={verFinalizadas}>
            <div className="space-y-1.5 mt-1.5">
              {finalizadas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirEdicion(c)}
                    className="w-full text-left bg-gray-500/[0.06] rounded-2xl px-3.5 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-400 truncate line-through">{c.descripcion}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 flex-shrink-0">
                        <Check size={11} strokeWidth={3} /> {c.totalCuotas} cuotas
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </Collapse>
        </div>
      )}

      <CuotaModal
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
      />
      <ImportExtractoModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(n) => showToast(`${n} compra${n !== 1 ? 's' : ''} importada${n !== 1 ? 's' : ''}`)}
      />
    </div>
  )
}
