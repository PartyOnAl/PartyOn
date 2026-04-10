import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, MapPin, Search, Ticket, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Event } from '@/types'
import { uniqueCanonicalCities } from '@/lib/cityNormalize'
import {
  defaultSearchFilters,
  type SearchFilters,
  searchFiltersToQueryString,
} from '@/lib/searchFilters'
import { fetchSuggestions, type SuggestionItem } from '@/api/suggestions'
import { MatchHighlight } from '@/components/MatchHighlight'
import './SearchHero.css'

export type { SearchFilters } from '@/lib/searchFilters'

const FILTERS = [
  'All',
  'Tonight',
  'This Weekend',
  'Free Entry',
  'Live Music',
  'Clubs',
  'Festivals',
] as const

type SearchHeroProps = {
  events: Event[]
  value: SearchFilters
  onChange: (next: SearchFilters) => void
}

type DropdownOption = {
  value: string
  label: string
}

type FilterDropdownProps = {
  value: string
  options: DropdownOption[]
  onChange: (nextValue: string) => void
}

type TypeaheadRow =
  | { kind: 'item'; item: SuggestionItem }
  | { kind: 'search' }

function FilterDropdown({ value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedLabel = useMemo(
    () =>
      options.find((option) => option.value === value)?.label ??
      options[0]?.label ??
      '',
    [options, value],
  )

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-10 w-full items-center justify-between rounded-lg border bg-secondary/60 px-3 text-sm transition-colors ${
          open
            ? 'border-primary/50 ring-2 ring-primary/20'
            : 'border-white/10 hover:border-primary/35'
        }`}
      >
        <span className="truncate text-foreground">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-full overflow-hidden rounded-lg border border-white/10 bg-[#12131a] shadow-[0_14px_28px_rgba(0,0,0,0.45)]">
          <div className="search-hero-dropdown-scroll max-h-56 overflow-y-auto py-1">
            {options.map((option) => {
              const isActive = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-foreground hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function normalizeLabel(s: string | undefined): string | null {
  const t = s?.trim()
  if (!t || t === '—' || t === '-') return null
  return t
}

function activeQuickPill(value: SearchFilters): (typeof FILTERS)[number] {
  if (value.category === 'free') return 'Free Entry'
  if (value.category === 'live') return 'Live Music'
  if (value.category === 'clubs') return 'Clubs'
  if (value.category === 'festivals') return 'Festivals'
  if (value.time === 'tonight') return 'Tonight'
  if (value.time === 'weekend') return 'This Weekend'
  return 'All'
}

function scrollToEventsSection() {
  document.getElementById('events')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

/** Primary search CTA only — keeps one strong gradient action in the bar. */
const searchSubmitPillClass =
  'shrink-0 rounded-full gradient-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-opacity hover:opacity-90'

function SuggestionLeadingIcon({ type }: { type: SuggestionItem['type'] }) {
  if (type === 'event') {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.07] text-foreground/85"
        aria-hidden
      >
        <Ticket className="h-4 w-4" strokeWidth={2} />
      </span>
    )
  }
  if (type === 'club') {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground"
        aria-hidden
      >
        <MapPin className="h-4 w-4" strokeWidth={2} />
      </span>
    )
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground"
      aria-hidden
    >
      <Search className="h-4 w-4" strokeWidth={2} />
    </span>
  )
}

export function SearchHero({ events, value, onChange }: SearchHeroProps) {
  const navigate = useNavigate()
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<{
    events: SuggestionItem[]
    clubs: SuggestionItem[]
    djs: SuggestionItem[]
  } | null>(null)
  const [suggLoading, setSuggLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const typeaheadRootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const goSearchPage = useCallback(() => {
    const qs = searchFiltersToQueryString(value)
    navigate(qs ? `/search?${qs}` : '/search')
  }, [navigate, value])

  const selectSuggestion = useCallback(
    (item: SuggestionItem) => {
      if (item.type === 'event') {
        navigate(`/event/${encodeURIComponent(item.id)}`)
      } else if (item.type === 'club') {
        navigate(`/club/${encodeURIComponent(item.id)}`)
      } else {
        navigate(`/dj/${encodeURIComponent(item.id)}`)
      }
    },
    [navigate],
  )

  useEffect(() => {
    const q = value.query.trim()
    if (!q) {
      setSuggestions(null)
      setSuggLoading(false)
      return
    }
    setSuggLoading(true)
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      ;(async () => {
        const { data, error } = await fetchSuggestions(q, value, ac.signal)
        if (ac.signal.aborted) return
        setSuggLoading(false)
        if (error) {
          setSuggestions({ events: [], clubs: [], djs: [] })
        } else {
          setSuggestions(
            data ?? { events: [], clubs: [], djs: [] },
          )
        }
      })()
    }, 300)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [
    value.query,
    value.city,
    value.musicType,
    value.time,
    value.category,
  ])

  /** Events section: typeahead lists events only (clubs use the header search). */
  const flatRows: TypeaheadRow[] = useMemo(() => {
    if (suggLoading || !suggestions) {
      return [{ kind: 'search' }]
    }
    const rows: TypeaheadRow[] = []
    suggestions.events.forEach((item) =>
      rows.push({ kind: 'item', item }),
    )
    rows.push({ kind: 'search' })
    return rows
  }, [suggestions, suggLoading])

  useEffect(() => {
    setHighlightIdx(-1)
  }, [flatRows.length, value.query])

  const showTypeahead = focused && value.query.trim().length > 0

  useEffect(() => {
    if (!showTypeahead) return
    const onDocDown = (e: MouseEvent) => {
      if (typeaheadRootRef.current?.contains(e.target as Node)) return
      setFocused(false)
    }
    window.addEventListener('mousedown', onDocDown)
    return () => window.removeEventListener('mousedown', onDocDown)
  }, [showTypeahead])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showTypeahead) {
      if (e.key === 'Enter') {
        e.preventDefault()
        goSearchPage()
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setFocused(false)
      inputRef.current?.blur()
      setHighlightIdx(-1)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) =>
        i < flatRows.length - 1 ? i + 1 : i,
      )
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => (i > 0 ? i - 1 : -1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const row =
        highlightIdx >= 0 ? flatRows[highlightIdx] : flatRows[flatRows.length - 1]
      if (row?.kind === 'item') {
        selectSuggestion(row.item)
        setFocused(false)
      } else {
        goSearchPage()
      }
    }
  }

  const cities = useMemo(() => {
    const raw: string[] = []
    for (const event of events) {
      const c = normalizeLabel(event.city)
      if (c) raw.push(c)
    }
    return uniqueCanonicalCities(raw)
  }, [events])

  const musicTypes = useMemo(() => {
    const set = new Set<string>()
    for (const event of events) {
      const m = normalizeLabel(event.musicType)
      if (m) set.add(m)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [events])

  const cityOptions: DropdownOption[] = useMemo(() => {
    const base: DropdownOption[] = [{ value: 'all', label: 'All cities' }]
    if (cities.length === 0) {
      return [
        ...base,
        {
          value: '__no_cities__',
          label: 'No cities in data yet',
        },
      ]
    }
    return [...base, ...cities.map((city) => ({ value: city, label: city }))]
  }, [cities])

  const musicOptions: DropdownOption[] = useMemo(() => {
    const base: DropdownOption[] = [{ value: 'all', label: 'All music types' }]
    if (musicTypes.length === 0) {
      return [
        ...base,
        {
          value: '__no_music__',
          label: 'No music types in data yet',
        },
      ]
    }
    return [...base, ...musicTypes.map((m) => ({ value: m, label: m }))]
  }, [musicTypes])

  const timeOptions: DropdownOption[] = [
    { value: 'all', label: 'Any time' },
    { value: 'tonight', label: 'Tonight' },
    { value: 'weekend', label: 'This weekend' },
  ]

  const pillActive = activeQuickPill(value)

  const applyCityChange = (nextCity: string) => {
    if (nextCity === '__no_cities__') return
    onChange({ ...value, city: nextCity })
  }

  const applyMusicChange = (nextMusic: string) => {
    if (nextMusic === '__no_music__') return
    onChange({ ...value, musicType: nextMusic })
  }

  const qTrim = value.query.trim()

  const filtersAreDefault = useMemo(() => {
    const d = defaultSearchFilters()
    return (
      value.query === d.query &&
      value.clubQuery === d.clubQuery &&
      value.city === d.city &&
      value.musicType === d.musicType &&
      value.time === d.time &&
      value.category === d.category
    )
  }, [value])

  const clearAllFilters = useCallback(() => {
    onChange(defaultSearchFilters())
    inputRef.current?.focus()
  }, [onChange])

  const renderSuggestionRow = (item: SuggestionItem, rowIndex: number) => {
    const idx = rowIndex
    const active = highlightIdx === idx
    return (
      <button
        key={`${item.type}-${item.id}-${rowIndex}`}
        type="button"
        role="option"
        aria-selected={active}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setHighlightIdx(idx)}
        onClick={() => {
          selectSuggestion(item)
          setFocused(false)
        }}
        className={`search-hero-typeahead__row flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
          active ? 'bg-primary/15' : 'hover:bg-white/8'
        }`}
      >
        <SuggestionLeadingIcon type={item.type} />
        <span className="min-w-0 flex-1 truncate text-foreground">
          <MatchHighlight text={item.name} query={qTrim} />
        </span>
        {item.date || item.location ? (
          <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
            {item.date ?? item.location}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <section className="py-6">
      <div className="po-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto w-full max-w-[860px] rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-8"
        >
          <div ref={typeaheadRootRef} className="relative">
            <div
              className={`relative flex h-12 items-center gap-3 rounded-full border pl-5 pr-2 transition-all duration-300 ${
                focused
                  ? 'border-primary/40 bg-secondary/80 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                  : 'border-border/40 bg-secondary/60 hover:border-border/60'
              }`}
            >
              <Search
                className={`h-5 w-5 shrink-0 transition-colors duration-300 ${focused ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search events…"
                value={value.query}
                onChange={(e) => onChange({ ...value, query: e.target.value })}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setFocused(false), 120)
                }}
                autoComplete="off"
                aria-expanded={showTypeahead}
                aria-controls="search-hero-typeahead-list"
                aria-autocomplete="list"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              {value.query.trim().length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 transition-colors hover:bg-white/10 hover:text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ ...value, query: '' })
                    inputRef.current?.focus()
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => goSearchPage()}
                className={`h-9 px-5 ${searchSubmitPillClass}`}
              >
                Search
              </button>
            </div>

            {showTypeahead ? (
              <div
                id="search-hero-typeahead-list"
                role="listbox"
                className="search-hero-typeahead search-hero-dropdown-scroll absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] max-h-72 overflow-y-auto rounded-xl border border-white/12 bg-[#1a1a1f] py-2 shadow-[0_20px_40px_rgba(0,0,0,0.55)]"
              >
                {suggLoading ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Searching…
                  </p>
                ) : null}
                {!suggLoading &&
                suggestions &&
                suggestions.events.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No event matches — try different words or use the header search
                    for clubs.
                  </p>
                ) : null}

                {(() => {
                  let ri = 0
                  return (
                    <>
                      {suggestions && !suggLoading && suggestions.events.length > 0 ? (
                        <div className="px-2">
                          <p className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                            Events
                          </p>
                          {suggestions.events.map((item) =>
                            renderSuggestionRow(item, ri++),
                          )}
                        </div>
                      ) : null}
                    </>
                  )
                })()}

                {(() => {
                  const idx = flatRows.length - 1
                  const active = highlightIdx === idx
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => {
                        goSearchPage()
                        setFocused(false)
                      }}
                      className={`search-hero-typeahead__row mt-1 w-full border-t border-white/10 px-3 py-2.5 text-left text-sm ${
                        active ? 'bg-primary/15' : 'hover:bg-white/8'
                      }`}
                    >
                      <span className="text-muted-foreground">
                        Search events for &apos;
                        <span className="font-medium text-primary">{qTrim}</span>
                        &apos;
                      </span>
                    </button>
                  )
                })()}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
              <FilterDropdown
                value={value.city}
                options={cityOptions}
                onChange={applyCityChange}
              />
              <FilterDropdown
                value={value.musicType}
                options={musicOptions}
                onChange={applyMusicChange}
              />
              <FilterDropdown
                value={value.time}
                options={timeOptions}
                onChange={(nextTime) => {
                  const t = nextTime as SearchFilters['time']
                  onChange({
                    ...value,
                    time: t,
                    category: t !== 'all' ? 'all' : value.category,
                  })
                }}
              />
            </div>
            <button
              type="button"
              disabled={filtersAreDefault}
              className="h-10 shrink-0 self-stretch rounded-lg border border-white/10 bg-secondary/60 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/35 disabled:pointer-events-none disabled:opacity-40 sm:self-end"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-[10px]">
            {FILTERS.map((filter) => {
              const active = pillActive === filter
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    if (filter === 'All') {
                      onChange({
                        ...value,
                        time: 'all',
                        category: 'all',
                      })
                    } else if (filter === 'Tonight') {
                      onChange({
                        ...value,
                        time: 'tonight',
                        category: 'all',
                      })
                    } else if (filter === 'This Weekend') {
                      onChange({
                        ...value,
                        time: 'weekend',
                        category: 'all',
                      })
                    } else if (filter === 'Free Entry') {
                      onChange({
                        ...value,
                        category: 'free',
                        time: 'all',
                      })
                    } else if (filter === 'Live Music') {
                      onChange({
                        ...value,
                        category: 'live',
                        time: 'all',
                      })
                    } else if (filter === 'Clubs') {
                      onChange({
                        ...value,
                        category: 'clubs',
                        time: 'all',
                      })
                    } else if (filter === 'Festivals') {
                      onChange({
                        ...value,
                        category: 'festivals',
                        time: 'all',
                      })
                    }
                    scrollToEventsSection()
                  }}
                  className={`rounded-full px-4 py-1.5 text-[0.8rem] transition-colors ${
                    active
                      ? 'gradient-primary border border-transparent text-primary-foreground'
                      : 'border border-white/10 bg-white/8 text-foreground hover:border-primary/35'
                  }`}
                >
                  {filter}
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
