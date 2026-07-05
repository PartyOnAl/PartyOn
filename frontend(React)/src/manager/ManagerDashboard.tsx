import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './ManagerDashboard.css'
import { MANAGER_NAV, ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { isPaidTicketEvent } from './eventPaidEntry'
import { API_BASE_URL } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardStats = {
  clubName: string
  ticketsSold: number
  tableReservations: number
  totalRevenue: number
  upcomingEvents: number
  weeklyReservations: { date: string; dayName?: string; tickets?: number; tables?: number; count: number }[]
  upcomingEventList?: {
    event_id: string
    event_name: string
    event_starting_date: string
    event_capacity: number | null
    event_image: string | null
    guest_count: number
    is_paid_event: boolean
  }[]
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

type TicketTypeRow = {
  id: string
  event_id: string | null
}

type TicketRow = {
  id: string
  event_id: string | null
  ticket_type_id?: string | null
  quantity: number | null
  status: string | null
  created_at?: string | null
}

type ClubEventPriceRow = {
  event_id: string
  ticket_price: string | null
  final_ticket_price: string | null
  event_type: string | null
}

type WeeklyActivityBar = {
  day: string
  dayName: string
  tickets: number
  freeReservations: number
}

type ActivePromotion = {
  promotion_id: string
  title: string
  category: string | null
  discount_value: number | null
  valid_until: string | null
  status: string | null
  image_url: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THUMB_COLORS = ['violet', 'cyan', 'amber'] as const
const TABLES_NAV_TARGET = MANAGER_NAV.find((item) => item.id === 'tables')?.to ?? '/manager/tables'

// Per-metric accent colours (tickets, tables, revenue, events)
const METRIC_COLORS = [
  { accent: '#ec4899', dim: 'rgba(236,72,153,0.14)' },
  { accent: '#a855f7', dim: 'rgba(168,85,247,0.14)' },
  { accent: '#34d399', dim: 'rgba(52,211,153,0.14)' },
  { accent: '#f59e0b', dim: 'rgba(245,158,11,0.14)' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `€${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Y-axis top = highest whole-number count in the data (no padded 4 when max is 1). */
function chartScaleMax(maxValue: number) {
  const v = Math.max(0, Math.ceil(maxValue))
  if (v <= 1) return 1
  if (v <= 6) return v
  return Math.ceil(v / 5) * 5
}

function chartYTicks(max: number): number[] {
  if (max <= 1) return [1, 0]
  if (max <= 6) return Array.from({ length: max + 1 }, (_, i) => max - i)
  const steps = 5
  return Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((max * (steps - i)) / steps),
  )
}

/** One horizontal line per Y tick (0 … max), including the top value. */
function chartGridBackground(max: number): string {
  if (max <= 0) return 'transparent'
  const line = 'rgba(255, 255, 255, 0.045)'
  const stops: string[] = []
  for (let value = 0; value <= max; value += 1) {
    const pct = (value / max) * 100
    stops.push(`${line} calc(${pct}% - 0.5px)`)
    stops.push(`${line} calc(${pct}% + 0.5px)`)
    if (value < max) {
      const nextPct = ((value + 1) / max) * 100
      stops.push(`transparent calc(${pct}% + 0.5px)`)
      stops.push(`transparent calc(${nextPct}% - 0.5px)`)
    }
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`
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

function IconChevronRight() {
  return (
    <svg className="manager-dash__event-arrow" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
function IconPromo() {
  return (
    <svg className="manager-dash__promo-tag-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M17 7L7 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
  const [statsReloadKey, setStatsReloadKey] = useState(0)
  const hasLoadedStatsRef = useRef(false)

  // ── Supplementary data still fetched from Supabase for the lists ──────────
  const [events,             setEvents]             = useState<EventRow[]>([])
  const [_reservations,      setReservations]       = useState<RawReservation[]>([])
  const [_tickets,           setTickets]            = useState<TicketRow[]>([])
  const [activePromotions,   setActivePromotions]   = useState<ActivePromotion[]>([])
  const [listLoading,        setListLoading]        = useState(true)
  const [clubEventPricing, setClubEventPricing] = useState<ClubEventPriceRow[]>([])
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityBar[]>([])
  const hasLoadedListsRef = useRef(false)
  const realtimeRefreshTimerRef = useRef<number | null>(null)

  // ── Fetch stats from backend ──────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return

    if (!user || !session) {
      setStatsLoading(false)
      return
    }

    if (!hasLoadedStatsRef.current) {
      setStatsLoading(true)
    }
    setStatsError(null)

    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.status === 401) throw new Error('Unauthorized — please sign in again.')
        if (res.status === 404) throw new Error('No club found for your account.')
        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = (await res.json()) as DashboardStats
        setStats(data)
        setWeeklyActivity(
          data.weeklyReservations.map((row) => ({
            day: row.date,
            dayName: row.dayName ?? row.date,
            tickets: row.tickets ?? 0,
            freeReservations: row.tables ?? row.count ?? 0,
          })),
        )
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : String(err))
      } finally {
        hasLoadedStatsRef.current = true
        setStatsLoading(false)
      }
    })()
  }, [user, session, authLoading, statsReloadKey])

  const fetchDashboardLists = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (authLoading || !stats || !user) {
      setListLoading(false)
      return
    }
    if (!supabase || !isSupabaseConfigured) {
      setListLoading(false)
      setClubEventPricing([])
      return
    }

    if (!silent && !hasLoadedListsRef.current) {
      setListLoading(true)
    }

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
        setTickets([])
        setActivePromotions([])
        setClubEventPricing([])
        setWeeklyActivity([])
        return
      }
      const clubId = clubData.club_id

      const { data: priceRows } = await supabase!
        .from('events')
        .select('event_id, ticket_price, final_ticket_price, event_type')
        .eq('club_id', clubId)
      const clubEvents = (priceRows ?? []) as ClubEventPriceRow[]
      setClubEventPricing(clubEvents)

      // Active promotions — independent of events, fetch before any early-return
      const today = new Date().toISOString().split('T')[0]
      const { data: promoData } = await supabase!
        .from('promotions')
        .select('promotion_id, title, category, discount_value, valid_until, status, image_url')
        .eq('club_id', clubId)
        .eq('status', 'active')
        .gte('valid_until', today)
        .order('valid_until', { ascending: true })
        .limit(5)
      setActivePromotions((promoData ?? []) as ActivePromotion[])

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

      const clubEventIds = clubEvents.map((event) => event.event_id).filter(Boolean)

      if (clubEventIds.length === 0) {
        setReservations([])
        setTickets([])
        setWeeklyActivity([])
        return
      }

      const { data: ticketTypeData } = await supabase!
        .from('ticket_types')
        .select('id, event_id')
        .in('event_id', clubEventIds)

      const ticketTypes = (ticketTypeData ?? []) as TicketTypeRow[]
      const ticketTypeEventById = new Map(
        ticketTypes
          .filter((ticketType) => ticketType.id && ticketType.event_id)
          .map((ticketType) => [ticketType.id, ticketType.event_id!]),
      )
      const ticketTypeIds = ticketTypes.map((ticketType) => ticketType.id).filter(Boolean)

      async function fetchReservationRows(column: 'event_id' | 'ticket_type_id', ids: string[]) {
        if (ids.length === 0) return [] as RawReservation[]

        const reservationSelect =
          'reservation_id, type, status, table_id, ticket_type_id, ' +
          'nr_of_people, event_id, reservation_date, created_at'

        const first = await supabase!
          .from('reservations')
          .select(reservationSelect)
          .in(column, ids)
          .order('created_at', { ascending: false })

        if (!first.error) return (first.data ?? []) as unknown as RawReservation[]

        const retry = await supabase!
          .from('reservations')
          .select(reservationSelect)
          .in(column, ids)
          .order('created_at', { ascending: false })

        return (retry.data ?? []) as unknown as RawReservation[]
      }

      const [eventReservationResult, ticketTypeReservationResult, eventTicketRowsResult, ticketTypeTicketRowsResult] = await Promise.all([
        fetchReservationRows('event_id', clubEventIds),
        fetchReservationRows('ticket_type_id', ticketTypeIds),
        supabase!
          .from('tickets')
          .select('id, event_id, ticket_type_id, quantity, status, created_at')
          .in('event_id', clubEventIds),
        ticketTypeIds.length > 0
          ? supabase!
              .from('tickets')
              .select('id, event_id, ticket_type_id, quantity, status, created_at')
              .in('ticket_type_id', ticketTypeIds)
          : Promise.resolve({ data: [] as TicketRow[], error: null }),
      ])

      const reservationRows = [
        ...eventReservationResult,
        ...ticketTypeReservationResult,
      ]
      const reservationById = new Map<string, RawReservation>()
      for (const reservation of reservationRows) {
        const resolvedEventId =
          reservation.event_id ??
          (reservation.ticket_type_id ? ticketTypeEventById.get(reservation.ticket_type_id) ?? null : null)
        reservationById.set(reservation.reservation_id, {
          ...reservation,
          event_id: resolvedEventId,
        })
      }

      const ress = [...reservationById.values()]
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      setReservations(ress)
      const ticketRows = [
        ...(eventTicketRowsResult.error ? [] : ((eventTicketRowsResult.data ?? []) as unknown as TicketRow[])),
        ...(ticketTypeTicketRowsResult.error ? [] : ((ticketTypeTicketRowsResult.data ?? []) as unknown as TicketRow[])),
      ]
      const ticketById = new Map<string, TicketRow>()
      for (const ticket of ticketRows) {
        ticketById.set(ticket.id, {
          ...ticket,
          event_id:
            ticket.event_id ??
            (ticket.ticket_type_id ? ticketTypeEventById.get(ticket.ticket_type_id) ?? null : null),
        })
      }
      const resolvedTickets = [...ticketById.values()]
      setTickets(resolvedTickets)

    } finally {
      hasLoadedListsRef.current = true
      setListLoading(false)
    }
  }, [authLoading, stats, user])

  useEffect(() => {
    void fetchDashboardLists()
  }, [fetchDashboardLists])

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current)
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null
      setStatsReloadKey((key) => key + 1)
      void fetchDashboardLists({ silent: true })
    }, 250)
  }, [fetchDashboardLists])

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return

    const channel = supabase
      .channel('manager-dashboard-upcoming-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_types' }, scheduleRealtimeRefresh)
      .subscribe()

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current)
        realtimeRefreshTimerRef.current = null
      }
      void supabase?.removeChannel(channel)
    }
  }, [scheduleRealtimeRefresh])

  // ── Derived data for the lists ────────────────────────────────────────────

  // reserved for future list features
  void useMemo(
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

  const emptyWeekBars = Array.from({ length: 7 }, (_, index) => {
        const date = new Date()
        date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() - (6 - index))
        return {
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          tickets: 0,
          freeReservations: 0,
        }
      })
  const weekBars = weeklyActivity.length > 0 ? weeklyActivity : emptyWeekBars
  const chartMax = chartScaleMax(Math.max(...weekBars.flatMap((b) => [b.tickets, b.freeReservations]), 0))
  const chartTicks = chartYTicks(chartMax)
  const chartGridBackgroundStyle = chartGridBackground(chartMax)

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
                <article
                  key={label}
                  className="manager-dash__metric"
                  style={{
                    '--metric-accent': METRIC_COLORS[idx].accent,
                    '--metric-dim': METRIC_COLORS[idx].dim,
                  } as React.CSSProperties}
                >
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
                  <h2 className="manager-dash__card-title">Weekly Activity</h2>
                  <p className="manager-dash__card-sub">Reservations per day (last 7 days).</p>
                </div>
              </div>

              {statsLoading || listLoading ? (
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
                    <div className="manager-dash__chart-y-scale">
                      {chartTicks.map((v, index) => (
                        <span key={`${v}-${index}`}>{v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="manager-dash__chart-plot">
                    <div
                      className="manager-dash__chart-grid"
                      aria-hidden
                      style={{ background: chartGridBackgroundStyle }}
                    />
                    <div className="manager-dash__chart-legend" aria-label="Chart legend">
                      <span><i className="manager-dash__legend-dot manager-dash__legend-dot--tickets" />Tickets Sold</span>
                      <span><i className="manager-dash__legend-dot manager-dash__legend-dot--free-reservations" />Free Reservations</span>
                    </div>
                    <div className="manager-dash__chart-bars">
                      {weekBars.map((b) => {
                        const ticketHeight = chartMax > 0 ? (b.tickets / chartMax) * 100 : 0
                        const freeReservationHeight = chartMax > 0 ? (b.freeReservations / chartMax) * 100 : 0
                        const tooltipHeight = Math.max(ticketHeight, freeReservationHeight)
                        return (
                          <div key={b.day} className="manager-dash__bar-col">
                            <div
                              className="manager-dash__bar-group"
                              style={{ '--activity-bar-height': `${tooltipHeight}%` } as React.CSSProperties}
                            >
                              <div
                                className="manager-dash__bar manager-dash__bar--tickets"
                                style={{
                                  height: `${ticketHeight}%`,
                                  minHeight: b.tickets > 0 ? 3 : 0,
                                }}
                              />
                              <div
                                className="manager-dash__bar manager-dash__bar--free-reservations"
                                style={{
                                  height: `${freeReservationHeight}%`,
                                  minHeight: b.freeReservations > 0 ? 3 : 0,
                                }}
                              />
                              <div className="manager-dash__chart-tooltip" role="tooltip">
                                <p className="manager-dash__chart-tooltip-day">{b.dayName}</p>
                                <p><span>Tickets Sold:</span> <strong>{b.tickets}</strong></p>
                                <p><span>Free Reservations:</span> <strong>{b.freeReservations}</strong></p>
                              </div>
                            </div>
                            <span className="manager-dash__bar-label">{b.day}</span>
                          </div>
                        )
                      })}
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
                  onClick={() => navigate('/manager/events?action=new')}
                >
                  <span className="manager-dash__qa-icon-wrap"><IconCalendar /></span>
                  <span className="manager-dash__qa-label">Create Event</span>
                  <IconPlus />
                </button>
                <button
                  type="button"
                  className="manager-dash__qa-btn"
                  onClick={() => navigate('/manager/promotions?action=new')}
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
                  <IconPlus />
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
                <Link to="/manager/events" className="manager-dash__link-all">
                  View all →
                </Link>
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
              ) : (stats?.upcomingEventList ?? []).length === 0 ? (
                <p style={{ color: '#8a8a8a', fontSize: '0.875rem' }}>No upcoming events.</p>
              ) : (
                <ul className="manager-dash__event-list">
                  {(stats?.upcomingEventList ?? []).map((ev, i) => {
                    const sold = ev.guest_count
                    const cap  = ev.event_capacity ?? 0
                    const pct  = cap > 0 ? Math.min(100, (sold / cap) * 100) : 0
                    return (
                      <li key={ev.event_id} className="manager-dash__event-row">
                        <Link
                          className="manager-dash__event-link"
                          to={`/manager/events?event=${encodeURIComponent(ev.event_id)}`}
                          aria-label={`Open ${ev.event_name} event details`}
                        >
                          <div
                            className={`manager-dash__event-thumb${!ev.event_image ? ` manager-dash__event-thumb--${THUMB_COLORS[i % 3]}` : ''}`}
                            style={ev.event_image ? {
                              backgroundImage: `url(${ev.event_image})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            } : undefined}
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
                                  {sold} / {cap} {ev.is_paid_event ? 'tickets' : 'reservations'}
                                </p>
                              </>
                            )}
                          </div>
                          <IconChevronRight />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Active Promotions */}
            <div className="manager-dash__card manager-dash__card--list">
              <div className="manager-dash__card-head">
                <h2 className="manager-dash__card-title">Active Promotions</h2>
                <Link to="/manager/promotions" className="manager-dash__link-all">
                  View all →
                </Link>
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
              ) : activePromotions.length === 0 ? (
                <div className="manager-dash__promo-empty">
                  <p>No active promotions right now.</p>
                  <button
                    type="button"
                    className="manager-dash__promo-create-btn"
                    onClick={() => navigate('/manager/promotions')}
                  >
                    Create Promotion
                  </button>
                </div>
              ) : (
                <ul className="manager-dash__promo-list">
                  {activePromotions.map((promo) => (
                    <li key={promo.promotion_id}>
                      <button
                        type="button"
                        className="manager-dash__promo-row"
                        onClick={() => navigate('/manager/promotions')}
                      >
                        <div className="manager-dash__promo-icon" aria-hidden>
                          {promo.image_url
                            ? <img src={promo.image_url} alt="" className="manager-dash__promo-icon-img" />
                            : <IconPromo />}
                        </div>
                        <div className="manager-dash__promo-body">
                          <p className="manager-dash__promo-title">{promo.title}</p>
                          <p className="manager-dash__promo-meta">
                            {promo.category ?? 'Promotion'}
                            {promo.valid_until
                              ? ` · Expires ${new Date(promo.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                              : ''}
                          </p>
                        </div>
                        <div className="manager-dash__promo-right">
                          {promo.discount_value != null && (
                            <span className="manager-dash__promo-discount">
                              {promo.discount_value}% off
                            </span>
                          )}
                          <IconChevronRight />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
