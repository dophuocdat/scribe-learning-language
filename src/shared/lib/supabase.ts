import { createClient } from '@supabase/supabase-js'
// TODO: Enable typed client once Database type is regenerated via `supabase gen types`
// import type { Database } from '@/shared/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create a .env file — see .env.example'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
