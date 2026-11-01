'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Upload, FileText, Repeat, Bug, Store, CreditCard, Landmark, AlertCircle, Trash2,
  Plus, Sparkles, CheckCircle2, Loader2, Megaphone,
} from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useResumenes } from '@finanzas/core/lib/useResumenes'
import { categoriasDeGasto, usuarioId } from '@finanzas/core/lib/resumenes'
import { GrupoComercio } from '@finanzas/core/lib/comercioReglas'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, monthLabel } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency, Resumen, ResumenItem, Settings, Tarjeta } from '@finanzas/core/types'
import { CompromisoMes, ETIQUETA_CARGO, conciliacion, mesCorto, montoCorto } from '@finanzas/core/lib/resumenAnalisis'
import { toBase } from '@finanzas/core/lib/currency'
import { AnalisisFinanciacion, Comparativa, Variacion } from '@finanzas/core/lib/resumenExtras'
import type { ConciliacionResumen } from '@finanzas/core/lib/useResumenes'
import type { GastoRegistrado } from '@finanzas/core/lib/conciliacion'
import Card from '@/components/ui/Card'
import CuotaModal from '@/components/cuotas/CuotaModal'
import Sheet from '@/components/ui/Sheet'
import ProgressBar from '@/components/ui/ProgressBar'
import { Money } from '@/components/ui/AnimatedNumber'
import { haptic } from '@/lib/haptics'

const ACCEPT = '.pdf,.csv,.txt,.xlsx,application/pdf,text/csv'

/** "octubre de 2026" → "Octubre de 2026" */
const mesLabel = (p: string) => { const l = monthLabel(p); return l.charAt(0).toUpperCase() + l.slice(1) }

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

const pctFmt = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`

/** Pestaña "Resúmenes" de Análisis: subir resúmenes y ver el análisis */
export default function ResumenesTab() {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase, user } = useAuthStore()
  const base = monedaBase as Currency
  const r = useResumenes(s, base, usuarioId(user))
  const inputRef = useRef<HTMLInputElement>(null)
  // Cuota cargada a mano: null = cerrado, 'nueva' = alta
  const [cuotaManual, setCuotaManual] = useState<CompraCuotas | 'nueva' | null>(null)
  const a = r.analisis
  const leyendo = r.subida.paso === 'leyendo'

  function elegir(files: FileList | null) {
    const f = files?.[0]
    if (f) { haptic(); r.subir(f) }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 pt-1 pb-28 space-y-3 no-scrollbar">
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => elegir(e.target.files)} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => inputRef.current?.click()}
        disabled={leyendo}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-70"
      >
        {leyendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {leyendo ? 'Leyendo resumen…' : 'Subir resumen (PDF, Excel o CSV)'}
      </motion.button>

      <AnimatePresence>
        {leyendo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="!p-3.5 flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center shrink-0">
                <Sparkles size={16} className="animate-pulse" />
              </span>
              <p className="text-xs text-gray-500">La IA está leyendo el archivo. Suele tardar entre 20 y 60 segundos.</p>
            </Card>
          </motion.div>
        )}
        {r.subida.paso === 'error' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/25 px-3.5 py-3 flex items-start gap-2.5 text-xs text-rose-600">
              <AlertCircle size={15} className="shrink-0 mt-px" />
              <span className="flex-1">{r.subida.mensaje}</span>
              <button onClick={r.descartar} className="font-semibold">Cerrar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {r.periodos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          {r.periodos.map((p) => (
            <button key={p} onClick={() => { haptic(); r.setPeriodo(p) }}
              className={`relative shrink-0 rounded-full px-3.5 h-8 text-xs font-semibold ${p === r.periodo ? 'text-white' : 'text-gray-500 glass'}`}>
              {p === r.periodo && <motion.span layoutId="m-resumen-periodo" className="absolute inset-0 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative">{mesLabel(p)}</span>
            </button>
          ))}
        </div>
      )}

      {r.cargando ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-[24px]" />)}</div>
      ) : !a ? (
        <Card className="text-center !py-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand text-white inline-flex items-center justify-center shadow-soft"><FileText size={22} /></div>
          <p className="mt-3 text-[15px] font-bold text-gray-900">Analice sus resúmenes</p>
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
            Suba el resumen de la tarjeta o de la cuenta. La IA extrae cada renglón y la app detecta suscripciones,
            gastos hormiga, cuotas y cargos bancarios.
          </p>
          <p className="mt-1 text-[11px] text-gray-400">Con 3 meses se detectan las suscripciones con confianza.</p>
          {r.errorCarga && <p className="mt-2 text-[11px] text-rose-500">{r.errorCarga}</p>}
        </Card>
      ) : (
        <>
          <Card>
            <p className="eyebrow">Gastos en resúmenes</p>
            <p className="mt-1.5 text-[24px] font-bold text-gray-900"><Money value={a.totalGastosBase} currency={base} /></p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {a.resumenes.map((res) => <ResumenChip key={res.id} r={res} onBorrar={() => r.borrar(res)} />)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Kpi icon={Repeat} label="Suscrip. / año" value={<Money value={a.suscripciones.reduce((t, x) => t + x.anualBase, 0)} currency={base} />} />
              <Kpi icon={Bug} label="Hormiga" value={<Money value={a.hormiga.totalBase} currency={base} />} />
              <Kpi icon={CreditCard} label="Cuotas próx. mes" value={<Money value={a.compromiso[0]?.totalBase ?? 0} currency={base} />} />
              <Kpi icon={Landmark} label="Impuestos y cargos" value={<Money value={a.cargos.totalBase} currency={base} />} />
            </div>
          </Card>

          <IndiceResumen />

          <div id="r-estado" className="scroll-mt-2 space-y-3">{a.resumenes.filter((res) => res.detalle).map((res) => <EstadoCuenta key={res.id} r={res} />)}</div>

          <div id="r-contraste" className="scroll-mt-2 space-y-3">{r.conciliaciones.map((c) => (
            <ConciliacionCard key={c.resumen.id} c={c} tarjetas={s.tarjetas ?? []} s={s}
              onElegir={(id) => r.elegirTarjeta(c.resumen.emisor, id)}
              onAgregar={(items, t) => { haptic('success'); return r.agregarFaltantes(items, t) }}
              onPasar={(cs, t) => { haptic('success'); return r.pasarConsumos(cs, t) }} />
          ))}</div>

          <div id="r-comparar" className="scroll-mt-2 space-y-3">
            {r.extras && <ComparativaCard c={r.extras.comparativa} base={base} />}
            {r.extras && <FinanciacionCard f={r.extras.financiacion} base={base} />}
          </div>

          <div id="r-suscripciones" className="scroll-mt-2" />
          <Card title="Suscripciones y débitos" delay={0.04}>
            {a.suscripciones.length === 0 ? (
              <Vacio texto={r.periodos.length < 3 ? 'Con 3 meses de resúmenes se detectan con confianza.' : 'No se detectaron cobros recurrentes.'} />
            ) : a.suscripciones.map((x) => (
              <Fila key={x.clave} titulo={x.comercio}
                meta={`${x.meses.length} ${x.meses.length === 1 ? 'mes' : 'meses'}${x.debito ? ' · débito aut.' : ''}${x.confianza === 'posible' ? ' · posible' : ''}`}
                derecha={<>
                  <p className="text-[13px] font-bold text-gray-900"><Money value={x.ultimo} currency={x.moneda} /></p>
                  <p className="text-[10.5px] text-gray-400 flex items-center justify-end gap-1">
                    {x.variacionPct !== null && Math.abs(x.variacionPct) >= 1 && (
                      <span className={`rounded-full px-1.5 font-bold ${x.variacionPct > 0 ? 'bg-rose-500/12 text-rose-500' : 'bg-emerald-500/12 text-emerald-600'}`}>
                        {x.variacionPct > 0 ? '+' : ''}{x.variacionPct.toFixed(0)}%
                      </span>
                    )}
                    <Money value={x.anualBase} currency={base} animated={false} />/año
                  </p>
                </>} />
            ))}
          </Card>

          <div id="r-hormiga" className="scroll-mt-2" />
          <Card title="Gastos hormiga" delay={0.12}>
            {a.hormiga.totalBase === 0 ? <Vacio texto="Sin hábitos ni compras chicas este mes." ok /> : (
              <>
                <p className="mb-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-xs text-gray-700 leading-relaxed">
                  Suman <b><Money value={a.hormiga.totalBase} currency={base} /></b>: el <b>{a.hormiga.pctDelPeriodo.toFixed(1)}%</b> del mes
                  (≈ <Money value={a.hormiga.anualBase} currency={base} /> al año).
                </p>
                {a.hormiga.habitos.length > 0 && <p className="eyebrow mt-1">Hábitos ({a.hormiga.minCompras}+ compras, con propinas)</p>}
                {a.hormiga.habitos.map((h) => (
                  <div key={h.clave} className="flex items-center justify-between gap-3 py-2 border-b border-hairline last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-900">{h.comercio}</p>
                      <p className="truncate text-[11px] text-gray-400">{h.veces} compras · ticket <Money value={h.ticketBase} currency={base} animated={false} /></p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-gray-900"><Money value={h.totalBase} currency={base} /></p>
                      <p className="text-[10.5px] text-gray-400"><Money value={h.anualBase} currency={base} animated={false} />/año</p>
                    </div>
                  </div>
                ))}
                {a.hormiga.chicas.cantidad > 0 && (
                  <>
                    <p className="eyebrow mt-3">Compras chicas sueltas (hasta USD {a.hormiga.topeUsd}) · {a.hormiga.chicas.cantidad}</p>
                    {a.hormiga.chicas.comercios.slice(0, 5).map((c) => (
                      <Fila key={c.clave} titulo={c.comercio} meta={`${c.veces} ${c.veces === 1 ? 'compra' : 'compras'}`}
                        derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={c.totalBase} currency={base} /></p>} />
                    ))}
                  </>
                )}
              </>
            )}
          </Card>

          <Card title="Dónde se va la plata" delay={0.16}>
            {a.topComercios.slice(0, 6).map((c, i) => (
              <div key={c.clave} className="py-1.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-semibold text-gray-900"><Store size={12} className="inline mr-1 text-gray-400" />{c.comercio}</span>
                  <span className="font-bold text-gray-900 shrink-0"><Money value={c.totalBase} currency={base} /></span>
                </div>
                <ProgressBar value={c.pct} className="mt-1" height={5} color={i === 0 ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 55%, transparent)'} />
              </div>
            ))}
          </Card>

          <div id="r-cuotas" className="scroll-mt-2" />
          <Card title="Cuotas en curso" delay={0.2}
              action={
                <button onClick={() => { haptic(); setCuotaManual('nueva') }} className="text-[11px] font-bold text-primary inline-flex items-center gap-1">
                  <Plus size={12} /> Agregar cuota
                </button>
              }>
              <p className="mb-2 text-xs text-gray-500 leading-relaxed">
                Falta pagar <b className="text-gray-900"><Money value={a.cuotas.reduce((t, c) => t + toBase(c.restante, c.moneda, base, s), 0)} currency={base} /></b>
                {a.libreDesde && <> · la última cuota vence en <b className="text-gray-900">{monthLabel(a.libreDesde)}</b></>}
              </p>
              {a.compromiso.length > 0 && <CompromisoChart meses={a.compromiso} resto={a.compromisoResto} base={base} />}
              {a.manualesDuplicadas.length > 0 && (
                <p className="mb-2 rounded-2xl bg-gray-500/[0.06] px-3 py-2 text-[11px] text-gray-500 leading-relaxed">
                  {a.manualesDuplicadas.map((d) => d.manual.descripcion).join(', ')} también {a.manualesDuplicadas.length === 1 ? 'está cargada' : 'están cargadas'} a mano:
                  se {a.manualesDuplicadas.length === 1 ? 'cuenta' : 'cuentan'} una sola vez, con el dato del resumen.
                </p>
              )}
              {a.cuotas.map((c, k) => {
                const cat = c.categoria ? getCatFromSettings(c.categoria, s) : undefined
                const cuota = c.actual === 0 ? `empieza ${mesCorto(c.manual!.primerMes)}` : `${c.actual}/${c.total}`
                const fila = (
                  <Fila key={k} titulo={c.comercio}
                    meta={c.manual ? `manual · ${c.emisor} · ${cuota}`
                      : c.refinanciacion ? `refinanciación · ${c.emisor} · ${cuota} · con intereses`
                      : `${c.emisor} · ${cuota} · ${cat?.nombre ?? 'sin categoría'}`}
                    derecha={<>
                      <p className="text-[13px] font-bold text-gray-900"><Money value={c.montoCuota} currency={c.moneda} /></p>
                      <p className="text-[10.5px] text-gray-400">
                        {c.restantes === 0 ? 'última cuota' : <>hasta {mesCorto(c.finMes)} · restan <Money value={c.restante} currency={c.moneda} animated={false} /></>}
                      </p>
                    </>} />
                )
                return c.manual ? (
                  <button key={k} type="button" onClick={() => { haptic(); setCuotaManual(c.manual!) }} className="block w-full text-left">{fila}</button>
                ) : fila
              })}
              {a.cuotas.length === 0 && <Vacio texto="No hay cuotas en curso en este período." ok />}
          </Card>

          <div id="r-categorias" className="scroll-mt-2" />
          <Card title="Gasto por categoría" delay={0.22}>
            {a.porCategoria.slice(0, 8).map((c) => {
              const cat = c.clave ? getCatFromSettings(c.clave, s) : undefined
              return (
                <div key={c.clave ?? '-'} className="py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold text-gray-900">{cat?.nombre ?? 'Sin categoría'} <span className="text-[11px] font-normal text-gray-400">{c.pct.toFixed(0)}%</span></span>
                    <span className="font-bold text-gray-900 shrink-0"><Money value={c.totalBase} currency={base} /></span>
                  </div>
                  <ProgressBar value={c.pct} className="mt-1" height={5} color={cat?.color ?? '#94a3b8'} />
                </div>
              )
            })}
            {a.porTitular.length > 0 && (
              <div className="pt-2 grid grid-cols-2 gap-1.5">
                {a.porTitular.map((t) => (
                  <div key={t.clave ?? '-'} className="rounded-2xl bg-gray-500/[0.06] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 truncate">{t.clave ?? 'Sin titular'}</p>
                    <p className="mt-1 text-[12.5px] font-bold text-gray-900 truncate"><Money value={t.totalBase} currency={base} /></p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Comercios y categorías" delay={0.23}>
            <p className="mb-1 text-xs text-gray-500">Cambie nombre o categoría: se aplica a todos los resúmenes y a los próximos.</p>
            {r.comercios.map((g) => (
              <EditorComercio key={g.clave} g={g} s={s} etiquetaNuevo="sin revisar"
                onCambiar={(nombre, categoria) => { haptic(); return r.recategorizar(g.clave, nombre, categoria) }} />
            ))}
          </Card>

          <div id="r-cargos" className="scroll-mt-2" />
          {a.cargos.items.length > 0 && (
            <Card title="Impuestos, intereses y comisiones" delay={0.24}>
              <p className="mb-2 text-xs text-gray-500 leading-relaxed">
                <b className="text-gray-900"><Money value={a.cargos.totalBase} currency={base} /></b> además de los consumos ({a.cargos.pctDelTotal.toFixed(1)}% de lo cobrado)
              </p>
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {a.cargos.porTipo.map((t) => (
                  <div key={t.tipo} className="rounded-2xl bg-gray-500/[0.06] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{ETIQUETA_CARGO[t.tipo].plural}</p>
                    <p className="mt-1 text-[12.5px] font-bold text-gray-900 truncate"><Money value={t.totalBase} currency={base} /></p>
                    <p className="text-[10px] text-gray-400">{t.cantidad} {t.cantidad === 1 ? 'renglón' : 'renglones'}</p>
                  </div>
                ))}
              </div>
              {a.cargos.items.map((c, k) => (
                <Fila key={k} titulo={c.descripcion} meta={ETIQUETA_CARGO[c.tipo].singular}
                  derecha={<p className={`text-[13px] font-bold ${c.montoBase < 0 ? 'text-emerald-600' : 'text-rose-500'}`}><Money value={c.montoBase} currency={base} /></p>} />
              ))}
              {a.cargos.porTipo.some((t) => t.tipo === 'percepcion') && (
                <p className="pt-2 text-[11px] text-gray-400 leading-relaxed">
                  Las percepciones (RG 5617) son a cuenta de Ganancias o Bienes Personales: se pueden computar o pedir la devolución a ARCA.
                </p>
              )}
            </Card>
          )}
        </>
      )}

      <Sheet
        open={r.subida.paso === 'revisar' || r.subida.paso === 'guardando'}
        onClose={r.descartar}
        title="Revisar resumen"
        subtitle="Verifique los datos antes de guardar"
        footer={
          <div className="grid grid-cols-2 gap-2 px-5 pb-5 pt-2">
            <button onClick={r.descartar} className="h-11 rounded-2xl glass text-sm font-semibold text-gray-700">Descartar</button>
            <button onClick={() => { haptic('success'); r.confirmar() }} disabled={r.subida.paso === 'guardando'}
              className="h-11 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-60">
              {r.subida.paso === 'guardando' ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        {(r.subida.paso === 'revisar' || r.subida.paso === 'guardando') && (
          <Revision resumen={r.subida.resumen} reemplaza={r.subida.reemplaza} s={s}
            grupos={r.gruposRevision} onEditar={r.editarEnRevision} />
        )}
      </Sheet>

      <CuotaModal open={cuotaManual !== null} editing={cuotaManual === 'nueva' ? null : cuotaManual} onClose={() => setCuotaManual(null)} />
    </div>
  )
}

const SECCIONES: [string, string][] = [
  ['r-estado', 'Estado'], ['r-contraste', 'Contraste'], ['r-cuotas', 'Cuotas'], ['r-comparar', 'Comparar'],
  ['r-suscripciones', 'Suscripciones'], ['r-hormiga', 'Hormiga'], ['r-categorias', 'Categorías'], ['r-cargos', 'Cargos'],
]

/** Índice para saltar a cada sección del resumen (la pestaña es larga) */
function IndiceResumen() {
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar bg-[var(--background)]/85 backdrop-blur">
      {SECCIONES.map(([id, label]) => (
        <button key={id} type="button"
          onClick={() => { haptic('light'); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
          className="shrink-0 h-7 px-3 rounded-full glass text-[11px] font-semibold text-gray-600">
          {label}
        </button>
      ))}
    </div>
  )
}

function ResumenChip({ r, onBorrar }: { r: Resumen; onBorrar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-500/[0.08] pl-2.5 pr-1 py-1 text-[11px]">
      {r.tipo === 'tarjeta' ? <CreditCard size={12} className="text-primary" /> : <Landmark size={12} className="text-primary" />}
      <span className="font-semibold text-gray-800">{r.emisor}</span>
      <button onClick={() => { haptic('warning'); onBorrar() }} aria-label={`Eliminar resumen ${r.emisor}`} className="h-6 w-6 inline-flex items-center justify-center text-gray-400">
        <Trash2 size={12} />
      </button>
    </span>
  )
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400"><Icon size={11} />{label}</p>
      <p className="mt-1 text-[14px] font-bold text-gray-900 truncate">{value}</p>
    </div>
  )
}

function Fila({ titulo, meta, derecha }: { titulo: string; meta: string; derecha: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-hairline last:border-0">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-gray-900">{titulo}</p>
        <p className="truncate text-[11px] text-gray-400">{meta}</p>
      </div>
      <div className="text-right shrink-0">{derecha}</div>
    </div>
  )
}

function Vacio({ texto, ok }: { texto: string; ok?: boolean }) {
  return (
    <p className="flex items-center gap-2 py-2 text-xs text-gray-500">
      {ok && <CheckCircle2 size={14} className="text-emerald-500" />}{texto}
    </p>
  )
}

const signo = (n: number) => (n > 0 ? '+' : '')
const pctTxt = (n: number | null) => (n === null ? '—' : `${signo(n)}${n.toFixed(0)}%`)

function ConciliacionCard({ c, tarjetas, s, onElegir, onAgregar, onPasar }: {
  c: ConciliacionResumen; tarjetas: Tarjeta[]; s: Settings
  onElegir: (tarjetaId: string) => void
  onAgregar: (items: ResumenItem[], t: Tarjeta) => Promise<void>
  onPasar: (cs: GastoRegistrado[], t: Tarjeta) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const correr = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const res = c.resultado
  const t = c.tarjeta
  const fecha = (iso: string) => fechaCorta(iso)
  const cat = (id: string | null) => (id ? getCatFromSettings(id, s)?.nombre : undefined) ?? 'sin categoría'
  return (
    <Card title={`Contraste con lo registrado · ${c.resumen.emisor}`} delay={0.025}>
      {tarjetas.length === 0 ? (
        <Vacio texto="Cree la tarjeta en Ajustes → Tarjetas de crédito para contrastar el resumen con sus gastos." />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-xs text-gray-500">Tarjeta en la app</span>
            <select value={t?.id ?? ''} onChange={(e) => onElegir(e.target.value)}
              className="h-8 rounded-lg bg-gray-500/[0.06] px-2 text-xs font-semibold text-gray-800 outline-none">
              {!t && <option value="">Elegir…</option>}
              {tarjetas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </div>
          {!t ? null : !res ? <div className="skeleton h-16 rounded-2xl" /> : (
            <>
              <div className="grid grid-cols-3 gap-1.5 py-1.5">
                <Kpi icon={CheckCircle2} label="Coinciden" value={String(res.coinciden.length)} />
                <Kpi icon={AlertCircle} label="Sin registrar" value={String(res.faltan.length)} />
                <Kpi icon={Repeat} label="Otro medio" value={String(res.otroMedio.length)} />
              </div>
              <p className="text-[11px] text-gray-400">Del {fecha(res.desde)} al {fecha(res.hasta)} · gastos registrados con tarjeta de crédito</p>

              {res.otroMedio.length > 0 && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="eyebrow">Registrados con otro medio</p>
                    <button disabled={busy} onClick={() => correr(() => onPasar(res.otroMedio.map((x) => x.consumo), t))} className="text-[11px] font-bold text-primary disabled:opacity-50">Pasar todos a {t.nombre}</button>
                  </div>
                  <p className="text-[11px] text-gray-500">Figuran en el resumen pero los registró con otro medio. Agregarlos los duplicaría.</p>
                  {res.otroMedio.map(({ item, consumo }) => (
                    <Fila key={consumo.id} titulo={consumo.comercio || item.comercio} meta={`${fecha(item.fecha)} · en el resumen: ${item.comercio}`}
                      derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={item.monto} currency={item.moneda} animated={false} /></p>} />
                  ))}
                </>
              )}

              {res.faltan.length > 0 && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="eyebrow">En el resumen, sin registrar como consumo</p>
                    <button disabled={busy} onClick={() => correr(() => onAgregar(res.faltan, t))} className="text-[11px] font-bold text-primary disabled:opacity-50">Agregar todos</button>
                  </div>
                  {res.faltan.map((i, k) => (
                    <div key={i.id ?? k} className="flex items-center justify-between gap-2 py-2 border-b border-hairline last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-gray-900">{i.comercio}</p>
                        <p className="truncate text-[11px] text-gray-400">{fecha(i.fecha)} · {cat(i.categoria)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[13px] font-bold text-gray-900"><Money value={i.monto} currency={i.moneda} animated={false} /></span>
                        <button disabled={busy} onClick={() => correr(() => onAgregar([i], t))} aria-label={`Agregar ${i.comercio}`}
                          className="h-7 w-7 rounded-lg glass inline-flex items-center justify-center text-primary disabled:opacity-50"><Plus size={13} /></button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {res.sobran.length > 0 && (
                <>
                  <p className="eyebrow mt-3">Registrados con {t.nombre} que no aparecen</p>
                  <p className="text-[11px] text-gray-500">Revise si están duplicados, si eran de otra tarjeta o si el comercio los imputó tarde.</p>
                  {res.sobran.map((x) => (
                    <Fila key={x.id} titulo={x.comercio || 'Sin comercio'} meta={fecha(x.fecha)}
                      derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={x.monto} currency={x.moneda} animated={false} /></p>} />
                  ))}
                </>
              )}

              {res.proximo.length > 0 && (
                <p className="mt-3 text-[11px] text-gray-500">
                  {res.proximo.length} gasto{res.proximo.length !== 1 ? 's' : ''} con {t.nombre} posterior{res.proximo.length !== 1 ? 'es' : ''} al cierre: entra{res.proximo.length !== 1 ? 'n' : ''} en el próximo resumen.
                </p>
              )}
              {res.faltan.length === 0 && res.otroMedio.length === 0 && res.sobran.length === 0 && (
                <Vacio texto="Todo lo registrado con la tarjeta coincide con el resumen." ok />
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}

function ComparativaCard({ c, base }: { c: Comparativa | null; base: Currency }) {
  if (!c) {
    return (
      <Card title="Contra meses anteriores" delay={0.03}>
        <Vacio texto="Suba el resumen del mes anterior de la misma tarjeta para comparar." />
      </Card>
    )
  }
  const t = c.total
  const ref = c.previos.length === 1 ? `${mesCorto(c.previos[0])}` : `promedio de ${c.previos.map((p) => mesCorto(p).split(' ')[0]).join(', ')}`
  const sube = (t.vsPromedioPct ?? 0) > 0
  const lista = (titulo: string, xs: Variacion[]) => xs.length > 0 && (
    <>
      <p className="eyebrow mt-3">{titulo}</p>
      {xs.slice(0, 4).map((v) => (
        <Fila key={v.clave ?? '-'} titulo={v.nombre} meta={`antes ${montoCorto(v.referenciaBase)} · ahora ${montoCorto(v.actualBase)}`}
          derecha={<p className={`text-[13px] font-bold ${v.difBase > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{signo(v.difBase)}<Money value={v.difBase} currency={base} animated={false} /></p>} />
      ))}
    </>
  )
  return (
    <Card title="Contra meses anteriores" delay={0.03}>
      <p className="text-xs text-gray-500">Consumos de {c.emisores.join(' y ')} contra {ref}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[20px] font-bold text-gray-900"><Money value={t.actualBase} currency={base} /></p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${sube ? 'bg-rose-500/12 text-rose-500' : 'bg-emerald-500/12 text-emerald-600'}`}>{pctTxt(t.vsPromedioPct)}</span>
      </div>
      <p className="text-[11px] text-gray-400">
        Antes <Money value={t.promedioBase} currency={base} animated={false} />
        {base !== 'USD' && t.vsPromedioUsdPct !== null && <> · en dólares {pctTxt(t.vsPromedioUsdPct)}</>}
      </p>
      {lista('Categorías que más cambiaron', c.categorias)}
      {lista('Comercios que más subieron', c.subas)}
      {c.nuevos.length > 0 && (
        <>
          <p className="eyebrow mt-3">Nuevos este mes</p>
          {c.nuevos.slice(0, 4).map((n) => (
            <Fila key={n.comercio} titulo={n.comercio} meta="no aparecía antes"
              derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={n.totalBase} currency={base} animated={false} /></p>} />
          ))}
        </>
      )}
    </Card>
  )
}

function FinanciacionCard({ f, base }: { f: AnalisisFinanciacion; base: Currency }) {
  const a = f.actual
  if (a.totalBase === 0 && !f.siPagaMinimo) return null
  const max = Math.max(...f.historial.map((h) => h.totalBase), 1)
  return (
    <Card title="Costo de financiarse" delay={0.035}>
      {a.totalBase > 0 ? (
        <>
          <p className="text-[20px] font-bold text-rose-500"><Money value={a.totalBase} currency={base} /></p>
          <p className="text-[11px] text-gray-500">
            en intereses e IVA este mes ({a.pctDelResumen.toFixed(1)}% de lo cobrado) · a este ritmo ≈ <Money value={a.totalBase * 12} currency={base} animated={false} /> al año
          </p>
          <div className="mt-2">
            {a.interesesBase > 0 && <Fila titulo="Intereses del saldo" meta="renglón del banco" derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={a.interesesBase} currency={base} animated={false} /></p>} />}
            {a.interesEnCuotasBase > 0 && <Fila titulo="Intereses dentro de refinanciaciones" meta="estimado a partir del IVA" derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={a.interesEnCuotasBase} currency={base} animated={false} /></p>} />}
            {a.ivaBase > 0 && <Fila titulo="IVA sobre intereses" meta="21 %" derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={a.ivaBase} currency={base} animated={false} /></p>} />}
          </div>
        </>
      ) : <Vacio texto="Este mes no pagó intereses." ok />}
      {f.siPagaMinimo && (
        <p className="mt-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-xs text-gray-700 leading-relaxed">
          Si paga solo el mínimo quedan <b><Money value={f.siPagaMinimo.financiadoBase} currency={base} animated={false} /></b> financiados
          al {pctFmt(f.siPagaMinimo.tem)} mensual: el mes que viene son ≈ <b><Money value={f.siPagaMinimo.interesBase} currency={base} animated={false} /></b> de intereses con IVA.
          Pagar el total los evita.
        </p>
      )}
      {f.historial.length > 1 && (
        <div className="mt-3">
          <p className="eyebrow mb-1.5">Por mes</p>
          <div className="flex items-end gap-1 h-16">
            {f.historial.map((h) => (
              <div key={h.periodo} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5">
                <span className="text-[9px] font-semibold text-gray-500 tnum">{h.totalBase > 0 ? montoCorto(h.totalBase) : '0'}</span>
                <div className={`w-full rounded-t-md ${h.periodo === a.periodo ? 'bg-rose-500/80' : 'bg-rose-500/35'}`} style={{ height: `${Math.max((h.totalBase / max) * 70, 3)}%` }} />
                <span className="text-[9px] text-gray-400">{mesCorto(h.periodo).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(f.tna !== null || f.cftea !== null) && (
        <p className="mt-2 text-[10.5px] text-gray-400">
          {f.tna !== null && <>TNA {pctFmt(f.tna)}</>}{f.tna !== null && f.cftea !== null && ' · '}{f.cftea !== null && <>CFTEA con IVA {pctFmt(f.cftea)}</>}
        </p>
      )}
    </Card>
  )
}

const COLOR_TIPO = {
  compras: 'var(--primary)',
  refinanciacion: '#f59e0b',
  manual: 'color-mix(in srgb, var(--primary) 30%, #94a3b8)',
} as const

/** Barras apiladas de lo comprometido mes a mes; tocar una barra muestra su detalle */
function CompromisoChart({ meses, resto, base }: { meses: CompromisoMes[]; resto: { mes: string; totalBase: number } | null; base: Currency }) {
  const [sel, setSel] = useState(0)
  const vis = meses.slice(0, 12)
  const max = Math.max(...vis.map((m) => m.totalBase))
  const m = vis[Math.min(sel, vis.length - 1)]
  const hay = {
    compras: vis.some((x) => x.comprasBase > 0),
    refinanciacion: vis.some((x) => x.refinanciacionBase > 0),
    manual: vis.some((x) => x.manualBase > 0),
  }
  const partes = [
    { k: 'compras' as const, label: 'Compras', v: m.comprasBase },
    { k: 'refinanciacion' as const, label: 'Refinanciación', v: m.refinanciacionBase },
    { k: 'manual' as const, label: 'Cargadas a mano', v: m.manualBase },
  ].filter((p) => p.v > 0)
  // El banco solo informa sus cuotas: se compara sin las cargadas a mano
  const delResumen = m.totalBase - m.manualBase
  const difBanco = m.bancoBase !== null && m.cantidad !== null && Math.abs(m.bancoBase - delResumen) > delResumen * 0.02
  return (
    <div className="mb-3 rounded-2xl bg-gray-500/[0.06] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Cuotas de los próximos resúmenes</p>
        <div className="flex gap-2 text-[9.5px] text-gray-500">
          {hay.compras && (hay.refinanciacion || hay.manual) && <Leyenda color={COLOR_TIPO.compras} label="Compras" />}
          {hay.refinanciacion && <Leyenda color={COLOR_TIPO.refinanciacion} label="Refinanc." />}
          {hay.manual && <Leyenda color={COLOR_TIPO.manual} label="Manual" />}
        </div>
      </div>
      <div className="mt-2 -mx-1 overflow-x-auto no-scrollbar">
        <div className="flex items-end gap-1 h-32 px-1" style={{ minWidth: vis.length * 30 }}>
          {vis.map((x, i) => {
            const activo = i === sel
            return (
              <button key={x.mes} type="button" onClick={() => { haptic(); setSel(i) }}
                aria-label={`${mesLabel(x.mes)}: ${montoCorto(x.totalBase)}`}
                className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                <span className={`text-[9px] font-bold tnum ${activo ? 'text-gray-900' : 'text-gray-400'}`}>{montoCorto(x.totalBase)}</span>
                <div className={`w-full flex flex-col-reverse rounded-t-md overflow-hidden transition-opacity ${activo ? '' : 'opacity-55'}`}
                  style={{ height: `${Math.max((x.totalBase / max) * 78, 4)}%` }}>
                  {x.comprasBase > 0 && <div style={{ flexGrow: x.comprasBase, background: COLOR_TIPO.compras }} />}
                  {x.refinanciacionBase > 0 && <div style={{ flexGrow: x.refinanciacionBase, background: COLOR_TIPO.refinanciacion }} />}
                  {x.manualBase > 0 && <div style={{ flexGrow: x.manualBase, background: COLOR_TIPO.manual }} />}
                </div>
                <span className={`text-[9.5px] ${activo ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{mesCorto(x.mes)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2.5 border-t border-hairline pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12.5px] font-bold text-gray-900">{mesLabel(m.mes)}{sel === 0 && <span className="ml-1 text-[10.5px] font-semibold text-primary">próximo resumen</span>}</p>
          <p className="text-[13px] font-bold text-gray-900"><Money value={m.totalBase} currency={base} animated={false} /></p>
        </div>
        {m.cantidad !== null && <p className="text-[11px] text-gray-400">{m.cantidad} cuota{m.cantidad !== 1 ? 's' : ''}</p>}
        {partes.length > 1 && partes.map((p) => (
          <p key={p.k} className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
            <Leyenda color={COLOR_TIPO[p.k]} label={p.label} />
            <Money value={p.v} currency={base} animated={false} />
          </p>
        ))}
        {m.terminan.length > 0 && (
          <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
            Última cuota de <b className="text-gray-800">{m.terminan.join(', ')}</b>: el mes siguiente baja.
          </p>
        )}
        {difBanco && (
          <p className="mt-1 text-[11px] text-amber-600">El banco informa <Money value={m.bancoBase!} currency={base} animated={false} /> para este mes.</p>
        )}
        {resto && <p className="mt-1 text-[11px] text-gray-500">Desde {mesCorto(resto.mes)}, según el banco: <Money value={resto.totalBase} currency={base} animated={false} /> más.</p>}
      </div>
    </div>
  )
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: color }} />{label}</span>
}

function Revision({ resumen, reemplaza, s, grupos, onEditar }: {
  resumen: Resumen; reemplaza: boolean; s: Settings
  grupos: GrupoComercio[]; onEditar: (clave: string, nombre: string, categoria: string | null) => void
}) {
  const nuevos = grupos.filter((g) => g.nuevo)
  const conocidos = grupos.filter((g) => !g.nuevo)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
          <p className="eyebrow">Emisor</p>
          <p className="mt-1 text-sm font-bold text-gray-900 truncate">{resumen.emisor}</p>
        </div>
        <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
          <p className="eyebrow">Período</p>
          <p className="mt-1 text-sm font-bold text-gray-900">{mesLabel(resumen.periodo)}</p>
        </div>
      </div>
      {resumen.total !== null && (
        <p className="text-xs text-gray-500">Total a pagar: <b className="text-gray-900"><Money value={resumen.total} currency={resumen.moneda} animated={false} /></b></p>
      )}
      {resumen.detalle && <Conciliacion r={resumen} />}
      {reemplaza && (
        <p className="rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-600">
          Ya hay un resumen de {resumen.emisor} para {mesLabel(resumen.periodo)}: se va a reemplazar.
        </p>
      )}
      {nuevos.length > 0 ? (
        <div>
          <p className="text-[13px] font-bold text-gray-900">Comercios nuevos ({nuevos.length})</p>
          <p className="text-[11px] text-gray-500">Revise nombre y categoría: se aplica solo en los próximos resúmenes.</p>
          {nuevos.map((g) => <EditorComercio key={g.clave} g={g} s={s} onCambiar={(n, c) => onEditar(g.clave, n, c)} />)}
        </div>
      ) : grupos.length > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-600">
          <CheckCircle2 size={14} className="shrink-0" /> Todos los comercios ya son conocidos: se aplicaron sus elecciones.
        </p>
      )}
      {conocidos.length > 0 && (
        <details>
          <summary className="text-[12px] font-semibold text-gray-500">Comercios conocidos ({conocidos.length}): ver o cambiar</summary>
          {conocidos.map((g) => <EditorComercio key={g.clave} g={g} s={s} onCambiar={(n, c) => onEditar(g.clave, n, c)} />)}
        </details>
      )}
      <details>
        <summary className="text-[12px] font-semibold text-gray-500">Ver los {resumen.items.length} renglones</summary>
      <div className="mt-2 rounded-2xl bg-gray-500/[0.05] divide-y divide-hairline">
        {resumen.items.map((i, k) => {
          const cat = i.categoria ? getCatFromSettings(i.categoria, s) : undefined
          return (
            <div key={k} className="flex items-center gap-2 px-3 py-2">
              <span className="w-11 text-[10.5px] text-gray-400 tabular-nums shrink-0">{fechaCorta(i.fecha)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-gray-900">{i.comercio}</span>
                <span className="block truncate text-[10.5px] text-gray-400">
                  {i.cuotaTotal ? `cuota ${i.cuotaActual}/${i.cuotaTotal}` : i.descripcion}{cat ? ` · ${cat.nombre}` : ''}
                </span>
              </span>
              <span className={`text-[12.5px] font-bold shrink-0 ${i.monto < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                <Money value={i.monto} currency={i.moneda} animated={false} />
              </span>
            </div>
          )
        })}
      </div>
      </details>
    </div>
  )
}

/** Fila editable de un comercio: nombre (se confirma al salir del campo) y categoría */
function EditorComercio({ g, s, onCambiar, etiquetaNuevo = 'nuevo' }: {
  g: GrupoComercio; s: Settings; onCambiar: (nombre: string, categoria: string | null) => unknown; etiquetaNuevo?: string
}) {
  const categorias = categoriasDeGasto(s)
  const confirmarNombre = (v: string) => { if (v.trim() && v.trim() !== g.nombre) onCambiar(v.trim(), g.categoria) }
  return (
    <div className="py-2 border-b border-hairline last:border-0">
      <div className="flex items-center gap-2">
        <input
          key={g.nombre}
          defaultValue={g.nombre}
          aria-label={`Nombre de ${g.nombre}`}
          enterKeyHint="done"
          className="min-w-0 flex-1 h-9 rounded-xl bg-gray-500/[0.07] px-2.5 text-[13px] font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-primary/30"
          onBlur={(e) => confirmarNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <select
          value={g.categoria ?? ''}
          aria-label={`Categoría de ${g.nombre}`}
          className={`w-[42%] h-9 rounded-xl bg-gray-500/[0.07] px-2 text-[12px] outline-none ${g.categoria ? 'text-gray-900' : 'text-gray-400'}`}
          onChange={(e) => onCambiar(g.nombre, e.target.value || null)}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre.split(' › ').pop()}</option>)}
        </select>
      </div>
      <p className="mt-1 truncate text-[10.5px] text-gray-400 px-1">
        {g.nuevo && <span className="mr-1 rounded-full bg-primary/12 px-1.5 font-bold text-primary">{etiquetaNuevo}</span>}
        {g.cantidad}× · <Money value={g.total} currency={g.moneda} animated={false} /> · {g.descripciones.join(' · ')}
      </p>
    </div>
  )
}

function Conciliacion({ r }: { r: Resumen }) {
  const c = conciliacion(r)
  if (c.ars === null && c.usd === null) return null
  const difs = ([['ARS', c.ars], ['USD', c.usd]] as const).filter(([, v]) => v !== null && v !== 0)
  return difs.length === 0 ? (
    <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-600">
      <CheckCircle2 size={14} className="shrink-0" /> Los renglones cuadran con el saldo del resumen.
    </p>
  ) : (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-600">
      <AlertCircle size={14} className="shrink-0 mt-px" />
      <span>
        No cuadra con el saldo ({difs.map(([m, v], i) => <span key={m}>{i > 0 && ' y '}<Money value={v!} currency={m} animated={false} /></span>)} de diferencia): puede faltar o estar repetido algún renglón.
      </span>
    </p>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-500/[0.06] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-[13.5px] font-bold text-gray-900 truncate">{children}</p>
    </div>
  )
}

function EstadoCuenta({ r }: { r: Resumen }) {
  const d = r.detalle!
  const saldo = d.saldoActualArs ?? r.total
  const usoLimite = saldo !== null && d.limiteCompra ? (saldo / d.limiteCompra) * 100 : null
  const tasas = ([['TNA', d.tna], ['TEA', d.tea], ['CFTEA', d.cftea]] as const).filter(([, v]) => v !== null)
  return (
    <Card title={`Estado de cuenta · ${r.emisor}`} delay={0.02}>
      {(d.fechaVencimiento || d.proximoCierre) && (
        <p className="-mt-1 mb-2.5 text-[11.5px] text-gray-500">
          {d.fechaVencimiento && <>Vence el <b className="text-gray-900">{fechaCorta(d.fechaVencimiento)}</b></>}
          {d.proximoCierre && <> · próximo cierre {fechaCorta(d.proximoCierre)}</>}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Dato label="Saldo a pagar">{saldo !== null ? <Money value={saldo} currency={r.moneda} animated={false} /> : '—'}</Dato>
        <Dato label="Pago mínimo">{d.pagoMinimo !== null ? <Money value={d.pagoMinimo} currency={r.moneda} animated={false} /> : '—'}</Dato>
        {d.saldoActualUsd !== null && <Dato label="En dólares"><Money value={d.saldoActualUsd} currency="USD" animated={false} /></Dato>}
        {d.saldoAnteriorArs !== null && <Dato label="Saldo anterior"><Money value={d.saldoAnteriorArs} currency={r.moneda} animated={false} /></Dato>}
      </div>
      {usoLimite !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>Uso del límite de compra</span><b className="text-gray-900">{usoLimite.toFixed(0)}%</b>
          </div>
          <ProgressBar value={Math.min(usoLimite, 100)} className="mt-1" height={6} color={usoLimite > 80 ? 'var(--expense)' : usoLimite > 50 ? 'var(--unassigned)' : 'var(--primary)'} />
        </div>
      )}
      {tasas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {tasas.map(([k, v]) => <span key={k} className="rounded-full bg-gray-500/[0.08] px-2 py-0.5 text-gray-500">{k} <b className="text-gray-900">{pctFmt(v!)}</b></span>)}
        </div>
      )}
      <div className="mt-3"><Conciliacion r={r} /></div>
      {d.planesOfrecidos.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow mb-1.5">Refinanciación que ofrece el banco</p>
          <div className="grid grid-cols-2 gap-1.5">
            {d.planesOfrecidos.map((p) => (
              <div key={p.cuotas} className="rounded-2xl bg-gray-500/[0.06] px-2.5 py-2">
                <p className="text-[12.5px] font-bold text-gray-900">{p.cuotas} × <Money value={p.montoCuota} currency={r.moneda} animated={false} /></p>
                <p className="text-[10px] text-gray-400">total <Money value={p.cuotas * p.montoCuota} currency={r.moneda} animated={false} /></p>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.avisos.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {d.avisos.map((av, k) => (
            <p key={k} className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-[11.5px] text-gray-700 leading-relaxed">
              <Megaphone size={13} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{av.texto}{av.vigencia && <span className="text-gray-400"> · desde {fechaCorta(av.vigencia)}</span>}</span>
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}
