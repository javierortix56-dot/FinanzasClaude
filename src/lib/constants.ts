export const SHARED_USER_ID = 'shared'

export const SHARED_USERS = [
  { id: 'javier', nombre: 'Javier' },
  { id: 'mary',   nombre: 'Mary'   },
]

export const DEFAULT_GASTO_CATEGORIES = [
  { id: 'vivienda',        nombre: 'Vivienda',        color: '#8B5CF6' },
  { id: 'alimentacion',   nombre: 'Alimentación',    color: '#10B981' },
  { id: 'transporte',     nombre: 'Transporte',      color: '#3B82F6' },
  { id: 'salud',          nombre: 'Salud',           color: '#EF4444' },
  { id: 'entretenimiento',nombre: 'Entretenimiento', color: '#F59E0B' },
  { id: 'ropa',           nombre: 'Ropa',            color: '#EC4899' },
  { id: 'educacion',      nombre: 'Educación',       color: '#6366F1' },
  { id: 'servicios',      nombre: 'Servicios',       color: '#14B8A6' },
  { id: 'ahorro',         nombre: 'Ahorro',          color: '#534AB7' },
  { id: 'otros_gasto',    nombre: 'Otros',           color: '#6B7280' },
]

export const DEFAULT_INGRESO_CATEGORIES = [
  { id: 'sueldo',          nombre: 'Sueldo',         color: '#10B981' },
  { id: 'freelance',       nombre: 'Freelance',      color: '#3B82F6' },
  { id: 'inversiones',     nombre: 'Inversiones',    color: '#8B5CF6' },
  { id: 'regalo',          nombre: 'Regalo',         color: '#EC4899' },
  { id: 'otros_ingreso',   nombre: 'Otros',          color: '#6B7280' },
]

export const ALL_CATEGORIES = [...DEFAULT_GASTO_CATEGORIES, ...DEFAULT_INGRESO_CATEGORIES]

export function getCategoryById(id: string) {
  return ALL_CATEGORIES.find((c) => c.id === id)
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
