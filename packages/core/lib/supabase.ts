import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'


export const supabase = createClient(supabaseUrl, supabaseKey)

/** UUID used as user_id for all shared records */
export const SHARED_UUID = '00000000-0000-0000-0000-000000000000'
