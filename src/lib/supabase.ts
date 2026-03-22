import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/** UUID used as user_id for all shared records */
export const SHARED_UUID = '00000000-0000-0000-0000-000000000000'
