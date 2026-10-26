'use client'

import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Upload, FileText, Repeat, Bug, Store, CreditCard, Landmark, AlertCircle, Trash2,
  Plus, Sparkles, TrendingUp, Loader2, CheckCircle2,
} from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useResumenes } from '@finanzas/core/lib/useResumenes'
import { usuarioId } from '@finanzas/core/lib/resumenes'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, monthLabel } from '@finanzas/core/lib/constants'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { Currency, Resumen, ResumenItem, Settings } from '@finanzas/core/types'
import { toBase } from '@finanzas/core/lib/currency'
import { ETIQUETA_CARGO, mesCorto } from '@finanzas/core/lib/resumenAnalisis'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import ProgressBar from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/MoneyText'
import { PageScroll } from '@/components/shell/PageScroll'
import { cn } from '@finanzas/core/lib/utils'

const ACCEPT = '.pdf,.csv,.txt,.xlsx,application/pdf,text/csv'

/** Categoría por defecto para un consumo sin sugerencia: "Otros" si existe */
function categoriaPorDefecto(s: Settings): string {
  const grupos = s.categoriasGasto.filter((g) => g.activa)
  const otros = grupos.find((g) => /otro/i.test(g.nombre))
  const g = otros ?? grupos[grupos.length - 1]
  return g?.subcategorias.find((c) => c.activa)?.id ?? g?.id ?? 'otros'
}

/** "octubre de 2026" → "Octubre de 2026" */
const mesLabel = (p: string) => { const l = monthLabel(p); return l.charAt(0).toUpperCase() + l.slice(1) }

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

export default function ResumenesPage() {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase, user } = useAuthStore()
  const base = monedaBase as Currency
  const r = useResumenes(s, base, usuarioId(user))
  const inputRef = useRef<HTMLInputElement>(null)
  const a = r.analisis
  const leyendo = r.subida.paso === 'leyendo'

  function elegirArchivo(files: FileList | null) {
    const f = files?.[0]
    if (f) r.subir(f)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <PageScroll className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {r.periodos.map((p) => (
            <button
              key={p}
              onClick={() => r.setPeriodo(p)}
              className={cn(
                'relative rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                p === r.periodo ? 'text-white' : 'text-muted hover:text-foreground bg-surface-2',
              )}
            >
              {p === r.periodo && (
                <motion.span layoutId="resumen-periodo" className="absolute inset-0 rounded-full bg-brand shadow-card" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              )}
              <span className="relative">{mesLabel(p)}</span>
            </button>
          ))}
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => elegirArchivo(e.target.files)} />
        <Button onClick={() => inputRef.current?.click()} disabled={leyendo}>
          {leyendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {leyendo ? 'Leyendo…' : 'Subir resumen'}
        </Button>
      </div>

      <AnimatePresence>
        {leyendo && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Card className="px-5 py-4 flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <div className="text-sm font-semibold">Leyendo {r.subida.paso === 'leyendo' ? r.subida.archivo : ''}</div>
                <div className="text-xs text-muted">La IA está extrayendo los movimientos. Suele tardar entre 20 y 60 segundos.</div>
              </div>
            </Card>
          </motion.div>
        )}
        {r.subida.paso === 'error' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Card className="px-5 py-4 flex items-center justify-between gap-3 !border-expense-soft bg-expense-tint">
              <div className="flex items-center gap-3 text-sm">
                <AlertCircle className="h-5 w-5 text-expense shrink-0" />
                <span>{r.subida.mensaje}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={r.descartar}>Cerrar</Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {r.cargando ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-[20px]" />)}
        </div>
      ) : !a ? (
        <EstadoVacio onSubir={() => inputRef.current?.click()} error={r.errorCarga} />
      ) : (
        <>
          <Card className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Gastos en resúmenes · {mesLabel(a.periodo)}</div>
                <div className="mt-2 text-[28px] font-semibold tnum leading-none"><MoneyText amount={a.totalGastosBase} currency={base} animated /></div>
                <div className="mt-2 text-xs text-muted">
                  {a.resumenes.length} {a.resumenes.length === 1 ? 'resumen' : 'resúmenes'} · {a.resumenes.reduce((n, x) => n + x.items.length, 0)} renglones
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.resumenes.map((res) => <ResumenChip key={res.id} r={res} onBorrar={() => r.borrar(res)} />)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={Repeat} tone="primary" label="Suscripciones / año" value={<MoneyText amount={a.suscripciones.reduce((t, x) => t + x.anualBase, 0)} currency={base} />} sub={`${a.suscripciones.length} detectadas`} />
              <Kpi icon={Bug} tone="warning" label="Gastos hormiga" value={<MoneyText amount={a.hormiga.totalBase} currency={base} />} sub={`${a.hormiga.cantidad} compras · ${a.hormiga.pctDelPeriodo.toFixed(1)}%`} />
              <Kpi icon={AlertCircle} tone="expense" label="No cargados en la app" value={String(r.faltantes.length)} sub={r.faltantes.length ? 'revisar abajo' : 'todo cargado'} />
              <Kpi icon={Landmark} tone="neutral" label="Impuestos y cargos" value={<MoneyText amount={a.cargos.totalBase} currency={base} />} sub={`${a.cargos.items.length} renglones`} />
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Seccion icon={Repeat} titulo="Suscripciones y débitos" sub="Cobros que se repiten mes a mes" delay={0.04}>
              {a.suscripciones.length === 0 ? (
                <Vacio texto={r.periodos.length < 3 ? 'Con 3 meses de resúmenes se detectan con confianza.' : 'No se detectaron cobros recurrentes.'} />
              ) : a.suscripciones.map((x) => (
                <Fila key={x.clave}
                  titulo={x.comercio}
                  meta={<>{x.meses.length} {x.meses.length === 1 ? 'mes' : 'meses'}{x.debito ? ' · débito automático' : ''}{x.confianza === 'posible' ? ' · posible' : ''}</>}
                  derecha={<>
                    <div className="font-semibold tnum"><MoneyText amount={x.ultimo} currency={x.moneda} /><span className="text-muted-2 font-normal">/mes</span></div>
                    <div className="text-[11px] text-muted tnum flex items-center justify-end gap-1.5">
                      {x.variacionPct !== null && Math.abs(x.variacionPct) >= 1 && (
                        <span className={cn('rounded-full px-1.5 py-px font-semibold', x.variacionPct > 0 ? 'bg-expense-soft text-expense' : 'bg-income-soft text-income')}>
                          {x.variacionPct > 0 ? '+' : ''}{x.variacionPct.toFixed(0)}%
                        </span>
                      )}
                      <MoneyText amount={x.anualBase} currency={base} />/año
                    </div>
                  </>}
                />
              ))}
            </Seccion>

            <Seccion icon={AlertCircle} titulo="No cargados en la app" sub="Gastos del resumen sin un egreso equivalente (±1 %, ±7 días)" delay={0.08}>
              {r.faltantes.length === 0 ? (
                <Vacio texto="Todos los consumos del resumen están cargados." ok />
              ) : r.faltantes.map((i, k) => (
                <FilaNoCargado key={i.id ?? k} item={i} s={s} onCargar={() => r.cargar(i, categoriaPorDefecto(s))} />
              ))}
            </Seccion>

            <Seccion icon={Bug} titulo="Gastos hormiga" sub={<>Compras sueltas por debajo de <MoneyText amount={a.hormiga.umbralBase} currency={base} /> (1 % del mes)</>} delay={0.12}>
              {a.hormiga.cantidad === 0 ? <Vacio texto="Sin compras chicas este mes." ok /> : (
                <>
                  <div className="mb-3 rounded-xl bg-unassigned-tint px-3 py-2.5 text-sm">
                    <b className="tnum">{a.hormiga.cantidad} compras</b> chicas suman <b><MoneyText amount={a.hormiga.totalBase} currency={base} /></b>: el <b>{a.hormiga.pctDelPeriodo.toFixed(1)}%</b> del gasto del mes
                    {' '}(≈ <MoneyText amount={a.hormiga.totalBase * 12} currency={base} /> al año).
                  </div>
                  {a.hormiga.comercios.slice(0, 8).map((c) => (
                    <Fila key={c.clave} titulo={c.comercio} meta={`${c.veces} ${c.veces === 1 ? 'compra' : 'compras'}`}
                      derecha={<div className="font-semibold tnum"><MoneyText amount={c.totalBase} currency={base} /></div>} />
                  ))}
                </>
              )}
            </Seccion>

            <Seccion icon={Store} titulo="Dónde se va la plata" sub="Comercios con más gasto en el período" delay={0.16}>
              {a.topComercios.slice(0, 8).map((c, i) => (
                <div key={c.clave} className="py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{c.comercio}<span className="ml-2 text-xs text-muted-2">{c.veces}×</span></span>
                    <span className="tnum font-semibold"><MoneyText amount={c.totalBase} currency={base} /></span>
                  </div>
                  <ProgressBar value={c.pct} className="mt-1.5" height={5} color={i === 0 ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 55%, transparent)'} />
                </div>
              ))}
            </Seccion>

            {a.cuotas.length > 0 && (
              <Seccion icon={CreditCard} titulo="Cuotas en curso"
                sub={<>Falta pagar <MoneyText amount={a.cuotas.reduce((t, c) => t + toBase(c.restante, c.moneda, base, s), 0)} currency={base} />
                  {a.libreDesde && <> · la última cuota vence en <b className="text-foreground">{monthLabel(a.libreDesde)}</b></>}</>} delay={0.2}>
                {r.cuotasNuevas.length > 0 && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 py-2 text-xs">
                    <span>{r.cuotasNuevas.length} {r.cuotasNuevas.length === 1 ? 'compra no está' : 'compras no están'} en Cuotas.</span>
                    <Button size="sm" variant="secondary" onClick={r.registrarCuotas}><Plus className="h-3.5 w-3.5" /> Agregar a Cuotas</Button>
                  </div>
                )}
                {a.compromiso.length > 0 && (
                  <div className="mb-3 rounded-xl bg-surface-2 px-3 py-3">
                    <div className="eyebrow !text-[10px] mb-2">Ya comprometido en los próximos resúmenes</div>
                    <div className="flex items-end gap-1.5 h-24">
                      {a.compromiso.slice(0, 12).map((m) => {
                        const max = Math.max(...a.compromiso.slice(0, 12).map((x) => x.totalBase))
                        return (
                          <div key={m.mes} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-1" title={`${monthLabel(m.mes)}: ${m.cantidad} cuota${m.cantidad !== 1 ? 's' : ''}`}>
                            <div className="w-full rounded-t-md bg-primary/70" style={{ height: `${Math.max((m.totalBase / max) * 100, 6)}%` }} />
                            <span className="text-[10px] text-muted-2">{mesCorto(m.mes)}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-2 text-[11px] text-muted">
                      Próximo mes: <b className="text-foreground tnum"><MoneyText amount={a.compromiso[0].totalBase} currency={base} /></b> en {a.compromiso[0].cantidad} cuota{a.compromiso[0].cantidad !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                {a.cuotas.map((c, k) => {
                  const cat = c.categoria ? getCatFromSettings(c.categoria, s) : undefined
                  return (
                    <Fila key={k} titulo={c.comercio}
                      meta={<>{c.emisor} · cuota {c.actual} de {c.total} · {cat?.nombre ?? 'sin categoría'}</>}
                      derecha={<>
                        <div className="font-semibold tnum"><MoneyText amount={c.montoCuota} currency={c.moneda} /></div>
                        <div className="text-[11px] text-muted tnum">
                          {c.restantes === 0 ? 'última cuota' : <>termina {monthLabel(c.finMes)} · restan <MoneyText amount={c.restante} currency={c.moneda} /></>}
                        </div>
                      </>} />
                  )
                })}
              </Seccion>
            )}

            {a.cargos.items.length > 0 && (
              <Seccion icon={Landmark} titulo="Impuestos, intereses y comisiones"
                sub={<>Lo que cobra el banco además de los consumos: <MoneyText amount={a.cargos.totalBase} currency={base} /> ({a.cargos.pctDelTotal.toFixed(1)}% de lo cobrado)</>} delay={0.24}>
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {a.cargos.porTipo.map((t) => (
                    <div key={t.tipo} className="rounded-xl bg-surface-2 px-3 py-2">
                      <div className="eyebrow !text-[10px]">{ETIQUETA_CARGO[t.tipo].plural}</div>
                      <div className="mt-1.5 text-sm font-semibold tnum"><MoneyText amount={t.totalBase} currency={base} /></div>
                      <div className="text-[11px] text-muted">{t.cantidad} {t.cantidad === 1 ? 'renglón' : 'renglones'}</div>
                    </div>
                  ))}
                </div>
                {a.cargos.items.map((c, k) => (
                  <Fila key={k} titulo={c.descripcion} meta={ETIQUETA_CARGO[c.tipo].singular}
                    derecha={<div className="font-semibold tnum text-expense"><MoneyText amount={c.montoBase} currency={base} /></div>} />
                ))}
              </Seccion>
            )}
          </div>
        </>
      )}

      <Modal
        open={r.subida.paso === 'revisar' || r.subida.paso === 'guardando'}
        onClose={r.descartar}
        title="Revisar resumen"
        description="Verifique que los datos sean correctos antes de guardar."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={r.descartar}>Descartar</Button>
            <Button onClick={r.confirmar} disabled={r.subida.paso === 'guardando'}>
              {r.subida.paso === 'guardando' ? 'Guardando…' : 'Guardar resumen'}
            </Button>
          </div>
        }
      >
        {(r.subida.paso === 'revisar' || r.subida.paso === 'guardando') && <Revision resumen={r.subida.resumen} reemplaza={r.subida.reemplaza} s={s} />}
      </Modal>
    </PageScroll>
  )
}

function EstadoVacio({ onSubir, error }: { onSubir: () => void; error: string | null }) {
  return (
    <Card className="px-8 py-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-brand text-white inline-flex items-center justify-center shadow-card-md">
        <FileText className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Analice sus resúmenes</h3>
      <p className="mt-2 text-sm text-muted max-w-lg mx-auto">
        Suba el resumen de la tarjeta o de la cuenta (PDF, Excel .xlsx o CSV). La IA extrae cada renglón y la app detecta
        suscripciones, gastos hormiga, cuotas, cargos bancarios y consumos que no están cargados.
      </p>
      <p className="mt-1 text-xs text-muted-2">Para detectar suscripciones con confianza conviene subir los últimos 3 meses.</p>
      {error && <p className="mt-3 text-xs text-expense">No se pudieron leer los resúmenes guardados: {error}</p>}
      <Button className="mt-6" onClick={onSubir}><Upload className="h-4 w-4" /> Subir el primero</Button>
    </Card>
  )
}

function ResumenChip({ r, onBorrar }: { r: Resumen; onBorrar: () => void }) {
  return (
    <span className="group inline-flex items-center gap-2 rounded-xl bg-surface-2 pl-3 pr-1.5 py-1.5 text-xs">
      {r.tipo === 'tarjeta' ? <CreditCard className="h-3.5 w-3.5 text-primary" /> : <Landmark className="h-3.5 w-3.5 text-primary" />}
      <span className="font-semibold">{r.emisor}</span>
      <span className="text-muted-2">{r.items.length}</span>
      <button onClick={onBorrar} title="Eliminar resumen" aria-label={`Eliminar resumen ${r.emisor}`}
        className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-muted-2 hover:text-expense hover:bg-expense-soft transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

const KPI_TONES = {
  primary: 'bg-primary/12 text-primary', warning: 'bg-unassigned-soft text-unassigned',
  expense: 'bg-expense-soft text-expense', neutral: 'bg-surface-2 text-muted',
}

function Kpi({ icon: Icon, tone, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>; tone: keyof typeof KPI_TONES; label: string; value: React.ReactNode; sub: string
}) {
  return (
    <div className="rounded-2xl bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={cn('h-7 w-7 rounded-lg inline-flex items-center justify-center', KPI_TONES[tone])}><Icon className="h-3.5 w-3.5" /></span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold tnum truncate">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  )
}

function Seccion({ icon: Icon, titulo, sub, delay, children }: {
  icon: React.ComponentType<{ className?: string }>; titulo: string; sub: React.ReactNode; delay?: number; children: React.ReactNode
}) {
  return (
    <Card delay={delay} className="px-6 py-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="h-9 w-9 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{titulo}</div>
          <div className="text-xs text-muted mt-0.5">{sub}</div>
        </div>
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </Card>
  )
}

function Fila({ titulo, meta, derecha }: { titulo: string; meta: React.ReactNode; derecha: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{titulo}</div>
        <div className="truncate text-[11.5px] text-muted-2">{meta}</div>
      </div>
      <div className="text-right text-sm shrink-0">{derecha}</div>
    </div>
  )
}

function Vacio({ texto, ok }: { texto: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted">
      {ok ? <CheckCircle2 className="h-4 w-4 text-income" /> : <TrendingUp className="h-4 w-4 text-muted-2" />}
      {texto}
    </div>
  )
}

function FilaNoCargado({ item, s, onCargar }: { item: ResumenItem; s: Settings; onCargar: () => Promise<void> }) {
  const cat = item.categoria ? getCatFromSettings(item.categoria, s) : undefined
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="h-8 w-8 rounded-lg inline-flex items-center justify-center shrink-0"
          style={{ background: `${cat?.color ?? '#94a3b8'}22`, color: cat?.color ?? '#94a3b8' }}>
          <CategoryIcon cat={cat ?? { id: item.categoria ?? 'otros' }} size={14} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.comercio}</div>
          <div className="truncate text-[11.5px] text-muted-2">{fechaCorta(item.fecha)} · {cat?.nombre ?? 'sin categoría'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tnum text-expense"><MoneyText amount={item.monto} currency={item.moneda} /></span>
        <Button size="sm" variant="secondary" onClick={onCargar} title="Crear el egreso en la app">
          <Plus className="h-3.5 w-3.5" /> Cargar
        </Button>
      </div>
    </div>
  )
}

function Revision({ resumen, reemplaza, s }: { resumen: Resumen; reemplaza: boolean; s: Settings }) {
  const gastos = resumen.items.filter((i) => i.monto > 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Dato label="Emisor" value={resumen.emisor} />
        <Dato label="Período" value={mesLabel(resumen.periodo)} />
        <Dato label="Total a pagar" value={resumen.total !== null ? <MoneyText amount={resumen.total} currency={resumen.moneda} /> : '—'} />
      </div>
      {reemplaza && (
        <div className="rounded-xl bg-unassigned-tint px-3 py-2 text-xs text-unassigned font-medium">
          Ya hay un resumen de {resumen.emisor} para {mesLabel(resumen.periodo)}: se va a reemplazar.
        </div>
      )}
      <div className="text-xs text-muted">{resumen.items.length} renglones · {gastos.length} gastos</div>
      <div className="max-h-[45vh] overflow-y-auto rounded-xl bg-surface-2 divide-y divide-hairline">
        {resumen.items.map((i, k) => {
          const cat = i.categoria ? getCatFromSettings(i.categoria, s) : undefined
          return (
            <div key={k} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-3 py-2 text-[12.5px]">
              <span className="text-muted-2 tnum">{fechaCorta(i.fecha)}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.comercio}</span>
                <span className="block truncate text-[11px] text-muted-2">
                  {i.descripcion}{i.cuotaTotal ? ` · cuota ${i.cuotaActual}/${i.cuotaTotal}` : ''}{cat ? ` · ${cat.nombre}` : ''}
                </span>
              </span>
              <span className={cn('tnum font-semibold', i.monto < 0 ? 'text-income' : 'text-foreground')}>
                <MoneyText amount={i.monto} currency={i.moneda} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Dato({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="eyebrow !text-[10px]">{label}</div>
      <div className="mt-1.5 text-sm font-semibold truncate">{value}</div>
    </div>
  )
}
