'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  Upload, FileText, Repeat, Bug, Store, CreditCard, Landmark, AlertCircle, Trash2,
  Plus, Sparkles, TrendingUp, Loader2, CheckCircle2, CalendarClock, Megaphone, PieChart, Tags, Target, Percent, GitCompareArrows, ListChecks,
} from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useResumenes } from '@finanzas/core/lib/useResumenes'
import { categoriasDeGasto, usuarioId } from '@finanzas/core/lib/resumenes'
import { GrupoComercio } from '@finanzas/core/lib/comercioReglas'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { addCompraCuotas, deleteCompraCuotas, restoreCompraCuotas, updateCompraCuotas } from '@finanzas/core/lib/cuotas'
import { offerUndo } from '@finanzas/core/lib/undo'
import { getCatFromSettings, monthLabel } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency, Resumen, ResumenItem, Settings, Tarjeta, Transaction } from '@finanzas/core/types'
import { toBase } from '@finanzas/core/lib/currency'
import { AnalisisFinanciacion, Comparativa, EstadoMeta, Variacion } from '@finanzas/core/lib/resumenExtras'
import type { ConciliacionResumen } from '@finanzas/core/lib/useResumenes'
import { CompromisoMes, ETIQUETA_CARGO, conciliacion, mesCorto, montoCorto } from '@finanzas/core/lib/resumenAnalisis'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import ProgressBar from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/MoneyText'
import { PageScroll } from '@/components/shell/PageScroll'
import { cn } from '@finanzas/core/lib/utils'

const ACCEPT = '.pdf,.csv,.txt,.xlsx,application/pdf,text/csv'

/** "octubre de 2026" → "Octubre de 2026" */
const mesLabel = (p: string) => { const l = monthLabel(p); return l.charAt(0).toUpperCase() + l.slice(1) }

const fechaCorta = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

const pctFmt = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`

export default function ResumenesPage() {
  const s = (useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase, user } = useAuthStore()
  const base = monedaBase as Currency
  const r = useResumenes(s, base, usuarioId(user))
  const inputRef = useRef<HTMLInputElement>(null)
  const [cuotaManual, setCuotaManual] = useState<CompraCuotas | 'nueva' | null>(null)
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
              <Kpi icon={Bug} tone="warning" label="Gastos hormiga" value={<MoneyText amount={a.hormiga.totalBase} currency={base} />} sub={`${a.hormiga.pctDelPeriodo.toFixed(1)}% del mes · ${a.hormiga.habitos.length} hábitos`} />
              <Kpi icon={CreditCard} tone="expense" label="Cuotas del próximo resumen" value={<MoneyText amount={a.compromiso[0]?.totalBase ?? 0} currency={base} />}
                sub={a.compromiso[0]?.cantidad != null ? `${a.compromiso[0].cantidad} cuotas · ya comprometido` : 'ya comprometido'} />
              <Kpi icon={Landmark} tone="neutral" label="Impuestos y cargos" value={<MoneyText amount={a.cargos.totalBase} currency={base} />} sub={`${a.cargos.items.length} renglones`} />
            </div>
          </Card>

          {a.resumenes.filter((res) => res.detalle).map((res) => <EstadoCuenta key={res.id} r={res} />)}

          {r.conciliaciones.map((c) => (
            <ConciliacionSeccion key={c.resumen.id} c={c} tarjetas={s.tarjetas ?? []} s={s}
              onElegir={(id) => r.elegirTarjeta(c.resumen.emisor, id)}
              onAgregar={(items, t) => r.agregarFaltantes(items, t)}
              onCargos={(t) => r.agregarCargos(c.resumen, c.resultado!.cargos, t)}
              onPasar={(txs, t) => r.pasarGastos(txs, t)} />
          ))}

          {r.extras && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <MetasSeccion metas={r.extras.metas} base={base} />
              <ComparativaSeccion c={r.extras.comparativa} base={base} />
              <FinanciacionSeccion f={r.extras.financiacion} base={base} />
            </div>
          )}

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

            <Seccion icon={Bug} titulo="Gastos hormiga"
              sub={<>Hábitos ({a.hormiga.minCompras}+ compras en el mes, propinas incluidas) y compras sueltas de hasta USD {a.hormiga.topeUsd} (≈ <MoneyText amount={a.hormiga.topeBase} currency={base} />)</>}
              delay={0.12}>
              {a.hormiga.totalBase === 0 ? <Vacio texto="Sin hábitos ni compras chicas este mes." ok /> : (
                <>
                  <div className="mb-3 rounded-xl bg-unassigned-tint px-3 py-2.5 text-sm">
                    Suman <b><MoneyText amount={a.hormiga.totalBase} currency={base} /></b>: el <b>{a.hormiga.pctDelPeriodo.toFixed(1)}%</b> del gasto del mes
                    {' '}(≈ <MoneyText amount={a.hormiga.anualBase} currency={base} /> al año).
                  </div>
                  {a.hormiga.habitos.length > 0 && <div className="eyebrow !text-[10px] pt-1">Hábitos</div>}
                  {a.hormiga.habitos.map((h) => (
                    <Fila key={h.clave} titulo={h.comercio}
                      meta={<>{h.veces} compras · ticket promedio <MoneyText amount={h.ticketBase} currency={base} /> · {h.pct.toFixed(1)}% del mes</>}
                      derecha={<>
                        <div className="font-semibold tnum"><MoneyText amount={h.totalBase} currency={base} /></div>
                        <div className="text-[11px] text-muted tnum"><MoneyText amount={h.anualBase} currency={base} />/año</div>
                      </>} />
                  ))}
                  {a.hormiga.chicas.cantidad > 0 && (
                    <>
                      <div className="eyebrow !text-[10px] pt-3">Compras chicas sueltas · {a.hormiga.chicas.cantidad} por <MoneyText amount={a.hormiga.chicas.totalBase} currency={base} /></div>
                      {a.hormiga.chicas.comercios.slice(0, 6).map((c) => (
                        <Fila key={c.clave} titulo={c.comercio} meta={`${c.veces} ${c.veces === 1 ? 'compra' : 'compras'}`}
                          derecha={<div className="font-semibold tnum"><MoneyText amount={c.totalBase} currency={base} /></div>} />
                      ))}
                    </>
                  )}
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

            <Seccion icon={CreditCard} titulo="Cuotas en curso"
                sub={<>Falta pagar <MoneyText amount={a.cuotas.reduce((t, c) => t + toBase(c.restante, c.moneda, base, s), 0)} currency={base} />
                  {a.libreDesde && <> · la última cuota vence en <b className="text-foreground">{monthLabel(a.libreDesde)}</b></>}</>} delay={0.2}>
                <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                  <span>¿Una cuota que no figura en ningún resumen (préstamo, Mercado Pago…)?</span>
                  <Button size="sm" variant="secondary" onClick={() => setCuotaManual('nueva')}><Plus className="h-3.5 w-3.5" /> Agregar cuota</Button>
                </div>
                {a.compromiso.length > 0 && <CompromisoChart meses={a.compromiso} resto={a.compromisoResto} base={base} />}
                {a.manualesDuplicadas.length > 0 && (
                  <div className="mb-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                    {a.manualesDuplicadas.map((d) => d.manual.descripcion).join(', ')} también {a.manualesDuplicadas.length === 1 ? 'está cargada' : 'están cargadas'} a mano:
                    se {a.manualesDuplicadas.length === 1 ? 'cuenta' : 'cuentan'} una sola vez, con el dato del resumen.
                  </div>
                )}
                {a.cuotas.map((c, k) => {
                  const cat = c.categoria ? getCatFromSettings(c.categoria, s) : undefined
                  const fila = (
                    <Fila key={k} titulo={c.comercio}
                      meta={<>
                        {c.manual && <span className="mr-1.5 rounded-full bg-primary/12 px-1.5 py-px font-semibold text-primary">manual</span>}
                        {c.refinanciacion && <span className="mr-1.5 rounded-full bg-unassigned-soft px-1.5 py-px font-semibold text-unassigned">refinanciación</span>}
                        {c.emisor} · {c.actual === 0 ? `empieza en ${monthLabel(c.manual!.primerMes)}` : `cuota ${c.actual} de ${c.total}`}
                        {c.refinanciacion ? ' · incluye intereses' : !c.manual && <> · {cat?.nombre ?? 'sin categoría'}</>}
                      </>}
                      derecha={<>
                        <div className="font-semibold tnum"><MoneyText amount={c.montoCuota} currency={c.moneda} /></div>
                        <div className="text-[11px] text-muted tnum">
                          {c.restantes === 0 ? 'última cuota' : <>termina {monthLabel(c.finMes)} · restan <MoneyText amount={c.restante} currency={c.moneda} /></>}
                        </div>
                      </>} />
                  )
                  return c.manual ? (
                    <button key={k} type="button" onClick={() => setCuotaManual(c.manual!)} title="Editar cuota manual"
                      className="block w-full text-left rounded-lg hover:bg-surface-2 -mx-2 px-2 transition-colors">{fila}</button>
                  ) : fila
                })}
                {a.cuotas.length === 0 && <Vacio texto="No hay cuotas en curso en este período." ok />}
            </Seccion>

            <Seccion icon={PieChart} titulo="Gasto por categoría" sub={a.porTitular.length > 0 ? 'Y por titular o adicional' : 'Consumos del período según la categoría sugerida'} delay={0.22}>
              {a.porCategoria.slice(0, 10).map((c) => {
                const cat = c.clave ? getCatFromSettings(c.clave, s) : undefined
                return (
                  <div key={c.clave ?? '-'} className="py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{cat?.nombre ?? 'Sin categoría'}<span className="ml-2 text-xs text-muted-2">{c.pct.toFixed(1)}%</span></span>
                      <span className="tnum font-semibold"><MoneyText amount={c.totalBase} currency={base} /></span>
                    </div>
                    <ProgressBar value={c.pct} className="mt-1.5" height={5} color={cat?.color ?? 'var(--muted-2)'} />
                  </div>
                )
              })}
              {a.porTitular.length > 0 && (
                <div className="pt-3 grid grid-cols-2 gap-2">
                  {a.porTitular.map((t) => (
                    <div key={t.clave ?? '-'} className="rounded-xl bg-surface-2 px-3 py-2">
                      <div className="eyebrow !text-[10px] truncate">{t.clave ?? 'Sin titular'}</div>
                      <div className="mt-1.5 text-sm font-semibold tnum"><MoneyText amount={t.totalBase} currency={base} /></div>
                      <div className="text-[11px] text-muted">{t.pct.toFixed(1)}% del gasto</div>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            <Seccion icon={Tags} titulo="Comercios y categorías"
              sub="Cambie el nombre o la categoría: se aplica a todos los resúmenes y a los próximos" delay={0.23}>
              <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
                {r.comercios.map((g) => (
                  <EditorComercio key={g.clave} g={g} s={s} onCambiar={(nombre, categoria) => r.recategorizar(g.clave, nombre, categoria)}
                    etiquetaNuevo="sin revisar" />
                ))}
              </div>
            </Seccion>

            {a.cargos.items.length > 0 && (
              <Seccion icon={Landmark} titulo="Impuestos, intereses y comisiones"
                sub={<>Lo que cobra el banco además de los consumos: <MoneyText amount={a.cargos.totalBase} currency={base} /> ({a.cargos.pctDelTotal.toFixed(1)}% de lo cobrado)</>} delay={0.24}>
                <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
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
                    derecha={<div className={cn('font-semibold tnum', c.montoBase < 0 ? 'text-income' : 'text-expense')}><MoneyText amount={c.montoBase} currency={base} /></div>} />
                ))}
                {a.cargos.porTipo.some((t) => t.tipo === 'percepcion') && (
                  <div className="pt-2.5 text-[11.5px] text-muted">
                    Las percepciones (RG 5617) son a cuenta de Ganancias o Bienes Personales: se pueden computar o pedir la devolución a ARCA.
                  </div>
                )}
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
        {(r.subida.paso === 'revisar' || r.subida.paso === 'guardando') && (
          <Revision resumen={r.subida.resumen} reemplaza={r.subida.reemplaza} s={s}
            grupos={r.gruposRevision} onEditar={r.editarEnRevision} />
        )}
      </Modal>
      <CuotaManualModal value={cuotaManual} creadoPor={usuarioId(user)} onClose={() => setCuotaManual(null)} />
    </PageScroll>
  )
}

/** Alta y edición de una cuota que no figura en ningún resumen subido */
function CuotaManualModal({ value, creadoPor, onClose }: { value: CompraCuotas | 'nueva' | null; creadoPor: string; onClose: () => void }) {
  const editando = value && value !== 'nueva' ? value : null
  return (
    <Modal open={value !== null} onClose={onClose} title={editando ? 'Editar cuota' : 'Agregar cuota'}
      description="Para cuotas que no aparecen en los resúmenes que sube (préstamos, Mercado Pago, otra tarjeta).">
      {value !== null && <FormCuota key={editando?.id ?? 'nueva'} editando={editando} creadoPor={creadoPor} onClose={onClose} />}
    </Modal>
  )
}

function FormCuota({ editando, creadoPor, onClose }: { editando: CompraCuotas | null; creadoPor: string; onClose: () => void }) {
  const [descripcion, setDescripcion] = useState(editando?.descripcion ?? '')
  const [tarjeta, setTarjeta] = useState(editando?.tarjeta ?? '')
  const [moneda, setMoneda] = useState<Currency>(editando?.moneda ?? 'ARS')
  const [monto, setMonto] = useState(editando ? String(editando.montoCuota) : '')
  const [total, setTotal] = useState(editando ? String(editando.totalCuotas) : '')
  const [primerMes, setPrimerMes] = useState(editando?.primerMes ?? new Date().toISOString().slice(0, 7))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const montoN = parseFloat(monto.replace(/\./g, '').replace(',', '.'))
  const totalN = parseInt(total, 10)
  const valido = descripcion.trim() !== '' && montoN > 0 && totalN >= 1 && /^\d{4}-\d{2}$/.test(primerMes)

  async function guardar() {
    if (!valido) return
    setGuardando(true)
    setError(null)
    try {
      const data = { descripcion: descripcion.trim(), tarjeta: tarjeta.trim(), moneda, montoCuota: montoN, totalCuotas: totalN, primerMes, creadoPor: editando?.creadoPor ?? creadoPor }
      if (editando?.id) await updateCompraCuotas(editando.id, data)
      else await addCompraCuotas(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!editando?.id) return
    setGuardando(true)
    try {
      await deleteCompraCuotas(editando.id)
      offerUndo(`"${editando.descripcion}" eliminada`, async () => { await restoreCompraCuotas(editando) })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="eyebrow block mb-1.5">Descripción</label>
        <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Préstamo auto, heladera…" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="eyebrow block mb-1.5">Dónde (opcional)</label>
          <Input value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} placeholder="Mercado Pago" />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Moneda</label>
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
            <option value="ARS">ARS</option><option value="USD">USD</option><option value="COP">COP</option>
          </Select>
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Monto de cada cuota</label>
          <Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="100.000" />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Cantidad de cuotas</label>
          <Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="12" />
        </div>
        <div className="col-span-2">
          <label className="eyebrow block mb-1.5">Mes de la primera cuota</label>
          <Input type="month" value={primerMes} onChange={(e) => setPrimerMes(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-xs text-expense">{error}</p>}
      <div className="flex justify-between gap-2 pt-1">
        {editando ? <Button variant="ghost" onClick={borrar} disabled={guardando}><Trash2 className="h-4 w-4" /> Eliminar</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido || guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
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
        suscripciones, gastos hormiga, cuotas y cargos bancarios.
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

const signo = (n: number) => (n > 0 ? '+' : '')
const pctTxt = (n: number | null) => (n === null ? '—' : `${signo(n)}${n.toFixed(0)}%`)

function ConciliacionSeccion({ c, tarjetas, s, onElegir, onAgregar, onCargos, onPasar }: {
  c: ConciliacionResumen; tarjetas: Tarjeta[]; s: Settings
  onElegir: (tarjetaId: string) => void
  onAgregar: (items: ResumenItem[], t: Tarjeta) => Promise<void>
  onCargos: (t: Tarjeta) => Promise<void>
  onPasar: (txs: Transaction[], t: Tarjeta) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const correr = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const res = c.resultado
  const t = c.tarjeta
  const cat = (id: string | null) => (id ? getCatFromSettings(id, s)?.nombre : undefined) ?? 'sin categoría'
  const totalCargos = res?.cargos.reduce((a, x) => a + x.monto, 0) ?? 0
  const sub = res ? <>Del {fechaCorta(res.desde)} al {fechaCorta(res.hasta)} · solo gastos con tarjeta de crédito (efectivo, débito y transferencias no figuran en el resumen)</> : 'Gastos registrados con la tarjeta contra los consumos del resumen'
  return (
    <Seccion icon={ListChecks} titulo={`Contraste con lo registrado · ${c.resumen.emisor}`} sub={sub} delay={0.025}>
      {tarjetas.length === 0 ? (
        <Vacio texto="Cree la tarjeta en Ajustes → Tarjetas de crédito para contrastar el resumen con sus gastos." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 py-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              Tarjeta en la app
              <Select value={t?.id ?? ''} onChange={(e) => onElegir(e.target.value)} className="!h-8 !w-auto">
                {!t && <option value="">Elegir…</option>}
                {tarjetas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </Select>
            </label>
            {res && (
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-income-soft px-2 py-0.5 font-semibold text-income">{res.coinciden.length} coinciden</span>
                <span className="rounded-full bg-expense-soft px-2 py-0.5 font-semibold text-expense">{res.faltan.length} sin registrar</span>
                <span className="rounded-full bg-unassigned-soft px-2 py-0.5 font-semibold text-unassigned">{res.otroMedio.length} con otro medio</span>
              </div>
            )}
          </div>
          {t && !res && <div className="py-4 text-sm text-muted">Cargando movimientos…</div>}
          {t && res && (
            <>
              {res.otroMedio.length > 0 && (
                <div className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="eyebrow !text-[10px]">Registrados con otro medio · agregarlos los duplicaría</div>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => correr(() => onPasar(res.otroMedio.map((x) => x.tx), t))}>Pasar todos a {t.nombre}</Button>
                  </div>
                  {res.otroMedio.map(({ item, tx }) => (
                    <Fila key={tx.id} titulo={tx.descripcion || item.comercio} meta={<>{fechaCorta(item.fecha)} · en el resumen: {item.comercio}</>}
                      derecha={<span className="font-semibold tnum"><MoneyText amount={item.monto} currency={item.moneda} /></span>} />
                  ))}
                </div>
              )}
              {res.faltan.length > 0 && (
                <div className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="eyebrow !text-[10px]">En el resumen, sin registrar</div>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => correr(() => onAgregar(res.faltan, t))}><Plus className="h-3.5 w-3.5" /> Agregar todos</Button>
                  </div>
                  {res.faltan.map((i, k) => (
                    <Fila key={i.id ?? k} titulo={i.comercio} meta={<>{fechaCorta(i.fecha)} · {cat(i.categoria)}</>}
                      derecha={<span className="flex items-center gap-2">
                        <span className="font-semibold tnum"><MoneyText amount={i.monto} currency={i.moneda} /></span>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => correr(() => onAgregar([i], t))} title="Agregar como gasto con la tarjeta"><Plus className="h-3.5 w-3.5" /></Button>
                      </span>} />
                  ))}
                </div>
              )}
              {res.cargos.length > 0 && (
                <div className="my-2 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="text-sm">
                    <span className="font-medium">Intereses, impuestos y comisiones</span>
                    <span className="ml-2 text-xs text-muted">{res.cargos.length} renglones · <MoneyText amount={totalCargos} currency={c.resumen.moneda} /></span>
                  </div>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => correr(() => onCargos(t))}>Agregar como gasto</Button>
                </div>
              )}
              {res.sobran.length > 0 && (
                <div className="py-2">
                  <div className="eyebrow !text-[10px]">Registrados con {t.nombre} que no aparecen · revisar duplicados, otra tarjeta o imputación tardía</div>
                  {res.sobran.map((tx) => (
                    <Fila key={tx.id} titulo={tx.descripcion || 'Sin descripción'} meta={fechaCorta(tx.fecha.toDate().toISOString().slice(0, 10))}
                      derecha={<span className="font-semibold tnum"><MoneyText amount={tx.monto} currency={tx.moneda} /></span>} />
                  ))}
                </div>
              )}
              {res.proximo.length > 0 && (
                <div className="py-2 text-xs text-muted">
                  {res.proximo.length} gasto{res.proximo.length !== 1 ? 's' : ''} con {t.nombre} posterior{res.proximo.length !== 1 ? 'es' : ''} al cierre: entra{res.proximo.length !== 1 ? 'n' : ''} en el próximo resumen.
                </div>
              )}
              {res.faltan.length === 0 && res.otroMedio.length === 0 && res.sobran.length === 0 && (
                <Vacio texto="Todo lo registrado con la tarjeta coincide con el resumen." ok />
              )}
            </>
          )}
        </>
      )}
    </Seccion>
  )
}

function MetasSeccion({ metas, base }: { metas: EstadoMeta[]; base: Currency }) {
  return (
    <Seccion icon={Target} titulo="Metas" sub="Topes mensuales configurados en Ajustes → Metas de resúmenes" delay={0.02}>
      {metas.length === 0 ? (
        <div className="py-3 text-sm text-muted">
          Todavía no hay metas. Configúrelas en <Link href="/ajustes" className="font-semibold text-primary">Ajustes → Metas de resúmenes</Link> (por ejemplo, delivery y Uber, o cero intereses).
        </div>
      ) : metas.map((m) => (
        <div key={m.meta.id} className="py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{m.meta.nombre}</span>
            <span className={cn('shrink-0 rounded-full px-2 py-px text-[11px] font-semibold', m.cumple ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense')}>
              {m.cumple ? 'Cumplida' : 'Excedida'}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted tnum">
            <b className="text-foreground"><MoneyText amount={m.actualBase} currency={base} /></b> de <MoneyText amount={m.topeBase} currency={base} />
            {!m.cumple && <> · se pasó por <MoneyText amount={m.actualBase - m.topeBase} currency={base} /></>}
          </div>
          <ProgressBar value={m.topeBase > 0 ? m.pct : 100} className="mt-1.5" height={6} color={m.cumple ? 'var(--income)' : 'var(--expense)'} />
          {m.historial.length > 1 && (
            <div className="mt-2 flex gap-1">
              {m.historial.map((h) => (
                <span key={h.periodo} title={`${monthLabel(h.periodo)}: ${montoCorto(h.valorBase)}`}
                  className={cn('flex-1 rounded-md py-0.5 text-center text-[10px] font-semibold', h.cumple ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense')}>
                  {mesCorto(h.periodo).split(' ')[0]}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 text-[11px] text-muted-2">
            Cumplida {m.cumplidos} de {m.historial.length} {m.historial.length === 1 ? 'mes' : 'meses'}
            {m.ahorroMensualBase !== null && m.ahorroMensualBase > 0 && <> · cumplirla libera ≈ <MoneyText amount={m.ahorroMensualBase} currency={base} />/mes contra su promedio</>}
          </div>
        </div>
      ))}
    </Seccion>
  )
}

function ComparativaSeccion({ c, base }: { c: Comparativa | null; base: Currency }) {
  if (!c) {
    return (
      <Seccion icon={GitCompareArrows} titulo="Contra meses anteriores" sub="Variación de consumos, categorías y comercios" delay={0.03}>
        <Vacio texto="Suba el resumen del mes anterior de la misma tarjeta para comparar." />
      </Seccion>
    )
  }
  const t = c.total
  const ref = c.previos.length === 1 ? monthLabel(c.previos[0]) : `promedio de ${c.previos.map((p) => mesCorto(p)).join(', ')}`
  const lista = (titulo: string, xs: Variacion[]) => xs.length > 0 && (
    <>
      <div className="eyebrow !text-[10px] pt-3">{titulo}</div>
      {xs.slice(0, 4).map((v) => (
        <Fila key={v.clave ?? '-'} titulo={v.nombre} meta={<>antes {montoCorto(v.referenciaBase)} · ahora {montoCorto(v.actualBase)}{v.difPct !== null && <> · {pctTxt(v.difPct)}</>}</>}
          derecha={<span className={cn('font-semibold tnum', v.difBase > 0 ? 'text-expense' : 'text-income')}>{signo(v.difBase)}<MoneyText amount={v.difBase} currency={base} /></span>} />
      ))}
    </>
  )
  return (
    <Seccion icon={GitCompareArrows} titulo="Contra meses anteriores" sub={<>Consumos de {c.emisores.join(' y ')} contra {ref}</>} delay={0.03}>
      <div className="py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-semibold tnum"><MoneyText amount={t.actualBase} currency={base} /></span>
          <span className={cn('rounded-full px-2 py-px text-xs font-semibold', (t.vsPromedioPct ?? 0) > 0 ? 'bg-expense-soft text-expense' : 'bg-income-soft text-income')}>{pctTxt(t.vsPromedioPct)}</span>
        </div>
        <div className="text-xs text-muted tnum">
          antes <MoneyText amount={t.promedioBase} currency={base} />
          {c.previos.length > 1 && <> · contra el mes anterior {pctTxt(t.vsAnteriorPct)}</>}
          {base !== 'USD' && t.vsPromedioUsdPct !== null && <> · en dólares {pctTxt(t.vsPromedioUsdPct)}</>}
        </div>
      </div>
      {lista('Categorías que más cambiaron', c.categorias)}
      {lista('Comercios que más subieron', c.subas)}
      {c.nuevos.length > 0 && (
        <>
          <div className="eyebrow !text-[10px] pt-3">Nuevos este mes</div>
          {c.nuevos.slice(0, 4).map((n) => (
            <Fila key={n.comercio} titulo={n.comercio} meta="no aparecía antes" derecha={<span className="font-semibold tnum"><MoneyText amount={n.totalBase} currency={base} /></span>} />
          ))}
        </>
      )}
    </Seccion>
  )
}

function FinanciacionSeccion({ f, base }: { f: AnalisisFinanciacion; base: Currency }) {
  const a = f.actual
  const max = Math.max(...f.historial.map((h) => h.totalBase), 1)
  const tasas = [f.tna !== null && `TNA ${pctFmt(f.tna)}`, f.cftea !== null && `CFTEA con IVA ${pctFmt(f.cftea)}`].filter(Boolean).join(' · ')
  return (
    <Seccion icon={Percent} titulo="Costo de financiarse" sub={tasas || 'Intereses, también los que vienen dentro de las refinanciaciones, más su IVA'} delay={0.035}>
      {a.totalBase > 0 ? (
        <>
          <div className="py-2">
            <div className="text-xl font-semibold tnum text-expense"><MoneyText amount={a.totalBase} currency={base} /></div>
            <div className="text-xs text-muted">
              en intereses e IVA este mes ({a.pctDelResumen.toFixed(1)}% de lo cobrado) · a este ritmo ≈ <MoneyText amount={a.totalBase * 12} currency={base} /> al año
            </div>
          </div>
          {a.interesesBase > 0 && <Fila titulo="Intereses del saldo" meta="renglón del banco" derecha={<span className="font-semibold tnum"><MoneyText amount={a.interesesBase} currency={base} /></span>} />}
          {a.interesEnCuotasBase > 0 && <Fila titulo="Intereses dentro de refinanciaciones" meta="estimado a partir del IVA del 21 %" derecha={<span className="font-semibold tnum"><MoneyText amount={a.interesEnCuotasBase} currency={base} /></span>} />}
          {a.ivaBase > 0 && <Fila titulo="IVA sobre intereses" meta="21 %" derecha={<span className="font-semibold tnum"><MoneyText amount={a.ivaBase} currency={base} /></span>} />}
        </>
      ) : <Vacio texto="Este mes no pagó intereses." ok />}
      {f.siPagaMinimo && (
        <div className="my-2 rounded-xl bg-unassigned-tint px-3 py-2.5 text-sm">
          Si paga solo el mínimo quedan <b><MoneyText amount={f.siPagaMinimo.financiadoBase} currency={base} /></b> financiados al {pctFmt(f.siPagaMinimo.tem)} mensual:
          el mes que viene son ≈ <b><MoneyText amount={f.siPagaMinimo.interesBase} currency={base} /></b> de intereses con IVA. Pagar el total los evita.
        </div>
      )}
      {f.historial.length > 1 && (
        <div className="pt-3">
          <div className="eyebrow !text-[10px] mb-1.5">Por mes</div>
          <div className="flex items-end gap-1.5 h-20">
            {f.historial.map((h) => (
              <div key={h.periodo} className="h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-0.5" title={monthLabel(h.periodo)}>
                <span className="text-[10px] font-semibold text-muted tnum">{h.totalBase > 0 ? montoCorto(h.totalBase) : '0'}</span>
                <div className={cn('w-full rounded-t-md', h.periodo === a.periodo ? 'bg-expense' : 'bg-expense/40')} style={{ height: `${Math.max((h.totalBase / max) * 70, 3)}%` }} />
                <span className="text-[10px] text-muted-2">{mesCorto(h.periodo).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Seccion>
  )
}

const COLOR_TIPO = {
  compras: 'var(--primary)',
  refinanciacion: '#f59e0b',
  manual: 'color-mix(in srgb, var(--primary) 30%, #94a3b8)',
} as const

/** Barras apiladas de lo comprometido mes a mes; clic en una barra muestra su detalle */
function CompromisoChart({ meses, resto, base }: { meses: CompromisoMes[]; resto: { mes: string; totalBase: number } | null; base: Currency }) {
  const [sel, setSel] = useState(0)
  const vis = meses.slice(0, 18)
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
    <div className="mb-3 rounded-xl bg-surface-2 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow !text-[10px]">Cuotas de los próximos resúmenes</div>
        <div className="flex gap-3 text-[10.5px] text-muted">
          {hay.compras && (hay.refinanciacion || hay.manual) && <Leyenda color={COLOR_TIPO.compras} label="Compras" />}
          {hay.refinanciacion && <Leyenda color={COLOR_TIPO.refinanciacion} label="Refinanciación" />}
          {hay.manual && <Leyenda color={COLOR_TIPO.manual} label="Cargadas a mano" />}
        </div>
      </div>
      <div className="mt-2 flex items-end gap-1.5 h-36">
        {vis.map((x, i) => {
          const activo = i === sel
          return (
            <button key={x.mes} type="button" onClick={() => setSel(i)} title={`${monthLabel(x.mes)}: ${montoCorto(x.totalBase)}`}
              className="group h-full flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
              <span className={cn('text-[10px] font-semibold tnum', activo ? 'text-foreground' : 'text-muted-2')}>{montoCorto(x.totalBase)}</span>
              <div className={cn('w-full flex flex-col-reverse rounded-t-md overflow-hidden transition-opacity', activo ? '' : 'opacity-55 group-hover:opacity-80')}
                style={{ height: `${Math.max((x.totalBase / max) * 78, 4)}%` }}>
                {x.comprasBase > 0 && <div style={{ flexGrow: x.comprasBase, background: COLOR_TIPO.compras }} />}
                {x.refinanciacionBase > 0 && <div style={{ flexGrow: x.refinanciacionBase, background: COLOR_TIPO.refinanciacion }} />}
                {x.manualBase > 0 && <div style={{ flexGrow: x.manualBase, background: COLOR_TIPO.manual }} />}
              </div>
              <span className={cn('text-[10px]', activo ? 'font-semibold text-foreground' : 'text-muted-2')}>{mesCorto(x.mes)}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 border-t border-hairline pt-2.5 text-xs text-muted space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            {mesLabel(m.mes)}{sel === 0 && <span className="ml-1.5 text-[11px] font-semibold text-primary">próximo resumen</span>}
            {m.cantidad !== null && <span className="ml-1.5 text-[11px] font-normal text-muted">{m.cantidad} cuota{m.cantidad !== 1 ? 's' : ''}</span>}
          </span>
          <b className="text-sm text-foreground tnum"><MoneyText amount={m.totalBase} currency={base} /></b>
        </div>
        {partes.length > 1 && partes.map((p) => (
          <div key={p.k} className="flex items-center justify-between">
            <Leyenda color={COLOR_TIPO[p.k]} label={p.label} />
            <span className="tnum"><MoneyText amount={p.v} currency={base} /></span>
          </div>
        ))}
        {m.terminan.length > 0 && <div>Última cuota de <b className="text-foreground">{m.terminan.join(', ')}</b>: el mes siguiente baja.</div>}
        {difBanco && <div className="text-unassigned">El banco informa <MoneyText amount={m.bancoBase!} currency={base} /> para este mes.</div>}
        {resto && <div>Desde {monthLabel(resto.mes)}, según el banco: <MoneyText amount={resto.totalBase} currency={base} /> más.</div>}
      </div>
    </div>
  )
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: color }} />{label}</span>
}

function Revision({ resumen, reemplaza, s, grupos, onEditar }: {
  resumen: Resumen; reemplaza: boolean; s: Settings
  grupos: GrupoComercio[]; onEditar: (clave: string, nombre: string, categoria: string | null) => void
}) {
  const gastos = resumen.items.filter((i) => i.monto > 0)
  const nuevos = grupos.filter((g) => g.nuevo)
  const conocidos = grupos.filter((g) => !g.nuevo)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Dato label="Emisor" value={resumen.emisor} />
        <Dato label="Período" value={mesLabel(resumen.periodo)} />
        <Dato label="Total a pagar" value={resumen.total !== null ? <MoneyText amount={resumen.total} currency={resumen.moneda} /> : '—'} />
      </div>
      {resumen.detalle && <Conciliacion r={resumen} />}
      {reemplaza && (
        <div className="rounded-xl bg-unassigned-tint px-3 py-2 text-xs text-unassigned font-medium">
          Ya hay un resumen de {resumen.emisor} para {mesLabel(resumen.periodo)}: se va a reemplazar.
        </div>
      )}
      {nuevos.length > 0 ? (
        <div>
          <div className="text-sm font-semibold">Comercios nuevos ({nuevos.length})</div>
          <div className="text-xs text-muted mb-1">Revise el nombre y la categoría. Lo que elija se aplica solo en los próximos resúmenes.</div>
          <div className="max-h-[38vh] overflow-y-auto">
            {nuevos.map((g) => <EditorComercio key={g.clave} g={g} s={s} onCambiar={(n, c) => onEditar(g.clave, n, c)} />)}
          </div>
        </div>
      ) : grupos.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-income-soft/60 px-3 py-2 text-xs font-medium text-income">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Todos los comercios ya son conocidos: se aplicaron sus nombres y categorías.
        </div>
      )}
      {conocidos.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">
            Comercios conocidos ({conocidos.length}): ver o cambiar
          </summary>
          <div className="mt-1 max-h-[30vh] overflow-y-auto">
            {conocidos.map((g) => <EditorComercio key={g.clave} g={g} s={s} onCambiar={(n, c) => onEditar(g.clave, n, c)} />)}
          </div>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">
          Ver los {resumen.items.length} renglones ({gastos.length} gastos)
        </summary>
      <div className="mt-2 max-h-[45vh] overflow-y-auto rounded-xl bg-surface-2 divide-y divide-hairline">
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
      </details>
    </div>
  )
}

/** Fila editable de un comercio: nombre (se confirma al salir o con Enter) y categoría */
function EditorComercio({ g, s, onCambiar, etiquetaNuevo = 'nuevo' }: {
  g: GrupoComercio; s: Settings; onCambiar: (nombre: string, categoria: string | null) => void; etiquetaNuevo?: string
}) {
  const categorias = categoriasDeGasto(s)
  const confirmarNombre = (v: string) => { if (v.trim() && v.trim() !== g.nombre) onCambiar(v.trim(), g.categoria) }
  return (
    <div className="grid grid-cols-[1fr_200px] items-center gap-3 py-2 border-b border-hairline last:border-0">
      <div className="min-w-0">
        <Input
          key={g.nombre}
          defaultValue={g.nombre}
          aria-label={`Nombre de ${g.nombre}`}
          className="h-9 font-medium"
          onBlur={(e) => confirmarNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <div className="mt-1 truncate text-[11px] text-muted-2 px-1" title={g.descripciones.join(' · ')}>
          {g.nuevo && <span className="mr-1.5 rounded-full bg-primary/12 px-1.5 py-px font-semibold text-primary">{etiquetaNuevo}</span>}
          {g.cantidad}× · <MoneyText amount={g.total} currency={g.moneda} /> · {g.descripciones.join(' · ')}
        </div>
      </div>
      <Select
        value={g.categoria ?? ''}
        aria-label={`Categoría de ${g.nombre}`}
        className={cn('h-9', !g.categoria && 'text-muted')}
        onChange={(e) => onCambiar(g.nombre, e.target.value || null)}
      >
        <option value="">Sin categoría</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre.split(' › ').pop()}</option>)}
      </Select>
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

function Conciliacion({ r }: { r: Resumen }) {
  const c = conciliacion(r)
  const difs = ([['ARS', c.ars], ['USD', c.usd]] as const).filter(([, v]) => v !== null && v !== 0)
  if (c.ars === null && c.usd === null) return null
  return difs.length === 0 ? (
    <div className="flex items-center gap-2 rounded-xl bg-income-soft/60 px-3 py-2 text-xs font-medium text-income">
      <CheckCircle2 className="h-4 w-4 shrink-0" /> Los renglones cuadran con el saldo del resumen: no falta ni sobra nada.
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-xl bg-unassigned-tint px-3 py-2 text-xs font-medium text-unassigned">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>
        Los renglones no cuadran con el saldo ({difs.map(([m, v]) => <MoneyText key={m} amount={v!} currency={m} />).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, ' y ', x] : [x]), [])} de diferencia):
        puede faltar o estar repetido algún renglón.
      </span>
    </div>
  )
}

function EstadoCuenta({ r }: { r: Resumen }) {
  const d = r.detalle!
  const saldo = d.saldoActualArs ?? r.total
  const usoLimite = saldo !== null && d.limiteCompra ? (saldo / d.limiteCompra) * 100 : null
  const tasas = ([['TNA', d.tna], ['TEM', d.tem], ['TEA', d.tea], ['CFTEA c/IVA', d.cftea]] as const).filter(([, v]) => v !== null)
  return (
    <Card delay={0.02} className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="h-9 w-9 rounded-xl bg-primary/12 text-primary inline-flex items-center justify-center shrink-0"><CalendarClock className="h-4 w-4" /></span>
          <div>
            <div className="text-[15px] font-semibold">Estado de cuenta · {r.emisor}</div>
            <div className="text-xs text-muted mt-0.5">
              {d.producto && <>{d.producto} · </>}
              {d.fechaCierre && <>cerró el {fechaCorta(d.fechaCierre)}</>}
              {d.fechaVencimiento && <> · vence el <b className="text-foreground">{fechaCorta(d.fechaVencimiento)}</b></>}
              {d.proximoCierre && <> · próximo cierre {fechaCorta(d.proximoCierre)}</>}
              {d.proximoVencimiento && <> (vence {fechaCorta(d.proximoVencimiento)})</>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dato label="Saldo a pagar" value={saldo !== null ? <MoneyText amount={saldo} currency={r.moneda} /> : '—'} />
        <Dato label="Saldo en dólares" value={d.saldoActualUsd !== null ? <MoneyText amount={d.saldoActualUsd} currency="USD" /> : '—'} />
        <Dato label="Pago mínimo" value={d.pagoMinimo !== null ? <MoneyText amount={d.pagoMinimo} currency={r.moneda} /> : '—'} />
        <Dato label="Saldo anterior" value={d.saldoAnteriorArs !== null ? <MoneyText amount={d.saldoAnteriorArs} currency={r.moneda} /> : '—'} />
      </div>

      {usoLimite !== null && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Uso del límite de compra (<MoneyText amount={d.limiteCompra!} currency={r.moneda} />)</span>
            <span className="font-semibold tnum">{usoLimite.toFixed(0)}%</span>
          </div>
          <ProgressBar value={Math.min(usoLimite, 100)} className="mt-1.5" height={6} color={usoLimite > 80 ? 'var(--expense)' : usoLimite > 50 ? 'var(--unassigned)' : 'var(--primary)'} />
        </div>
      )}

      {(tasas.length > 0 || d.tipoCambio !== null) && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {tasas.map(([k, v]) => (
            <span key={k} className="rounded-full bg-surface-2 px-2.5 py-1"><span className="text-muted">{k}</span> <b className="tnum">{pctFmt(v!)}</b></span>
          ))}
          {d.tipoCambio !== null && <span className="rounded-full bg-surface-2 px-2.5 py-1"><span className="text-muted">Dólar del resumen</span> <b className="tnum">${d.tipoCambio.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</b></span>}
        </div>
      )}

      <div className="mt-4"><Conciliacion r={r} /></div>

      {d.planesOfrecidos.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow !text-[10px] mb-2">
            Refinanciación que ofrece el banco{d.saldoFinanciable !== null && <> · saldo financiable <MoneyText amount={d.saldoFinanciable} currency={r.moneda} /></>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {d.planesOfrecidos.map((p) => (
              <div key={p.cuotas} className="rounded-xl bg-surface-2 px-3 py-2">
                <div className="text-sm font-semibold tnum">{p.cuotas} × <MoneyText amount={p.montoCuota} currency={r.moneda} /></div>
                <div className="text-[11px] text-muted tnum">
                  total <MoneyText amount={p.cuotas * p.montoCuota} currency={r.moneda} />{p.cftea !== null && <> · CFTEA {pctFmt(p.cftea)}</>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.avisos.length > 0 && (
        <div className="mt-4 space-y-2">
          {d.avisos.map((av, k) => (
            <div key={k} className="flex items-start gap-2.5 rounded-xl bg-unassigned-tint px-3 py-2.5 text-[12.5px]">
              <Megaphone className="h-4 w-4 text-unassigned shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-medium">{av.texto}</span>
                {(av.vigencia || av.monto !== null) && (
                  <span className="text-muted">
                    {av.vigencia && <> · desde {fechaCorta(av.vigencia)}</>}
                    {av.monto !== null && <> · <MoneyText amount={av.monto} currency={r.moneda} /></>}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
