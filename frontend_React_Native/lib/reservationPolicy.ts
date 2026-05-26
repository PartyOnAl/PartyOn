export const DEFAULT_RESERVATION_HOLD_MINUTES = 30

export function normalizeReservationHoldMinutes(value: unknown) {
  const raw = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(raw)) return DEFAULT_RESERVATION_HOLD_MINUTES
  return Math.min(240, Math.max(0, Math.round(raw)))
}

export function reservationHoldPolicyText(value: unknown) {
  const minutes = normalizeReservationHoldMinutes(value)
  if (minutes === 0) {
    return 'Your table is held until the event start time. After that, the venue may release it if you have not checked in.'
  }
  return `Your table is held for ${minutes} minute${minutes === 1 ? '' : 's'} after the event start time. After that, the venue may release it if you have not checked in.`
}

export function reservationHoldShortText(value: unknown) {
  const minutes = normalizeReservationHoldMinutes(value)
  if (minutes === 0) return 'Held until event start'
  return `Held for ${minutes} min after start`
}
