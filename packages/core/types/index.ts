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
  /**
   * Egreso pagado con tarjeta de crédito (en lugar de asignarse a un ingreso):
   * no consume ingresos este mes y se suma al pago de la tarjeta del mes siguiente.
   */
  tarjetaId?: string | null
  /** Presente solo en el pago automático de una tarjeta (ver lib/tarjetas.ts) */
  pagoTarjeta?: PagoTarjeta | null
}

/** Tarjeta de crédito (se configura en Ajustes) */
export interface Tarjeta {
  id: string
  nombre: string
  color: string
  /** Primer mes (YYYY-MM) cuyo pago incluye las cuotas de la tarjeta */
  desde: string
}

/**
 * Desglose del pago mensual de una tarjeta, en una moneda. El monto del
 * movimiento es el abono (lo que se paga); total − abono pasa al mes siguiente.
 */
export interface PagoTarjeta {
  tarjetaId: string
  /** Mes del pago (YYYY-MM) */
  mes: string
  moneda: Currency
  /** Gastos del mes anterior asignados a la tarjeta */
  consumos: number
  /** Cuotas que vencen este mes */
  cuotas: number
  /** Lo que quedó sin pagar el mes anterior */
  saldoAnterior: number
  total: number
  /** true si el abono se fijó a mano (menor al total) */
  abonoManual: boolean
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
  /** Criterio de gastos hormiga en Resúmenes */
  hormiga?: { topeUsd: number; minCompras: number }
  tarjetas?: Tarjeta[]
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

/** Resumen de tarjeta o cuenta importado (PDF/CSV/Excel) */
export type ResumenTipo = 'tarjeta' | 'cuenta'

export type ResumenItemTipo =
  | 'consumo' | 'debito_automatico' | 'pago' | 'impuesto' | 'percepcion' | 'interes'
  | 'comision' | 'financiacion' | 'devolucion' | 'transferencia' | 'ajuste' | 'otro'

/** Cabecera y condiciones del resumen, tal como las informa el banco (todo opcional) */
export interface ResumenDetalle {
  producto: string | null
  /** YYYY-MM-DD */
  fechaCierre: string | null
  fechaVencimiento: string | null
  proximoCierre: string | null
  proximoVencimiento: string | null
  saldoAnteriorArs: number | null
  saldoAnteriorUsd: number | null
  saldoActualArs: number | null
  saldoActualUsd: number | null
  pagoMinimo: number | null
  limiteCompra: number | null
  limiteFinanciacion: number | null
  limiteAdelanto: number | null
  limiteCuotas: number | null
  /** Tasas en porcentaje (72.97 = 72,97 %) */
  tna: number | null
  tem: number | null
  tea: number | null
  cftea: number | null
  tipoCambio: number | null
  /** Cuadro "Total de cuotas a vencer"; desde = acumulado "a partir de" ese mes */
  cuotasAVencer: { mes: string; monto: number; desde: boolean }[]
  saldoFinanciable: number | null
  planesOfrecidos: { cuotas: number; montoCuota: number; tna: number | null; cftea: number | null }[]
  avisos: {
    tipo: 'comision' | 'tasa' | 'beneficio' | 'condicion' | 'otro'
    texto: string
    vigencia: string | null
    monto: number | null
  }[]
}

export interface ResumenItem {
  id?: string
  resumenId?: string
  /** YYYY-MM-DD */
  fecha: string
  descripcion: string
  /** Nombre normalizado para agrupar entre meses */
  comercio: string
  /** Positivo = gasto/débito; negativo = pago, devolución o crédito */
  monto: number
  moneda: Currency
  cuotaActual: number | null
  cuotaTotal: number | null
  tipo: ResumenItemTipo
  /** id de categoría sugerida (gasto) */
  categoria: string | null
  /** Titular o adicional, si el resumen separa los consumos por persona */
  titular: string | null
  /** Nombre que propuso la IA (solo durante la revisión; no se guarda) */
  comercioOriginal?: string
}

export interface Resumen {
  id?: string
  emisor: string
  tipo: ResumenTipo
  /** YYYY-MM del cierre */
  periodo: string
  moneda: Currency
  total: number | null
  archivo: string
  creadoPor: string
  createdAt?: string
  /** null en resúmenes cargados antes de que se extrajera la cabecera */
  detalle: ResumenDetalle | null
  items: ResumenItem[]
}
