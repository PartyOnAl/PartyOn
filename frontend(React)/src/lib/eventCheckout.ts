import type { Event, EventDetail } from '@/types'

export function parsePrice(value: unknown): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : 0
}

/** Table reservation flow (not ticket checkout). */
export function isReservationFlow(
  ev: Pick<Event, 'reservationOnly' | 'ticketRequired'> | null | undefined,
): boolean {
  if (!ev) return false
  if (ev.reservationOnly === true) return true
  if (ev.ticketRequired === false) return true
  return false
}

/** Ticket purchase via Stripe. */
export function eventNeedsTicket(
  ev: Pick<Event, 'reservationOnly' | 'ticketRequired' | 'price'> | null | undefined,
): boolean {
  if (!ev) return false
  if (isReservationFlow(ev)) return false
  if (ev.ticketRequired === true) return true
  return parsePrice(ev.price) > 0
}

export function resolveEventPrice(
  ev?: Pick<Event, 'price'> | null,
  legacy?: { final_ticket_price?: number | string; ticket_price?: number | string } | null,
): number {
  const candidates = [ev?.price, legacy?.final_ticket_price, legacy?.ticket_price]
  for (const value of candidates) {
    const n = parsePrice(value)
    if (n > 0) return n
  }
  return 0
}

export type LegacyEventPay = {
  event_id?: string
  event_name?: string
  event_starting_date?: string
  event_image?: string
  final_ticket_price?: number | string
  ticket_price?: number | string
  currency?: string
}

/** Minimal body for POST /event/pay — omit images (often multi‑MB base64 → 413). */
export function buildStripeEventPayload(args: {
  eventId: string
  eventName: string
  legacy?: LegacyEventPay | null
}): Pick<LegacyEventPay, 'event_id' | 'event_name'> {
  const { eventId, eventName, legacy } = args
  return {
    event_id: legacy?.event_id ?? eventId,
    event_name: legacy?.event_name ?? eventName,
  }
}

/** Prefer catalog detail, then navigation state, then list cache. */
export function pickEventForFlow(
  detail: EventDetail | null,
  stateEvent: Event | EventDetail | null | undefined,
  catalogList: Event | undefined,
): EventDetail | null {
  if (detail) return detail
  if (stateEvent) {
    return {
      ticketTypes: [],
      reservationOnly: stateEvent.reservationOnly === true,
      ...stateEvent,
    } as EventDetail
  }
  if (catalogList) {
    return {
      ticketTypes: [],
      reservationOnly: catalogList.reservationOnly === true,
      ...catalogList,
    } as EventDetail
  }
  return null
}
