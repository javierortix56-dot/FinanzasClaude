'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, X, Check, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MoneyText } from '@/components/MoneyText'
import { TransactionModal } from '@/components/modals/TransactionModal'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { getCatFromSettings, SHARED_USERS } from '@/lib/constants'
import { markEjecutado, deleteTransaction } from '@/lib/transactions'
import { useUIStore } from '@/store/useUIStore'
import { Transaction, TransactionType } from '@/types'

type Filter = 'todos' | 'ingreso' | 'egreso' | 'pendientes'

export default function MovimientosPage() {
  const { transactions } = useTransactionStore()
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)

  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const [persona, setPersona] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [initialType, setInitialType] = useState<TransactionType>('egreso')

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filter === 'ingreso' && t.tipo !== 'ingreso') return false
      if (filter === 'egreso' && t.tipo !== 'egreso') return false
      if (filter === 'pendientes' && t.ejecutado) return false
      if (categoria && t.categoria !== categoria) return false
      if (persona && t.creadoPor !== persona) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !t.descripcion.toLowerCase().includes(q) &&
          !t.nota.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
    .sort((a, b) => b.fecha.toDate().getTime() - a.fecha.toDate().getTime())
  }, [transactions, filter, categoria, persona, search])

  const allCategories = useMemo(() => {
    const list: { id: string; nombre: string; group: string }[] = []
    for (const g of [...settings.categoriasGasto, ...settings.categoriasIngreso]) {
      for (const sub of g.subcategorias) {
        list.push({ id: sub.id, nombre: sub.nombre, group: g.nombre })
      }
    }
    return list
  }, [settings])

  function openNew(type: TransactionType) {
    setEditing(null)
    setInitialType(type)
    setOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Movimientos</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openNew('ingreso')}>
            <Plus className="h-4 w-4" /> Ingreso
          </Button>
          <Button onClick={() => openNew('egreso')}>
            <Plus className="h-4 w-4" /> Egreso
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-center px-5 py-4 border-b border-border">
          <div className="inline-flex p-1 rounded-md bg-surface-2 border border-border">
            {(['todos', 'ingreso', 'egreso', 'pendientes'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-8 text-xs font-medium rounded transition-colors capitalize ${
                  filter === f ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                }`}
              >
                {f === 'pendientes' ? 'Pendientes' : f}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar concepto o nota…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-44"
          >
            <option value="">Todas las categorías</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.group} · {c.nombre}</option>
            ))}
          </Select>

          <Select
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-36"
          >
            <option value="">Todas las personas</option>
            {SHARED_USERS.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted bg-surface-2/60">
              <tr>
                <th className="px-5 py-2.5 font-medium w-10"></th>
                <th className="px-5 py-2.5 font-medium">Concepto</th>
                <th className="px-5 py-2.5 font-medium">Categoría</th>
                <th className="px-5 py-2.5 font-medium">Persona</th>
                <th className="px-5 py-2.5 font-medium">Fecha</th>
                <th className="px-5 py-2.5 font-medium text-right">Monto</th>
                <th className="px-5 py-2.5 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-muted text-sm">
                    No hay movimientos que coincidan con los filtros.
                  </td>
                </tr>
              ) : filtered.map((t) => (
                <Row
                  key={t.id}
                  t={t}
                  settings={settings}
                  onEdit={() => openEdit(t)}
                  onToggle={() => toggleEjecutado(t)}
                  onDelete={() => handleDelete(t)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border text-xs text-muted">
          {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
        </div>
      </Card>

      <TransactionModal
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        initialType={initialType}
      />
    </div>
  )
}

function Row({
  t,
  settings,
  onEdit,
  onToggle,
  onDelete,
}: {
  t: Transaction
  settings: typeof DEFAULT_SETTINGS
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const cat = getCatFromSettings(t.categoria, settings)
  const persona = SHARED_USERS.find((u) => u.id === t.creadoPor)?.nombre ?? '—'
  const date = t.fecha.toDate()
  const fechaStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/60 group">
      <td className="px-5 py-3">
        <button
          onClick={onToggle}
          title={t.ejecutado ? 'Marcar pendiente' : 'Marcar ejecutado'}
          className={`h-5 w-5 rounded-full border inline-flex items-center justify-center transition-colors ${
            t.ejecutado
              ? 'bg-income border-income text-white'
              : 'bg-surface border-border-strong text-transparent hover:border-primary'
          }`}
        >
          <Check className="h-3 w-3" />
        </button>
      </td>
      <td className="px-5 py-3 max-w-[320px]">
        <div className="text-sm text-foreground font-medium truncate">
          {t.descripcion || '(sin descripción)'}
        </div>
        {t.nota && <div className="text-xs text-muted truncate mt-0.5">{t.nota}</div>}
      </td>
      <td className="px-5 py-3">
        <span className="inline-flex items-center gap-2 text-xs text-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: cat?.color ?? '#94a3b8' }} />
          {cat?.nombre ?? '—'}
        </span>
      </td>
      <td className="px-5 py-3 text-xs text-muted">{persona}</td>
      <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">{fechaStr}</td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <div className={`text-sm font-semibold tabular-nums ${
          t.tipo === 'ingreso' ? 'text-income' : 'text-expense'
        }`}>
          {t.tipo === 'ingreso' ? '+' : '−'}
          <MoneyText amount={t.monto} currency={t.moneda} />
        </div>
        {!t.ejecutado && (
          <div className="mt-0.5">
            <Badge tone="warning" className="text-[10px] py-0">Pendiente</Badge>
          </div>
        )}
      </td>
      <td className="px-5 py-3 relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface-2"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-10 z-20 w-36 bg-surface border border-border rounded-md shadow-lg py-1">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2 inline-flex items-center gap-2"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-2 text-expense inline-flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}
