import { Category, CategoryGroup, Settings } from '../types'

export const SHARED_USER_ID = 'shared'

export const SHARED_USERS = [
  { id: 'javier', nombre: 'Javier' },
  { id: 'mary',   nombre: 'Mary'   },
]

// ── Defaults de categorías en formato árbol ────────────────────────────────

export const DEFAULT_GASTO_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'grp_esenciales', nombre: 'Esenciales', color: '#3B82F6', activa: true,
    subcategorias: [
      { id: 'vivienda',      nombre: 'Vivienda',      color: '#3B82F6', activa: true },
      { id: 'alimentacion',  nombre: 'Alimentación',  color: '#22C55E', activa: true },
      { id: 'salud',         nombre: 'Salud',          color: '#EF4444', activa: true },
      { id: 'educacion',     nombre: 'Educación',      color: '#6366F1', activa: true },
      { id: 'servicios',     nombre: 'Servicios',      color: '#06B6D4', activa: true },
    ],
  },
  {
    id: 'grp_variable', nombre: 'Variable', color: '#F97316', activa: true,
    subcategorias: [
      { id: 'transporte',      nombre: 'Transporte',      color: '#F97316', activa: true },
      { id: 'entretenimiento', nombre: 'Entretenimiento', color: '#A855F7', activa: true },
      { id: 'ropa',            nombre: 'Ropa',             color: '#EC4899', activa: true },
    ],
  },
  {
    id: 'grp_financiero', nombre: 'Financiero', color: '#8B5CF6', activa: true,
    subcategorias: [
      { id: 'ahorro', nombre: 'Ahorro', color: '#8B5CF6', activa: true },
    ],
  },
  {
    id: 'grp_otros_gasto', nombre: 'Otros', color: '#94A3B8', activa: true,
    subcategorias: [
      { id: 'otros_gasto', nombre: 'Otros', color: '#94A3B8', activa: true },
    ],
  },
]

export const DEFAULT_INGRESO_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'grp_laboral', nombre: 'Laboral', color: '#22C55E', activa: true,
    subcategorias: [
      { id: 'sueldo',    nombre: 'Sueldo',    color: '#22C55E', activa: true },
      { id: 'freelance', nombre: 'Freelance', color: '#06B6D4', activa: true },
    ],
  },
  {
    id: 'grp_pasivo_ing', nombre: 'Pasivo', color: '#F59E0B', activa: true,
    subcategorias: [
      { id: 'inversiones', nombre: 'Inversiones', color: '#F59E0B', activa: true },
    ],
  },
  {
    id: 'grp_otros_ingreso', nombre: 'Otros', color: '#94A3B8', activa: true,
    subcategorias: [
      { id: 'regalo',       nombre: 'Regalo', color: '#EC4899', activa: true },
      { id: 'otros_ingreso', nombre: 'Otros', color: '#94A3B8', activa: true },
    ],
  },
]

// Lista plana de todos los defaults (para backward-compat con getCategoryById)
function flattenGroups(groups: CategoryGroup[]): Category[] {
  return groups.flatMap((g) => [
    { id: g.id, nombre: g.nombre, color: g.color, activa: g.activa },
    ...g.subcategorias,
  ])
}

const ALL_DEFAULT_CATEGORIES: Category[] = [
  ...flattenGroups(DEFAULT_GASTO_CATEGORY_GROUPS),
  ...flattenGroups(DEFAULT_INGRESO_CATEGORY_GROUPS),
]

/** Busca en los defaults. Para categorías custom usá getCatFromSettings. */
export function getCategoryById(id: string): Category | undefined {
  return ALL_DEFAULT_CATEGORIES.find((c) => c.id === id)
}

/** Busca en settings (incluye custom) con fallback a defaults. */
export function getCatFromSettings(id: string, settings: Settings | null): Category | undefined {
  const allGroups = [
    ...(settings?.categoriasGasto   ?? DEFAULT_GASTO_CATEGORY_GROUPS),
    ...(settings?.categoriasIngreso ?? DEFAULT_INGRESO_CATEGORY_GROUPS),
  ]
  for (const g of allGroups) {
    if (g.id === id) return { id: g.id, nombre: g.nombre, color: g.color, activa: g.activa }
    const sub = g.subcategorias.find((s) => s.id === id)
    if (sub) return sub
  }
  return getCategoryById(id)
}

/** Dado un ID de subcategoría, retorna el grupo padre (buscando en settings). */
export function getParentGroup(subId: string, groups: CategoryGroup[]): CategoryGroup | undefined {
  return groups.find((g) => g.subcategorias.some((s) => s.id === subId))
}

export function formatAmount(monto: number, moneda: string): string {
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto)
  return `${moneda} ${num}`
}

/**
 * Parsea un monto escrito por el usuario aceptando formato es-AR:
 *   "1.234,56" → 1234.56 · "1500,50" → 1500.5 · "1.500" → 1500 · "1.5" → 1.5
 * Devuelve NaN si no es un número válido. Los negativos se rechazan salvo
 * que se pase allowNegative (p. ej. retiros en snapshots).
 */
export function parseAmount(input: string, opts: { allowNegative?: boolean } = {}): number {
  let raw = input.trim().replace(/\s+/g, '')
  let negative = false
  if (raw.startsWith('-')) {
    if (!opts.allowNegative) return NaN
    negative = true
    raw = raw.slice(1)
  }
  if (!raw) return NaN

  const lastDot   = raw.lastIndexOf('.')
  const lastComma = raw.lastIndexOf(',')
  let normalized: string
  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos separadores: el que está más a la derecha es el decimal
    const thousands = lastDot > lastComma ? ',' : '.'
    normalized = raw.split(thousands).join('').replace(',', '.')
  } else if (lastComma !== -1) {
    // Solo coma: decimal si aparece una vez, separador de miles si se repite
    const commas = raw.split(',').length - 1
    normalized = commas > 1 ? raw.split(',').join('') : raw.replace(',', '.')
  } else if (lastDot !== -1) {
    // Solo punto: "1.234.567" o "1.500" (es-AR) son miles; "1.5"/"0.500" decimal
    const dots = raw.split('.').length - 1
    const digitsAfter = raw.length - lastDot - 1
    const intPart = raw.slice(0, raw.indexOf('.'))
    normalized = dots > 1 || (digitsAfter === 3 && intPart !== '' && intPart !== '0')
      ? raw.split('.').join('')
      : raw
  } else {
    normalized = raw
  }

  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(normalized)) return NaN
  const n = parseFloat(normalized)
  if (!Number.isFinite(n)) return NaN
  return negative ? -n : n
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Fecha de hoy en formato YYYY-MM-DD usando la zona horaria LOCAL (no UTC). */
export function getCurrentDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Indica si un mes (YYYY-MM) está cerrado en settings → solo lectura. */
export function isMonthClosed(month: string, settings: Settings | null): boolean {
  return !!settings?.mesesCerrados?.includes(month)
}

/** Mensaje estándar al bloquear ediciones en un mes cerrado. */
export const CLOSED_MONTH_MSG = 'Mes cerrado: solo lectura'

export function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
