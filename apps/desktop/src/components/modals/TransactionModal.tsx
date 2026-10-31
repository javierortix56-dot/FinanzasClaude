'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2, Calculator, Check, CreditCard, ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import Collapse from '@/components/ui/Collapse'
import { MoneyText } from '@/components/MoneyText'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { addTransaction, updateTransaction } from '@finanzas/core/lib/transactions'
import { adjustAssetSaldo } from '@finanzas/core/lib/assets'
import { deleteTransactionsWithUndo } from '@finanzas/core/lib/undo'
import { evalExpr, isExpression } from '@finanzas/core/lib/calc'
import { toBase, txToBase, txMonth } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { Asignacion, Currency, Transaction, TransactionType } from '@finanzas/core/types'
import { SHARED_USERS, getParentGroup, toLocalDateString, monthLabel, shiftMonth } from '@finanzas/core/lib/constants'
import { registrarAbono, detallePago, tarjetaDe, type DetallePago } from '@finanzas/core/lib/tarjetas'
import { cn } from '@finanzas/core/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  initialType?: TransactionType
  editing?: Transaction | null
}

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

export function TransactionModal({ open, onClose, initialType = 'egreso', editing }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing?.pagoTarjeta ? 'Pago de tarjeta' : editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      size="lg"
    >
      {editing?.pagoTarjeta ? (
        <PagoTarjetaForm key={editing.id} pago={editing} onClose={onClose} />
      ) : (
        <Form
          key={editing?.id ?? `new-${initialType}`}
          editing={editing ?? null}
          initialType={initialType}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function Form({
  editing, initialType, onClose,
}: {
  editing: Transaction | null
  initialType: TransactionType
  onClose: () => void
}) {
  const s = useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((st) => st.showToast)
  const transactions = useTransactionStore((st) => st.transactions)
  const assets = useAssetStore((st) => st.assets)
  const base = useAuthStore((st) => st.monedaBase) as Currency

  const initialGroup = editing
    ? (getParentGroup(editing.categoria, editing.tipo === 'ingreso' ? s.categoriasIngreso : s.categoriasGasto)?.id ?? editing.categoria)
    : ''

  const [tipo, setTipo]             = useState<TransactionType>(editing?.tipo ?? initialType)
  const [monto, setMonto]           = useState(editing ? String(editing.monto) : '')
  const [moneda, setMoneda]         = useState<Currency>(editing?.moneda ?? 'ARS')
  const [group, setGroup]           = useState(initialGroup)
  const [categoria, setCategoria]   = useState(editing?.categoria ?? '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? '')
  const [nota, setNota]             = useState(editing?.nota ?? '')
  const [fecha, setFecha]           = useState(
    editing ? toLocalDateString(editing.fecha.toDate()) : toLocalDateString(),
  )
  const [creadoPor, setCreadoPor]   = useState(editing?.creadoPor || SHARED_USERS[0].id)
  const [ejecutado, setEjecutado]   = useState(editing?.ejecutado ?? false)
  const [recurrente, setRecurrente] = useState(editing?.recurrente ?? false)
  // '' = sin asignar · '__keep' = conservar una asignación dividida existente
  // · 'tc:<id>' = pagado con esa tarjeta de crédito
  const [ingresoId, setIngresoId]   = useState(() => {
    if (editing?.tarjetaId && tarjetaDe(editing.tarjetaId, s)) return `tc:${editing.tarjetaId}`
    const a = editing?.asignaciones ?? []
    if (a.length > 1) return '__keep'
    // Un vínculo a un ingreso que ya no existe (huérfano) se muestra como sin asignar
    const id = a[0]?.ingresoId ?? ''
    return transactions.some((t) => t.id === id && t.tipo === 'ingreso') ? id : ''
  })
  const [ahorroAssetId, setAhorroAssetId] = useState(editing?.ahorroAssetId ?? '')
  const [saving, setSaving]         = useState(false)

  // El monto admite operaciones ("1500+320"), evaluadas sin eval()
  const parsed = evalExpr(monto)
  const montoNum = parsed ?? 0
  const esCuenta = isExpression(monto)
  const montoInvalid = monto.trim() !== '' && !(montoNum > 0)

  const groups = (tipo === 'ingreso' ? s.categoriasIngreso : s.categoriasGasto).filter((g) => g.activa)
  const currentGroup = groups.find((g) => g.id === group)
  const subs = currentGroup?.subcategorias.filter((c) => c.activa) ?? []

  function changeTipo(t: TransactionType) {
    setTipo(t)
    setGroup('')
    setCategoria('')
  }

  function pickGroup(id: string) {
    const g = groups.find((x) => x.id === id)
    setGroup(id)
    // Un grupo sin subcategorías activas se usa como categoría directamente
    const activeSubs = g?.subcategorias.filter((c) => c.activa) ?? []
    const cat = activeSubs.length === 0 ? id : ''
    setCategoria(cat)
    autoAhorro(cat || id)
  }

  function pickSub(id: string) {
    setCategoria(id)
    autoAhorro(id)
  }

  // Destino de ahorro sugerido por la configuración (solo altas)
  function autoAhorro(catId: string) {
    if (editing || tipo !== 'egreso') return
    const link = (s.ahorroLinks ?? []).find((l) => l.categoriaId === catId || l.categoriaId === group)
    if (link) setAhorroAssetId(link.assetId)
  }

  // Conceptos usados antes en la categoría (autocompletado rápido)
  const sugerencias = useMemo(() => {
    if (!categoria) return []
    return [...new Set(
      transactions
        .filter((t) => t.categoria === categoria && t.descripcion && t.descripcion !== descripcion)
        .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
        .map((t) => t.descripcion),
    )].slice(0, 5)
  }, [transactions, categoria, descripcion])

  // Ingresos del mes con su disponible (sin contar lo que asigna este movimiento)
  const ingresoOptions = useMemo(() => transactions
    .filter((t) => t.tipo === 'ingreso')
    .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime())
    .map((ing) => {
      const used = transactions
        .filter((t) => t.tipo === 'egreso' && t.id !== editing?.id)
        .reduce((sum, t) => sum + t.asignaciones
          .filter((a) => a.ingresoId === ing.id)
          .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s, txMonth(t)), 0), 0)
      return { ing, libre: txToBase(ing, base, s) - used }
    }), [transactions, editing, base, s])

  const ahorroOptions = assets.filter((a) => a.clase === 'activo')

  const canSave = montoNum > 0 && !!categoria && !saving

  async function handleSave() {
    if (!(montoNum > 0)) return showToast('Ingresá un monto válido', 'error')
    if (!categoria) return showToast('Elegí una categoría', 'error')

    let asignaciones: Asignacion[] = []
    const tarjetaId = tipo === 'egreso' && ingresoId.startsWith('tc:') ? ingresoId.slice(3) : null
    if (tipo === 'egreso' && !tarjetaId) {
      if (ingresoId === '__keep') {
        // Dividido: se conserva la proporción de cada parte sobre el nuevo monto
        const prevTotal = editing!.asignaciones.reduce((x, a) => x + a.monto, 0) || 1
        asignaciones = editing!.asignaciones.map((a) => ({ ...a, monto: Math.round((a.monto / prevTotal) * montoNum * 100) / 100 }))
      } else if (ingresoId) {
        asignaciones = [{ ingresoId, monto: montoNum }]
      }
    }

    const payload: Omit<Transaction, 'id'> = {
      userId: 'shared',
      tipo,
      monto: montoNum,
      moneda,
      categoria,
      descripcion: descripcion.trim(),
      nota,
      tags: editing?.tags ?? [],
      fecha: { toDate: () => new Date(fecha + 'T12:00:00') },
      ejecutado,
      asignaciones,
      creadoPor,
      recurrente,
      ahorroAssetId: tipo === 'egreso' ? (ahorroAssetId || null) : null,
      tarjetaId,
    }

    setSaving(true)
    try {
      if (editing?.id) {
        await updateTransaction(editing.id, payload)
        showToast('Movimiento actualizado')
      } else {
        await addTransaction(payload)
        showToast('Movimiento agregado')
      }

      // Sincroniza el saldo de la cuenta de ahorro (misma lógica que mobile;
      // antes desktop no la movía y el patrimonio quedaba desfasado).
      try {
        const txMonth = fecha.slice(0, 7)
        const oldId = editing?.ahorroAssetId ?? ''
        const newId = payload.ahorroAssetId ?? ''
        if (editing?.id) {
          if (oldId && oldId !== newId) {
            await adjustAssetSaldo(oldId, -editing.monto, editing.fecha.toDate().toISOString().slice(0, 7))
          }
          if (newId) {
            const delta = oldId === newId ? montoNum - editing.monto : montoNum
            if (delta !== 0) await adjustAssetSaldo(newId, delta, txMonth)
          }
        } else if (newId) {
          await adjustAssetSaldo(newId, montoNum, txMonth)
        }
      } catch (syncErr) {
        console.error('[TransactionModal] ahorro sync:', syncErr)
      }
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Sin confirm(): borra al instante y ofrece "Deshacer" (también revierte el ahorro)
  async function handleDelete() {
    if (!editing?.id) return
    setSaving(true)
    try {
      await deleteTransactionsWithUndo([editing])
      onClose()
    } catch {
      showToast('Error al eliminar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const accent = tipo === 'ingreso' ? 'var(--income)' : 'var(--expense)'

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); handleSave() }}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave() } }}
    >
      <Segmented
        id="tx-tipo"
        value={tipo}
        onChange={changeTipo}
        className="w-full"
        options={[
          { value: 'egreso', label: 'Egreso', activeColor: 'var(--expense)' },
          { value: 'ingreso', label: 'Ingreso', activeColor: 'var(--income)' },
        ]}
      />

      {/* Monto con calculadora */}
      <div>
        <Label htmlFor="tx-monto">Monto</Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="tx-monto"
              autoFocus={!editing}
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onBlur={() => { if (esCuenta && parsed !== null) setMonto(String(parsed)) }}
              placeholder="0"
              aria-invalid={montoInvalid}
              className={cn(
                'h-14 w-full rounded-2xl border bg-surface-2 px-4 text-[26px] font-semibold tnum tracking-tight outline-none transition-all placeholder:text-muted-2 focus:bg-surface focus:ring-4',
                montoInvalid ? 'border-expense/50 focus:ring-expense/10' : 'border-transparent focus:border-primary/40 focus:ring-primary/10',
              )}
              style={{ color: montoNum > 0 ? accent : undefined }}
            />
            <AnimatePresence>
              {esCuenta && (
                <motion.span
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-sm font-semibold tnum shadow-card"
                >
                  <Calculator className="h-3.5 w-3.5 text-muted" />
                  {parsed === null ? '…' : <>= <MoneyText amount={parsed} currency={moneda} /></>}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <Segmented
            id="tx-moneda"
            value={moneda}
            onChange={setMoneda}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-2">Admite cuentas: 1500+320, 3×450, 10000÷4.</p>
      </div>

      {/* Categoría: grupos con ícono y subcategorías */}
      <div>
        <Label>Categoría</Label>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => {
            const active = g.id === group
            return (
              <motion.button
                type="button"
                key={g.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => pickGroup(g.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  active ? 'border-transparent text-white shadow-card' : 'border-hairline bg-surface-2 text-foreground hover:bg-surface',
                )}
                style={active ? { background: g.color } : undefined}
              >
                <span style={active ? undefined : { color: g.color }} className="inline-flex"><CategoryIcon cat={g} size={13} /></span>
                {g.nombre}
              </motion.button>
            )
          })}
        </div>
        <Collapse open={subs.length > 0}>
          <div className="mt-2.5 flex flex-wrap gap-1.5 rounded-2xl bg-surface-2 p-2">
            {subs.map((c) => {
              const active = c.id === categoria
              return (
                <motion.button
                  type="button"
                  key={c.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => pickSub(c.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    active ? 'bg-surface text-foreground shadow-card' : 'text-muted hover:text-foreground',
                  )}
                >
                  <span style={{ color: c.color || currentGroup?.color }} className="inline-flex"><CategoryIcon cat={c} size={12} /></span>
                  {c.nombre}
                  {active && <Check className="h-3 w-3 text-primary" strokeWidth={3} />}
                </motion.button>
              )
            })}
          </div>
        </Collapse>
      </div>

      <div className="grid grid-cols-[1fr_180px] gap-3">
        <div>
          <Label htmlFor="tx-desc">Concepto</Label>
          <Input
            id="tx-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Sueldo, Supermercado, Alquiler"
          />
          {sugerencias.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sugerencias.map((sg) => (
                <button
                  type="button"
                  key={sg}
                  onClick={() => setDescripcion(sg)}
                  className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11.5px] text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {sg}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="tx-fecha">Fecha</Label>
          <Input id="tx-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {/* Asignación y ahorro (solo egresos) */}
      <Collapse open={tipo === 'egreso'}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tx-asig">Se paga con</Label>
            <Select id="tx-asig" value={ingresoId} onChange={(e) => setIngresoId(e.target.value)}>
              <option value="">Sin asignar</option>
              {editing && editing.asignaciones.length > 1 && (
                <option value="__keep">Dividido entre {editing.asignaciones.length} ingresos (conservar)</option>
              )}
              {ingresoOptions.length > 0 && (
                <optgroup label="Ingresos">
                  {ingresoOptions.map(({ ing, libre }) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.descripcion || '(sin descripción)'} · libre {Math.round(libre).toLocaleString('es-AR')} {base}
                    </option>
                  ))}
                </optgroup>
              )}
              {(s.tarjetas ?? []).length > 0 && (
                <optgroup label="Tarjetas (se paga el mes siguiente)">
                  {(s.tarjetas ?? []).map((t) => (
                    <option key={t.id} value={`tc:${t.id}`}>{t.nombre}</option>
                  ))}
                </optgroup>
              )}
            </Select>
            {ingresoId.startsWith('tc:') && (
              <p className="mt-1.5 text-[11px] text-muted">
                Se suma al pago de {monthLabel(shiftMonth(fecha.slice(0, 7), 1))}.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="tx-ahorro">Destino de ahorro</Label>
            <Select id="tx-ahorro" value={ahorroAssetId} onChange={(e) => setAhorroAssetId(e.target.value)}>
              <option value="">Ninguno</option>
              {ahorroOptions.map((a) => <option key={a.id} value={a.id}>{a.nombre} · {a.moneda}</option>)}
            </Select>
          </div>
        </div>
      </Collapse>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cargado por</Label>
          <Segmented
            id="tx-user"
            value={creadoPor}
            onChange={setCreadoPor}
            className="w-full"
            options={SHARED_USERS.map((u) => ({ value: u.id, label: u.nombre }))}
          />
        </div>
        <div className="flex flex-col justify-end gap-1.5">
          <Toggle checked={ejecutado} onChange={setEjecutado} label={tipo === 'ingreso' ? 'Recibido' : 'Pagado'} />
          <Toggle checked={recurrente} onChange={setRecurrente} label="Recurrente mensual" />
        </div>
      </div>

      <div>
        <Label htmlFor="tx-nota">Nota (opcional)</Label>
        <Textarea id="tx-nota" value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-[60px]" />
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-hairline">
        {editing ? (
          <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving} className="text-expense">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        ) : <span className="text-[11px] text-muted-2"><kbd className="font-sans">⌘</kbd>/<kbd className="font-sans">Ctrl</kbd>+Enter para guardar</span>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={!canSave}>
            {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * Pago automático de una tarjeta: el total no se edita (sale de los consumos,
 * las cuotas y el saldo anterior); sí cuánto se abona, con qué ingreso y si
 * ya se pagó. Lo que no se abona pasa al pago del mes siguiente.
 */
function PagoTarjetaForm({ pago, onClose }: { pago: Transaction; onClose: () => void }) {
  const s = useSettingsStore((st) => st.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((st) => st.showToast)
  const transactions = useTransactionStore((st) => st.transactions)
  const base = useAuthStore((st) => st.monedaBase) as Currency
  const p = pago.pagoTarjeta!
  const tarjeta = tarjetaDe(p.tarjetaId, s)
  const previo = shiftMonth(p.mes, -1)
  const siguiente = shiftMonth(p.mes, 1)

  const [abono, setAbono] = useState(String(pago.monto))
  const [ingresoId, setIngresoId] = useState(() => {
    if (pago.asignaciones.length > 1) return '__keep'
    const id = pago.asignaciones[0]?.ingresoId ?? ''
    return transactions.some((t) => t.id === id && t.tipo === 'ingreso') ? id : ''
  })
  const [ejecutado, setEjecutado] = useState(pago.ejecutado)
  const [saving, setSaving] = useState(false)
  const [verDetalle, setVerDetalle] = useState(false)
  const [detalle, setDetalle] = useState<DetallePago | null>(null)

  useEffect(() => {
    if (!verDetalle || detalle) return
    let vivo = true
    detallePago(p, s).then((d) => { if (vivo) setDetalle(d) }).catch(() => { if (vivo) setDetalle({ consumos: [], cuotas: [] }) })
    return () => { vivo = false }
  }, [verDetalle, detalle, p, s])

  const abonoNum = evalExpr(abono) ?? NaN
  const abonoValido = abonoNum >= 0 && abonoNum <= p.total + 0.005
  const pasa = abonoValido ? Math.max(p.total - abonoNum, 0) : 0

  const ingresoOptions = useMemo(() => transactions
    .filter((t) => t.tipo === 'ingreso')
    .sort((a, b) => a.fecha.toDate().getTime() - b.fecha.toDate().getTime())
    .map((ing) => {
      const used = transactions
        .filter((t) => t.tipo === 'egreso' && t.id !== pago.id)
        .reduce((sum, t) => sum + t.asignaciones
          .filter((a) => a.ingresoId === ing.id)
          .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s, txMonth(t)), 0), 0)
      return { ing, libre: txToBase(ing, base, s) - used }
    }), [transactions, pago.id, base, s])

  async function handleSave() {
    if (!abonoValido) return showToast(`El abono debe estar entre 0 y ${formatNum(p.total)}`, 'error')
    const monto = Math.round(abonoNum * 100) / 100
    setSaving(true)
    try {
      if (monto !== pago.monto) await registrarAbono(pago, monto)
      let asignaciones: Asignacion[]
      if (ingresoId === '__keep') {
        const prevTotal = pago.asignaciones.reduce((x, a) => x + a.monto, 0) || 1
        asignaciones = monto > 0 ? pago.asignaciones.map((a) => ({ ...a, monto: Math.round((a.monto / prevTotal) * monto * 100) / 100 })) : []
      } else {
        asignaciones = ingresoId && monto > 0 ? [{ ingresoId, monto }] : []
      }
      await updateTransaction(pago.id!, { asignaciones, ejecutado })
      showToast(pasa > 0 ? `Abono guardado · pasan ${formatNum(pasa)} ${p.moneda} a ${monthLabel(siguiente)}` : 'Pago actualizado')
      onClose()
    } catch (err) {
      console.error(err)
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lineas = [
    { label: `Consumos de ${monthLabel(previo)}`, monto: p.consumos },
    { label: `Cuotas de ${monthLabel(p.mes)}`, monto: p.cuotas },
    { label: `Saldo impago de ${monthLabel(previo)}`, monto: p.saldoAnterior },
  ]

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-xl inline-flex items-center justify-center text-white" style={{ background: tarjeta?.color ?? 'var(--muted)' }}>
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[15px] font-semibold">{tarjeta?.nombre ?? 'Tarjeta eliminada'}{p.moneda !== 'ARS' ? ` · ${p.moneda}` : ''}</div>
          <div className="text-xs text-muted capitalize">Pago de {monthLabel(p.mes)} · se genera solo y no se puede borrar</div>
        </div>
      </div>

      <div className="rounded-xl bg-surface-2 p-4 space-y-2 text-sm">
        {lineas.map((l) => (
          <div key={l.label} className={cn('flex justify-between', l.monto === 0 && 'text-muted-2')}>
            <span>{l.label}</span>
            <MoneyText amount={l.monto} currency={p.moneda} />
          </div>
        ))}
        <div className="flex justify-between border-t border-hairline pt-2 font-semibold">
          <span>Total a pagar</span>
          <MoneyText amount={p.total} currency={p.moneda} />
        </div>
      </div>

      <div>
        <button type="button" onClick={() => setVerDetalle((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', verDetalle && 'rotate-180')} />
          {verDetalle ? 'Ocultar' : 'Ver'} qué lo compone
        </button>
        <Collapse open={verDetalle}>
          <div className="mt-2 space-y-1 text-xs">
            {!detalle ? <p className="text-muted">Cargando…</p> : (
              <>
                {detalle.consumos.map((c) => (
                  <div key={c.id} className="flex justify-between gap-3">
                    <span className="truncate text-muted">{c.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · {c.descripcion || '(sin descripción)'}</span>
                    <MoneyText amount={c.monto} currency={c.moneda} />
                  </div>
                ))}
                {detalle.cuotas.map((c, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span className="truncate text-muted">{c.descripcion} · cuota {c.numero}/{c.totalCuotas}</span>
                    <MoneyText amount={c.monto} currency={p.moneda} />
                  </div>
                ))}
                {detalle.consumos.length === 0 && detalle.cuotas.length === 0 && <p className="text-muted">Sin consumos ni cuotas: es saldo anterior.</p>}
              </>
            )}
          </div>
        </Collapse>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pago-abono">Abono ({p.moneda})</Label>
          <Input
            id="pago-abono"
            inputMode="decimal"
            value={abono}
            onChange={(e) => setAbono(e.target.value)}
            aria-invalid={!abonoValido}
            className={cn('tnum', !abonoValido && 'border-expense/50 ring-4 ring-expense/10')}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            {pasa > 0
              ? <span className="text-unassigned font-medium">Pasan <MoneyText amount={pasa} currency={p.moneda} /> a {monthLabel(siguiente)}</span>
              : <span className="text-muted">Se paga el total</span>}
            {abonoNum !== p.total && (
              <button type="button" className="font-semibold text-primary" onClick={() => setAbono(String(p.total))}>Pagar total</button>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="pago-asig">Se paga con</Label>
          <Select id="pago-asig" value={ingresoId} onChange={(e) => setIngresoId(e.target.value)}>
            <option value="">Sin asignar</option>
            {pago.asignaciones.length > 1 && <option value="__keep">Dividido entre {pago.asignaciones.length} ingresos (conservar)</option>}
            {ingresoOptions.map(({ ing, libre }) => (
              <option key={ing.id} value={ing.id}>
                {ing.descripcion || '(sin descripción)'} · libre {Math.round(libre).toLocaleString('es-AR')} {base}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Toggle checked={ejecutado} onChange={setEjecutado} label="Pagado" />

      <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" disabled={saving || !abonoValido}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

const formatNum = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 rounded-lg py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border-strong')}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')}
        />
      </span>
      {label}
    </button>
  )
}
