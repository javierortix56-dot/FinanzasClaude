export type Currency = 'ARS' | 'COP' | 'USD'

export type TransactionType = 'ingreso' | 'egreso'

/** Compat shim so code calling .toDate() still works with Supabase date strings */
export interface FechaCompat {
  toDate: () => Date
}

export interface User {
  nombre: string
  email: string
  monedaBase: Currency
}

export interface Transaction {
  id?: string
  userId: string
  tipo: TransactionType
  monto: number
  moneda: Currency
  categoria: string
  descripcion: string
  nota: string
  tags: string[]
  fecha: FechaCompat
  ejecutado: boolean
  asignadoA: string | null
  creadoPor: string
  recurrente?: boolean
  /** Si el movimiento está vinculado a una cuenta de ahorro del patrimonio. */
  ahorroAssetId?: string | null
  /** Monto efectivamente sumado al activo (en la moneda del activo). Para revertir con precisión. */
  ahorroDelta?: number | null
}

export interface Asset {
  id?: string
  userId: string
  nombre: string
  tipo: string   // activo: 'banco'|'efectivo'|'cripto'|'inversiones'|'ahorro'; pasivo: tiposPasivo string
  clase: 'activo' | 'pasivo'
  moneda: Currency
  saldo: number
  fechaAlta: FechaCompat
  metaObjetivo: number | null
  metaMoneda: string | null
}

export interface ExchangeRateRecord {
  mes: string
  ARS_USD: number
  COP_USD: number
}

export interface Category {
  id: string
  nombre: string
  color: string
  activa: boolean
}

export interface CategoryGroup {
  id: string
  nombre: string
  color: string
  activa: boolean
  subcategorias: Category[]
}

export interface Settings {
  tipoCambio: {
    ARS_USD: number
    COP_USD: number
  }
  historialTipoCambio: ExchangeRateRecord[]
  categoriasGasto: CategoryGroup[]
  categoriasIngreso: CategoryGroup[]
  tiposActivo: string[]
  tiposPasivo: string[]
  mesesCerrados?: string[]
}

export interface Budget {
  id?: string
  userId: string
  categoria: string
  mes: string
  limite: number
  moneda: string
}
