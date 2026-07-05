import './Events.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { EventCard } from '@/components/EventCard'
import { FilterDropdown, type DropdownOption } from '@/components/SearchHero'
import { useCatalog } from '@/contexts/CatalogContext'
import { getJson } from '@/api'
import type { Event } from '@/types'

type QuickFilter = 'all' | 'tonight' | 'weekend' | 'free' | 'live' | 'clubs' | 'festivals'
type PriceFilter = 'all' | 'free' | 'under10' | 'under25' | 'paid'

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tonight', label: 'Tonight' },
  { value: 'weekend', label: 'This Weekend' },
  { value: 'free', label: 'Free Entry' },
  { value: 'live', label: 'Live Music' },
  { value: 'clubs', label: 'Clubs' },
  { value: 'festivals', label: 'Festivals' },
]

const PRICE_OPTIONS: DropdownOption[] = [
  { value: 'all', label: 'Any price' },
  { value: 'free', label: 'Free entry' },
  { value: 'under10', label: 'Under €10' },
  { value: 'under25', label: 'Under €25' },
  { value: 'paid', label: 'Paid events' },
]

function normalizeLabel(value: string | undefined): string | null {
  const next = value?.trim()
  if (!next || next === '-') return null
  return next
}

/** Use rawDate (ISO) when available, fall back to display date string */
function eventDate(event: Event) {
  const src = event.rawDate || event.date
  const parsed = new Date(src)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromInputDate(value: string, end = false) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return end ? endOfDay(date) : startOfDay(date)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isThisWeekend(date: Date) {
  const start = startOfDay(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  end.setHours(23, 59, 59, 999)
  const day = date.getDay()
  return date >= start && date <= end && (day === 5 || day === 6 || day === 0)
}

function eventMatchesQuickFilter(event: Event, filter: QuickFilter) {
  if (filter === 'all') return true
  const haystack = [event.title, event.club, event.city, event.musicType, event.genre]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .toLowerCase()

  if (filter === 'tonight') {
    const date = eventDate(event)
    return date ? isSameDay(date, new Date()) : false
  }
  if (filter === 'weekend') {
    const date = eventDate(event)
    return date ? isThisWeekend(date) : false
  }
  if (filter === 'free') return event.price <= 0
  if (filter === 'live') return /live\s*music|acoustic|unplugged|jazz|concert|open\s*mic/i.test(haystack)
  if (filter === 'clubs') return !/\bfestival|fest\b|restaurant|bistro|dinner|brunch\b/i.test(haystack)
  if (filter === 'festivals') return /\bfestival|fest\b|rave|block\s*party/i.test(haystack)
  return true
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateRangeLabel(start: string, end: string) {
  const startDate = fromInputDate(start)
  const endDate = fromInputDate(end)
  if (!startDate) return 'Any time'
  if (!endDate || isSameDay(startDate, endDate)) return formatShortDate(startDate)
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function calendarCells(month: Date) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function isInRange(day: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false
  const time = startOfDay(day).getTime()
  return time > startOfDay(start).getTime() && time < startOfDay(end).getTime()
}

function eventMatchesDateRange(event: Event, start: string, end: string) {
  if (!start) return true
  const date = eventDate(event)
  if (!date) return false
  const rangeStart = fromInputDate(start)
  const rangeEnd = fromInputDate(end || start, true)
  if (!rangeStart || !rangeEnd) return true
  return date >= rangeStart && date <= rangeEnd
}

function eventMatchesPrice(event: Event, filter: PriceFilter) {
  if (filter === 'all') return true
  if (filter === 'free') return event.price <= 0
  if (filter === 'under10') return event.price > 0 && event.price <= 10
  if (filter === 'under25') return event.price > 0 && event.price <= 25
  if (filter === 'paid') return event.price > 0
  return true
}

function DatePicker({
  start,
  end,
  onChange,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(start)
  const [draftEnd, setDraftEnd] = useState(end)
  const [viewMonth, setViewMonth] = useState(() => fromInputDate(start) ?? startOfDay(new Date()))
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const draftStartDate = fromInputDate(draftStart)
  const draftEndDate = fromInputDate(draftEnd)

  const selectDay = (day: Date) => {
    const selected = startOfDay(day)
    const currentStart = fromInputDate(draftStart)
    const currentEnd = fromInputDate(draftEnd)
    if (!currentStart || currentEnd) {
      setDraftStart(toInputDate(selected))
      setDraftEnd('')
      return
    }
    if (selected < currentStart) {
      setDraftStart(toInputDate(selected))
      setDraftEnd(toInputDate(currentStart))
    } else {
      setDraftEnd(toInputDate(selected))
    }
  }

  return (
    <div ref={rootRef} className="events-date-picker">
      <button
        type="button"
        onClick={() => {
          setDraftStart(start)
          setDraftEnd(end)
          setViewMonth(fromInputDate(start) ?? startOfDay(new Date()))
          setOpen((current) => !current)
        }}
        className={`events-date-picker__trigger ${open ? 'events-date-picker__trigger--open' : ''}`}
      >
        <span className="truncate">{dateRangeLabel(start, end)}</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="events-date-calendar">
          <div className="events-date-calendar__nav">
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <strong>{monthLabel(viewMonth)}</strong>
            <button type="button" onClick={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="events-date-calendar__weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="events-date-calendar__grid">
            {calendarCells(viewMonth).map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />
              const selectedStart = draftStartDate ? isSameDay(day, draftStartDate) : false
              const selectedEnd = draftEndDate ? isSameDay(day, draftEndDate) : false
              const inRange = isInRange(day, draftStartDate, draftEndDate)
              const today = isSameDay(day, new Date())
              const className = [
                'events-date-calendar__day',
                selectedStart || selectedEnd ? 'events-date-calendar__day--selected' : '',
                inRange ? 'events-date-calendar__day--range' : '',
                today ? 'events-date-calendar__day--today' : '',
              ].filter(Boolean).join(' ')
              return (
                <button key={day.toISOString()} type="button" className={className} onClick={() => selectDay(day)}>
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          <div className="events-date-calendar__footer">
            <button
              type="button"
              onClick={() => {
                setDraftStart('')
                setDraftEnd('')
                onChange('', '')
                setOpen(false)
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="events-date-calendar__apply"
              disabled={!draftStart}
              onClick={() => {
                onChange(draftStart, draftEnd || draftStart)
                setOpen(false)
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function Events() {
  const { events, loading, error } = useCatalog()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('all')
  const [musicType, setMusicType] = useState('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [dbCities, setDbCities] = useState<string[]>([])
  const [dbMusicTypes, setDbMusicTypes] = useState<string[]>([])

  useEffect(() => {
    getJson<{ cities: string[]; musicTypes: string[] }>('/catalog/filters').then(({ data }) => {
      if (data?.cities) setDbCities(data.cities)
      if (data?.musicTypes) setDbMusicTypes(data.musicTypes)
    })
  }, [])

  const cityOptions = useMemo((): DropdownOption[] => {
    const base: DropdownOption[] = [{ value: 'all', label: 'All cities' }]
    const sources = dbCities.length > 0
      ? dbCities
      : [...new Set(events.map((e) => normalizeLabel(e.city)).filter((v): v is string => Boolean(v)))].sort()
    return [...base, ...sources.map((c) => ({ value: c, label: c }))]
  }, [dbCities, events])

  const musicOptions = useMemo((): DropdownOption[] => {
    const base: DropdownOption[] = [{ value: 'all', label: 'All music types' }]
    const sources = dbMusicTypes.length > 0
      ? dbMusicTypes
      : [...new Set(events.map((e) => normalizeLabel(e.musicType) ?? normalizeLabel(e.genre)).filter((v): v is string => Boolean(v)))].sort()
    return [...base, ...sources.map((m) => ({ value: m, label: m }))]
  }, [dbMusicTypes, events])

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((event) => {
      const matchesSearch = q.length === 0 || event.title.toLowerCase().includes(q)
      const eventCity = event.city?.trim() ?? ''
      const matchesCity = city === 'all' || eventCity.toLowerCase().includes(city.toLowerCase())
      const eventMusic = (event.musicType || event.genre || '').toLowerCase()
      const matchesMusic = musicType === 'all' || eventMusic === musicType.toLowerCase()
      return (
        matchesSearch &&
        matchesCity &&
        matchesMusic &&
        eventMatchesDateRange(event, dateStart, dateEnd) &&
        eventMatchesQuickFilter(event, quickFilter) &&
        eventMatchesPrice(event, priceFilter)
      )
    })
  }, [city, dateEnd, dateStart, events, musicType, priceFilter, query, quickFilter])

  return (
    <div className="events-page">
      <Navbar />
      <main>
        <section className="events-page-hero">
          <div className="po-container events-page-hero__inner">
            <p className="events-page-hero__eyebrow">Events</p>
            <h1>All Upcoming Events</h1>
            <p>Search the full nightlife calendar and filter by city, music, date, entry type, and event style.</p>
          </div>
        </section>

        <section className="po-container events-page-content">
          <form className="events-search" onSubmit={(event) => event.preventDefault()}>
            {/* Row 1: search bar */}
            <div className="events-search__bar">
              <Search className="events-search__icon" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events..."
                aria-label="Search events by name"
              />
              {query ? (
                <button
                  type="button"
                  className="events-search__clear"
                  aria-label="Clear search"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setQuery('')}
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
              <button type="submit" className="events-search__submit">
                Search
              </button>
            </div>

            {/* Row 2: dropdowns + clear */}
            <div className="events-search__filter-row">
              <FilterDropdown value={city} options={cityOptions} onChange={setCity} />
              <FilterDropdown value={musicType} options={musicOptions} onChange={setMusicType} />
              <DatePicker
                start={dateStart}
                end={dateEnd}
                onChange={(start, end) => {
                  setDateStart(start)
                  setDateEnd(end)
                  if (start) setQuickFilter('all')
                }}
              />
              <FilterDropdown value={priceFilter} options={PRICE_OPTIONS} onChange={(value) => setPriceFilter(value as PriceFilter)} />
              <button
                type="button"
                className="events-clear-btn"
                disabled={!query && city === 'all' && musicType === 'all' && !dateStart && priceFilter === 'all' && quickFilter === 'all'}
                onClick={() => {
                  setQuery('')
                  setCity('all')
                  setMusicType('all')
                  setDateStart('')
                  setDateEnd('')
                  setPriceFilter('all')
                  setQuickFilter('all')
                }}
              >
                Clear all
              </button>
            </div>

            {/* Row 3: quick-filter pills */}
            <div className="events-quick-filters" aria-label="Quick event filters">
              {QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={quickFilter === filter.value ? 'events-quick-filters__pill events-quick-filters__pill--active' : 'events-quick-filters__pill'}
                  onClick={() => {
                    setQuickFilter(filter.value)
                    if (filter.value === 'tonight' || filter.value === 'weekend') {
                      setDateStart('')
                      setDateEnd('')
                    }
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </form>

          <div className="events-results-header">
            <p>
              Showing {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
            </p>
          </div>

          {error ? (
            <p className="events-empty">Could not load events right now.</p>
          ) : loading ? (
            <p className="events-empty">Loading upcoming events...</p>
          ) : filteredEvents.length === 0 ? (
            <p className="events-empty">No events match these filters. Try a different search or date.</p>
          ) : (
            <div className="events-results-grid">
              {filteredEvents.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>
      <LovableFooter />
    </div>
  )
}
