import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Event } from '@/types'




export type SearchFilters = {
  query: string
  city: string
  musicType: string
  time: 'all' | 'tonight' | 'weekend'
}

type SearchHeroProps = {
  value: SearchFilters
  onChange: (next: SearchFilters) => void
  cities: string[]
  musicTypes: string[]
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

function FilterDropdown({ value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '',
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
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-full overflow-hidden rounded-lg border border-white/10 bg-[#12131a] shadow-[0_14px_28px_rgba(0,0,0,0.45)]">
          <div className="max-h-56 overflow-auto py-1">
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

export function SearchHero({ value, onChange , cities , musicTypes }: SearchHeroProps) {
  const [focused, setFocused] = useState(false)
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All')
  const FILTERS = [ 'All', 'Tonight', 'This Weekend', 'Free Entry', 'Live Music', 'Clubs', 'Festivals', ] as const
  const dropdownConfig = [
    {
      key: 'city',
      value: value.city,
      options: [
        { value: 'all', label: 'All cities' },
        ...cities.map((c) => ({ value: c, label: c })),
      ],
      onChange: (v: string) => onChange({ ...value, city: v }),
    },
    {
      key: 'musicType',
      value: value.musicType,
      options: [
        { value: 'all', label: 'All music types' },
        ...musicTypes.map((m) => ({ value: m, label: m })),
      ],
      onChange: (v: string) => onChange({ ...value, musicType: v }),
    },
    {
      key: 'time',
      value: value.time,
      options: [
        { value: 'all', label: 'Any time' },
        { value: 'tonight', label: 'Tonight' },
        { value: 'weekend', label: 'This weekend' },
      ],
      onChange: (v: string) =>
        onChange({
          ...value,
          time: v as SearchFilters['time'],
        }),
    },
  ]
  const cityOptions: DropdownOption[] = [
    { value: 'all', label: 'All cities' },
    ...cities.map((city) => ({ value: city, label: city })),
  ]
  const musicOptions: DropdownOption[] = [
    { value: 'all', label: 'All music types' },
    ...musicTypes.map((musicType) => ({ value: musicType, label: musicType })),
  ]
  const timeOptions: DropdownOption[] = [
    { value: 'all', label: 'Any time' },
    { value: 'tonight', label: 'Tonight' },
    { value: 'weekend', label: 'This weekend' },
  ]

  return (
    <section className="py-6">
      <div className="po-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full max-w-[860px] mx-auto rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-8"
        >
          <div
            className={`relative flex h-12 items-center gap-3 rounded-full border pl-5 pr-2 transition-all duration-300 ${
              focused
                ? 'bg-secondary/80 border-primary/40 shadow-[0_0_20px_hsl(var(--primary)/0.15)]'
                : 'bg-secondary/60 border-border/40 hover:border-border/60'
            }`}
          >
            <Search
              className={`h-5 w-5 shrink-0 transition-colors duration-300 ${focused ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <input
              type="text"
              placeholder="Search events, clubs, DJs..."
              value={value.query}
              onChange={(e) => onChange({ ...value, query: e.target.value })}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent text-foreground text-base placeholder:text-muted-foreground/60 outline-none"
            />
            <button
              type="button"
              className="h-9 rounded-full gradient-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Search
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {dropdownConfig.map((dropdown) => (
    <FilterDropdown
      key={dropdown.key}
      value={dropdown.value}
      options={dropdown.options}
      onChange={dropdown.onChange}
    />
  ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-[10px]">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter)
                    if (filter === 'All') {
                      onChange({ ...value, time: 'all' })
                    } else if (filter === 'Tonight') {
                      onChange({ ...value, time: 'tonight' })
                    } else if (filter === 'This Weekend') {
                      onChange({ ...value, time: 'weekend' })
                    }
                  }}
                  className={`rounded-full px-4 py-1.5 text-[0.8rem] transition-colors ${
                    active
                      ? 'gradient-primary text-primary-foreground border border-transparent'
                      : 'bg-white/8 text-foreground border border-white/10 hover:border-primary/35'
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
