import type { User } from '@supabase/supabase-js'

/** Staff roles that may only use the PartyOn mobile app (not the customer web app). */
export const MOBILE_ONLY_STAFF_ROLES = ['hostess', 'security'] as const

export type MobileOnlyStaffRole = (typeof MOBILE_ONLY_STAFF_ROLES)[number]

/** Roles managers can assign when creating staff accounts (web Add Staff form + API). */
export const INVITE_STAFF_ROLES = ['hostess', 'security', 'staff_manager'] as const

export type InviteStaffRole = (typeof INVITE_STAFF_ROLES)[number]

export function getStaffRoleFromUser(user: User | null | undefined): string | null {
  const r = user?.user_metadata?.staff_role
  if (typeof r !== 'string') return null
  const t = r.trim()
  return t || null
}

export function isMobileOnlyStaffRole(role: string | null): role is MobileOnlyStaffRole {
  return role === 'hostess' || role === 'security'
}

/** Any venue staff account (metadata.staff_role), excluding club managers who use profiles.role instead. */
export function isVenueStaffAccount(user: User | null | undefined): boolean {
  return getStaffRoleFromUser(user) != null
}
