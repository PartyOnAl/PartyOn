import './Promotions.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Star } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { useCatalog } from '@/contexts/CatalogContext'
import type { Promotion } from '@/types'

type DiscountFilter = 'all' | 'free' | 'percent' | 'other'
type DateFilter = 'none' | 'tonight' | 'week' | 'custom'

const FILTER_OPTIONS: Array<{ value: DiscountFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'free', label: 'Free' },
  { value: 'percent', label: '% Off' },
]

function promotionDiscountType(promo: Promotion): Exclude<DiscountFilter, 'all'> {
  const text = `${promo.badge} ${promo.title} ${promo.offerType ?? ''}`.toLowerCase()
  if (text.includes('free') || promo.promoPrice === 0) return 'free'
  if (text.includes('%') || text.includes('off') || text.includes('discount')) return 'percent'
  return 'other'
}

function timestamp(value?: string, fallback = Number.POSITIVE_INFINITY) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : fallback
}

function promotionEndTimestamp(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  if (!/[tT]/.test(value)) date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function isPromotionActive(promo: Promotion) {
  return promotionEndTimestamp(promo.validUntil) >= Date.now()
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

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateRangeLabel(start: Date | null, end: Date | null) {
  if (!start || !end) return 'Pick Dates'
  return `${formatShortDate(start)} - ${formatShortDate(end)}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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

function RangeCalendar({
  viewMonth,
  rangeStart,
  rangeEnd,
  onPrevious,
  onNext,
  onSelectDay,
  onClear,
  onApply,
}: {
  viewMonth: Date
  rangeStart: Date | null
  rangeEnd: Date | null
  onPrevious: () => void
  onNext: () => void
  onSelectDay: (day: Date) => void
  onClear: () => void
  onApply: () => void
}) {
  return (
    <div className="promotions-calendar" role="dialog" aria-label="Pick promotion date range">
      <div className="promotions-calendar__nav">
        <button type="button" onClick={onPrevious} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel(viewMonth)}</strong>
        <button type="button" onClick={onNext} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="promotions-calendar__month">
        <div className="promotions-calendar__weekdays">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="promotions-calendar__grid">
          {calendarCells(viewMonth).map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="promotions-calendar__empty" />
            const selectedStart = rangeStart ? sameDay(day, rangeStart) : false
            const selectedEnd = rangeEnd ? sameDay(day, rangeEnd) : false
            const inRange = isInRange(day, rangeStart, rangeEnd)
            const today = sameDay(day, new Date())
            const className = [
              'promotions-calendar__day',
              selectedStart || selectedEnd ? 'promotions-calendar__day--selected' : '',
              inRange ? 'promotions-calendar__day--range' : '',
              today ? 'promotions-calendar__day--today' : '',
            ].filter(Boolean).join(' ')
            return (
              <button key={day.toISOString()} type="button" className={className} onClick={() => onSelectDay(day)}>
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>
      <div className="promotions-calendar__footer">
        <span>{dateRangeLabel(rangeStart, rangeEnd)}</span>
        <div className="promotions-calendar__actions">
          <button type="button" className="promotions-calendar__clear" onClick={onClear}>Clear</button>
          <button type="button" className="promotions-calendar__apply" onClick={onApply} disabled={!rangeStart || !rangeEnd}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function dateRangeLabelFromInputs(start: string, end: string) {
  const startDate = fromInputDate(start)
  const endDate = fromInputDate(end)
  if (!startDate || !endDate) return 'Pick Dates'
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
}

function promotionOverlapsRange(promo: Promotion, rangeStart: Date, rangeEnd: Date) {
  const promoStart = timestamp(promo.validFrom, Number.NEGATIVE_INFINITY)
  const promoEnd = promotionEndTimestamp(promo.validUntil)
  return promoStart <= rangeEnd.getTime() && promoEnd >= rangeStart.getTime()
}

function PromotionCard({ promo }: { promo: Promotion }) {
  return (
    <article className="promotions-card">
      <Link to={`/promotions/offer/${encodeURIComponent(promo.id)}`} className="promotions-card__media">
        <img src={promo.image} alt={promo.title} loading="lazy" />
        <span className={`promotions-card__badge ${promo.badgeColor || 'bg-primary'}`}>
          {promo.badge}
        </span>
      </Link>
      <div className="promotions-card__body">
        <div className="promotions-card__title-row">
          <h2>{promo.title}</h2>
          <span className="promotions-card__rating">
            <Star size={14} fill="currentColor" />
            {promo.rating.toFixed(1)}
          </span>
        </div>
        <p className="promotions-card__desc">{promo.description}</p>
        <div className="promotions-card__meta">
          <span>{promo.venue}</span>
          {promo.city || promo.address ? (
            <span>
              <MapPin size={14} />
              {promo.city || promo.address}
            </span>
          ) : null}
        </div>
        <Link to={`/promotions/offer/${encodeURIComponent(promo.id)}`} className="promotions-card__cta">
          View Offer
        </Link>
      </div>
    </article>
  )
}

export default function Promotions() {
  const { promotions, loading, error } = useCatalog()
  const [filter, setFilter] = useState<DiscountFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('none')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [draftRangeStart, setDraftRangeStart] = useState('')
  const [draftRangeEnd, setDraftRangeEnd] = useState('')
  const [rangeOpen, setRangeOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfDay(new Date()))
  const rangeButtonRef = useRef<HTMLButtonElement | null>(null)
  const rangeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!rangeOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rangeRef.current?.contains(target) || rangeButtonRef.current?.contains(target)) return
      setRangeOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [rangeOpen])

  const visiblePromotions = useMemo(() => {
    let range: { start: Date; end: Date } | null = null
    const today = new Date()
    if (dateFilter === 'tonight') {
      range = { start: startOfDay(today), end: endOfDay(today) }
    } else if (dateFilter === 'week') {
      const weekEnd = endOfDay(new Date(today))
      weekEnd.setDate(weekEnd.getDate() + 6)
      range = { start: startOfDay(today), end: weekEnd }
    } else if (dateFilter === 'custom') {
      const start = fromInputDate(rangeStart)
      const end = fromInputDate(rangeEnd, true)
      if (start && end) range = start <= end ? { start, end } : { start: end, end: start }
    }

    const activePromotions = promotions.filter(isPromotionActive)

    const filteredByType =
      filter === 'all'
        ? activePromotions
        : activePromotions.filter((promo) => promotionDiscountType(promo) === filter)

    const filteredByDate = range
      ? filteredByType.filter((promo) => promotionOverlapsRange(promo, range.start, range.end))
      : filteredByType

    return [...filteredByDate].sort((a, b) => timestamp(a.validUntil) - timestamp(b.validUntil))
  }, [dateFilter, filter, promotions, rangeEnd, rangeStart])

  const pickDatesLabel =
    rangeStart && rangeEnd ? dateRangeLabelFromInputs(rangeStart, rangeEnd) : 'Pick Dates'

  const selectedRangeStart = fromInputDate(draftRangeStart)
  const selectedRangeEnd = fromInputDate(draftRangeEnd)

  const selectDraftRangeDay = (day: Date) => {
    const selected = startOfDay(day)
    const currentStart = fromInputDate(draftRangeStart)
    const currentEnd = fromInputDate(draftRangeEnd)
    if (!currentStart || currentEnd) {
      setDraftRangeStart(toInputDate(selected))
      setDraftRangeEnd('')
      return
    }
    if (selected < currentStart) {
      setDraftRangeStart(toInputDate(selected))
      setDraftRangeEnd(toInputDate(currentStart))
    } else {
      setDraftRangeEnd(toInputDate(selected))
    }
  }

  const openRangePicker = () => {
    setDraftRangeStart(rangeStart)
    setDraftRangeEnd(rangeEnd)
    setViewMonth(fromInputDate(rangeStart) ?? startOfDay(new Date()))
    setRangeOpen((open) => !open)
  }

  const applyDraftRange = () => {
    if (!draftRangeStart || !draftRangeEnd) return
    setRangeStart(draftRangeStart)
    setRangeEnd(draftRangeEnd)
    setDateFilter('custom')
    setRangeOpen(false)
  }

  return (
    <div className="promotions-page">
      <Navbar />
      <main>
        <section className="promotions-hero">
          <div className="po-container promotions-hero__inner">
            <p className="promotions-hero__eyebrow">Promotions</p>
            <h1>Exclusive Offers</h1>
            <p>
              Browse active deals, free-entry nights, bottle-service specials, and limited club offers before they expire.
            </p>
          </div>
        </section>

        <section className="po-container promotions-content">
          <div className="promotions-toolbar">
            <div className="promotions-filter" role="group" aria-label="Filter promotions by discount type">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filter === option.value ? 'promotions-filter__btn promotions-filter__btn--active' : 'promotions-filter__btn'}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
              <span className="promotions-filter__divider" aria-hidden />
              <div className="promotions-filter__date-group">
              <button
                type="button"
                className={dateFilter === 'tonight' ? 'promotions-filter__btn promotions-filter__btn--active' : 'promotions-filter__btn'}
                onClick={() => {
                  setDateFilter(dateFilter === 'tonight' ? 'none' : 'tonight')
                  setRangeOpen(false)
                }}
              >
                Tonight
              </button>
              <button
                type="button"
                className={dateFilter === 'week' ? 'promotions-filter__btn promotions-filter__btn--active' : 'promotions-filter__btn'}
                onClick={() => {
                  setDateFilter(dateFilter === 'week' ? 'none' : 'week')
                  setRangeOpen(false)
                }}
              >
                This Week
              </button>
              <div className="promotions-date-anchor">
                <button
                  ref={rangeButtonRef}
                  type="button"
                  className={dateFilter === 'custom' || rangeOpen ? 'promotions-filter__btn promotions-filter__btn--active' : 'promotions-filter__btn'}
                  onClick={openRangePicker}
                >
                  {pickDatesLabel}
                </button>
                {rangeOpen ? (
                  <>
                    <div className="promotions-date-click-shield" aria-hidden />
                    <div ref={rangeRef} className="promotions-date-popover">
                      <RangeCalendar
                        viewMonth={viewMonth}
                        rangeStart={selectedRangeStart}
                        rangeEnd={selectedRangeEnd}
                        onPrevious={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                        onNext={() => setViewMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                        onSelectDay={selectDraftRangeDay}
                        onClear={() => {
                          setDraftRangeStart('')
                          setDraftRangeEnd('')
                          setRangeStart('')
                          setRangeEnd('')
                          setDateFilter('none')
                        }}
                        onApply={applyDraftRange}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              </div>
            </div>
          </div>

          <p className="promotions-count">
            Showing {visiblePromotions.length} active promotion{visiblePromotions.length === 1 ? '' : 's'}
          </p>

          {loading ? (
            <p className="promotions-empty">Loading active promotions...</p>
          ) : error ? (
            <p className="promotions-empty">Could not load promotions right now.</p>
          ) : visiblePromotions.length === 0 ? (
            <p className="promotions-empty">No active promotions match this filter right now. Check back soon for fresh offers.</p>
          ) : (
            <div className="promotions-grid">
              {visiblePromotions.map((promo) => (
                <PromotionCard key={promo.id} promo={promo} />
              ))}
            </div>
          )}
        </section>
      </main>
      <LovableFooter />
    </div>
  )
}
