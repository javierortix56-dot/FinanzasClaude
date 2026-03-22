import { Timestamp } from 'firebase/firestore'

export type Currency = 'ARS' | 'COP' | 'USD'

export type TransactionType = 'ingreso' | 'egreso'

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
  fecha: Timestamp
  ejecutado: boolean
  asignadoA: string | null
  creadoPor: string
}

export interface Asset {
  id?: string
  userId: string
  nombre: string
  tipo: 'banco' | 'efectivo' | 'cripto' | 'inversiones' | 'ahorro'
  clase: 'activo' | 'pasivo'
  moneda: Currency
  saldo: number
  fechaAlta: Timestamp
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

export interface Settings {
  tipoCambio: {
    ARS_USD: number
    COP_USD: number
  }
  historialTipoCambio: ExchangeRateRecord[]
  categoriasGasto: Category[]
  categoriasIngreso: Category[]
  tiposActivo: string[]
  tiposPasivo: string[]
}

export interface Budget {
  id?: string
  userId: string
  categoria: string
  mes: string
  limite: number
  moneda: string
}
