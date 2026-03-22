import { createClient } from '@supabase/supabase-js'

// Fallback placeholders prevent build-time crash when env vars are absent (SSG).
// At runtime in the browser the real values are always present.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
)

/** UUID used as user_id for all shared records */
export const SHARED_UUID = '00000000-0000-0000-0000-000000000000'
