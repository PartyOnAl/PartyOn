/**
 * Paid vs free entry — same rules as Event Management (`EventManagement.tsx`).
 */

export type EventPriceFields = {
  ticket_price?: string | null
  final_ticket_price?: string | null
  event_type?: string | null
}

/** Numeric € price from final_ticket_price (preferred) or ticket_price; null = unset / non-numeric (free entry in UI). */
export function parseEventTicketPriceEuro(ev: EventPriceFields): number | null {
  const raw = ev.final_ticket_price ?? ev.ticket_price
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '') return null
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function eventTypeImpliesFreeEntry(ev: EventPriceFields): boolean {
  const t = ev.event_type?.trim().toLowerCase() ?? ''
  if (!t) return false
  return t === 'free entry' || t === 'free' || /\bfree\s+entry\b/.test(t)
}

/** Paid entry: positive stored price; not overridden by an explicit "free entry" event type. */
export function isPaidTicketEvent(ev: EventPriceFields): boolean {
  if (eventTypeImpliesFreeEntry(ev)) return false
  const n = parseEventTicketPriceEuro(ev)
  return n !== null && n > 0
}

export type ReservationStatusFields = { status?: string | null }

export function reservationIsConfirmed(r: ReservationStatusFields): boolean {
  const s = (r.status ?? '').trim().toLowerCase()
  return s === 'confirmed'
}

export type ReservationGuestFields = {
  nr_of_people?: number | null
}

/** Guest headcount for a single reservation row. Returns 0 when nr_of_people is null/unset. */
export function reservationGuestCount(r: ReservationGuestFields): number {
  return r.nr_of_people || 0
}

/** Sum of guest headcounts across many reservation rows. */
export function totalGuestCount(rows: ReservationGuestFields[]): number {
  return rows.reduce((sum, r) => sum + reservationGuestCount(r), 0)
}
