import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Star } from 'lucide-react'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import './ManagerDashboard.css'
import './ManagerAnalytics.css'
import './ManagerReviews.css'

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  event_id: string
  user: { name: string | null; surname: string | null; avatar_url: string | null } | null
  event: { event_name: string; event_starting_date: string | null } | null
}

type ClubEvent = { event_id: string; event_name: string }

function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="mgr-reviews__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= value ? 'mgr-reviews__star--filled' : 'mgr-reviews__star--empty'}
        />
      ))}
    </div>
  )
}

function EventDropdown({
  events,
  value,
  onChange,
}: {
  events: ClubEvent[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const selectedLabel =
    value === 'all' ? 'All events' : (events.find((e) => e.event_id === value)?.event_name ?? 'All events')

  return (
    <div ref={ref} className="mgr-reviews__dropdown">
      <button
        type="button"
        className="mgr-reviews__dropdown-btn"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="mgr-reviews__dropdown-label">{selectedLabel}</span>
        <ChevronDown className={`mgr-reviews__dropdown-chevron ${open ? 'mgr-reviews__dropdown-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="mgr-reviews__dropdown-menu" role="listbox">
          {[{ event_id: 'all', event_name: 'All events' }, ...events].map((ev) => (
            <button
              key={ev.event_id}
              type="button"
              role="option"
              aria-selected={value === ev.event_id}
              className={`mgr-reviews__dropdown-item${value === ev.event_id ? ' mgr-reviews__dropdown-item--active' : ''}`}
              onClick={() => { onChange(ev.event_id); setOpen(false) }}
            >
              {ev.event_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function initials(name: string | null, surname: string | null): string {
  return ((name?.trim()[0] ?? '') + (surname?.trim()[0] ?? '')).toUpperCase() || '?'
}

function ReviewAvatar({ name, surname, avatarUrl }: { name: string | null; surname: string | null; avatarUrl: string | null }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(avatarUrl && !imgFailed)
  return (
    <div className="mgr-reviews__avatar">
      {showImg ? (
        <img
          src={avatarUrl!}
          alt=""
          className="mgr-reviews__avatar-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials(name, surname)
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

export default function ManagerReviews() {
  const { club, clubId } = useManagerClub()
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [allEvents, setAllEvents] = useState<ClubEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) return
    setLoading(true)
    setError(null)

    void (async () => {
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('event_id, event_name')
        .eq('club_id', clubId)
        .order('event_starting_date', { ascending: false })

      if (evErr) { setLoading(false); setError(evErr.message); return }
      const clubEvents = (events ?? []) as ClubEvent[]
      setAllEvents(clubEvents)

      if (clubEvents.length === 0) { setLoading(false); return }

      const { data, error: rErr } = await supabase
        .from('event_ratings')
        .select(`
          id, rating, comment, created_at, event_id,
          user:user_id(name, surname, avatar_url),
          event:event_id(event_name, event_starting_date)
        `)
        .in('event_id', clubEvents.map((e) => e.event_id))
        .order('created_at', { ascending: false })

      setLoading(false)
      if (rErr) { setError(rErr.message); return }
      setReviews((data ?? []) as unknown as ReviewRow[])
    })()
  }, [clubId])

  const filtered = useMemo(() => {
    let result = eventFilter === 'all' ? reviews : reviews.filter((r) => r.event_id === eventFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (r) =>
          r.comment?.toLowerCase().includes(q) ||
          r.event?.event_name?.toLowerCase().includes(q) ||
          [r.user?.name, r.user?.surname].filter(Boolean).join(' ').toLowerCase().includes(q),
      )
    }
    return result
  }, [reviews, eventFilter, search])

  const avgRating = filtered.length ? filtered.reduce((s, r) => s + r.rating, 0) / filtered.length : 0

  const distribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    for (const r of filtered) dist[r.rating - 1]++
    return dist.reverse()
  }, [filtered])

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-analytics__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-analytics__bound">
            {/* Page header */}
            <div className="manager-dash__page-head mgr-reviews__page-head">
              <div>
                <h1 className="manager-dash__page-title">Reviews</h1>
                <p className="manager-dash__page-sub">What guests are saying about your events</p>
              </div>
              <EventDropdown events={allEvents} value={eventFilter} onChange={setEventFilter} />
            </div>

            {loading ? (
              <div className="mgr-reviews__empty">Loading reviews…</div>
            ) : error ? (
              <div className="mgr-reviews__empty mgr-reviews__empty--error">{error}</div>
            ) : reviews.length === 0 ? (
              <div className="mgr-reviews__empty">
                <Star className="mgr-reviews__empty-icon" />
                <p>No reviews yet</p>
                <span>Reviews will appear here once guests rate their experience.</span>
              </div>
            ) : (
              <>
                {/* Summary */}
                <section className="mgr-reviews__summary manager-analytics__card">
                  <div className="mgr-reviews__avg-block">
                    <p className="mgr-reviews__avg-num">{avgRating.toFixed(1)}</p>
                    <StarDisplay value={Math.round(avgRating)} size={20} />
                    <p className="mgr-reviews__avg-count">{filtered.length} review{filtered.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="mgr-reviews__dist">
                    {[5, 4, 3, 2, 1].map((n, i) => {
                      const count = distribution[i]
                      const pct = filtered.length ? (count / filtered.length) * 100 : 0
                      return (
                        <div key={n} className="mgr-reviews__dist-row">
                          <span className="mgr-reviews__dist-label">{n}</span>
                          <Star className="mgr-reviews__dist-star" />
                          <div className="mgr-reviews__dist-bar-wrap">
                            <div className="mgr-reviews__dist-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="mgr-reviews__dist-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Search */}
                <div className="mgr-reviews__search-wrap">
                  <Search className="mgr-reviews__search-icon" />
                  <input
                    type="text"
                    placeholder="Search by guest, event, or comment…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="mgr-reviews__search"
                  />
                </div>

                {/* List */}
                {filtered.length === 0 ? (
                  <p className="mgr-reviews__no-results">No reviews match your search.</p>
                ) : (
                  <section className="mgr-reviews__list">
                    {filtered.map((review) => {
                      const userName =
                        [review.user?.name, review.user?.surname].filter(Boolean).join(' ') || 'Guest'
                      return (
                        <article key={review.id} className="mgr-reviews__card manager-analytics__card">
                          <div className="mgr-reviews__card-top">
                            <ReviewAvatar name={review.user?.name ?? null} surname={review.user?.surname ?? null} avatarUrl={review.user?.avatar_url ?? null} />
                            <div className="mgr-reviews__card-meta">
                              <p className="mgr-reviews__card-user">{userName}</p>
                              <p className="mgr-reviews__card-event">{review.event?.event_name ?? '—'}</p>
                            </div>
                            <div className="mgr-reviews__card-right">
                              <StarDisplay value={review.rating} size={14} />
                              <p className="mgr-reviews__card-date">{formatDate(review.created_at)}</p>
                            </div>
                          </div>
                          {review.comment ? (
                            <p className="mgr-reviews__card-comment">{review.comment}</p>
                          ) : null}
                        </article>
                      )
                    })}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
