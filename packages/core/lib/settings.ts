import { supabase, SHARED_UUID } from './supabase'
import { Settings, CategoryGroup, Category } from '../types'
import { DEFAULT_GASTO_CATEGORY_GROUPS, DEFAULT_INGRESO_CATEGORY_GROUPS } from './constants'

export const DEFAULT_SETTINGS: Settings = {
  monedaBase: 'ARS',
  tipoCambio: {
    ARS_USD: 1200,
    COP_USD: 4100,
  },
  historialTipoCambio: [],
  categoriasGasto:   DEFAULT_GASTO_CATEGORY_GROUPS,
  categoriasIngreso: DEFAULT_INGRESO_CATEGORY_GROUPS,
  tiposActivo:  ['Banco', 'Efectivo', 'Cripto', 'Inversiones', 'Ahorro'],
  tiposPasivo:  ['Tarjeta de crédito', 'Préstamo', 'Deuda'],
  mesesCerrados: [],
  ahorroLinks: [],
}

// ── Migración de formato viejo (Category[]) → nuevo (CategoryGroup[]) ────────
function isGroup(item: unknown): item is CategoryGroup {
  return typeof item === 'object' && item !== null && 'subcategorias' in item
}

function migrateToGroups(items: unknown[], defaults: CategoryGroup[]): CategoryGroup[] {
  if (!Array.isArray(items) || items.length === 0) return defaults
  if (isGroup(items[0])) return items as CategoryGroup[]
  // Formato viejo: Category[] → cada categoría se convierte en grupo sin subcategorías
  return (items as Category[]).map((c) => ({
    id:            c.id,
    nombre:        c.nombre,
    color:         c.color,
    activa:        c.activa ?? true,
    subcategorias: [],
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSettings(row: Record<string, any>): Settings {
  const appSettings  = row.app_settings  ?? {}
  const accountCats  = row.account_cats  ?? {}
  const monthlyRates = row.monthly_rates ?? []
  const latestRate   = monthlyRates.length > 0 ? monthlyRates[monthlyRates.length - 1] : null
  const tipoCambio   = (appSettings.tipoCambio && typeof appSettings.tipoCambio.ARS_USD === 'number')
    ? appSettings.tipoCambio
    : latestRate
      ? { ARS_USD: latestRate.ARS_USD, COP_USD: latestRate.COP_USD }
      : DEFAULT_SETTINGS.tipoCambio

  const monedaBase = ['ARS', 'COP', 'USD'].includes(appSettings.monedaBase)
    ? appSettings.monedaBase
    : 'ARS'

  return {
    monedaBase,
    tipoCambio,
    historialTipoCambio: Array.isArray(row.monthly_rates)  ? row.monthly_rates : [],
    categoriasGasto:     migrateToGroups(row.transaction_cats, DEFAULT_GASTO_CATEGORY_GROUPS),
    categoriasIngreso:   migrateToGroups(row.categories,       DEFAULT_INGRESO_CATEGORY_GROUPS),
    tiposActivo:  Array.isArray(accountCats.tiposActivo) ? accountCats.tiposActivo : DEFAULT_SETTINGS.tiposActivo,
    tiposPasivo:  Array.isArray(accountCats.tiposPasivo) ? accountCats.tiposPasivo : DEFAULT_SETTINGS.tiposPasivo,
    mesesCerrados: Array.isArray(row.closed_months) ? row.closed_months : [],
    ahorroLinks: Array.isArray(appSettings.ahorroLinks) ? appSettings.ahorroLinks : [],
  }
}

function settingsToRow(settings: Settings, existingAppSettings: Record<string, unknown> = {}) {
  return {
    user_id:         SHARED_UUID,
    // app_settings comparte columna con claves que este módulo no maneja
    // (p. ej. budgets, que lib/budgets.ts guarda acá) — preservarlas.
    app_settings:    { ...existingAppSettings, monedaBase: settings.monedaBase ?? 'ARS', tipoCambio: settings.tipoCambio, ahorroLinks: settings.ahorroLinks ?? [] },
    monthly_rates:   settings.historialTipoCambio,
    transaction_cats: settings.categoriasGasto,
    categories:      settings.categoriasIngreso,
    account_cats:    { tiposActivo: settings.tiposActivo, tiposPasivo: settings.tiposPasivo },
    closed_months:   settings.mesesCerrados ?? [],
  }
}

export async function getOrInitSettings(_userId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', SHARED_UUID)
    .maybeSingle()

  if (error) {
    console.error('[settings] fetch error:', error)
    return DEFAULT_SETTINGS
  }

  if (!data) {
    const { error: insErr } = await supabase
      .from('configuracion')
      .insert(settingsToRow(DEFAULT_SETTINGS))
    if (insErr) console.error('[settings] init error:', insErr)
    return DEFAULT_SETTINGS
  }

  return rowToSettings(data)
}

export function subscribeToSettings(
  _userId: string,
  callback: (s: Settings) => void
): () => void {
  let active = true

  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('user_id', SHARED_UUID)
      .maybeSingle()

    if (!active) return

    if (!error && data) callback(rowToSettings(data))
  }

  fetchAndNotify()

  const channel = supabase
    .channel(`configuracion-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, fetchAndNotify)
    .subscribe()

  return () => { active = false; supabase.removeChannel(channel) }
}

export async function updateSettings(_userId: string, partial: Partial<Settings>) {
  // Releer la fila cruda justo antes de escribir, para mergear sobre el estado
  // más reciente y preservar las claves ajenas de app_settings (budgets).
  // Riesgo residual: dos escrituras simultáneas siguen pudiendo pisarse entre
  // el read y el write (no hay transacción) — aceptable para 2 usuarios.
  const { data, error: fetchErr } = await supabase
    .from('configuracion')
    .select('*')
    .eq('user_id', SHARED_UUID)
    .maybeSingle()
  if (fetchErr) throw fetchErr

  const current = data ? rowToSettings(data) : DEFAULT_SETTINGS
  const merged  = { ...current, ...partial }
  const { error } = await supabase
    .from('configuracion')
    .upsert(settingsToRow(merged, data?.app_settings ?? {}), { onConflict: 'user_id' })
  if (error) throw error
}
