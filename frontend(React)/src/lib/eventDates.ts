/**
 * Matches Expo `lib/eventDates.ts` so "past event" matches mobile bookings.
 */

type EventLike = {
  event_starting_date?: string | null
  event_ending_date?: string | null
  event_hours?: string | null
}

function dateParts(value: string | null | undefined): [number, number, number] | null {
  if (!value) return null
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
}

function hourParts(value: string | null | undefined): [number, number][] {
  if (!value) return []
  const matches = value.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\b/g) ?? []
  return matches.slice(0, 2).map(part => {
    const [h, m = '0'] = part.split(':')
    return [Number(h), Number(m)]
  })
}

function localDate(value: string | null | undefined, time?: [number, number] | null): Date | null {
  const parts = dateParts(value)
  if (!parts) return null
  const [year, month, day] = parts
  const [hour, minute] = time ?? [0, 0]
  return new Date(year, month, day, hour, minute, 0, 0)
}

export function eventStartDateTime(event: EventLike): Date | null {
  return localDate(event.event_starting_date, hourParts(event.event_hours)[0])
}

export function eventEndDateTime(event: EventLike): Date | null {
  const times = hourParts(event.event_hours)
  const start = eventStartDateTime(event)
  const end = localDate(event.event_ending_date || event.event_starting_date, times[1])

  if (end) {
    if (start && end <= start) end.setDate(end.getDate() + 1)
    return end
  }

  if (!start) return null
  const fallback = new Date(start)
  fallback.setHours(23, 59, 59, 999)
  return fallback
}

export function isEventPast(event: EventLike, now = new Date()): boolean {
  const end = eventEndDateTime(event)
  return !!end && end < now
}
