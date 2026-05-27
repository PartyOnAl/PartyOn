import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminNavLink from './AdminNavLink'
import { fetchAdminOverview, type AdminOverviewData } from './adminApi'
import { useAdminData } from './useAdminData'
import './PlatformAnalytics.css'

type NavId = 'overview' | 'clubs' | 'users' | 'revenue' | 'featured' | 'analysis' | 'settings'
type RangeKey = '30d' | '90d' | '6m'

type NavItem = {
  id: NavId
  label: string
  href: string
}

type LinePoint = {
  label: string
  value: number
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Platform Overview', href: '/admin/platform-analysis' },
  { id: 'clubs', label: 'Club Approvals', href: '/admin/club-approvals' },
  { id: 'users', label: 'User Management', href: '/admin/user-management' },
  { id: 'revenue', label: 'Revenue & Payments', href: '/admin/revenue-payments' },
  { id: 'featured', label: 'Featured Events', href: '/admin/featured-events' },
  { id: 'analysis', label: 'Platform Analytics', href: '/admin/platform-analytics' },
  { id: 'settings', label: 'Settings', href: '/admin/settings' },
]

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '6m', label: '6 months' },
]

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20V10M12 20V4M20 20v-6" strokeLinecap="round" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12h12M10 12v10M14 12v10" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 5 2-7L2 9h7z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18M7 16l4-4 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m13 2-8 11h6l-1 9 8-11h-6z" strokeLinejoin="round" />
    </svg>
  )
}

const NAV_ICONS: Record<NavId, ReactNode> = {
  overview: <IconOverview />,
  clubs: <IconBuilding />,
  users: <IconUsers />,
  revenue: <IconWallet />,
  featured: <IconStar />,
  analysis: <IconChart />,
  settings: <IconSettings />,
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value)
}

function formatTrend(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function monthLabels(count: number): string[] {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const labels: string[] = []
  const now = new Date()
  for (let index = count - 1; index >= 0; index -= 1) {
    labels.push(formatter.format(new Date(now.getFullYear(), now.getMonth() - index, 1)))
  }
  return labels
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildUserGrowthSeries(totalUsers: number, trend: number, range: RangeKey): LinePoint[] {
  const rangeMultiplier = range === '30d' ? 0.72 : range === '90d' ? 0.9 : 1
  const labels = monthLabels(6)
  const monthlyFactor = clamp(1 + (trend / 100) * 0.22 * rangeMultiplier, 0.94, 1.12)
  const points = new Array(labels.length).fill(null) as LinePoint[]
  let currentValue = totalUsers

  for (let index = labels.length - 1; index >= 0; index -= 1) {
    points[index] = { label: labels[index], value: Math.max(0, Math.round(currentValue)) }
    currentValue /= monthlyFactor
  }

  return points
}

function buildWeeklyBookings(totalBookings: number, averageBookings: number, range: RangeKey): LinePoint[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weights = [0.36, 0.38, 0.44, 0.56, 0.98, 1.3, 0.78]
  const rangeMultiplier = range === '30d' ? 0.88 : range === '90d' ? 1 : 1.08
  const base = Math.max(42, Math.round(Math.max(totalBookings / 42, averageBookings / 3) * rangeMultiplier))

  return labels.map((label, index) => ({
    label,
    value: Math.round(base * weights[index]),
  }))
}

function LineChart({ points }: { points: LinePoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  const minValue = Math.min(...points.map((point) => point.value), maxValue)
  const range = Math.max(maxValue - minValue, 1)
  const width = 100
  const height = 42
  const paddingX = 4
  const paddingY = 4
  const plotWidth = width - paddingX * 2
  const plotHeight = height - paddingY * 2

  const chartPoints = points.map((point, index) => {
    const x = paddingX + (plotWidth * index) / Math.max(1, points.length - 1)
    const normalized = (point.value - minValue) / range
    const y = paddingY + plotHeight - normalized * plotHeight
    return { ...point, x, y }
  })

  return (
    <svg className="pa__chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="User growth trend">
      {[0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = paddingY + plotHeight * step
        return <line key={step} className="pa__chart-gridline" x1={paddingX} x2={width - paddingX} y1={y} y2={y} />
      })}
      <polyline
        className="pa__chart-line"
        fill="none"
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
      />
      {chartPoints.map((point) => (
        <circle key={point.label} className="pa__chart-dot" cx={point.x} cy={point.y} r="1.25" />
      ))}
    </svg>
  )
}

export default function PlatformAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [range, setRange] = useState<RangeKey>('90d')
  const { session } = useAuth()
  const { data, loading, error } = useAdminData<AdminOverviewData>(
    'admin:overview',
    session?.access_token,
    fetchAdminOverview,
  )
  const navId = useId()
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const featuredEvents = useMemo(
    () => (data?.featuredEvents?.length ? data.featuredEvents : data?.topEvents ?? []),
    [data],
  )
  const totalEventCount = data?.metrics.totalEvents ?? 0
  const averageBookings = totalEventCount > 0 ? (data?.metrics.totalBookings ?? 0) / totalEventCount : 0
  const userGrowthSeries = useMemo(
    () => buildUserGrowthSeries(data?.metrics.totalUsers ?? 0, data?.trends.users ?? 0, range),
    [data, range],
  )
  const weeklyBookings = useMemo(
    () => buildWeeklyBookings(data?.metrics.totalBookings ?? 0, averageBookings, range),
    [averageBookings, data, range],
  )

  const analytics = useMemo(() => {
    const metrics = data?.metrics
    const events = featuredEvents
    const highOccupancy = events.filter((event) => event.occupancyAlert).length
    const spikes = events.filter((event) => event.reservationSpike).length
    const missingDetails = events.filter((event) => event.hasMissingDetails).length
    const avgCapacity = events.length
      ? Math.round(events.reduce((sum, event) => sum + (event.capacityPercent ?? 0), 0) / events.length)
      : 0
    const trafficReady = events.filter((event) => (event.views ?? event.clicks ?? 0) > 0).length
    const revenuePerBooking = metrics?.totalBookings ? metrics.monthlyRevenue / metrics.totalBookings : 0
    const favoriteRate = events.length
      ? Math.round(
          events.reduce((sum, event) => sum + (event.favorites ?? 0), 0) /
            Math.max(events.reduce((sum, event) => sum + (event.views ?? event.clicks ?? 0), 0), 1) *
            100,
        )
      : 0

    return {
      highOccupancy,
      spikes,
      missingDetails,
      avgCapacity,
      trafficCoverage: percent(trafficReady, Math.max(events.length, 1)),
      revenuePerBooking,
      bookingPerEvent: averageBookings,
      favoriteRate,
      activeClubShare: metrics
        ? percent(metrics.activeClubs, Math.max(metrics.activeClubs + metrics.pendingApprovals, 1))
        : 0,
    }
  }, [averageBookings, data, featuredEvents])

  const kpis = [
    { label: 'Total Users', value: formatNumber(data?.metrics.totalUsers ?? 0), trend: formatTrend(data?.trends.users ?? 0), icon: <IconUsers /> },
    { label: 'Active Clubs', value: formatNumber(data?.metrics.activeClubs ?? 0), trend: formatTrend(data?.trends.clubs ?? 0), icon: <IconBuilding /> },
    { label: 'Total Events', value: formatNumber(data?.metrics.totalEvents ?? 0), trend: formatTrend(data?.trends.events ?? 0), icon: <IconCalendar /> },
    { label: 'Total Bookings', value: formatNumber(data?.metrics.totalBookings ?? 0), trend: `${analytics.bookingPerEvent.toFixed(1)} / event`, icon: <IconBolt /> },
    { label: 'Monthly Revenue', value: formatCurrency(data?.metrics.monthlyRevenue ?? 0), trend: formatTrend(data?.trends.revenue ?? 0), icon: <IconWallet /> },
  ]

  const rankedClubs = [...(data?.topClubs ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
    .slice(0, 4)

  const rankedEvents = [...(data?.topEvents ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
    .slice(0, 4)

  const weeklyMax = Math.max(...weeklyBookings.map((point) => point.value), 1)

  return (
    <div className="pa">
      {sidebarOpen ? (
        <button type="button" className="pa__backdrop" aria-label="Close menu" onClick={closeSidebar} />
      ) : null}

      <aside
        className={`pa__sidebar${sidebarOpen ? ' pa__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="pa__sidebar-scroll">
          <div className="pa__brand">
            <span className="pa__brand-title">PartyOn</span>
            <span className="pa__brand-sub">Platform Admin</span>
          </div>

          <nav className="pa__nav">
            {NAV.map((item) => (
              <AdminNavLink
                key={item.id}
                to={item.href}
                className="pa__nav-link"
                activeClassName=" pa__nav-link--active"
                onNavigate={closeSidebar}
              >
                <span className="pa__nav-icon" aria-hidden>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </AdminNavLink>
            ))}
          </nav>
        </div>

        <div className="pa__user">
          <div className="pa__avatar" aria-hidden />
          <div className="pa__user-text">
            <span className="pa__user-name">Super Admin</span>
            <span className="pa__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="pa__main">
        <header className="pa__topbar">
          <button
            type="button"
            className="pa__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="pa__menu-btn-text">Menu</span>
          </button>
          <span className="pa__topbar-title">PartyOn Platform</span>
          <button type="button" className="pa__icon-btn" aria-label="Platform analytics">
            <IconChart />
          </button>
        </header>

        <main className="pa__content">
          <header className="pa__page-head">
            <div>
              <h1 className="pa__h1">Platform Analytics</h1>
              <p className="pa__sub">
                A sharper executive pulse inspired by your reference: high-contrast KPI framing, cleaner
                chart surfaces, and a nightlife-driven tone without losing live data.
              </p>
            </div>

            <div className="pa__range">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`pa__range-btn${range === option.key ? ' pa__range-btn--active' : ''}`}
                  onClick={() => setRange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? <p className="pa__empty">Loading analytics...</p> : null}
          {error ? <p className="pa__empty">{error}</p> : null}

          <section className="pa__kpis" aria-label="Analytics summary">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="pa__card pa__kpi">
                <div className="pa__kpi-head">
                  <span className="pa__kpi-icon" aria-hidden>
                    {kpi.icon}
                  </span>
                  <span className="pa__kpi-trend">{kpi.trend}</span>
                </div>
                <strong>{kpi.value}</strong>
                <span>{kpi.label}</span>
              </article>
            ))}
          </section>

          <section className="pa__chart-grid">
            <article className="pa__card pa__chart-card">
              <div className="pa__section-head">
                <div>
                  <h2 className="pa__section-title">User Growth</h2>
                  <span className="pa__section-note">Derived from current total users and the active growth trend</span>
                </div>
                <span className="pa__section-note">{formatNumber(data?.metrics.totalUsers ?? 0)} total users</span>
              </div>

              <div className="pa__chart-shell">
                <LineChart points={userGrowthSeries} />
                <div className="pa__chart-labels">
                  {userGrowthSeries.map((point) => (
                    <div key={point.label}>
                      <strong>{formatNumber(point.value)}</strong>
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="pa__card pa__chart-card">
              <div className="pa__section-head">
                <div>
                  <h2 className="pa__section-title">Weekly Booking Trends</h2>
                  <span className="pa__section-note">Modeled from active booking density across the selected window</span>
                </div>
                <span className="pa__section-note">{averageBookings.toFixed(1)} avg bookings per event</span>
              </div>

              <div className="pa__bars" role="img" aria-label="Weekly booking bars">
                {weeklyBookings.map((point) => (
                  <div key={point.label} className="pa__bar-item">
                    <span className="pa__bar-value">{point.value}</span>
                    <span className="pa__bar" style={{ height: `${Math.max(14, (point.value / weeklyMax) * 100)}%` }} />
                    <span className="pa__bar-label">{point.label}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="pa__insight-grid">
            <article className="pa__card pa__insight-card">
              <span className="pa__insight-label">Revenue per booking</span>
              <strong>{formatCurrency(analytics.revenuePerBooking)}</strong>
              <p>Useful for checking whether premium inventory is lifting booking value, not just booking volume.</p>
            </article>
            <article className="pa__card pa__insight-card">
              <span className="pa__insight-label">Traffic coverage</span>
              <strong>{analytics.trafficCoverage}%</strong>
              <p>Share of featured or top events already emitting traffic signals such as views or clicks.</p>
            </article>
            <article className="pa__card pa__insight-card">
              <span className="pa__insight-label">Featured curation</span>
              <strong>{featuredEvents.filter((event) => event.isFeatured).length}</strong>
              <p>Currently marked featured inside the overview feed and ready to sync with the editorial team.</p>
            </article>
          </section>

          <section className="pa__split">
            <article className="pa__card pa__list-card">
              <div className="pa__section-head">
                <h2 className="pa__section-title">Top Performing Clubs</h2>
                <Link className="pa__section-link" to="/admin/revenue-payments">Revenue report</Link>
              </div>

              <ol className="pa__ranked">
                {rankedClubs.map((club, index) => (
                  <li key={club.id} className="pa__ranked-row">
                    <span className="pa__rank-badge">#{index + 1}</span>
                    <div className="pa__ranked-main">
                      <strong>{club.name}</strong>
                      <span>{formatNumber(club.bookings)} bookings</span>
                    </div>
                    <div className="pa__ranked-side">
                      <strong>{formatCurrency(club.revenue)}</strong>
                      <span>Rating {club.rating?.toFixed(1) ?? 'N/A'}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="pa__card pa__list-card">
              <div className="pa__section-head">
                <h2 className="pa__section-title">Top Events</h2>
                <Link className="pa__section-link" to="/admin/featured-events">Editorial queue</Link>
              </div>

              <ol className="pa__ranked">
                {rankedEvents.map((event, index) => (
                  <li key={event.id} className="pa__ranked-row">
                    <span className="pa__rank-badge">#{index + 1}</span>
                    <div className="pa__ranked-main">
                      <strong>{event.name}</strong>
                      <span>{event.venue}</span>
                    </div>
                    <div className="pa__ranked-side">
                      <strong>{formatCurrency(event.revenue)}</strong>
                      <span>{formatNumber(event.bookings)} bookings</span>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
