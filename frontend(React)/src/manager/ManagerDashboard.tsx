import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ManagerDashboard.css'
import { MANAGER_NAV, ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { isPaidTicketEvent } from './eventPaidEntry'

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardStats = {
  clubName: string
  ticketsSold: number
  tableReservations: number
  totalRevenue: number
  upcomingEvents: number
  weeklyReservations: { date: string; count: number }[]
}

type EventRow = {
  event_id: string
  event_name: string
  event_starting_date: string
  event_capacity: number | null
  event_image: string | null
  event_type: string | null
  ticket_price: string | null
  final_ticket_price: string | null
}

type RawReservation = {
  reservation_id: string
  type: string | null
  status: string | null
  table_id: string | null
  ticket_type_id: string | null
  nr_of_people: number | null
  event_id: string | null
  reservation_date: string | null
  created_at: string | null
}

type ClubEventPriceRow = {
  ticket_price: string | null
  final_ticket_price: string | null
  event_type: string | null
}

type RecentReservation = {
  reservation_id: string
  type: string | null
  status: string | null
  event_id: string | null
  created_at: string | null
  profiles: { name: string | null; surname: string | null } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THUMB_COLORS = ['violet', 'cyan', 'amber'] as const
const TABLES_NAV_TARGET = MANAGER_NAV.find((item) => item.id === 'tables')?.to ?? '/manager/tables'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `€${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
function IconTicket() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconTableSmall() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16v10H4V7Zm0 5h16M9 7v10M15 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconEuro() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 10h12M6 14h9M8 6c-2 2-2 10 0 12M16 6c2 2 2 10 0 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconCalendarSmall() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconTrendUp() {
  return (
    <svg className="manager-dash__trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m18 8-6 6-4-4-6 6M14 8h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPlus() {
  return (
    <svg className="manager-dash__qa-chev" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconExternal() {
  return (
    <svg className="manager-dash__qa-chev" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 3h7v7M10 14 21 3M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconDollar() {
  return (
    <svg className="manager-dash__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
function IconSeats() {
  return (
    <svg className="manager-dash__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 12h3v6H6v-6Zm9 0h3v6h-3v-6ZM4 10h5M15 10h5M9 6h6v4H9V6Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function navIconForMetric(index: number) {
  const icons = [IconTicket, IconTableSmall, IconEuro, IconCalendarSmall]
  const C = icons[index] ?? IconTicket
  return <C />
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <article className="manager-dash__metric" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="manager-dash__metric-head">
        <span
          className="manager-dash__metric-ic-wrap"
          style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, width: 32, height: 32 }}
        />
      </div>
      <div style={{ height: 28, width: '60%', borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }} />
      <div style={{ height: 14, width: '80%', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
    </article>
  )
}

// ─── Loading / Error shells ───────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />
        <div className="manager-dash__main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const { user, session, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  // ── Stats from backend API ────────────────────────────────────────────────
  const [stats, setStats]             = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError]   = useState<string | null>(null)

  // ── Supplementary data still fetched from Supabase for the lists ──────────
  const [events,             setEvents]             = useState<EventRow[]>([])
  const [reservations,       setReservations]       = useState<RawReservation[]>([])
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([])
  const [listLoading,        setListLoading]        = useState(true)
  const [clubEventPricing, setClubEventPricing] = useState<ClubEventPriceRow[]>([])

  // ── Fetch stats from backend ──────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return

    if (!user || !session) {
      setStatsLoading(false)
      return
    }

    setStatsLoading(true)
    setStatsError(null)

    void (async () => {
      try {
        const res = await fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.status === 401) throw new Error('Unauthorized — please sign in again.')
        if (res.status === 404) throw new Error('No club found for your account.')
        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = (await res.json()) as DashboardStats
        setStats(data)
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : String(err))
      } finally {
        setStatsLoading(false)
      }
    })()
  }, [user, session, authLoading])

  // ── Fetch supplementary list data from Supabase (upcoming events + recent) ─
  useEffect(() => {
    if (authLoading || !stats || !user) return
    if (!supabase || !isSupabaseConfigured) {
      setListLoading(false)
      setClubEventPricing([])
      return
    }

    setListLoading(true)

    void (async () => {
      try {
        const currentUser = user
        const { data: clubData, error: clubErr } = await supabase!
          .from('clubs')
          .select('club_id')
          .eq('manager_id', currentUser.id)
          .single()

        if (clubErr || !clubData?.club_id) {
          setEvents([])
          setReservations([])
          setRecentReservations([])
          setClubEventPricing([])
          return
        }
        const clubId = clubData.club_id

        const { data: priceRows } = await supabase!
          .from('events')
          .select('ticket_price, final_ticket_price, event_type')
          .eq('club_id', clubId)
        setClubEventPricing((priceRows ?? []) as ClubEventPriceRow[])

        const { data: evData } = await supabase!
          .from('events')
          .select(
            'event_id, event_name, event_starting_date, event_capacity, event_image, event_type, ticket_price, final_ticket_price',
          )
          .eq('club_id', clubId)
          .gt('event_starting_date', new Date().toISOString())
          .order('event_starting_date', { ascending: true })
          .limit(5)

        const evs: EventRow[] = evData ?? []
        setEvents(evs)

        if (evs.length === 0) return

        const eventIds = evs.map((e) => e.event_id)

        const { data: resData } = await supabase!
          .from('reservations')
          .select(
            'reservation_id, type, status, table_id, ticket_type_id, ' +
            'nr_of_people, event_id, reservation_date, created_at',
          )
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })

        const ress = (resData ?? []) as unknown as RawReservation[]
        setReservations(ress)

        if (ress.length === 0) return

        const recentIds = ress.slice(0, 5).map((r) => r.reservation_id)
        const { data: recentData } = await supabase!
          .from('reservations')
          .select('reservation_id, type, status, event_id, created_at, profiles(name, surname)')
          .in('reservation_id', recentIds)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentReservations((recentData ?? []) as unknown as RecentReservation[])
      } finally {
        setListLoading(false)
      }
    })()
  }, [stats, authLoading, user])

  // ── Derived data for the lists ────────────────────────────────────────────
  const now = new Date()

  const eventById = useMemo(
    () => Object.fromEntries(events.map((e) => [e.event_id, e])),
    [events],
  )

  const metricLabels = useMemo(() => {
    const rows = clubEventPricing
    if (rows.length === 0) {
      return { tickets: 'Tickets Sold', tables: 'Table Reservations' }
    }
    const hasPaid = rows.some(isPaidTicketEvent)
    const hasFree = rows.some((e) => !isPaidTicketEvent(e))
    const tickets = !hasPaid && hasFree ? 'Reservations' : 'Tickets Sold'
    return { tickets, tables: 'Table Reservations' }
  }, [clubEventPricing])

  const upcomingList = useMemo(
    () => events.filter((e) => new Date(e.event_starting_date) > now).slice(0, 5),
    [events],
  )

  // Chart data from API (convert { date, count } → { day, value })
  const weekBars = stats?.weeklyReservations.map((w) => ({ day: w.date, value: w.count })) ?? []
  const chartMax = Math.max(...weekBars.map((b) => b.value), 1)

  // Payments lookup for recent reservations amount display
  const [payments, setPayments] = useState<{ payment_id: string; amount: string; status: string | null; reservation_id: string }[]>([])
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || reservations.length === 0) return
    const ids = reservations.map((r) => r.reservation_id)
    void supabase
      .from('payments')
      .select('payment_id, amount, status, reservation_id')
      .in('reservation_id', ids)
      .then(({ data }) => setPayments(data ?? []))
  }, [reservations])

  // ── Render states ─────────────────────────────────────────────────────────

  if (authLoading) {
    return <Shell><span style={{ color: '#8a8a8a' }}>Loading…</span></Shell>
  }

  if (statsError) {
    return <Shell><span style={{ color: '#f87171' }}>Error: {statsError}</span></Shell>
  }

  // ── Full render ───────────────────────────────────────────────────────────

  return (
    <div className="manager-dash">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main">
          <ManagerTopBar clubName={stats?.clubName} />

          <div className="manager-dash__page-head">
            <h1 className="manager-dash__page-title">Dashboard Overview</h1>
            <p className="manager-dash__page-sub">
              Track your club&apos;s performance and operations.
            </p>
          </div>

          {/* ── Stat cards ─────────────────────────────────────────────────── */}
          <section className="manager-dash__metrics" aria-label="Key metrics">
            {statsLoading ? (
              <>
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </>
            ) : (
              [
                { label: metricLabels.tickets, value: stats?.ticketsSold ?? 0,                    idx: 0, trend: true },
                { label: metricLabels.tables,  value: stats?.tableReservations ?? 0,              idx: 1, trend: true },
                { label: 'Total Revenue',        value: formatCurrency(stats?.totalRevenue ?? 0),  idx: 2, trend: true },
                { label: 'Upcoming Events',      value: stats?.upcomingEvents ?? 0,                idx: 3, trend: false },
              ].map(({ label, value, idx, trend }) => (
                <article key={label} className="manager-dash__metric">
                  <div className={trend ? 'manager-dash__metric-head' : 'manager-dash__metric-head manager-dash__metric-head--solo'}>
                    <span className="manager-dash__metric-ic-wrap">{navIconForMetric(idx)}</span>
                    {trend && (
                      <p className="manager-dash__metric-trend manager-dash__metric-trend--up">
                        <IconTrendUp />
                      </p>
                    )}
                  </div>
                  <p className="manager-dash__metric-value">{value}</p>
                  <p className="manager-dash__metric-label">{label}</p>
                </article>
              ))
            )}
          </section>

          {/* ── Chart + Quick Actions ──────────────────────────────────────── */}
          <section className="manager-dash__row manager-dash__row--charts">
            <div className="manager-dash__card manager-dash__card--chart">
              <div className="manager-dash__card-head">
                <div>
                  <h2 className="manager-dash__card-title">Weekly Reservations</h2>
                  <p className="manager-dash__card-sub">Bookings per day (last 7 days).</p>
                </div>
              </div>

              {statsLoading ? (
                <div
                  style={{
                    height: 160,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ) : (
                <div className="manager-dash__chart">
                  <div className="manager-dash__chart-y" aria-hidden>
                    {[
                      chartMax,
                      Math.round(chartMax * 0.75),
                      Math.round(chartMax * 0.5),
                      Math.round(chartMax * 0.25),
                      0,
                    ].map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                  <div className="manager-dash__chart-plot">
                    <div className="manager-dash__chart-grid" aria-hidden />
                    <div className="manager-dash__chart-bars">
                      {weekBars.map((b) => (
                        <div key={b.day} className="manager-dash__bar-col">
                          <div
                            className="manager-dash__bar"
                            style={{
                              height: `${chartMax > 0 ? (b.value / chartMax) * 100 : 0}%`,
                            }}
                          />
                          <span className="manager-dash__bar-label">{b.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="manager-dash__card manager-dash__card--qa">
              <h2 className="manager-dash__qa-title">Quick Actions</h2>
              <div className="manager-dash__qa-list">
                <button
                  type="button"
                  className="manager-dash__qa-btn"
                  onClick={() => navigate('/manager/events')}
                >
                  <span className="manager-dash__qa-icon-wrap"><IconCalendar /></span>
                  <span className="manager-dash__qa-label">Create Event</span>
                  <IconPlus />
                </button>
                <button
                  type="button"
                  className="manager-dash__qa-btn"
                  onClick={() => navigate('/manager/promotions')}
                >
                  <span className="manager-dash__qa-icon-wrap"><IconDollar /></span>
                  <span className="manager-dash__qa-label">Add Promotion</span>
                  <IconPlus />
                </button>
                <button
                  type="button"
                  className="manager-dash__qa-btn"
                  onClick={() => navigate(TABLES_NAV_TARGET)}
                >
                  <span className="manager-dash__qa-icon-wrap"><IconSeats /></span>
                  <span className="manager-dash__qa-label">Manage Tables</span>
                  <IconExternal />
                </button>
              </div>
            </div>
          </section>

          {/* ── Upcoming events + Recent reservations ─────────────────────── */}
          <section className="manager-dash__row manager-dash__row--lists">
            {/* Upcoming events */}
            <div className="manager-dash__card manager-dash__card--list">
              <div className="manager-dash__card-head">
                <h2 className="manager-dash__card-title">Upcoming Events</h2>
              </div>
              {listLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 56,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
                </div>
              ) : upcomingList.length === 0 ? (
                <p style={{ color: '#8a8a8a', fontSize: '0.875rem' }}>No upcoming events.</p>
              ) : (
                <ul className="manager-dash__event-list">
                  {upcomingList.map((ev, i) => {
                    const sold = reservations.filter((r) => r.event_id === ev.event_id).length
                    const cap  = ev.event_capacity ?? 0
                    const pct  = cap > 0 ? Math.min(100, (sold / cap) * 100) : 0
                    return (
                      <li key={ev.event_id} className="manager-dash__event-row">
                        <div
                          className={`manager-dash__event-thumb manager-dash__event-thumb--${THUMB_COLORS[i % 3]}`}
                          aria-hidden
                        />
                        <div className="manager-dash__event-body">
                          <p className="manager-dash__event-title">{ev.event_name}</p>
                          <p className="manager-dash__event-meta">
                            {new Date(ev.event_starting_date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                          {cap > 0 && (
                            <>
                              <div className="manager-dash__progress">
                                <div
                                  className="manager-dash__progress-fill"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="manager-dash__progress-label">
                                {sold} / {cap} {isPaidTicketEvent(ev) ? 'tickets' : 'reservations'}
                              </p>
                            </>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Recent reservations */}
            <div className="manager-dash__card manager-dash__card--list">
              <div className="manager-dash__card-head">
                <h2 className="manager-dash__card-title">Recent Reservations</h2>
              </div>
              {listLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 48,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
                </div>
              ) : recentReservations.length === 0 ? (
                <p style={{ color: '#8a8a8a', fontSize: '0.875rem' }}>No reservations yet.</p>
              ) : (
                <ul className="manager-dash__res-list">
                  {recentReservations.map((r) => {
                    const profile  = r.profiles
                    const guestName = profile
                      ? `${profile.name ?? ''} ${profile.surname ?? ''}`.trim() || 'Guest'
                      : 'Guest'
                    const evRow = r.event_id ? eventById[r.event_id] : undefined
                    const eventName = evRow?.event_name ?? '—'
                    const amount = payments
                      .filter((p) => p.reservation_id === r.reservation_id)
                      .reduce((s, p) => s + parseFloat(p.amount || '0'), 0)
                    return (
                      <li key={r.reservation_id} className="manager-dash__res-row">
                        <div>
                          <p className="manager-dash__res-guest">{guestName}</p>
                          <p className="manager-dash__res-detail">
                            {evRow && isPaidTicketEvent(evRow) ? 'Ticket' : 'Reservation'} • {eventName}
                          </p>
                        </div>
                        <div className="manager-dash__res-right">
                          <p className="manager-dash__res-price">
                            {amount > 0 ? formatCurrency(amount) : '—'}
                          </p>
                          <span
                            className={
                              r.status === 'confirmed'
                                ? 'manager-dash__badge manager-dash__badge--ok'
                                : 'manager-dash__badge manager-dash__badge--pending'
                            }
                          >
                            {r.status ?? 'pending'}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
