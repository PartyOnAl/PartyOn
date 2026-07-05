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

export type AuthLane = 'user' | 'manager' | 'admin'

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
export const adminSupabase = createPartyOnClient('partyon-admin-auth')

export const supabase: SupabaseClient | null = userSupabase

/**
 * Change the authenticated user's password via a direct REST call to Supabase's
 * auth endpoint. This avoids the GoTrue JS client's internal `currentSession`
 * check (which throws "Auth session missing!" when the in-memory state is stale)
 * and avoids `setSession()` triggering `onAuthStateChange` → SIGNED_OUT events
 * that redirect the user away before the update can complete.
 */
export async function updatePasswordViaRest(
  accessToken: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ password: newPassword }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      message?: string
      msg?: string
      error_description?: string
      error?: string
    }
    throw new Error(
      body.message ??
      body.msg ??
      body.error_description ??
      body.error ??
      `HTTP ${res.status}`,
    )
  }
}
