'use client'

import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, FileText, ClipboardPaste, Check } from 'lucide-react'
import { parseExtractoTexto, CuotaDetectada } from '@finanzas/core/lib/extracto'
import { addComprasCuotas } from '@finanzas/core/lib/cuotas'
import { getCurrentMonth, shiftMonth, monthLabel, SHARED_USERS } from '@finanzas/core/lib/constants'
import { CompraCuotas, Currency } from '@finanzas/core/types'
import { extraerTextoPDF } from '@/lib/pdf'

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
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface rounded-t-3xl z-50 shadow-2xl outline-none flex flex-col max-h-[92dvh]"
          aria-describedby={undefined}
        >
          <div className="flex-shrink-0 px-5 pt-3 pb-3">
            <div className="flex justify-center pb-2.5">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-base font-bold text-gray-900">
                Importar extracto de tarjeta
              </Dialog.Title>
              <button
                onClick={() => { reset(); onClose() }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X size={15} className="text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
            {filas === null ? (
              <>
                {/* ── Paso 1: cargar ── */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-primary/30 text-primary bg-primary/5 disabled:opacity-50"
                >
                  <FileText size={18} className="flex-shrink-0" />
                  <span className="text-left">
                    <span className="block text-sm font-semibold">{busy ? 'Leyendo…' : 'Subir extracto (PDF o TXT)'}</span>
                    <span className="block text-[11px] opacity-70">Se procesa en tu teléfono, no se sube a ningún lado</span>
                  </span>
                </button>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={handleFile} />

                <div className="flex items-center gap-2 text-[11px] text-gray-300">
                  <div className="flex-1 h-px bg-gray-100" /> o pegá el texto <div className="flex-1 h-px bg-gray-100" />
                </div>

                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={'Copiá las líneas del resumen y pegalas acá.\nEj: 15/03 MERPAGO*FRAVEGA C.03/12 45.678,90'}
                  rows={5}
                  className="w-full bg-gray-50 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300 font-mono"
                />
                <button
                  onClick={() => analizar(texto)}
                  disabled={!texto.trim() || busy}
                  className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <ClipboardPaste size={15} /> Analizar texto
                </button>
              </>
            ) : (
              <>
                {/* ── Paso 2: revisar ── */}
                <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-primary font-semibold">
                    {filas.length} compra{filas.length !== 1 ? 's' : ''} detectada{filas.length !== 1 ? 's' : ''} — revisá y corregí antes de importar
                  </p>
                </div>

                {/* Datos comunes */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tarjeta (Visa, Master…)"
                    value={tarjeta}
                    onChange={(e) => setTarjeta(e.target.value)}
                    className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-300"
                  />
                  <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5 flex-shrink-0">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setMoneda(c)}
                        className={`px-2 rounded-[10px] text-[11px] font-bold ${moneda === c ? 'bg-primary text-white' : 'text-gray-400'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5 flex-shrink-0">
                    {SHARED_USERS.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setCreadoPor(u.id)}
                        className={`px-2 rounded-[10px] text-[11px] font-bold ${creadoPor === u.id ? 'bg-primary text-white' : 'text-gray-400'}`}
                      >
                        {u.nombre.charAt(0)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Mes del extracto <span className="font-normal normal-case text-gray-300">(las cuotas NN/MM vencen este mes)</span>
                  </p>
                  <input
                    type="month"
                    value={mesExtracto}
                    onChange={(e) => setMesExtracto(e.target.value)}
                    className="w-full h-10 bg-gray-50 rounded-xl px-3 text-sm text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Filas editables */}
                <div className="space-y-1.5">
                  {filas.map((f, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border px-3 py-2.5 transition-all ${
                        f.incluir ? 'border-primary/40 bg-primary/5' : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setFila(i, { incluir: !f.incluir })}
                          className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center ${
                            f.incluir ? 'bg-primary border-primary' : 'border-gray-300 bg-surface'
                          }`}
                        >
                          {f.incluir && <Check size={11} color="white" strokeWidth={3.5} />}
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
                          className="w-9 bg-surface border border-gray-200 rounded-lg px-1 py-0.5 text-xs text-center tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <span className="text-[11px] text-gray-400">de</span>
                        <input
                          value={String(f.totalCuotas)}
                          onChange={(e) => setFila(i, { totalCuotas: parseInt(e.target.value, 10) || 1 })}
                          inputMode="numeric"
                          className="w-9 bg-surface border border-gray-200 rounded-lg px-1 py-0.5 text-xs text-center tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <input
                          value={String(f.monto)}
                          onChange={(e) => setFila(i, { monto: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                          inputMode="decimal"
                          className="flex-1 min-w-0 bg-surface border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-right font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <span className="text-[10px] text-gray-400 flex-shrink-0">/cuota</span>
                      </div>
                      {f.incluir && f.cuotaActual > 1 && (
                        <p className="text-[10px] text-gray-400 mt-1 pl-[26px]">
                          Primera cuota: {monthLabel(shiftMonth(mesExtracto, -(f.cuotaActual - 1)))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setFilas(null)}
                  className="text-xs text-gray-400 underline"
                >
                  ← Volver a cargar otro extracto
                </button>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-400">{error}</div>
            )}
          </div>

          {/* Footer fijo */}
          {filas !== null && (
            <div className="flex-shrink-0 border-t border-gray-100 px-5 pt-3 pb-5 bg-surface">
              <button
                onClick={importar}
                disabled={busy || seleccionadas.length === 0}
                className="w-full h-12 rounded-2xl bg-primary text-white text-sm font-bold disabled:opacity-40"
              >
                {busy ? 'Importando…' : `Importar ${seleccionadas.length} compra${seleccionadas.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
