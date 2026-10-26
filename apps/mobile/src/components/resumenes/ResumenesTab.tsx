'use client'

import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Upload, FileText, Repeat, Bug, Store, CreditCard, Landmark, AlertCircle, Trash2,
  Plus, Sparkles, CheckCircle2, Loader2,
} from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useResumenes } from '@finanzas/core/lib/useResumenes'
import { usuarioId } from '@finanzas/core/lib/resumenes'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, monthLabel } from '@finanzas/core/lib/constants'
import { CategoryIcon } from '@/lib/categoryIcons'
import { Currency, Resumen, ResumenItem, Settings } from '@finanzas/core/types'
import { ETIQUETA_CARGO, mesCorto } from '@finanzas/core/lib/resumenAnalisis'
import { toBase } from '@finanzas/core/lib/currency'
import Card from '@/components/ui/Card'
import Sheet from '@/components/ui/Sheet'
import ProgressBar from '@/components/ui/ProgressBar'
import { Money } from '@/components/ui/AnimatedNumber'
import { haptic } from '@/lib/haptics'

const ACCEPT = '.pdf,.csv,.txt,.xlsx,application/pdf,text/csv'

function categoriaPorDefecto(s: Settings): string {
  const grupos = s.categoriasGasto.filter((g) => g.activa)
  const g = grupos.find((x) => /otro/i.test(x.nombre)) ?? grupos[grupos.length - 1]
  return g?.subcategorias.find((c) => c.activa)?.id ?? g?.id ?? 'otros'
}

/** "octubre de 2026" → "Octubre de 2026" */
const mesLabel = (p: string) => { const l = monthLabel(p); return l.charAt(0).toUpperCase() + l.slice(1) }

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

/** Pestaña "Resúmenes" de Análisis: subir resúmenes y ver el análisis */
export default function ResumenesTab() {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase, user } = useAuthStore()
  const base = monedaBase as Currency
  const r = useResumenes(s, base, usuarioId(user))
  const inputRef = useRef<HTMLInputElement>(null)
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
            gastos hormiga, cuotas, cargos bancarios y consumos sin cargar.
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
              <Kpi icon={AlertCircle} label="Sin cargar" value={String(r.faltantes.length)} />
              <Kpi icon={Landmark} label="Impuestos y cargos" value={<Money value={a.cargos.totalBase} currency={base} />} />
            </div>
          </Card>

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

          <Card title="No cargados en la app" delay={0.08}>
            {r.faltantes.length === 0 ? <Vacio texto="Todo lo del resumen está cargado." ok /> : r.faltantes.map((i, k) => (
              <FilaNoCargado key={i.id ?? k} item={i} s={s} onCargar={() => { haptic('success'); return r.cargar(i, categoriaPorDefecto(s)) }} />
            ))}
          </Card>

          <Card title="Gastos hormiga" delay={0.12}>
            {a.hormiga.cantidad === 0 ? <Vacio texto="Sin compras chicas este mes." ok /> : (
              <>
                <p className="mb-2 rounded-2xl bg-amber-500/10 px-3 py-2.5 text-xs text-gray-700 leading-relaxed">
                  <b>{a.hormiga.cantidad} compras</b> chicas suman <b><Money value={a.hormiga.totalBase} currency={base} /></b>:
                  el <b>{a.hormiga.pctDelPeriodo.toFixed(1)}%</b> del mes (≈ <Money value={a.hormiga.totalBase * 12} currency={base} /> al año).
                </p>
                {a.hormiga.comercios.slice(0, 6).map((c) => (
                  <Fila key={c.clave} titulo={c.comercio} meta={`${c.veces} ${c.veces === 1 ? 'compra' : 'compras'}`}
                    derecha={<p className="text-[13px] font-bold text-gray-900"><Money value={c.totalBase} currency={base} /></p>} />
                ))}
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

          {a.cuotas.length > 0 && (
            <Card title="Cuotas en curso" delay={0.2}
              action={r.cuotasNuevas.length > 0 ? (
                <button onClick={() => { haptic('success'); r.registrarCuotas() }} className="text-[11px] font-bold text-primary inline-flex items-center gap-1">
                  <Plus size={12} /> Agregar {r.cuotasNuevas.length} a Cuotas
                </button>
              ) : undefined}>
              <p className="mb-2 text-xs text-gray-500 leading-relaxed">
                Falta pagar <b className="text-gray-900"><Money value={a.cuotas.reduce((t, c) => t + toBase(c.restante, c.moneda, base, s), 0)} currency={base} /></b>
                {a.libreDesde && <> · la última cuota vence en <b className="text-gray-900">{monthLabel(a.libreDesde)}</b></>}
              </p>
              {a.compromiso.length > 0 && (
                <div className="mb-3 rounded-2xl bg-gray-500/[0.06] px-3 py-3">
                  <p className="eyebrow mb-2">Ya comprometido en los próximos resúmenes</p>
                  <div className="flex items-end gap-1 h-20">
                    {a.compromiso.slice(0, 8).map((m) => {
                      const max = Math.max(...a.compromiso.slice(0, 8).map((x) => x.totalBase))
                      return (
                        <div key={m.mes} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                          <div className="w-full rounded-t-md bg-primary/70" style={{ height: `${Math.max((m.totalBase / max) * 100, 6)}%` }} />
                          <span className="text-[9.5px] text-gray-400">{mesCorto(m.mes)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Próximo mes: <b className="text-gray-900"><Money value={a.compromiso[0].totalBase} currency={base} /></b> en {a.compromiso[0].cantidad} cuota{a.compromiso[0].cantidad !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {a.cuotas.map((c, k) => {
                const cat = c.categoria ? getCatFromSettings(c.categoria, s) : undefined
                return (
                  <Fila key={k} titulo={c.comercio} meta={`${c.emisor} · ${c.actual}/${c.total} · ${cat?.nombre ?? 'sin categoría'}`}
                    derecha={<>
                      <p className="text-[13px] font-bold text-gray-900"><Money value={c.montoCuota} currency={c.moneda} /></p>
                      <p className="text-[10.5px] text-gray-400">
                        {c.restantes === 0 ? 'última cuota' : <>hasta {mesCorto(c.finMes)} · restan <Money value={c.restante} currency={c.moneda} animated={false} /></>}
                      </p>
                    </>} />
                )
              })}
            </Card>
          )}

          {a.cargos.items.length > 0 && (
            <Card title="Impuestos, intereses y comisiones" delay={0.24}>
              <p className="mb-2 text-xs text-gray-500 leading-relaxed">
                <b className="text-gray-900"><Money value={a.cargos.totalBase} currency={base} /></b> además de los consumos ({a.cargos.pctDelTotal.toFixed(1)}% de lo cobrado)
              </p>
              <div className="mb-2 grid grid-cols-3 gap-1.5">
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
                  derecha={<p className="text-[13px] font-bold text-rose-500"><Money value={c.montoBase} currency={base} /></p>} />
              ))}
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
          <Revision resumen={r.subida.resumen} reemplaza={r.subida.reemplaza} s={s} />
        )}
      </Sheet>
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

function FilaNoCargado({ item, s, onCargar }: { item: ResumenItem; s: Settings; onCargar: () => Promise<void> }) {
  const cat = item.categoria ? getCatFromSettings(item.categoria, s) : undefined
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-hairline last:border-0">
      <span className="h-8 w-8 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: `${cat?.color ?? '#94a3b8'}22`, color: cat?.color ?? '#94a3b8' }}>
        <CategoryIcon cat={cat ?? { id: item.categoria ?? 'otros' }} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-gray-900">{item.comercio}</p>
        <p className="truncate text-[11px] text-gray-400">{fechaCorta(item.fecha)} · <Money value={item.monto} currency={item.moneda} animated={false} /></p>
      </div>
      <motion.button whileTap={{ scale: 0.92 }} onClick={onCargar} className="h-8 px-2.5 rounded-xl glass text-[11px] font-bold text-primary inline-flex items-center gap-1 shrink-0">
        <Plus size={12} /> Cargar
      </motion.button>
    </div>
  )
}

function Revision({ resumen, reemplaza, s }: { resumen: Resumen; reemplaza: boolean; s: Settings }) {
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
      {reemplaza && (
        <p className="rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-600">
          Ya hay un resumen de {resumen.emisor} para {mesLabel(resumen.periodo)}: se va a reemplazar.
        </p>
      )}
      <p className="text-[11px] text-gray-400">{resumen.items.length} renglones</p>
      <div className="rounded-2xl bg-gray-500/[0.05] divide-y divide-hairline">
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
    </div>
  )
}
