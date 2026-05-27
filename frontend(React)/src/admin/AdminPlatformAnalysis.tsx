import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminNavLink from './AdminNavLink'
import { fetchAdminOverview, type AdminOverviewData } from './adminApi'
import { useAdminData } from './useAdminData'
import './AdminPlatformAnalysis.css'

type NavId =
  | 'overview'
  | 'clubs'
  | 'users'
  | 'revenue'
  | 'featured'
  | 'analysis'
  | 'settings'

type NavItem = {
  id: NavId
  label: string
  href: string
  active?: boolean
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Platform Overview', href: '/admin/platform-analysis', active: true },
  { id: 'clubs', label: 'Club Approvals', href: '/admin/club-approvals' },
  { id: 'users', label: 'User Management', href: '/admin/user-management' },
  { id: 'revenue', label: 'Revenue & Payments', href: '/admin/revenue-payments' },
  { id: 'featured', label: 'Featured Events', href: '/admin/featured-events' },
  { id: 'analysis', label: 'Platform Analytics', href: '/admin/platform-analytics' },
  { id: 'settings', label: 'Settings', href: '/admin/settings' },
]

type KpiIconId = 'users' | 'building' | 'calendar' | 'euro'

type MetricRow1 = {
  kpiIcon: KpiIconId
  label: string
  value: string
  trend: string
  trendUp: boolean
}

type MetricRow2 = {
  label: string
  value: string
  variant: 'default' | 'warning' | 'danger'
}

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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
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

function IconEuro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M7 10.5h9M7 13.5h7M16 8c-2.2-1.1-5.5-.6-7.5 1.3-2.4 2.4-2.4 6.4 0 8.8 2 2 5.3 2.4 7.5 1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrendUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 14l3-3 3 3 5-5M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path
        d="M10.3 3.6 1.7 18c-.5 1 .2 2 1.3 2h18c1.1 0 1.8-1 1.3-2L13.7 3.6a1.5 1.5 0 0 0-2.6 0Z"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const KPI_ICONS: Record<KpiIconId, ReactNode> = {
  users: <IconUsers />,
  building: <IconBuilding />,
  calendar: <IconCalendar />,
  euro: <IconEuro />,
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
  return `€${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatTrend(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`
}

function formatYAxisTick(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`
  }
  return formatNumber(value)
}

function buildRevenueYAxisTicks(maxRevenue: number, tickCount = 5): number[] {
  if (tickCount <= 1) return [0]

  const step = maxRevenue / (tickCount - 1)
  return Array.from({ length: tickCount }, (_, index) => {
    const rawValue = step * index
    if (index === 0) return 0
    if (index === tickCount - 1) return maxRevenue
    return Math.round(rawValue)
  })
}

function formatAverageRating(value: number | null): string {
  if (typeof value !== 'number') return '–'
  return value.toFixed(1)
}

function RevenueChart({ points, maxRevenue }: { points: { month: string; value: number }[]; maxRevenue: number }) {
  const gradId = useId().replace(/:/g, '')
  const w = 100
  const h = 40
  const padX = 2
  const padY = 4
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const n = points.length
  const chartPoints = points.map((p, i) => {
    const x = padX + (innerW * i) / Math.max(1, n - 1)
    const y = padY + innerH * (1 - p.value / maxRevenue)
    return `${x},${y}`
  })
  const polyline = chartPoints.join(' ')
  const lineStroke = `url(#apa-chart-line-${gradId})`

  return (
    <svg
      className="apa-chart__svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Revenue trend last 6 months"
    >
      <defs>
        <linearGradient id={`apa-chart-line-${gradId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          className="apa-chart__grid"
          x1={padX}
          x2={w - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
        />
      ))}
      <polyline
        className="apa-chart__line"
        fill="none"
        stroke={lineStroke}
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {points.map((p, i) => {
        const x = padX + (innerW * i) / Math.max(1, n - 1)
        const y = padY + innerH * (1 - p.value / maxRevenue)
        return <circle key={p.month} className="apa-chart__dot" cx={x} cy={y} r="1.2" />
      })}
    </svg>
  )
}

export default function AdminPlatformAnalysis() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { session } = useAuth()
  const {
    data: overview,
    loading,
    error,
  } = useAdminData<AdminOverviewData>(
    'admin:overview',
    session?.access_token,
    fetchAdminOverview,
  )
  const navId = useId()

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const metricsRow1: MetricRow1[] = overview
    ? [
        {
          kpiIcon: 'users',
          label: 'Total Users',
          value: formatNumber(overview.metrics.totalUsers),
          trend: formatTrend(overview.trends.users),
          trendUp: overview.trends.users >= 0,
        },
        {
          kpiIcon: 'building',
          label: 'Active Clubs',
          value: formatNumber(overview.metrics.activeClubs),
          trend: formatTrend(overview.trends.clubs),
          trendUp: overview.trends.clubs >= 0,
        },
        {
          kpiIcon: 'calendar',
          label: 'Total Events',
          value: formatNumber(overview.metrics.totalEvents),
          trend: formatTrend(overview.trends.events),
          trendUp: overview.trends.events >= 0,
        },
        {
          kpiIcon: 'euro',
          label: 'Monthly Revenue',
          value: formatCurrency(overview.metrics.monthlyRevenue),
          trend: formatTrend(overview.trends.revenue),
          trendUp: overview.trends.revenue >= 0,
        },
      ]
    : []

  const metricsRow2: MetricRow2[] = overview
    ? [
        { label: 'Total Bookings', value: formatNumber(overview.metrics.totalBookings), variant: 'default' },
        {
          label: 'Active Subscriptions',
          value: formatNumber(overview.metrics.activeSubscriptions),
          variant: 'default',
        },
        {
          label: 'Pending Approvals',
          value: formatNumber(overview.metrics.pendingApprovals),
          variant: 'warning',
        },
        { label: 'Open Disputes', value: formatNumber(overview.metrics.openDisputes), variant: 'danger' },
      ]
    : []

  const revenuePoints = overview?.revenuePoints ?? []
  const maxRevenue = Math.max(...revenuePoints.map((point) => point.value), 1)
  const yLabels = buildRevenueYAxisTicks(maxRevenue)
  const rankedClubs = [...(overview?.topClubs ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
    .map((club, index) => ({ ...club, rank: index + 1 }))
  const rankedEvents = [...(overview?.topEvents ?? [])]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.bookings - a.bookings || b.revenue - a.revenue)
    .map((event, index) => ({ ...event, rank: index + 1 }))

  return (
    <div className="apa">
      {sidebarOpen ? (
        <button
          type="button"
          className="apa__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`apa__sidebar${sidebarOpen ? ' apa__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="apa__sidebar-scroll">
          <div className="apa__brand">
            <span className="apa__brand-title">PartyOn</span>
            <span className="apa__brand-sub">Platform Admin</span>
          </div>

          <nav className="apa__nav">
            {NAV.map((item) =>
              item.href === '#' ? (
                <span key={item.id} className="apa__nav-link apa__nav-link--muted">
                  <span className="apa__nav-icon" aria-hidden>
                    {NAV_ICONS[item.id]}
                  </span>
                  {item.label}
                </span>
              ) : (
                <AdminNavLink
                  key={item.id}
                  to={item.href}
                  className="apa__nav-link"
                  activeClassName=" apa__nav-link--active"
                  onNavigate={closeSidebar}
                >
                  <span className="apa__nav-icon" aria-hidden>
                    {NAV_ICONS[item.id]}
                  </span>
                  {item.label}
                </AdminNavLink>
              ),
            )}
          </nav>
        </div>

        <div className="apa__user">
          <div className="apa__avatar" aria-hidden />
          <div className="apa__user-text">
            <span className="apa__user-name">Super Admin</span>
            <span className="apa__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="apa__main">
        <header className="apa__topbar">
          <button
            type="button"
            className="apa__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="apa__menu-btn-text">Menu</span>
          </button>
          <span className="apa__topbar-title">PartyOn Platform</span>
          <button type="button" className="apa__icon-btn" aria-label="Settings">
            <IconGear />
          </button>
        </header>

        <main className="apa__content">
          <header className="apa__page-head">
            <h1 className="apa__h1">Platform Overview</h1>
            <p className="apa__sub">Monitor your entire PartyOn ecosystem</p>
          </header>

          {loading ? <p className="apa__sub">Loading database metrics...</p> : null}
          {error ? <p className="apa__sub">{error}</p> : null}

          <section className="apa__metrics" aria-label="Key metrics">
            <div className="apa__metric-row">
              {metricsRow1.map((m) => (
                <article key={m.label} className="apa__card apa__metric apa__metric--kpi">
                  <div className="apa__metric-kpi-head">
                    <span className="apa__metric-kpi-icon" aria-hidden>
                      {KPI_ICONS[m.kpiIcon]}
                    </span>
                    <span
                      className={`apa__metric-trend${m.trendUp ? ' apa__metric-trend--up' : ''}`}
                    >
                      <IconTrendUp />
                      {m.trend}
                    </span>
                  </div>
                  <p className="apa__metric-value">{m.value}</p>
                  <h2 className="apa__metric-label">{m.label}</h2>
                </article>
              ))}
            </div>
            <div className="apa__metric-row">
              {metricsRow2.map((m) => (
                <article
                  key={m.label}
                  className={`apa__card apa__metric apa__metric--stat apa__metric--${m.variant}`}
                >
                  {(m.variant === 'warning' || m.variant === 'danger') && (
                    <div className="apa__metric-stat-head">
                      <span
                        className={`apa__metric-stat-icon apa__metric-stat-icon--${m.variant}`}
                        aria-hidden
                      >
                        <IconAlert />
                      </span>
                    </div>
                  )}
                  <p className="apa__metric-value">{m.value}</p>
                  <h2 className="apa__metric-label">{m.label}</h2>
                </article>
              ))}
            </div>
          </section>

          <section className="apa__split apa__split--middle">
            <article className="apa__card apa__card--chart">
              <div className="apa__card-head">
                <h2 className="apa__card-title">Platform Revenue</h2>
                <span className="apa__card-meta">Last 6 months</span>
                <Link className="apa__link" to="/admin/revenue-payments">
                  View Report
                </Link>
              </div>
              <div className="apa-chart">
                <div className="apa-chart__y" aria-hidden>
                  {[...yLabels].reverse().map((label, index) => (
                    <span key={`${label}-${index}`}>{formatYAxisTick(label)}</span>
                  ))}
                </div>
                <div className="apa-chart__plot">
                  <RevenueChart points={revenuePoints} maxRevenue={maxRevenue} />
                  <div className="apa-chart__x">
                    {revenuePoints.map((p) => (
                      <span key={p.month}>{p.month}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="apa__card apa__card--actions">
              <h2 className="apa__card-title apa__card-title--solo">Quick Actions</h2>
              <ul className="apa__actions">
                <li>
                  <Link className="apa__action" to="/admin/club-approvals">
                    <span>Club Approvals ({overview?.metrics.pendingApprovals ?? 0} pending)</span>
                    <IconArrowUpRight />
                  </Link>
                </li>
                <li>
                  <Link className="apa__action" to="/manager/disputes">
                    <span>Disputes ({overview?.metrics.openDisputes ?? 0} open)</span>
                    <IconArrowUpRight />
                  </Link>
                </li>
                <li>
                  <Link className="apa__action" to="/admin/revenue-payments">
                    <span>Revenue Report (View details)</span>
                    <IconArrowUpRight />
                  </Link>
                </li>
              </ul>
            </article>
          </section>

          <section className="apa__split apa__split--bottom">
            <article className="apa__card">
              <h2 className="apa__card-title apa__card-title--solo">Top Performing Clubs</h2>
              <ol className="apa__ranked">
                {rankedClubs.map((c) => (
                  <li key={c.rank} className="apa__ranked-row">
                    <span className="apa__rank">#{c.rank}</span>
                    <div className="apa__ranked-main">
                      <span className="apa__ranked-name">{c.name}</span>
                      <span className="apa__ranked-meta">{c.bookings} bookings</span>
                    </div>
                    <span className="apa__ranked-rev">{formatCurrency(c.revenue)}</span>
                    <span className="apa__ranked-rating">★ {formatAverageRating(c.rating)}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="apa__card">
              <h2 className="apa__card-title apa__card-title--solo">Top Events</h2>
              <ol className="apa__ranked">
                {rankedEvents.map((e) => (
                  <li key={e.rank} className="apa__ranked-row">
                    <span className="apa__rank">#{e.rank}</span>
                    <div className="apa__ranked-main">
                      <span className="apa__ranked-name">{e.name}</span>
                      <span className="apa__ranked-meta">{e.venue}</span>
                    </div>
                    <span className="apa__ranked-rev">{formatCurrency(e.revenue)}</span>
                    <span className="apa__ranked-rating">★ {formatAverageRating(e.rating)}</span>
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
