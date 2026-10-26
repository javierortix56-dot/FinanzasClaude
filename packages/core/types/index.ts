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

/** Usuario de la sesión de Supabase Auth */
export interface SessionUser {
  id: string
  email: string
  nombre: string
}

/**
 * Asignación parcial de un egreso a un ingreso.
 * Un egreso puede dividirse entre varios ingresos (p. ej. parte al sueldo
 * de Javier y el resto al de Mary). La suma de los montos debe cubrir el
 * total del egreso.
 */
export interface Asignacion {
  ingresoId: string
  /** Monto asignado, en la moneda del egreso */
  monto: number
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
  /** Ingresos a los que está asignado el egreso (vacío = sin asignar) */
  asignaciones: Asignacion[]
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
  /** Origen del valor: 'mep' | 'oficial' | 'blue' (promedio mensual automático) o ausente si se cargó a mano */
  fuente?: string
}

/** De dónde sale el tipo de cambio ARS/USD. COP siempre usa la TRM oficial en modo automático. */
export type FuenteCambio = 'mep' | 'oficial' | 'blue' | 'manual'

export interface Category {
  id: string
  nombre: string
  color: string
  activa: boolean
  /** Nombre del ícono (catálogo de la app mobile). Opcional: sin ícono se usa uno por defecto. */
  icono?: string
}

export interface CategoryGroup {
  id: string
  nombre: string
  color: string
  activa: boolean
  icono?: string
  subcategorias: Category[]
}

export interface AhorroLink {
  categoriaId: string
  assetId: string
}

export interface Settings {
  /** Moneda en la que se muestran los totales de la app */
  monedaBase?: Currency
  tipoCambio: {
    ARS_USD: number
    COP_USD: number
  }
  historialTipoCambio: ExchangeRateRecord[]
  /** Fuente de la cotización (por defecto MEP automático) */
  fuenteCambio?: FuenteCambio
  /** ISO de la última sincronización automática de cotizaciones */
  cambioActualizado?: string | null
  categoriasGasto: CategoryGroup[]
  categoriasIngreso: CategoryGroup[]
  tiposActivo: string[]
  tiposPasivo: string[]
  mesesCerrados?: string[]
  ahorroLinks?: AhorroLink[]
}

/** Compra en cuotas con tarjeta de crédito */
export interface CompraCuotas {
  id?: string
  descripcion: string
  /** Nombre libre de la tarjeta (Visa Galicia, Master Bancolombia, …) */
  tarjeta: string
  moneda: Currency
  /** Monto de CADA cuota, en la moneda de la compra */
  montoCuota: number
  totalCuotas: number
  /** Mes en que vence la primera cuota, formato 'YYYY-MM' */
  primerMes: string
  creadoPor: string
}

export interface Budget {
  id?: string
  userId: string
  categoria: string
  mes: string
  limite: number
  moneda: string
}
