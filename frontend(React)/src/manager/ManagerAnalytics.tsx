import { useEffect, useMemo, useState } from 'react'
import './ManagerDashboard.css'
import './ManagerAnalytics.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

type EventRow = {
  event_id: string
  event_name: string
  event_starting_date: string
  created_at: string | null
}

type ReservationRow = {
  reservation_id: string
  event_id: string | null
  type: string | null
  status: string | null
  user_id: string | null
  created_at: string | null
}

type PaymentRow = {
  amount: string | number | null
  status: string | null
  payment_date: string | null
  reservation_id: string | null
}

function parseAmount(value: string | number | null) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'))
  return Number.isFinite(n) ? n : 0
}

function isCompletedPayment(status: string | null) {
  return (status ?? '').toLowerCase() === 'completed'
}

function isTicketSale(row: ReservationRow) {
  return row.type === 'ticket' && row.status === 'confirmed'
}

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact && Math.abs(value) >= 1000 ? 'compact' : 'standard',
  }).format(value)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? '+100%' : '+0%'
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${Math.round(pct)}%`
}

function IconMoney() {
  return (
    <svg className="manager-analytics__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="manager-analytics__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="manager-analytics__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg className="manager-analytics__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m18 8-6 6-4-4-6 6M14 8h4v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string
  value: string
  trend: string
  icon: React.ReactNode
}) {
  const positive = !trend.startsWith('-')
  return (
    <article className="manager-analytics__metric">
      <div className="manager-analytics__metric-top">
        <span className="manager-analytics__metric-icon-wrap">{icon}</span>
        <span className={positive ? 'manager-analytics__trend manager-analytics__trend--up' : 'manager-analytics__trend manager-analytics__trend--down'}>
          {trend}
        </span>
      </div>
      <p className="manager-analytics__metric-value">{value}</p>
      <p className="manager-analytics__metric-label">{label}</p>
    </article>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />
        <div className="manager-dash__main manager-analytics__main">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ManagerAnalytics() {
  const { club, clubId } = useManagerClub()
  const [events, setEvents] = useState<EventRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const { data: eventData, error: eventErr } = await supabase
          .from('events')
          .select('event_id, event_name, event_starting_date, created_at')
          .eq('club_id', clubId)
          .order('event_starting_date', { ascending: true })

        if (eventErr) throw new Error(eventErr.message)

        const eventRows = (eventData ?? []) as EventRow[]
        const eventIds = eventRows.map((event) => event.event_id)
        setEvents(eventRows)

        if (eventIds.length === 0) {
          setReservations([])
          setPayments([])
          return
        }

        const { data: reservationData, error: reservationErr } = await supabase
          .from('reservations')
          .select('reservation_id, event_id, type, status, user_id, created_at')
          .in('event_id', eventIds)

        if (reservationErr) throw new Error(reservationErr.message)

        const reservationRows = (reservationData ?? []) as ReservationRow[]
        const reservationIds = reservationRows.map((reservation) => reservation.reservation_id)
        setReservations(reservationRows)

        if (reservationIds.length === 0) {
          setPayments([])
          return
        }

        const { data: paymentData, error: paymentErr } = await supabase
          .from('payments')
          .select('amount, status, payment_date, reservation_id')
          .in('reservation_id', reservationIds)

        if (paymentErr) throw new Error(paymentErr.message)

        setPayments((paymentData ?? []) as PaymentRow[])
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [clubId])

  const analytics = useMemo(() => {
    const now = new Date()
    const currentMonth = startOfMonth(now)
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const reservationById = Object.fromEntries(reservations.map((reservation) => [reservation.reservation_id, reservation]))
    const eventById = Object.fromEntries(events.map((event) => [event.event_id, event]))
    const completedPayments = payments.filter((payment) => isCompletedPayment(payment.status))
    const totalRevenue = completedPayments.reduce((sum, payment) => sum + parseAmount(payment.amount), 0)
    const ticketSales = reservations.filter(isTicketSale)
    const uniqueCustomers = new Set(reservations.map((reservation) => reservation.user_id).filter(Boolean)).size
    const averageTicketPrice = ticketSales.length > 0 ? totalRevenue / ticketSales.length : 0

    const currentMonthRevenue = completedPayments
      .filter((payment) => {
        const date = payment.payment_date ? new Date(payment.payment_date) : null
        return date !== null && date >= currentMonth && date < nextMonth
      })
      .reduce((sum, payment) => sum + parseAmount(payment.amount), 0)
    const previousMonthRevenue = completedPayments
      .filter((payment) => {
        const date = payment.payment_date ? new Date(payment.payment_date) : null
        return date !== null && date >= previousMonth && date < currentMonth
      })
      .reduce((sum, payment) => sum + parseAmount(payment.amount), 0)

    const currentMonthCustomers = new Set(
      reservations
        .filter((reservation) => {
          const date = reservation.created_at ? new Date(reservation.created_at) : null
          return date !== null && date >= currentMonth && date < nextMonth
        })
        .map((reservation) => reservation.user_id)
        .filter(Boolean),
    ).size
    const previousMonthCustomers = new Set(
      reservations
        .filter((reservation) => {
          const date = reservation.created_at ? new Date(reservation.created_at) : null
          return date !== null && date >= previousMonth && date < currentMonth
        })
        .map((reservation) => reservation.user_id)
        .filter(Boolean),
    ).size

    const currentMonthEvents = events.filter((event) => {
      const date = new Date(event.event_starting_date)
      return date >= currentMonth && date < nextMonth
    }).length
    const previousMonthEvents = events.filter((event) => {
      const date = new Date(event.event_starting_date)
      return date >= previousMonth && date < currentMonth
    }).length

    const previousMonthTickets = reservations.filter((reservation) => {
      const date = reservation.created_at ? new Date(reservation.created_at) : null
      return isTicketSale(reservation) && date !== null && date >= previousMonth && date < currentMonth
    }).length
    const currentMonthTickets = reservations.filter((reservation) => {
      const date = reservation.created_at ? new Date(reservation.created_at) : null
      return isTicketSale(reservation) && date !== null && date >= currentMonth && date < nextMonth
    }).length

    const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const key = monthKey(date)
      const value = completedPayments
        .filter((payment) => {
          const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null
          return paymentDate !== null && monthKey(paymentDate) === key
        })
        .reduce((sum, payment) => sum + parseAmount(payment.amount), 0)
      return { label: date.toLocaleString('en-US', { month: 'short' }), value }
    })

    const weeklySales = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (6 - index))
      const key = dayKey(date)
      const value = reservations.filter((reservation) => {
        const createdAt = reservation.created_at ? new Date(reservation.created_at) : null
        return isTicketSale(reservation) && createdAt !== null && dayKey(createdAt) === key
      }).length
      return { label: date.toLocaleDateString('en-US', { weekday: 'short' }), value }
    })

    const revenueByEvent = completedPayments.reduce<Record<string, number>>((acc, payment) => {
      const reservation = payment.reservation_id ? reservationById[payment.reservation_id] : null
      const eventId = reservation?.event_id
      if (!eventId) return acc
      acc[eventId] = (acc[eventId] ?? 0) + parseAmount(payment.amount)
      return acc
    }, {})

    const ticketsByEvent = ticketSales.reduce<Record<string, number>>((acc, reservation) => {
      if (!reservation.event_id) return acc
      acc[reservation.event_id] = (acc[reservation.event_id] ?? 0) + 1
      return acc
    }, {})

    const topEvents = Object.entries(revenueByEvent)
      .map(([eventId, revenue]) => ({
        eventId,
        name: eventById[eventId]?.event_name ?? 'Untitled Event',
        revenue,
        tickets: ticketsByEvent[eventId] ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)

    return {
      totalRevenue,
      uniqueCustomers,
      eventsHosted: events.length,
      averageTicketPrice,
      trends: {
        revenue: formatTrend(currentMonthRevenue, previousMonthRevenue),
        customers: formatTrend(currentMonthCustomers, previousMonthCustomers),
        events: formatTrend(currentMonthEvents, previousMonthEvents),
        ticketPrice: formatTrend(currentMonthTickets, previousMonthTickets),
      },
      monthlyRevenue,
      weeklySales,
      topEvents,
    }
  }, [events, reservations, payments])

  const maxMonthlyRevenue = Math.max(...analytics.monthlyRevenue.map((item) => item.value), 1)
  const maxWeeklySales = Math.max(...analytics.weeklySales.map((item) => item.value), 1)
  const chartPoints = analytics.monthlyRevenue
    .map((item, index) => {
      const x = analytics.monthlyRevenue.length === 1 ? 50 : (index / (analytics.monthlyRevenue.length - 1)) * 100
      const y = 92 - (item.value / maxMonthlyRevenue) * 72
      return `${x},${y}`
    })
    .join(' ')

  if (loading) {
    return <Shell><span style={{ color: '#8a8a8a' }}>Loading analytics...</span></Shell>
  }

  if (error) {
    return <Shell><span style={{ color: '#f87171' }}>Error: {error}</span></Shell>
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-analytics__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-analytics__bound">
            <div className="manager-dash__page-head">
              <h1 className="manager-dash__page-title">Analytics</h1>
              <p className="manager-dash__page-sub">Track performance and insights</p>
            </div>

            <section className="manager-analytics__metrics" aria-label="Analytics metrics">
              <MetricCard label="Total Revenue" value={formatCurrency(analytics.totalRevenue, true)} trend={analytics.trends.revenue} icon={<IconMoney />} />
              <MetricCard label="Total Customers" value={analytics.uniqueCustomers.toLocaleString('en-US')} trend={analytics.trends.customers} icon={<IconUsers />} />
              <MetricCard label="Events Hosted" value={analytics.eventsHosted.toLocaleString('en-US')} trend={analytics.trends.events} icon={<IconCalendar />} />
              <MetricCard label="Avg. Ticket Price" value={formatCurrency(analytics.averageTicketPrice)} trend={analytics.trends.ticketPrice} icon={<IconTrend />} />
            </section>

            <section className="manager-analytics__charts" aria-label="Analytics charts">
              <article className="manager-analytics__card">
                <h2 className="manager-analytics__card-title">Monthly Revenue</h2>
                <div className="manager-analytics__line-chart">
                  <div className="manager-analytics__y-axis">
                    {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                      <span key={ratio}>{formatCurrency(maxMonthlyRevenue * ratio, true)}</span>
                    ))}
                  </div>
                  <div className="manager-analytics__line-plot">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                      <polyline points={chartPoints} />
                      {analytics.monthlyRevenue.map((item, index) => {
                        const x = analytics.monthlyRevenue.length === 1 ? 50 : (index / (analytics.monthlyRevenue.length - 1)) * 100
                        const y = 92 - (item.value / maxMonthlyRevenue) * 72
                        return <circle key={item.label} cx={x} cy={y} r="1.4" />
                      })}
                    </svg>
                    <div className="manager-analytics__x-axis">
                      {analytics.monthlyRevenue.map((item) => <span key={item.label}>{item.label}</span>)}
                    </div>
                  </div>
                </div>
              </article>

              <article className="manager-analytics__card">
                <h2 className="manager-analytics__card-title">Weekly Ticket Sales</h2>
                <div className="manager-analytics__bar-chart">
                  {analytics.weeklySales.map((item) => (
                    <div key={item.label} className="manager-analytics__bar-col">
                      <div
                        className="manager-analytics__bar"
                        title={`${item.value} tickets`}
                        style={{ height: `${Math.max(8, (item.value / maxWeeklySales) * 100)}%` }}
                      />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="manager-analytics__card manager-analytics__top-events" aria-label="Top performing events">
              <h2 className="manager-analytics__card-title">Top Performing Events</h2>
              {analytics.topEvents.length === 0 ? (
                <p className="manager-analytics__empty">No paid event revenue yet.</p>
              ) : (
                <ul className="manager-analytics__event-list">
                  {analytics.topEvents.map((event, index) => (
                    <li key={event.eventId} className="manager-analytics__event-row">
                      <span className="manager-analytics__event-rank">#{index + 1}</span>
                      <div className="manager-analytics__event-info">
                        <p>{event.name}</p>
                        <span>{event.tickets.toLocaleString('en-US')} tickets sold</span>
                      </div>
                      <div className="manager-analytics__event-revenue">
                        <strong>{formatCurrency(event.revenue, false)}</strong>
                        <span>Revenue</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
