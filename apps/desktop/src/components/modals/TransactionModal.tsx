'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2, Calculator, Check } from 'lucide-react'
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
import { toBase } from '@finanzas/core/lib/currency'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { Asignacion, Currency, Transaction, TransactionType } from '@finanzas/core/types'
import { SHARED_USERS, getParentGroup, toLocalDateString } from '@finanzas/core/lib/constants'
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
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      size="lg"
    >
      <Form
        key={editing?.id ?? `new-${initialType}`}
        editing={editing ?? null}
        initialType={initialType}
        onClose={onClose}
      />
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
  const [ingresoId, setIngresoId]   = useState(() => {
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
          .reduce((x, a) => x + toBase(a.monto, t.moneda, base, s), 0), 0)
      return { ing, libre: toBase(ing.monto, ing.moneda, base, s) - used }
    }), [transactions, editing, base, s])

  const ahorroOptions = assets.filter((a) => a.clase === 'activo')

  const canSave = montoNum > 0 && !!categoria && !saving

  async function handleSave() {
    if (!(montoNum > 0)) return showToast('Ingresá un monto válido', 'error')
    if (!categoria) return showToast('Elegí una categoría', 'error')

    let asignaciones: Asignacion[] = []
    if (tipo === 'egreso') {
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
              {ingresoOptions.map(({ ing, libre }) => (
                <option key={ing.id} value={ing.id}>
                  {ing.descripcion || '(sin descripción)'} · libre {Math.round(libre).toLocaleString('es-AR')} {base}
                </option>
              ))}
            </Select>
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
