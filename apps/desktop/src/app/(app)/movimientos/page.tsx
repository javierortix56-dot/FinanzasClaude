'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Search, X, Check, MoreHorizontal, Pencil, Trash2, Link2 } from 'lucide-react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { Select } from '@/components/ui/input'
import { MoneyText } from '@/components/MoneyText'
import { TransactionModal } from '@/components/modals/TransactionModal'
import { LedgerStats, LedgerTabs } from '@/components/ledger/LedgerHeader'
import { Segmented } from '@/components/ui/segmented'
import { CategoryIcon } from '@finanzas/core/lib/categoryIcons'
import { deleteTransactionsWithUndo } from '@finanzas/core/lib/undo'
import { stagger } from '@/components/ui/motion'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { getCatFromSettings, SHARED_USERS } from '@finanzas/core/lib/constants'
import { markEjecutado } from '@finanzas/core/lib/transactions'
import { toBase } from '@finanzas/core/lib/currency'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { cn } from '@finanzas/core/lib/utils'
import { Currency, Settings, Transaction, TransactionType } from '@finanzas/core/types'

type Filter = 'todas' | 'pendientes' | 'javier' | 'mary'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'javier', label: 'Javier' },
  { value: 'mary', label: 'Mary' },
]

export default function MovimientosPage() {
  const { transactions } = useTransactionStore()
  const settings = (useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS) as Settings
  const { monedaBase } = useAuthStore()
  const showToast = useUIStore((s) => s.showToast)

  const [filter, setFilter] = useState<Filter>('todas')
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [initialType, setInitialType] = useState<TransactionType>('egreso')

  const base = monedaBase as Currency

  // Escape limpia la selección del libro (si no hay un diálogo abierto)
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  function matches(t: Transaction) {
    if (filter === 'pendientes' && t.ejecutado) return false
    if (filter === 'javier' && t.creadoPor !== 'javier') return false
    if (filter === 'mary' && t.creadoPor !== 'mary') return false
    if (categoria && t.categoria !== categoria) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.descripcion.toLowerCase().includes(q) && !t.nota.toLowerCase().includes(q)) return false
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

  // Sin confirm() nativo: se borra al instante (revirtiendo el saldo de la
  // cuenta de ahorro si corresponde) y el toast ofrece "Deshacer" (⌘Z).
  async function handleDelete(t: Transaction) {
    if (!t.id) return
    if (selected === t.id) setSelected(null)
    try {
      await deleteTransactionsWithUndo([t])
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
            className="glass w-full rounded-xl py-[7px] pl-[30px] pr-8 text-[13px] text-foreground placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <AnimatePresence>
          {search && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-[15px] w-[15px]" />
            </motion.button>
          )}
          </AnimatePresence>
        </div>

        <Segmented id="mov-filter" size="sm" value={filter} onChange={setFilter} options={FILTERS} />

        <Select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="h-[33px] w-44 rounded-xl py-0 text-[12.5px]"
        >
          <option value="">Todas las categorías</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.group} · {c.nombre}</option>
          ))}
        </Select>

        <div className="flex gap-2">
          <button
            onClick={() => openNew('ingreso')}
            className="glass inline-flex items-center gap-1 rounded-xl px-3 py-[7px] text-[12.5px] font-semibold text-income transition-[filter,transform] hover:brightness-105 active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" /> Ingreso
          </button>
          <button
            onClick={() => openNew('egreso')}
            className="bg-brand inline-flex items-center gap-1 rounded-xl px-3 py-[7px] text-[12.5px] font-semibold text-primary-foreground shadow-card transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
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
            selectedTx ? (
              <span className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  <b className="font-semibold text-foreground">{selectedTx.descripcion || '(sin descripción)'}</b>
                  {' · '}{linkedIds.size - 1} {linkedIds.size - 1 === 1 ? 'partida vinculada' : 'partidas vinculadas'} · Esc para limpiar
                </span>
              </span>
            ) : 'Clic en un movimiento para ver su contrapartida · clic en el círculo para marcarlo ejecutado'
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
  footer?: React.ReactNode
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
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: income ? 0.05 : 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex min-h-0 flex-col overflow-hidden rounded-[18px]"
    >
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
          <div className={cn('text-[15px] font-bold tnum', income ? 'text-income' : 'text-expense')}>
            <MoneyText amount={total} currency={base} animated />
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
          <AnimatePresence initial={false}>
          {rows.map((t, i) => (
            <LedgerRow
              key={t.id}
              index={i}
              t={t}
              kind={kind}
              settings={settings}
              isSelected={t.id === selected}
              isLinked={isLinked(t)}
              dimmed={selected !== null && !isLinked(t)}
              onSelect={() => onSelect(t.id === selected ? null : t.id ?? null)}
              onToggle={() => onToggle(t)}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
          </AnimatePresence>
        )}
      </div>

      {footer && (
        <div className="border-t border-hairline px-3.5 py-2 text-[11.5px] text-muted">{footer}</div>
      )}
    </motion.section>
  )
}

function LedgerRow({
  index, t, kind, settings, isSelected, isLinked, dimmed, onSelect, onToggle, onEdit, onDelete,
}: {
  index: number
  t: Transaction
  kind: 'in' | 'out'
  settings: Settings
  isSelected: boolean
  isLinked: boolean
  dimmed: boolean
  onSelect: () => void
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cat = getCatFromSettings(t.categoria, settings)
  const persona = SHARED_USERS.find((u) => u.id === t.creadoPor)?.nombre ?? '—'
  const fecha = t.fecha.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  // El renglón en USD es una referencia, no un importe operable: se redondea
  // para que la columna de montos no se llene de decimales.
  const usd = Math.round(toBase(t.monto, t.moneda, 'USD', settings))
  const done = t.ejecutado
  const income = kind === 'in'

  const meta = [cat?.nombre ?? '—', fecha, persona, ...(done ? [] : ['pendiente'])].join(' · ')

  return (
    <motion.div
      layout="position"
      onClick={onSelect}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dimmed ? 0.34 : 1, y: 0 }}
      exit={{ opacity: 0, x: income ? -24 : 24, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.25, delay: stagger(index, 0.015, 0.2), ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative grid cursor-pointer grid-cols-[3px_1fr_auto_auto] items-center gap-2.5 overflow-hidden border-b border-hairline py-[7px] pr-3.5 transition-colors last:border-0',
        income ? 'hover:bg-income-tint' : 'hover:bg-expense-tint',
        isSelected && 'bg-primary/8',
        menuOpen && 'overflow-visible z-10',
      )}
    >
      <motion.span
        initial={false}
        animate={{ scaleY: isLinked ? 1 : 0, opacity: isLinked ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="h-7 rounded-r-[3px] bg-primary origin-center"
      />

      <span className="flex min-w-0 flex-col gap-px pl-[11px]">
        <span
          className={cn(
            'truncate text-[12.5px] font-semibold',
            done ? 'text-muted-2 line-through' : 'text-foreground',
          )}
        >
          {t.descripcion || '(sin descripción)'}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[10.5px] text-muted-2">
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px]"
            style={{ background: `${cat?.color ?? '#94a3b8'}22`, color: cat?.color ?? '#94a3b8' }}
          >
            {cat && <CategoryIcon cat={cat} size={10} />}
          </span>
          <span className="truncate">{meta}</span>
        </span>
      </span>

      <span className="flex flex-col items-end gap-px text-right">
        <span
          className={cn(
            'text-[12.5px] font-bold tnum',
            done ? 'text-muted-2 line-through' : income ? 'text-income' : 'text-expense',
          )}
        >
          {income ? '' : '−'}
          <MoneyText amount={t.monto} currency={t.moneda} />
        </span>
        <span className="text-[10px] tnum text-muted-2">
          <MoneyText amount={usd} currency="USD" />
        </span>
      </span>

      <span className="relative flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="rounded text-muted-2 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <motion.button
          whileTap={{ scale: 0.8 }}
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
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="glass-strong absolute right-0 top-6 z-20 w-40 origin-top-right rounded-xl p-1"
              >
                <MenuItem icon={Pencil} onClick={() => { setMenuOpen(false); onEdit() }}>Editar</MenuItem>
                <MenuItem icon={Check} onClick={() => { setMenuOpen(false); onToggle() }}>
                  {done ? 'Marcar pendiente' : income ? 'Marcar recibido' : 'Marcar pagado'}
                </MenuItem>
                <MenuItem icon={Trash2} danger onClick={() => { setMenuOpen(false); onDelete() }}>Eliminar</MenuItem>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </span>
    </motion.div>
  )
}

function MenuItem({ icon: Icon, danger, onClick, children }: {
  icon: React.ComponentType<{ className?: string }>
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'inline-flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2',
        danger ? 'text-expense' : 'text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}
