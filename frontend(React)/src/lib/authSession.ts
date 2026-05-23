import type { Session, SupabaseClient } from '@supabase/supabase-js'

import { isAdminRole, roleFromUser } from './accountRoles'
import { adminSupabase, managerSupabase, type AuthLane } from './supabase'

export const ADMIN_ROLE_HINT_KEY = 'partyon-admin-role-hint'

/**
 * One-time compatibility: older admin sessions may have been saved under the
 * manager storage key. If so, copy that session into the admin client.
 */
export async function migrateLegacyAdminSession(): Promise<boolean> {
  if (!adminSupabase || !managerSupabase) return false

  const { data: existing } = await adminSupabase.auth.getSession()
  if (existing.session) return true

  const { data: legacy } = await managerSupabase.auth.getSession()
  if (!legacy.session) return false

  let isAdmin = isAdminRole(roleFromUser(legacy.session.user))
  if (!isAdmin && legacy.session.user?.id) {
    const { data: profile } = await managerSupabase
      .from('profiles')
      .select('role')
      .eq('id', legacy.session.user.id)
      .single()
    isAdmin = isAdminRole(profile?.role)
  }
  if (!isAdmin) return false

  const { error } = await adminSupabase.auth.setSession({
    access_token: legacy.session.access_token,
    refresh_token: legacy.session.refresh_token,
  })
  if (error) return false

  const { data } = await adminSupabase.auth.getSession()
  if (data.session) persistAdminRoleHint(data.session.user)
  return Boolean(data.session)
}

/**
 * Restore the persisted session for exactly one auth lane. This never signs out;
 * it only reads storage and, if possible, refreshes the stored refresh token.
 */
export async function recoverPersistedSession(
  client: SupabaseClient,
  lane: AuthLane,
): Promise<Session | null> {
  if (lane === 'admin') {
    await migrateLegacyAdminSession()
  }

  const { data: current } = await client.auth.getSession()
  if (current.session) return current.session

  const { data: refreshed, error } = await client.auth.refreshSession()
  if (!error && refreshed.session) return refreshed.session

  return null
}

export function persistAdminRoleHint(user: Session['user'] | null | undefined): void {
  const role = roleFromUser(user)
  if (isAdminRole(role)) {
    sessionStorage.setItem(ADMIN_ROLE_HINT_KEY, role ?? 'admin')
  }
}
