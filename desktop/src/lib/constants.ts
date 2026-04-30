import { Category, CategoryGroup, Settings } from '@/types'

export const SHARED_USER_ID = 'shared'

export const SHARED_USERS = [
  { id: 'javier', nombre: 'Javier' },
  { id: 'mary',   nombre: 'Mary'   },
]

// ── Defaults de categorías en formato árbol ────────────────────────────────

export const DEFAULT_GASTO_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'grp_esenciales', nombre: 'Esenciales', color: '#8B5CF6', activa: true,
    subcategorias: [
      { id: 'vivienda',      nombre: 'Vivienda',      color: '#8B5CF6', activa: true },
      { id: 'alimentacion',  nombre: 'Alimentación',  color: '#10B981', activa: true },
      { id: 'salud',         nombre: 'Salud',          color: '#EF4444', activa: true },
      { id: 'educacion',     nombre: 'Educación',      color: '#6366F1', activa: true },
      { id: 'servicios',     nombre: 'Servicios',      color: '#14B8A6', activa: true },
    ],
  },
  {
    id: 'grp_variable', nombre: 'Variable', color: '#F59E0B', activa: true,
    subcategorias: [
      { id: 'transporte',      nombre: 'Transporte',      color: '#3B82F6', activa: true },
      { id: 'entretenimiento', nombre: 'Entretenimiento', color: '#F59E0B', activa: true },
      { id: 'ropa',            nombre: 'Ropa',             color: '#EC4899', activa: true },
    ],
  },
  {
    id: 'grp_financiero', nombre: 'Financiero', color: '#534AB7', activa: true,
    subcategorias: [
      { id: 'ahorro', nombre: 'Ahorro', color: '#534AB7', activa: true },
    ],
  },
  {
    id: 'grp_otros_gasto', nombre: 'Otros', color: '#6B7280', activa: true,
    subcategorias: [
      { id: 'otros_gasto', nombre: 'Otros', color: '#6B7280', activa: true },
    ],
  },
]

export const DEFAULT_INGRESO_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'grp_laboral', nombre: 'Laboral', color: '#10B981', activa: true,
    subcategorias: [
      { id: 'sueldo',    nombre: 'Sueldo',    color: '#10B981', activa: true },
      { id: 'freelance', nombre: 'Freelance', color: '#3B82F6', activa: true },
    ],
  },
  {
    id: 'grp_pasivo_ing', nombre: 'Pasivo', color: '#8B5CF6', activa: true,
    subcategorias: [
      { id: 'inversiones', nombre: 'Inversiones', color: '#8B5CF6', activa: true },
    ],
  },
  {
    id: 'grp_otros_ingreso', nombre: 'Otros', color: '#6B7280', activa: true,
    subcategorias: [
      { id: 'regalo',       nombre: 'Regalo', color: '#EC4899', activa: true },
      { id: 'otros_ingreso', nombre: 'Otros', color: '#6B7280', activa: true },
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

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

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
