import type { AuthError, User } from '@supabase/supabase-js'

export const ACCOUNT_BLOCKED_MESSAGE =
  'Your account has been blocked. Contact support if you believe this is a mistake.'

/** Supabase sets `banned_until` when an admin blocks a user via `ban_duration`. */
export function isUserBlocked(user: User | null | undefined): boolean {
  const raw = user?.banned_until
  if (!raw) return false
  const until = new Date(raw)
  if (Number.isNaN(until.getTime())) return false
  return until.getTime() > Date.now()
}

export function isAuthBanError(error: AuthError | null | undefined): boolean {
  if (!error) return false
  const msg = error.message.toLowerCase()
  return msg.includes('banned') || msg.includes('user is banned')
}
