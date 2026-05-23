import {
  getSupabaseClient,
  isSupabaseConfigured,
  type AuthLane,
} from '@/lib/supabase'

/**
 * Reads the current Supabase session and refreshes if the access token is
 * expired or about to expire, so Nest's SupabaseJwtGuard receives a valid JWT.
 * React `session` from context can lag behind after tab sleep or clock skew.
 * Uses the lane for the current route unless `lane` is passed explicitly.
 */
export async function getAccessTokenForApi(
  lane?: AuthLane,
): Promise<string | null> {
  const client = getSupabaseClient(lane)
  if (!isSupabaseConfigured || !client) return null

  const { data: first, error: e1 } = await client.auth.getSession()
  if (e1 || !first.session?.access_token) return null

  let session = first.session
  const expMs = session.expires_at != null ? session.expires_at * 1000 : null
  const needsRefresh =
    expMs != null && expMs <= Date.now() + 60_000

  if (needsRefresh) {
    const { data: ref, error: e2 } = await client.auth.refreshSession()
    if (!e2 && ref.session?.access_token) {
      session = ref.session
    }
  }

  return session.access_token ?? null
}
