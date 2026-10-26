'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, ClipboardPaste, Check, ChevronLeft } from 'lucide-react'
import { parseExtractoTexto, CuotaDetectada } from '@finanzas/core/lib/extracto'
import { addComprasCuotas } from '@finanzas/core/lib/cuotas'
import { getCurrentMonth, shiftMonth, monthLabel, SHARED_USERS } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency } from '@finanzas/core/types'
import { extraerTextoPDF } from '@/lib/pdf'
import Sheet, { FieldLabel, fieldClass } from '@/components/ui/Sheet'
import Segmented from '@/components/ui/Segmented'
import { springPop } from '@/components/ui/motion'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Fila extends CuotaDetectada {
  incluir: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
}

export default function ImportExtractoModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto]     = useState('')
  const [filas, setFilas]     = useState<Fila[] | null>(null)
  const [tarjeta, setTarjeta] = useState('')
  const [moneda, setMoneda]   = useState<Currency>('ARS')
  const [mesExtracto, setMesExtracto] = useState(getCurrentMonth())
  const [creadoPor, setCreadoPor] = useState(SHARED_USERS[0].id)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function reset() {
    setTexto(''); setFilas(null); setError(null); setBusy(false)
  }

  // Se resetea al ABRIR (no al cerrar) para que el sheet anime su salida con
  // el contenido intacto. Patrón de estado derivado del valor previo de `open`.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) reset()
  }

  function analizar(input: string) {
    const detectadas = parseExtractoTexto(input)
    if (detectadas.length === 0) {
      setError('No se detectaron compras en cuotas. Probá pegando las líneas del resumen que dicen "NN/MM" (cuota N de M).')
      return
    }
    setError(null)
    setFilas(detectadas.map((d) => ({ ...d, incluir: true })))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const contenido = file.name.toLowerCase().endsWith('.pdf')
        ? await extraerTextoPDF(file)
        : await file.text()
      analizar(contenido)
    } catch (err) {
      console.error('[extracto] error leyendo archivo:', err)
      setError('No se pudo leer el archivo. Probá copiando y pegando el texto del resumen.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function setFila(i: number, patch: Partial<Fila>) {
    setFilas((prev) => prev!.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  }

  const seleccionadas = (filas ?? []).filter((f) => f.incluir)

  async function importar() {
    if (seleccionadas.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const compras: Omit<CompraCuotas, 'id'>[] = seleccionadas.map((f) => ({
        descripcion: f.descripcion,
        tarjeta: tarjeta.trim(),
        moneda,
        montoCuota: f.monto,
        totalCuotas: f.totalCuotas,
        // La cuota N vence en el mes del extracto → la primera fue N-1 meses antes
        primerMes: shiftMonth(mesExtracto, -(f.cuotaActual - 1)),
        creadoPor,
      }))
      await addComprasCuotas(compras)
      onImported(compras.length)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Importar extracto de tarjeta"
      bodyClassName="px-5 pb-4 space-y-4"
      footer={filas !== null ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={importar}
          disabled={busy || seleccionadas.length === 0}
          className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
        >
          {busy ? 'Importando…' : `Importar ${seleccionadas.length} compra${seleccionadas.length !== 1 ? 's' : ''}`}
        </motion.button>
      ) : undefined}
    >
            {filas === null ? (
        <>
    {/* ── Paso 1: cargar ── */}
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-[20px] border-2 border-dashed border-primary/30 text-primary bg-primary/[0.06] disabled:opacity-50"
    >
      <span className="w-10 h-10 rounded-2xl bg-primary/12 flex items-center justify-center flex-shrink-0">
        <FileText size={18} className={busy ? 'animate-pulse' : ''} />
      </span>
      <span className="text-left">
        <span className="block text-sm font-semibold">{busy ? 'Leyendo…' : 'Subir extracto (PDF o TXT)'}</span>
        <span className="block text-[11px] opacity-70">Se procesa en tu teléfono, no se sube a ningún lado</span>
      </span>
    </motion.button>
    <input ref={fileRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={handleFile} />

    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <div className="flex-1 h-px bg-hairline" /> o pegá el texto <div className="flex-1 h-px bg-hairline" />
    </div>

    <textarea
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      placeholder={'Copiá las líneas del resumen y pegalas acá.\nEj: 15/03 MERPAGO*FRAVEGA C.03/12 45.678,90'}
      rows={5}
      className="w-full bg-gray-500/[0.06] rounded-2xl px-3.5 py-3 text-xs text-gray-900 outline-none border border-transparent focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10 placeholder:text-gray-400 font-mono transition-all"
    />
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => analizar(texto)}
      disabled={!texto.trim() || busy}
      className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40 flex items-center justify-center gap-2"
    >
      <ClipboardPaste size={15} /> Analizar texto
    </motion.button>
        </>
      ) : (
        <>
    {/* ── Paso 2: revisar ── */}
    <div className="bg-primary/[0.07] ring-1 ring-primary/15 rounded-2xl px-3.5 py-3">
      <p className="text-xs text-primary font-semibold">
        {filas.length} compra{filas.length !== 1 ? 's' : ''} detectada{filas.length !== 1 ? 's' : ''} — revisá y corregí antes de importar
      </p>
    </div>

    {/* Datos comunes */}
    <input
      type="text"
      placeholder="Tarjeta (Visa, Master…)"
      value={tarjeta}
      onChange={(e) => setTarjeta(e.target.value)}
      className={fieldClass}
    />
    <div className="flex gap-2">
      <Segmented
        id="extracto-moneda"
        size="sm"
        value={moneda}
        onChange={setMoneda}
        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        variant="solid"
        className="flex-1"
      />
      <Segmented
        id="extracto-user"
        size="sm"
        value={creadoPor}
        onChange={setCreadoPor}
        options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre }))}
        variant="solid"
        className="flex-1"
      />
    </div>

    <div>
      <FieldLabel hint="(las cuotas NN/MM vencen este mes)">Mes del extracto</FieldLabel>
      <input
        type="month"
        value={mesExtracto}
        onChange={(e) => setMesExtracto(e.target.value)}
        className={fieldClass}
      />
    </div>

    {/* Filas editables */}
    <div className="space-y-1.5">
      {filas.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: f.incluir ? 1 : 0.55, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.3) }}
          className={`rounded-2xl px-3 py-2.5 transition-colors ${
            f.incluir ? 'bg-primary/[0.06] ring-1 ring-primary/30' : 'bg-gray-500/[0.06]'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFila(i, { incluir: !f.incluir })}
              className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                f.incluir ? 'bg-primary border-primary' : 'border-gray-300 bg-surface'
              }`}
              aria-label={f.incluir ? 'Excluir' : 'Incluir'}
            >
              <AnimatePresence>
                {f.incluir && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springPop} className="inline-flex">
                    <Check size={11} color="white" strokeWidth={3.5} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <input
              value={f.descripcion}
              onChange={(e) => setFila(i, { descripcion: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-gray-900 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 mt-1.5 pl-[26px]">
            <span className="text-[11px] text-gray-400">Cuota</span>
            <input
              value={String(f.cuotaActual)}
              onChange={(e) => setFila(i, { cuotaActual: parseInt(e.target.value, 10) || 1 })}
              inputMode="numeric"
              className="w-9 bg-surface rounded-lg px-1 py-1 text-xs text-center tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-[11px] text-gray-400">de</span>
            <input
              value={String(f.totalCuotas)}
              onChange={(e) => setFila(i, { totalCuotas: parseInt(e.target.value, 10) || 1 })}
              inputMode="numeric"
              className="w-9 bg-surface rounded-lg px-1 py-1 text-xs text-center tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
            />
            <input
              value={String(f.monto)}
              onChange={(e) => setFila(i, { monto: parseFloat(e.target.value.replace(',', '.')) || 0 })}
              inputMode="decimal"
              className="flex-1 min-w-0 bg-surface rounded-lg px-2 py-1 text-xs text-right font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-[10px] text-gray-400 flex-shrink-0">/cuota</span>
          </div>
          {f.incluir && f.cuotaActual > 1 && (
            <p className="text-[10px] text-gray-400 mt-1 pl-[26px]">
              Primera cuota: {monthLabel(shiftMonth(mesExtracto, -(f.cuotaActual - 1)))}
            </p>
          )}
        </motion.div>
      ))}
    </div>

    <button
      onClick={() => setFilas(null)}
      className="flex items-center gap-1 h-8 pl-1.5 pr-3 rounded-full bg-gray-500/[0.08] text-xs font-semibold text-gray-500"
    >
      <ChevronLeft size={14} /> Volver a cargar otro extracto
    </button>
        </>
      )}

      {error && (
        <div className="bg-rose-500/10 ring-1 ring-rose-500/20 rounded-2xl px-3 py-2.5 text-xs text-rose-500">{error}</div>
      )}
    </Sheet>
  )
}
