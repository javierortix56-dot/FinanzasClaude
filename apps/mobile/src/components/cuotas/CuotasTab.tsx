'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, FileText, CreditCard } from 'lucide-react'
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

  function abrirNueva()               { setEditing(null); setEditorOpen(true) }
  function abrirEdicion(c: CompraCuotas) { setEditing(c); setEditorOpen(true) }

  return (
    <div className="h-full overflow-y-auto px-4 pt-3 pb-8">

      {/* ── Acciones ── */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={abrirNueva}
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-white text-xs font-bold active:scale-[0.98] transition-transform"
        >
          <Plus size={14} /> Agregar
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold active:scale-[0.98] transition-transform"
        >
          <FileText size={14} /> Importar extracto
        </button>
      </div>

      {/* ── Resumen del mes ── */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">
            Cuotas de {monthLabel(currentMonth).split(' ')[0]}
          </p>
          <p className={`text-sm font-bold text-gray-900 tabular-nums ${hideAmounts ? 'blur-sm' : ''}`}>
            {formatAmount(totalMesBase, base)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Deuda restante</p>
          <p className={`text-sm font-bold text-gray-900 tabular-nums ${hideAmounts ? 'blur-sm' : ''}`}>
            {formatAmount(deudaRestanteBase, base)}
          </p>
        </div>
      </div>

      {/* ── Proyección próximos 6 meses ── */}
      {activas.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Compromiso próximos meses
          </p>
          <div className="flex items-end gap-1.5 h-24 px-1">
            {proyeccion.map(({ mes, total }) => {
              const [, m] = mes.split('-')
              const esActual = mes === currentMonth
              return (
                <div key={mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <p className={`text-[10px] font-semibold tabular-nums leading-none ${hideAmounts ? 'blur-sm' : ''} ${esActual ? 'text-primary' : 'text-gray-400'}`}>
                    {total >= 1000 ? `${Math.round(total / 1000)}k` : Math.round(total)}
                  </p>
                  <div className="w-full flex items-end" style={{ height: 56 }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${esActual ? 'bg-primary' : 'bg-primary/25'}`}
                      style={{ height: `${Math.max((total / maxProy) * 100, total > 0 ? 6 : 2)}%` }}
                    />
                  </div>
                  <p className={`text-[10px] leading-none ${esActual ? 'text-primary font-bold' : 'text-gray-400'}`}>
                    {MONTH_ABBR[parseInt(m, 10) - 1]}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lista de compras activas ── */}
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
        Compras activas {activas.length > 0 && <span className="font-normal text-gray-300">({activas.length})</span>}
      </p>

      {compras === null ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : activas.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <CreditCard size={18} className="text-primary/50" />
          </div>
          <p className="text-xs text-gray-400">Sin compras en cuotas activas</p>
          <p className="text-[11px] text-gray-300 mt-0.5">Agregá una a mano o importá tu extracto</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activas.map((c) => {
            const actual   = cuotaEnMes(c, currentMonth)
            const restantes = cuotasRestantes(c, currentMonth)
            const pagadas  = c.totalCuotas - restantes
            const pct      = (pagadas / c.totalCuotas) * 100
            const restanteBase = restantes * toBase(c.montoCuota, c.moneda, base, s)
            return (
              <button
                key={c.id}
                onClick={() => abrirEdicion(c)}
                className="w-full text-left bg-surface rounded-2xl border border-gray-100 shadow-sm px-3.5 py-2.5 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900 truncate flex-1 min-w-0">{c.descripcion}</p>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${hideAmounts ? 'blur-sm' : ''} text-gray-900`}>
                    {formatAmount(c.montoCuota, c.moneda)}<span className="text-gray-400 font-normal text-[10px]">/mes</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.tarjeta && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                      <CreditCard size={10} /> {c.tarjeta}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {actual !== null ? `cuota ${actual} de ${c.totalCuotas}` : `arranca en ${monthLabel(c.primerMes)}`}
                  </span>
                  <span className={`text-[10px] text-gray-400 ml-auto tabular-nums ${hideAmounts ? 'blur-sm' : ''}`}>
                    faltan {formatAmount(restanteBase, base)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Finalizadas ── */}
      {finalizadas.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setVerFinalizadas((v) => !v)}
            className="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
          >
            Finalizadas ({finalizadas.length}) {verFinalizadas ? '▾' : '▸'}
          </button>
          {verFinalizadas && (
            <div className="space-y-1.5 mt-1.5">
              {finalizadas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => abrirEdicion(c)}
                  className="w-full text-left bg-gray-50 rounded-2xl px-3.5 py-2.5 opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-500 truncate line-through">{c.descripcion}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{c.totalCuotas} cuotas ✓</span>
                  </div>
                </button>
              ))}
            </div>
          )}
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
