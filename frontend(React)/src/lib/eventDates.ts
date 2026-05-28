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

/** `time without time zone` for reservations (`expected_arrival_time`). */
export function formatPostgresTime(hour: number, minute: number): string {
  const h = Math.max(0, Math.min(23, hour))
  const m = Math.max(0, Math.min(59, minute))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function parseClockToken(token: string): [number, number] | null {
  const s = token.trim().replace(/\s+/g, ' ')
  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (m12) {
    let h = Number(m12[1])
    const min = Number(m12[2])
    const ap = m12[3].toUpperCase()
    if (h < 1 || h > 12 || min < 0 || min > 59) return null
    if (ap === 'PM' && h !== 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return [h, min]
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) {
    const h = Number(m24[1])
    const min = Number(m24[2])
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return [h, min]
  }
  return null
}

function collectClockTokens(text: string): string[] {
  const tokens: string[] = []
  const re = /\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?/gi
  for (const m of text.matchAll(re)) {
    tokens.push(m[0].trim())
  }
  return tokens
}

/** First doors-open time as PostgreSQL `time` (24h `HH:MM:SS`). */
export function arrivalTimeFromEvent(ev: {
  doorsOpen?: string | null
  date?: string
  rawDate?: string | null
}): string {
  const hoursText = ev.doorsOpen?.trim()
  if (hoursText) {
    for (const token of collectClockTokens(hoursText)) {
      const parts = parseClockToken(token)
      if (parts) return formatPostgresTime(parts[0], parts[1])
    }
  }
  const iso = ev.rawDate?.trim()
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      return formatPostgresTime(d.getHours(), d.getMinutes())
    }
  }
  const fromDate = ev.date?.match(/(\d{1,2}):(\d{2})/)
  if (fromDate) {
    const h = Number(fromDate[1])
    const m = Number(fromDate[2])
    if (h >= 0 && h <= 23) return formatPostgresTime(h, m)
  }
  return '22:00:00'
}
