import { getJson } from '@/api'
import type { SearchFilters } from '@/lib/searchFilters'

export type SuggestionItem = {
  id: string
  name: string
  type: 'event' | 'club' | 'dj'
  date?: string
  location?: string
}

export type SuggestionsPayload = {
  events: SuggestionItem[]
  clubs: SuggestionItem[]
  djs: SuggestionItem[]
}

function buildSuggestionsUrl(q: string, filters: SearchFilters): string {
  const p = new URLSearchParams()
  p.set('q', q)
  if (filters.city !== 'all') p.set('city', filters.city)
  if (filters.musicType !== 'all') p.set('musicType', filters.musicType)
  if (filters.time !== 'all') p.set('time', filters.time)
  if (filters.category !== 'all') p.set('category', filters.category)
  return `/suggestions?${p.toString()}`
}

export async function fetchSuggestions(
  q: string,
  filters: SearchFilters,
  signal?: AbortSignal,
): Promise<{ data: SuggestionsPayload | null; error: string | null }> {
  const trimmed = q.trim()
  if (!trimmed) {
    return {
      data: { events: [], clubs: [], djs: [] },
      error: null,
    }
  }
  const { data, error } = await getJson<SuggestionsPayload>(
    buildSuggestionsUrl(trimmed, filters),
    signal ? { signal } : undefined,
  )
  return { data, error }
}
