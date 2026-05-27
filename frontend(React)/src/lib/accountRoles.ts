import type { User } from '@supabase/supabase-js'

type ProfileLike = { role?: string | null } | null | undefined

export function normalizeRole(value: unknown): string {
  return String(value ?? '').toLowerCase().trim()
}

export function roleFromUser(user: User | null | undefined): string | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  const app = user.app_metadata ?? {}
  const candidates = [meta.role, app.role, meta.user_role, meta.account_role]
  for (const candidate of candidates) {
    const normalized = normalizeRole(candidate)
    if (normalized) return normalized
  }
  return null
}

export function resolveAccountRole(
  user: User | null | undefined,
  profile?: ProfileLike,
  roleHint?: unknown,
): string | null {
  const fromProfile = normalizeRole(profile?.role)
  if (fromProfile) return fromProfile
  const fromHint = normalizeRole(roleHint)
  if (fromHint) return fromHint
  return roleFromUser(user)
}

export function isAdminRole(role: unknown): boolean {
  const normalized = normalizeRole(role)
  return (
    normalized === 'admin' ||
    normalized === 'superadmin' ||
    normalized === 'super_admin'
  )
}

export function isManagerRole(role: unknown): boolean {
  return normalizeRole(role) === 'manager'
}
