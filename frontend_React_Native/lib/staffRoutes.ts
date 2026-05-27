import type { Href } from 'expo-router'

const BODYGUARD_ROLES = new Set([
  'staff',
  'bodyguard',
  'door_staff',
  'doorstaff',
  'security',
  'bouncer',
])

/** Default screen after venue staff sign-in. */
export function getStaffHomeHref(role: string | null | undefined): Href {
  const r = String(role ?? '').toLowerCase().trim()
  if (r === 'host') return '/hostess'
  if (BODYGUARD_ROLES.has(r)) return '/guard/guard'
  return '/(staff)'
}

export function isVenueStaffRole(role: string | null | undefined): boolean {
  const r = String(role ?? '').toLowerCase().trim()
  return r === 'host' || BODYGUARD_ROLES.has(r)
}
