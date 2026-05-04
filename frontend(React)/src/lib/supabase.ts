import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Web (Vite) — same Supabase project as Expo mobile:
 *   EXPO_PUBLIC_SUPABASE_URL → VITE_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY → VITE_SUPABASE_ANON_KEY
 * Dashboard “publishable” key → VITE_SUPABASE_PUBLISHABLE_KEY (or reuse ANON_KEY).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function createPartyOnClient(storageKey: string): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey,
    },
  })
}

export const userSupabase = createPartyOnClient('partyon-user-auth')
export const managerSupabase = createPartyOnClient('partyon-manager-auth')

export const supabase: SupabaseClient | null = userSupabase
