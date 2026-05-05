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
  ahorroAssetId?: string | null
}

export interface AssetSnapshot {
  /** Mes en formato 'YYYY-MM' */
  month: string
  /** Aporte/retiro neto del mes en la moneda del activo (positivo = aporte, negativo = retiro) */
  aporte: number
  /** Saldo al cierre del mes en la moneda del activo */
  saldo: number
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
  /** Snapshots históricos por mes (incluye opcionalmente el mes de fechaAlta) */
  snapshots: AssetSnapshot[]
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
