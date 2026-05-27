import {
  createClient,
  type AuthError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js'

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

function createPartyOnClient(
  storageKey: string,
  options?: { detectSessionInUrl?: boolean },
): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
      storageKey,
    },
  })
}

export const userSupabase = createPartyOnClient('partyon-user-auth', {
  detectSessionInUrl: true,
})
export const managerSupabase = createPartyOnClient('partyon-manager-auth')
/** Platform admin dashboard — isolated from customer and club-manager sessions. */
export const adminSupabase = createPartyOnClient('partyon-admin-auth')
/** Temporary password-login lane; cleared after copying into the final role lane. */
export const loginSupabase = createPartyOnClient('partyon-login-auth')

export type AuthLane = 'user' | 'manager' | 'admin'

export function authLaneFromPathname(pathname: string): AuthLane {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/manager')) return 'manager'
  return 'user'
}

export function authClientForLane(lane: AuthLane): SupabaseClient | null {
  switch (lane) {
    case 'admin':
      return adminSupabase
    case 'manager':
      return managerSupabase
    default:
      return userSupabase
  }
}

function currentPathname(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

/** Lane for the current URL (or explicit lane). */
export function getSupabaseClient(lane?: AuthLane): SupabaseClient | null {
  return authClientForLane(lane ?? authLaneFromPathname(currentPathname()))
}

/**
 * Default export for customer-facing pages (`/home`, bookings, profile, etc.).
 * Manager/admin code must use `managerSupabase` / `adminSupabase` or `getSupabaseClient()`.
 */
export const supabase: SupabaseClient | null = userSupabase

type AuthUserResult = {
  data: { user: User | null }
  error: AuthError | null
}

/**
 * Server-validated user for the active auth lane:
 * `/admin/*` → adminSupabase, `/manager/*` → managerSupabase, else userSupabase.
 */
export async function getAuthUser(lane?: AuthLane): Promise<AuthUserResult> {
  const client = getSupabaseClient(lane)
  if (!client) {
    return { data: { user: null }, error: null }
  }
  return client.auth.getUser()
}
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
