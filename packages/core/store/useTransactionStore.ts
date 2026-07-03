import { create } from 'zustand'
import { Transaction } from '../types'
import { getCurrentMonth, shiftMonth, toLocalDateString } from '../lib/constants'

// ── Caché de meses con persistencia en localStorage ──────────────────────────
// Navegar entre meses ya visitados es instantáneo (se muestra el caché y el
// fetch de fondo reconcilia), y la PWA arranca con los datos de la última
// sesión en vez de un spinner.

const CACHE_KEY = 'finanzas-tx-cache-v1'
const MAX_CACHED_MONTHS = 8

type SerializedTx = Omit<Transaction, 'fecha'> & { fecha: string }

function serializeTx(tx: Transaction): SerializedTx {
  return { ...tx, fecha: toLocalDateString(tx.fecha.toDate()) }
}

function reviveTx(row: SerializedTx): Transaction {
  const dateStr = row.fecha
  return { ...row, fecha: { toDate: () => new Date(dateStr + 'T12:00:00') } }
}

function loadCache(): Record<string, Transaction[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SerializedTx[]>
    return Object.fromEntries(
      Object.entries(parsed).map(([m, rows]) => [m, rows.map(reviveTx)])
    )
  } catch {
    return {}
  }
}

function persistCache(cache: Record<string, Transaction[]>) {
  if (typeof window === 'undefined') return
  try {
    const months = Object.keys(cache).sort().slice(-MAX_CACHED_MONTHS)
    const out: Record<string, SerializedTx[]> = {}
    for (const m of months) out[m] = cache[m].map(serializeTx)
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(out))
  } catch {
    // localStorage lleno o bloqueado (modo privado): seguimos solo en memoria
  }
}

/** Borra los datos persistidos (se llama al cerrar sesión). */
export function clearTransactionCache() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(CACHE_KEY) } catch { /* noop */ }
}

function monthOf(tx: Transaction): string {
  const d = tx.fecha.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface TransactionState {
  transactions: Transaction[]
  currentMonth: string
  /** true solo cuando no hay NADA para mostrar (ni caché) del mes actual */
  isLoading: boolean
  /** Datos autoritativos del servidor para un mes (fetch/realtime) */
  setMonthTransactions: (month: string, txs: Transaction[]) => void
  /** Update optimista: inserta/actualiza según la fecha del movimiento */
  upsertTransaction: (tx: Transaction) => void
  /** Update optimista: merge parcial sobre un movimiento existente */
  patchTransaction: (id: string, partial: Partial<Transaction>) => void
  /** Update optimista: elimina de todos los meses cacheados */
  removeTransaction: (id: string) => void
  prevMonth: () => void
  nextMonth: () => void
}

export const useTransactionStore = create<TransactionState>((set, get) => {
  const cache: Record<string, Transaction[]> = loadCache()
  const initialMonth = getCurrentMonth()

  function syncCurrent() {
    const { currentMonth } = get()
    set({ transactions: cache[currentMonth] ?? [] })
    persistCache(cache)
  }

  function removeFromCache(id: string) {
    for (const m of Object.keys(cache)) {
      cache[m] = cache[m].filter((t) => t.id !== id)
    }
  }

  function upsert(tx: Transaction) {
    removeFromCache(tx.id!)
    const m = monthOf(tx)
    cache[m] = [...(cache[m] ?? []), tx]
    syncCurrent()
  }

  function goToMonth(month: string) {
    const cached = cache[month]
    set({
      currentMonth: month,
      transactions: cached ?? [],
      isLoading: cached === undefined,
    })
  }

  return {
    transactions: cache[initialMonth] ?? [],
    currentMonth: initialMonth,
    isLoading: !(initialMonth in cache),

    setMonthTransactions: (month, txs) => {
      cache[month] = txs
      persistCache(cache)
      if (month === get().currentMonth) {
        set({ transactions: txs, isLoading: false })
      }
    },

    upsertTransaction: upsert,

    patchTransaction: (id, partial) => {
      for (const m of Object.keys(cache)) {
        const found = cache[m].find((t) => t.id === id)
        if (found) {
          upsert({ ...found, ...partial })
          return
        }
      }
    },

    removeTransaction: (id) => {
      removeFromCache(id)
      syncCurrent()
    },

    prevMonth: () => goToMonth(shiftMonth(get().currentMonth, -1)),
    nextMonth: () => goToMonth(shiftMonth(get().currentMonth, +1)),
  }
})
