import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
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
  { id: 'overview', label: 'Platform Overview', href: 'admin-platform-analysis.html', active: true },
  { id: 'clubs', label: 'Club Approvals', href: 'club-approving.html' },
  { id: 'users', label: 'User Management', href: 'user-management.html' },
  { id: 'revenue', label: 'Revenue & Payments', href: 'revenue-and-payments.html' },
  { id: 'featured', label: 'Featured Events', href: 'featured-events.html' },
  { id: 'analysis', label: 'Platform Analytics', href: 'platform-analytics.html' },
  { id: 'settings', label: 'Settings', href: 'platform-settings.html' },
]

type KpiIconId = 'users' | 'building' | 'calendar' | 'euro'

const METRICS_ROW1: {
  kpiIcon: KpiIconId
  label: string
  value: string
  trend: string
  trendUp: boolean
}[] = [
  { kpiIcon: 'users', label: 'Total Users', value: '12,847', trend: '+18%', trendUp: true },
  { kpiIcon: 'building', label: 'Active Clubs', value: '47', trend: '+12%', trendUp: true },
  { kpiIcon: 'calendar', label: 'Total Events', value: '234', trend: '+24%', trendUp: true },
  { kpiIcon: 'euro', label: 'Monthly Revenue', value: '€124,580', trend: '+15%', trendUp: true },
]

const METRICS_ROW2: {
  label: string
  value: string
  variant: 'default' | 'warning' | 'danger'
}[] = [
  { label: 'Total Bookings', value: '8,942', variant: 'default' },
  { label: 'Active Subscriptions', value: '42', variant: 'default' },
  { label: 'Pending Approvals', value: '2', variant: 'warning' },
  { label: 'Open Disputes', value: '1', variant: 'danger' },
]

const REVENUE_POINTS = [
  { month: 'Oct', value: 72000 },
  { month: 'Nov', value: 88000 },
  { month: 'Dec', value: 102000 },
  { month: 'Jan', value: 95000 },
  { month: 'Feb', value: 118000 },
  { month: 'Mar', value: 124580 },
]

const MAX_REVENUE = 140000

const TOP_CLUBS = [
  { rank: 1, name: 'Folie Terrace', bookings: 1240, revenue: '€45,670', rating: 4.8 },
  { rank: 2, name: 'Cirque Le Soir', bookings: 980, revenue: '€38,200', rating: 4.7 },
  { rank: 3, name: 'White Dubai', bookings: 756, revenue: '€29,100', rating: 4.6 },
]

const TOP_EVENTS = [
  {
    rank: 1,
    name: 'Saturday Night Fever',
    venue: 'Folie Terrace',
    revenue: '€18,500',
    bookings: 420,
  },
  { rank: 2, name: 'Rooftop Sessions', venue: 'Skyline Rooftop', revenue: '€14,200', bookings: 310 },
  { rank: 3, name: 'VIP Experience Night', venue: 'Basement Club', revenue: '€11,800', bookings: 265 },
]

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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinejoin="round" />
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
  settings: <IconGear />,
}

function RevenueChart() {
  const gradId = useId().replace(/:/g, '')
  const w = 100
  const h = 40
  const padX = 2
  const padY = 4
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const n = REVENUE_POINTS.length
  const points = REVENUE_POINTS.map((p, i) => {
    const x = padX + (innerW * i) / Math.max(1, n - 1)
    const y = padY + innerH * (1 - p.value / MAX_REVENUE)
    return `${x},${y}`
  })
  const polyline = points.join(' ')
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
      {REVENUE_POINTS.map((p, i) => {
        const x = padX + (innerW * i) / Math.max(1, n - 1)
        const y = padY + innerH * (1 - p.value / MAX_REVENUE)
        return <circle key={p.month} className="apa-chart__dot" cx={x} cy={y} r="1.2" />
      })}
    </svg>
  )
}

export default function AdminPlatformAnalysis() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
        <div className="apa__brand">
          <span className="apa__brand-title">PartyOn</span>
          <span className="apa__brand-sub">Platform Admin</span>
        </div>

        <nav className="apa__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`apa__nav-link${item.active ? ' apa__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="apa__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

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
          <button type="button" className="apa__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="apa__content">
          <header className="apa__page-head">
            <h1 className="apa__h1">Platform Overview</h1>
            <p className="apa__sub">Monitor your entire PartyOn ecosystem</p>
          </header>

          <section className="apa__metrics" aria-label="Key metrics">
            <div className="apa__metric-row">
              {METRICS_ROW1.map((m) => (
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
              {METRICS_ROW2.map((m) => (
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
                <a className="apa__link" href="#">
                  View Report
                </a>
              </div>
              <div className="apa-chart">
                <div className="apa-chart__y" aria-hidden>
                  <span>140k</span>
                  <span>105k</span>
                  <span>70k</span>
                  <span>35k</span>
                  <span>0</span>
                </div>
                <div className="apa-chart__plot">
                  <RevenueChart />
                  <div className="apa-chart__x">
                    {REVENUE_POINTS.map((p) => (
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
                  <a className="apa__action" href="#">
                    <span>Club Approvals (2 pending)</span>
                    <IconArrowUpRight />
                  </a>
                </li>
                <li>
                  <a className="apa__action" href="#">
                    <span>Disputes (1 open)</span>
                    <IconArrowUpRight />
                  </a>
                </li>
                <li>
                  <a className="apa__action" href="#">
                    <span>Revenue Report (View details)</span>
                    <IconArrowUpRight />
                  </a>
                </li>
              </ul>
            </article>
          </section>

          <section className="apa__split apa__split--bottom">
            <article className="apa__card">
              <h2 className="apa__card-title apa__card-title--solo">Top Performing Clubs</h2>
              <ol className="apa__ranked">
                {TOP_CLUBS.map((c) => (
                  <li key={c.rank} className="apa__ranked-row">
                    <span className="apa__rank">#{c.rank}</span>
                    <div className="apa__ranked-main">
                      <span className="apa__ranked-name">{c.name}</span>
                      <span className="apa__ranked-meta">{c.bookings} bookings</span>
                    </div>
                    <span className="apa__ranked-rev">{c.revenue}</span>
                    <span className="apa__ranked-rating">★ {c.rating}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="apa__card">
              <h2 className="apa__card-title apa__card-title--solo">Top Events</h2>
              <ol className="apa__ranked">
                {TOP_EVENTS.map((e) => (
                  <li key={e.rank} className="apa__ranked-row">
                    <span className="apa__rank">#{e.rank}</span>
                    <div className="apa__ranked-main">
                      <span className="apa__ranked-name">{e.name}</span>
                      <span className="apa__ranked-meta">{e.venue}</span>
                    </div>
                    <span className="apa__ranked-rev">{e.revenue}</span>
                    <span className="apa__ranked-book">{e.bookings} bookings</span>
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
