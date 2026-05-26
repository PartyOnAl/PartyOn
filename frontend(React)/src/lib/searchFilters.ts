import type { Club, Event } from '@/types'
import { cityMatchKey } from '@/lib/cityNormalize'

export type SearchFilters = {
  /** Text filter for events (hero + `/search?q=`). Case-insensitive. */
  query: string
  /** Text filter for clubs (navbar + `/search?cq=`). Case-insensitive. */
  clubQuery: string
  city: string
  musicType: string
  time: 'all' | 'tonight' | 'weekend'
  category: 'all' | 'free' | 'live' | 'clubs' | 'festivals'
}

export const defaultSearchFilters = (): SearchFilters => ({
  query: '',
  clubQuery: '',
  city: 'all',
  musicType: 'all',
  time: 'all',
  category: 'all',
})

export function eventMatchesSearchFilters(event: Event, f: SearchFilters): boolean {
  const query = f.query.trim().toLowerCase()
  const haystack = [
    event.title,
    event.club,
    event.city,
    event.musicType,
    event.genre,
  ]
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .join(' ')
    .toLowerCase()

  const matchesQuery = query.length === 0 || haystack.includes(query)

  const matchesCity =
    f.city === 'all' ||
    (event.city.trim() !== '' && cityMatchKey(event.city) === cityMatchKey(f.city))

  const evMusic = event.musicType.trim().toLowerCase()
  const filterMusic = f.musicType.trim().toLowerCase()
  const matchesMusic =
    f.musicType === 'all' ||
    (event.musicType.trim() !== '' &&
      event.musicType.trim() !== '—' &&
      evMusic === filterMusic)

  const timeMatch = event.date.match(/(\d{1,2}):(\d{2})\s*$/)
  const hour = timeMatch ? Number(timeMatch[1]) : NaN
  const isTonight = Number.isFinite(hour) && hour >= 18
  const isWeekend = /^(Fri|Sat|Sun)\b/i.test(event.date.trim())
  const matchesTime =
    f.time === 'all' ||
    (f.time === 'tonight' && (!Number.isFinite(hour) || isTonight)) ||
    (f.time === 'weekend' && isWeekend)

  let matchesCategory = true
  if (f.category === 'free') {
    matchesCategory = event.price <= 0
  } else if (f.category === 'live') {
    matchesCategory =
      /live\s*music|acoustic|unplugged|jazz\s*night|concert|open\s*mic/i.test(haystack)
  } else if (f.category === 'clubs') {
    matchesCategory = !/\b(dining|dinner|brunch|restaurant|bistro)\b/i.test(haystack)
  } else if (f.category === 'festivals') {
    matchesCategory = /\bfestival|fest\b|rave|block\s*party/i.test(haystack)
  }

  return (
    matchesQuery && matchesCity && matchesMusic && matchesTime && matchesCategory
  )
}

/** Clubs in suggestions: respect city filter only (no music/time on venue). */
export function clubMatchesSuggestionCityFilter(club: Club, f: SearchFilters): boolean {
  if (f.city === 'all') return true
  const c = club.city?.trim()
  if (!c) return false
  return cityMatchKey(c) === cityMatchKey(f.city)
}

export function searchFiltersToQueryString(f: SearchFilters): string {
  const p = new URLSearchParams()
  const q = f.query.trim()
  if (q) p.set('q', q)
  const cq = f.clubQuery.trim()
  if (cq) p.set('cq', cq)
  if (f.city !== 'all') p.set('city', f.city)
  if (f.musicType !== 'all') p.set('musicType', f.musicType)
  if (f.time !== 'all') p.set('time', f.time)
  if (f.category !== 'all') p.set('category', f.category)
  return p.toString()
}

export function parseSearchParams(searchParams: URLSearchParams): SearchFilters {
  const time = searchParams.get('time')
  const category = searchParams.get('category')
  return {
    query: searchParams.get('q') ?? '',
    clubQuery: searchParams.get('cq') ?? '',
    city: searchParams.get('city')?.trim() || 'all',
    musicType: searchParams.get('musicType')?.trim() || 'all',
    time:
      time === 'tonight' || time === 'weekend'
        ? time
        : 'all',
    category:
      category === 'free' ||
      category === 'live' ||
      category === 'clubs' ||
      category === 'festivals'
        ? category
        : 'all',
  }
}
