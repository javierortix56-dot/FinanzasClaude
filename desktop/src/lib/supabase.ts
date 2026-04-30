import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

// Log en consola para verificar configuración (solo URL, no la clave)
if (typeof window !== 'undefined') {
  if (supabaseUrl === 'https://placeholder.supabase.co') {
    console.error('[supabase] ⚠️  NEXT_PUBLIC_SUPABASE_URL no está configurada en este entorno')
  } else {
    console.log('[supabase] URL configurada:', supabaseUrl.replace(/https?:\/\//, '').slice(0, 30) + '...')
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey)

/** UUID used as user_id for all shared records */
export const SHARED_UUID = '00000000-0000-0000-0000-000000000000'
