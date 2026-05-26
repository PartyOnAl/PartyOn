import type { User } from '@supabase/supabase-js'

/** True when the user must set a new password before using the app (staff bootstrap flow). */
export function userMustChangePassword(user: User | null | undefined): boolean {
  const v = user?.user_metadata?.must_change_password as unknown
  if (v === true) return true
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true
  return false
}
