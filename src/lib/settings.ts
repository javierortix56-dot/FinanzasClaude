import { supabase, SHARED_UUID } from './supabase'
import { Settings } from '@/types'
import { DEFAULT_GASTO_CATEGORIES, DEFAULT_INGRESO_CATEGORIES } from './constants'

export const DEFAULT_SETTINGS: Settings = {
  tipoCambio: {
    ARS_USD: 1200,
    COP_USD: 4100,
  },
  historialTipoCambio: [],
  categoriasGasto: DEFAULT_GASTO_CATEGORIES.map((c) => ({ ...c, activa: true })),
  categoriasIngreso: DEFAULT_INGRESO_CATEGORIES.map((c) => ({ ...c, activa: true })),
  tiposActivo: ['Banco', 'Efectivo', 'Cripto', 'Inversiones', 'Ahorro'],
  tiposPasivo: ['Tarjeta de crédito', 'Préstamo', 'Deuda'],
  mesesCerrados: [],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSettings(row: Record<string, any>): Settings {
  const appSettings = row.app_settings ?? {}
  const accountCats = row.account_cats ?? {}
  const monthlyRates = row.monthly_rates ?? []
  // tipoCambio may be in app_settings, or we fall back to the latest monthly_rates entry
  const latestRate = monthlyRates.length > 0 ? monthlyRates[monthlyRates.length - 1] : null
  const tipoCambio = (appSettings.tipoCambio && typeof appSettings.tipoCambio.ARS_USD === 'number')
    ? appSettings.tipoCambio
    : latestRate
      ? { ARS_USD: latestRate.ARS_USD, COP_USD: latestRate.COP_USD }
      : DEFAULT_SETTINGS.tipoCambio
  return {
    tipoCambio,
    historialTipoCambio: Array.isArray(row.monthly_rates) ? row.monthly_rates : DEFAULT_SETTINGS.historialTipoCambio,
    categoriasGasto: Array.isArray(row.transaction_cats) ? row.transaction_cats : DEFAULT_SETTINGS.categoriasGasto,
    categoriasIngreso: Array.isArray(row.categories) ? row.categories : DEFAULT_SETTINGS.categoriasIngreso,
    tiposActivo: Array.isArray(accountCats.tiposActivo) ? accountCats.tiposActivo : DEFAULT_SETTINGS.tiposActivo,
    tiposPasivo: Array.isArray(accountCats.tiposPasivo) ? accountCats.tiposPasivo : DEFAULT_SETTINGS.tiposPasivo,
    mesesCerrados: Array.isArray(row.closed_months) ? row.closed_months : [],
  }
}

function settingsToRow(settings: Settings) {
  return {
    user_id: SHARED_UUID,
    app_settings: { tipoCambio: settings.tipoCambio },
    monthly_rates: settings.historialTipoCambio,
    transaction_cats: settings.categoriasGasto,
    categories: settings.categoriasIngreso,
    account_cats: { tiposActivo: settings.tiposActivo, tiposPasivo: settings.tiposPasivo },
    closed_months: settings.mesesCerrados ?? [],
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
  async function fetchAndNotify() {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('user_id', SHARED_UUID)
      .maybeSingle()

    if (!error && data) callback(rowToSettings(data))
  }

  fetchAndNotify()

  const channel = supabase
    .channel('configuracion-shared')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, fetchAndNotify)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function updateSettings(_userId: string, partial: Partial<Settings>) {
  // fetch current then merge
  const current = await getOrInitSettings(_userId)
  const merged = { ...current, ...partial }

  const { error } = await supabase
    .from('configuracion')
    .upsert(settingsToRow(merged), { onConflict: 'user_id' })

  if (error) throw error
}
