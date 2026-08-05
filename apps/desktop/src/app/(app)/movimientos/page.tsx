'use client'

import { useState } from 'react'
import { Plus, Search, X, Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { Select } from '@/components/ui/input'
import { MoneyText } from '@/components/MoneyText'
import { TransactionModal } from '@/components/modals/TransactionModal'
import { LedgerStats, LedgerTabs, FilterPill } from '@/components/ledger/LedgerHeader'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings } from '@finanzas/core/lib/constants'
import { markEjecutado, deleteTransaction } from '@finanzas/core/lib/transactions'
import { toBase } from '@finanzas/core/lib/currency'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { cn } from '@finanzas/core/lib/utils'
import { txCategoryPath, txLabel } from '@/lib/labels'
import { Currency, Settings, Transaction, TransactionType } from '@finanzas/core/types'

type Filter = 'todas' | 'pendientes' | 'javier' | 'mary'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'javier', label: 'Javier' },
  { key: 'mary', label: 'Mary' },
]

export default function MovimientosPage() {
  const { transactions } = useTransactionStore()
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase } = useAuthStore()
  const showToast = useUIStore((s) => s.showToast)

  const [filter, setFilter] = useState<Filter>('todas')
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  // `selected` ya no se fija con un clic (el clic abre la edición): se activa
  // al pasar el mouse por encima, para ver la contrapartida sin perder el clic.
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [initialType, setInitialType] = useState<TransactionType>('egreso')

  const base = monedaBase as Currency

  function matches(t: Transaction) {
    if (filter === 'pendientes' && t.ejecutado) return false
    if (filter === 'javier' && t.creadoPor !== 'javier') return false
    if (filter === 'mary' && t.creadoPor !== 'mary') return false
    if (categoria && t.categoria !== categoria) return false
    if (search) {
      const q = search.toLowerCase()
      if (!txLabel(t, settings).toLowerCase().includes(q) && !t.nota.toLowerCase().includes(q)) return false
    }
    return true
  }

  const byDate = (a: Transaction, b: Transaction) =>
    a.fecha.toDate().getTime() - b.fecha.toDate().getTime()

  const ingresos = transactions.filter((t) => t.tipo === 'ingreso' && matches(t)).sort(byDate)
  const egresos = transactions.filter((t) => t.tipo === 'egreso' && matches(t)).sort(byDate)

  const totalIn = ingresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)
  const totalOut = egresos.reduce((s, t) => s + toBase(t.monto, t.moneda, base, settings), 0)

  const allCategories: { id: string; nombre: string; group: string }[] = []
  for (const g of [...settings.categoriasGasto, ...settings.categoriasIngreso]) {
    for (const sub of g.subcategorias) {
      allCategories.push({ id: sub.id, nombre: sub.nombre, group: g.nombre })
    }
  }

  const selectedTx = transactions.find((t) => t.id === selected)

  /**
   * Un movimiento está vinculado a la selección si es el seleccionado mismo,
   * o si comparte una asignación con él (egreso ↔ ingreso de respaldo).
   */
  const linkedIds = new Set<string>()
  if (selectedTx?.id) {
    linkedIds.add(selectedTx.id)
    if (selectedTx.tipo === 'ingreso') {
      for (const t of transactions) {
        if (t.id && t.asignaciones.some((a) => a.ingresoId === selectedTx.id)) linkedIds.add(t.id)
      }
    } else {
      for (const a of selectedTx.asignaciones) linkedIds.add(a.ingresoId)
    }
  }
  const isLinked = (t: Transaction) => !!t.id && linkedIds.has(t.id)

  function openNew(type: TransactionType) {
    setEditing(null)
    setInitialType(type)
    setOpen(true)
  }

  async function toggleEjecutado(t: Transaction) {
    if (!t.id) return
    try {
      await markEjecutado(t.id, !t.ejecutado)
      showToast(t.ejecutado ? 'Marcado como pendiente' : 'Marcado como ejecutado')
    } catch {
      showToast('Error', 'error')
    }
  }

  async function handleDelete(t: Transaction) {
    if (!t.id) return
    if (!confirm('¿Eliminar este movimiento?')) return
    try {
      await deleteTransaction(t.id)
      showToast('Movimiento eliminado')
    } catch {
      showToast('Error al eliminar', 'error')
    }
  }

  return (
    <main className="flex flex-1 min-h-0 flex-col gap-2.5 px-4 lg:px-6 pt-3">
      <LedgerStats />

      <div className="flex flex-wrap items-center gap-2">
        <LedgerTabs />

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar movimientos…"
            className="w-full rounded-[10px] border border-border bg-surface py-[6px] pl-[30px] pr-8 text-[13px] text-foreground placeholder:text-muted-2 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-[15px] w-[15px]" />
            </button>
          )}
        </div>

        <div className="flex gap-[3px] rounded-[10px] bg-surface-2 p-[3px]">
          {FILTERS.map((f) => (
            <FilterPill key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </FilterPill>
          ))}
        </div>

        <Select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-[31px] w-44 rounded-[10px] py-0 text-[12.5px]"
        >
          <option value="">Todas las categorías</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.group} · {c.nombre}</option>
          ))}
        </Select>

        <div className="flex gap-2">
          <button
            onClick={() => openNew('ingreso')}
            className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-surface px-3 py-[6px] text-[12.5px] font-semibold text-income transition-colors hover:bg-surface-2"
          >
            <Plus className="h-3.5 w-3.5" /> Ingreso
          </button>
          <button
            onClick={() => openNew('egreso')}
            className="inline-flex items-center gap-1 rounded-[10px] bg-primary px-3 py-[6px] text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" /> Egreso
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 pb-3.5 xl:grid-cols-2">
        <LedgerColumn
          kind="in"
          title="Ingresos"
          rows={ingresos}
          total={totalIn}
          base={base}
          settings={settings}
          selected={selected}
          isLinked={isLinked}
          onSelect={setSelected}
          onToggle={toggleEjecutado}
          onEdit={(t) => { setEditing(t); setOpen(true) }}
          onDelete={handleDelete}
        />
        <LedgerColumn
          kind="out"
          title="Egresos"
          rows={egresos}
          total={totalOut}
          headerSub={totalIn > 0 ? `${Math.round((totalOut / totalIn) * 100)}% del ingreso` : undefined}
          base={base}
          settings={settings}
          selected={selected}
          isLinked={isLinked}
          onSelect={setSelected}
          onToggle={toggleEjecutado}
          onEdit={(t) => { setEditing(t); setOpen(true) }}
          onDelete={handleDelete}
          footer={
            selectedTx
              ? `${txLabel(selectedTx, settings)} · se resaltan las partidas vinculadas`
              : 'Clic en un movimiento para editarlo · pasá el mouse para ver su contrapartida · clic en el círculo para marcarlo ejecutado'
          }
        />
      </div>

      <TransactionModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        initialType={initialType}
      />
    </main>
  )
}

function LedgerColumn({
  kind, title, rows, total, headerSub, footer, base, settings,
  selected, isLinked, onSelect, onToggle, onEdit, onDelete,
}: {
  kind: 'in' | 'out'
  title: string
  rows: Transaction[]
  total: number
  headerSub?: string
  footer?: string
  base: Currency
  settings: Settings
  selected: string | null
  isLinked: (t: Transaction) => boolean
  onSelect: (id: string | null) => void
  onToggle: (t: Transaction) => void
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}) {
  const income = kind === 'in'
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-card">
      <header
        className={cn(
          'flex items-baseline justify-between border-b px-3.5 py-2.5',
          income ? 'bg-income-tint border-income-soft' : 'bg-expense-tint border-expense-soft',
        )}
      >
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-xs font-bold uppercase tracking-[0.06em]',
              income ? 'text-income' : 'text-expense',
            )}
          >
            {title}
          </span>
          <span className="text-xs tabular-nums text-muted">({rows.length})</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className={cn('text-[15px] font-bold tabular-nums', income ? 'text-income' : 'text-expense')}>
            <MoneyText amount={total} currency={base} />
          </div>
          {headerSub && <div className="whitespace-nowrap text-[11px] text-muted-2">{headerSub}</div>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-muted">
            Sin {income ? 'ingresos' : 'egresos'} que coincidan con los filtros.
          </p>
        ) : (
          rows.map((t) => (
            <LedgerRow
              key={t.id}
              t={t}
              kind={kind}
              base={base}
              settings={settings}
              isSelected={t.id === selected}
              isLinked={isLinked(t)}
              onHover={(on) => onSelect(on ? t.id ?? null : null)}
              onToggle={() => onToggle(t)}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
            />
          ))
        )}
      </div>

      {footer && (
        <div className="border-t border-border px-3.5 py-2 text-[11.5px] text-muted">{footer}</div>
      )}
    </section>
  )
}

function LedgerRow({
  t, kind, base, settings, isSelected, isLinked, onHover, onToggle, onEdit, onDelete,
}: {
  t: Transaction
  kind: 'in' | 'out'
  base: Currency
  settings: Settings
  isSelected: boolean
  isLinked: boolean
  onHover: (on: boolean) => void
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cat = getCatFromSettings(t.categoria, settings)
  const fecha = t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  // El importe principal siempre va en la moneda base: si se cargó en COP o USD
  // se muestra ya convertido, y abajo queda el importe original como referencia.
  // Si ya se cargó en la moneda base no hay segundo renglón: repetir el mismo
  // número en otra divisa solo ensucia la columna.
  const montoBase = toBase(t.monto, t.moneda, base, settings)
  const esOtraMoneda = t.moneda !== base
  const done = t.ejecutado
  const income = kind === 'in'

  // El grupo ubica al movimiento sin repetir el título; el estado ya se lee del
  // tachado y de quién lo cargó están los filtros de arriba.
  const meta = [txCategoryPath(t, settings), fecha].filter(Boolean).join(' · ')

  return (
    <div
      role="button"
      tabIndex={0}
      title="Editar movimiento"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'group grid cursor-pointer grid-cols-[3px_1fr_auto_auto] items-center gap-2.5 border-b border-border py-[7px] pr-3.5 transition-colors last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        income ? 'hover:bg-income-tint' : 'hover:bg-expense-tint',
        isLinked && !isSelected && 'bg-primary/5',
      )}
    >
      <span
        className={cn('h-7 rounded-r-[3px]', isLinked ? 'bg-primary' : 'bg-transparent')}
      />

      <span className="flex min-w-0 flex-col gap-px pl-[11px]">
        <span
          className={cn(
            'truncate text-[12.5px] font-semibold',
            done ? 'text-muted-2 line-through' : 'text-foreground',
          )}
        >
          {txLabel(t, settings)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10.5px] text-muted-2">
          <span
            className="h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ background: cat?.color ?? '#94a3b8' }}
          />
          <span className="truncate">{meta}</span>
        </span>
      </span>

      <span className="flex flex-col items-end gap-px text-right">
        <span
          className={cn(
            'text-[12.5px] font-bold tabular-nums',
            done ? 'text-muted-2 line-through' : income ? 'text-income' : 'text-expense',
          )}
        >
          {income ? '' : '−'}
          <MoneyText amount={montoBase} currency={base} />
        </span>
        {esOtraMoneda && (
          <span className="text-[10px] tabular-nums text-muted-2">
            <MoneyText amount={t.monto} currency={t.moneda} />
          </span>
        )}
      </span>

      <span className="relative flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="rounded text-muted-2 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          title={done ? 'Marcar pendiente' : income ? 'Marcar recibido' : 'Marcar pagado'}
          className={cn(
            'grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border-2 transition-colors',
            done
              ? income
                ? 'border-income bg-income text-white'
                : 'border-expense bg-expense text-white'
              : 'border-border-strong bg-transparent text-transparent hover:border-primary',
          )}
        >
          <Check className="h-2 w-2" strokeWidth={4} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
            <div className="absolute right-0 top-6 z-20 w-36 rounded-md border border-border bg-surface py-1 shadow-card-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit() }}
                className="inline-flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete() }}
                className="inline-flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-expense hover:bg-surface-2"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </div>
          </>
        )}
      </span>
    </div>
  )
}
