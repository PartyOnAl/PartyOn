export const NO_SHOW_STATUS = 'NoShow'
export const DEFAULT_NO_SHOW_GRACE_MINUTES = 30
export const NO_SHOW_GRACE_PERIOD_KEY = 'partyOn_manager_noShowGraceMinutes'
export const NO_SHOW_BADGE_KEY = 'partyOn_manager_noShowBadgeCount'
export const NO_SHOW_BADGE_EVENT = 'partyOn:no-show-badge'

export type NoShowStatus = 'before_start' | 'countdown' | 'expired' | 'no_show' | 'inactive'

export function normalizeReservationStatus(status: string | null | undefined): string {
  return String(status ?? '').toLowerCase().replace(/[\s_-]/g, '')
}

export function reservationIsNoShow(status: string | null | undefined): boolean {
  return normalizeReservationStatus(status) === 'noshow'
}

export function loadNoShowGraceMinutes(): number {
  const raw = window.localStorage.getItem(NO_SHOW_GRACE_PERIOD_KEY)
  const value = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_NO_SHOW_GRACE_MINUTES
}

export function saveNoShowGraceMinutes(value: number): number {
  const safeValue = Math.max(1, Math.min(240, Math.round(value)))
  window.localStorage.setItem(NO_SHOW_GRACE_PERIOD_KEY, String(safeValue))
  return safeValue
}

export function getNoShowBadgeCount(): number {
  const value = Number.parseInt(window.localStorage.getItem(NO_SHOW_BADGE_KEY) ?? '0', 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function incrementNoShowBadgeCount(): number {
  const next = getNoShowBadgeCount() + 1
  window.localStorage.setItem(NO_SHOW_BADGE_KEY, String(next))
  window.dispatchEvent(new CustomEvent(NO_SHOW_BADGE_EVENT, { detail: next }))
  return next
}

export function clearNoShowBadgeCount(): void {
  window.localStorage.setItem(NO_SHOW_BADGE_KEY, '0')
  window.dispatchEvent(new CustomEvent(NO_SHOW_BADGE_EVENT, { detail: 0 }))
}

export function getNoShowDeadline(eventStartIso: string | null | undefined, graceMinutes: number): Date | null {
  if (!eventStartIso) return null
  const start = new Date(eventStartIso)
  if (Number.isNaN(start.getTime())) return null
  return new Date(start.getTime() + graceMinutes * 60_000)
}

export function getNoShowState(
  status: string | null | undefined,
  eventStartIso: string | null | undefined,
  graceMinutes: number,
  nowMs: number,
  tableOccupied = false,
): { state: NoShowStatus; remainingMs: number; deadline: Date | null } {
  if (reservationIsNoShow(status)) {
    return { state: 'no_show', remainingMs: 0, deadline: getNoShowDeadline(eventStartIso, graceMinutes) }
  }
  if (normalizeReservationStatus(status) !== 'confirmed' || tableOccupied) {
    return { state: 'inactive', remainingMs: 0, deadline: getNoShowDeadline(eventStartIso, graceMinutes) }
  }
  const deadline = getNoShowDeadline(eventStartIso, graceMinutes)
  if (!deadline || !eventStartIso) return { state: 'inactive', remainingMs: 0, deadline }
  const startMs = new Date(eventStartIso).getTime()
  if (nowMs < startMs) return { state: 'before_start', remainingMs: deadline.getTime() - nowMs, deadline }
  const remainingMs = deadline.getTime() - nowMs
  return {
    state: remainingMs <= 0 ? 'expired' : 'countdown',
    remainingMs: Math.max(0, remainingMs),
    deadline,
  }
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
