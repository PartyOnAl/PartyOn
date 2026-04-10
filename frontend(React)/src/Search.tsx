import { useMemo, useState, type ReactNode, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCatalog } from '@/contexts/CatalogContext'
import type { Club } from '@/types'
import {
  defaultSearchFilters,
  eventMatchesSearchFilters,
  clubMatchesSuggestionCityFilter,
  parseSearchParams,
  searchFiltersToQueryString,
  type SearchFilters,
} from '@/lib/searchFilters'
import './Search.css'

const FALLBACK_THUMB = 'linear-gradient(135deg, #6366f1, #a855f7)'

function eventThumb(imageUrl: string): string {
  const u = imageUrl?.trim()
  if (u && (u.startsWith('http://') || u.startsWith('https://'))) {
    return `url(${u}) center/cover no-repeat`
  }
  return FALLBACK_THUMB
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 9h16M8 5V3M16 5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 3v18M16 8.5a3 3 0 0 0-4-2.65M8 15.5a3 3 0 0 0 4 2.65"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function clubMatchesSearchFilters(club: Club, f: SearchFilters): boolean {
  if (!clubMatchesSuggestionCityFilter(club, f)) return false
  const q = f.clubQuery.trim().toLowerCase()
  if (!q) return true
  return (
    club.name.toLowerCase().includes(q) ||
    (club.city?.toLowerCase().includes(q) ?? false) ||
    (club.address?.toLowerCase().includes(q) ?? false)
  )
}

function ResultRow({
  title,
  thumb,
  children,
  onActivate,
}: {
  title: string
  thumb: string
  children: ReactNode
  onActivate: () => void
}) {
  return (
    <div
      className="search-page__row"
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
    >
      <div
        className="search-page__thumb"
        style={{ background: thumb }}
        aria-hidden={true}
      />
      <div className="search-page__body">
        <h3 className="search-page__title">{title}</h3>
        <div className="search-page__meta">{children}</div>
      </div>
    </div>
  )
}

export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters)
  const { events, clubs, loading, error } = useCatalog()

  useEffect(() => {
    setFilters(parseSearchParams(searchParams))
  }, [searchParams])

  const filteredEvents = useMemo(
    () => events.filter((ev) => eventMatchesSearchFilters(ev, filters)),
    [events, filters],
  )

  const filteredClubs = useMemo(
    () => clubs.filter((c) => clubMatchesSearchFilters(c, filters)),
    [clubs, filters],
  )

  const applyFromBar = () => {
    const qs = searchFiltersToQueryString(filters)
    navigate(qs ? `/search?${qs}` : '/search', { replace: true })
  }

  return (
    <div className="search-page">
      <div className="search-page__blur-layer" aria-hidden={true} />
      <div className="search-page__dim-layer" aria-hidden={true} />
      <div className="search-page__content">
        <div className="search-page__bar-wrap">
          {filters.clubQuery.trim() ? (
            <p className="search-page__category mb-2 text-sm text-muted-foreground">
              Club search (from header):{' '}
              <span className="font-medium text-foreground">
                &ldquo;{filters.clubQuery.trim()}&rdquo;
              </span>
            </p>
          ) : null}
          <div className="search-page__bar">
            <SearchIcon />
            <input
              className="search-page__input"
              type="search"
              value={filters.query}
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyFromBar()
                }
              }}
              aria-label="Search events"
              placeholder="Search events…"
              autoComplete="off"
            />
            {filters.query.length > 0 ? (
              <button
                type="button"
                className="search-page__clear"
                aria-label="Clear search"
                onClick={() => setFilters((f) => ({ ...f, query: '' }))}
              >
                <ClearIcon />
              </button>
            ) : null}
            <button
              type="button"
              className="search-page__submit"
              aria-label="Apply search"
              onClick={() => applyFromBar()}
            >
              Search
            </button>
          </div>
        </div>

        <div className="search-page__results">
          {error ? (
            <p className="search-page__category text-destructive text-sm">{error}</p>
          ) : null}
          {loading ? (
            <p className="search-page__category text-muted-foreground text-sm">Loading…</p>
          ) : null}

          <h2 className="search-page__category">Events</h2>
          {filteredEvents.length === 0 && !loading ? (
            <p className="search-page__category text-muted-foreground text-sm">
              No events found.
            </p>
          ) : null}
          {filteredEvents.map((ev) => (
            <ResultRow
              key={ev.id}
              title={ev.title}
              thumb={eventThumb(ev.imageUrl)}
              onActivate={() => navigate(`/event/${encodeURIComponent(ev.id)}`)}
            >
              <span className="search-page__meta-item">
                <CalendarIcon />
                {ev.date}
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <PinIcon />
                {ev.club}
                {ev.city ? ` · ${ev.city}` : ''}
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <DollarIcon />
                <span>{`${ev.currency}${ev.price.toFixed(0)}`}</span>
              </span>
            </ResultRow>
          ))}

          <h2 className="search-page__category">Clubs</h2>
          {filteredClubs.length === 0 && !loading ? (
            <p className="search-page__category text-muted-foreground text-sm">
              No clubs found.
            </p>
          ) : null}
          {filteredClubs.map((club) => (
            <ResultRow
              key={club.id}
              title={club.name}
              thumb={eventThumb(club.imageUrl)}
              onActivate={() => navigate(`/club/${encodeURIComponent(club.id)}`)}
            >
              <span className="search-page__meta-item">
                <CalendarIcon />
                Venue
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <PinIcon />
                {club.address ?? club.city ?? '—'}
              </span>
            </ResultRow>
          ))}
        </div>
      </div>
    </div>
  )
}
