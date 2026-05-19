import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './PlatformAnalytics.css'

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
  { id: 'overview', label: 'Platform Overview', href: 'admin-platform-analysis.html' },
  { id: 'clubs', label: 'Club Approvals', href: 'club-approving.html' },
  { id: 'users', label: 'User Management', href: 'user-management.html' },
  { id: 'revenue', label: 'Revenue & Payments', href: 'revenue-and-payments.html' },
  { id: 'featured', label: 'Featured Events', href: 'featured-events.html' },
  { id: 'analysis', label: 'Platform Analytics', href: 'platform-analytics.html', active: true },
  { id: 'settings', label: 'Settings', href: 'platform-settings.html' },
]

type KpiIconId = 'users' | 'building' | 'calendar' | 'ticket' | 'euro'

const KPIS: {
  kpiIcon: KpiIconId
  label: string
  value: string
  trend: string
}[] = [
  { kpiIcon: 'users', label: 'Total Users', value: '12,847', trend: '+18%' },
  { kpiIcon: 'building', label: 'Active Clubs', value: '47', trend: '+12%' },
  { kpiIcon: 'calendar', label: 'Total Events', value: '234', trend: '+24%' },
  { kpiIcon: 'ticket', label: 'Total Bookings', value: '8,942', trend: '+32%' },
  { kpiIcon: 'euro', label: 'Monthly Revenue', value: '€124,580', trend: '+15%' },
]

const USER_GROWTH = [
  { month: 'Oct', value: 4200 },
  { month: 'Nov', value: 5800 },
  { month: 'Dec', value: 7600 },
  { month: 'Jan', value: 9200 },
  { month: 'Feb', value: 11200 },
  { month: 'Mar', value: 12847 },
]

const MAX_USERS = 14000

const WEEKLY_BOOKINGS = [
  { day: 'Mon', value: 420 },
  { day: 'Tue', value: 580 },
  { day: 'Wed', value: 650 },
  { day: 'Thu', value: 720 },
  { day: 'Fri', value: 1100 },
  { day: 'Sat', value: 1450 },
  { day: 'Sun', value: 980 },
]

const MAX_WEEKLY = 1600

const TOP_CLUBS = [
  { rank: 1, name: 'Folie Terrace', bookings: 1247, revenue: '€45,670', rating: 4.8 },
  { rank: 2, name: 'Cirque Le Soir', bookings: 982, revenue: '€38,920', rating: 4.7 },
  { rank: 3, name: 'White Dubai', bookings: 856, revenue: '€34,560', rating: 4.9 },
]

const TOP_EVENTS = [
  {
    rank: 1,
    name: 'Saturday Night Fever',
    venue: 'Folie Terrace',
    revenue: '€18,500',
    bookings: 467,
  },
  {
    rank: 2,
    name: 'Rooftop Sessions',
    venue: 'Folie Terrace',
    revenue: '€14,200',
    bookings: 356,
  },
  {
    rank: 3,
    name: 'VIP Experience Night',
    venue: 'Cirque Le Soir',
    revenue: '€12,800',
    bookings: 234,
  },
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

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7"
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

const NAV_ICONS: Record<NavId, ReactNode> = {
  overview: <IconOverview />,
  clubs: <IconBuilding />,
  users: <IconUsers />,
  revenue: <IconWallet />,
  featured: <IconStar />,
  analysis: <IconChart />,
  settings: <IconGear />,
}

const KPI_ICONS: Record<KpiIconId, ReactNode> = {
  users: <IconUsers />,
  building: <IconBuilding />,
  calendar: <IconCalendar />,
  ticket: <IconTicket />,
  euro: <IconEuro />,
}

function UserGrowthChart() {
  const gradId = useId().replace(/:/g, '')
  const w = 100
  const h = 40
  const padX = 2
  const padY = 4
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const n = USER_GROWTH.length
  const points = USER_GROWTH.map((p, i) => {
    const x = padX + (innerW * i) / Math.max(1, n - 1)
    const y = padY + innerH * (1 - p.value / MAX_USERS)
    return `${x},${y}`
  })
  const polyline = points.join(' ')

  return (
    <svg
      className="pa-chart__svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="User growth last 6 months"
    >
      <defs>
        <linearGradient id={`pa-line-${gradId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          className="pa-chart__grid"
          x1={padX}
          x2={w - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
        />
      ))}
      <polyline
        className="pa-chart__line"
        fill="none"
        stroke={`url(#pa-line-${gradId})`}
        strokeWidth="0.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      {USER_GROWTH.map((p, i) => {
        const x = padX + (innerW * i) / Math.max(1, n - 1)
        const y = padY + innerH * (1 - p.value / MAX_USERS)
        return <circle key={p.month} className="pa-chart__dot" cx={x} cy={y} r="1.2" />
      })}
    </svg>
  )
}

function WeeklyBookingsChart() {
  const w = 100
  const h = 40
  const padX = 6
  const padY = 4
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const n = WEEKLY_BOOKINGS.length
  const slot = innerW / n
  const barW = slot * 0.52

  return (
    <svg
      className="pa-chart__svg pa-chart__svg--bars"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Weekly booking trends"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          className="pa-chart__grid"
          x1={padX}
          x2={w - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
        />
      ))}
      {WEEKLY_BOOKINGS.map((p, i) => {
        const barH = (p.value / MAX_WEEKLY) * innerH
        const x = padX + slot * i + (slot - barW) / 2
        const y = padY + innerH - barH
        return (
          <rect
            key={p.day}
            className="pa-chart__bar"
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx="0.4"
          />
        )
      })}
    </svg>
  )
}

export default function PlatformAnalytics() {
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
    <div className="pa">
      {sidebarOpen ? (
        <button
          type="button"
          className="pa__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`pa__sidebar${sidebarOpen ? ' pa__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="pa__brand">
          <span className="pa__brand-title">PartyOn</span>
          <span className="pa__brand-sub">Platform Admin</span>
        </div>

        <nav className="pa__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`pa__nav-link${item.active ? ' pa__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="pa__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

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
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="pa__menu-btn-text">Menu</span>
          </button>
          <span className="pa__topbar-title">PartyOn Platform</span>
          <button type="button" className="pa__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="pa__content">
          <header className="pa__page-head">
            <h1 className="pa__h1">Platform Analytics</h1>
            <p className="pa__sub">Deep insights into platform performance and trends</p>
          </header>

          <section className="pa__kpi-row" aria-label="Key metrics">
            {KPIS.map((m) => (
              <article key={m.label} className="pa__card pa__kpi">
                <div className="pa__kpi-head">
                  <span className="pa__kpi-icon" aria-hidden>
                    {KPI_ICONS[m.kpiIcon]}
                  </span>
                  <span className="pa__kpi-trend">
                    <IconTrendUp />
                    {m.trend}
                  </span>
                </div>
                <p className="pa__kpi-value">{m.value}</p>
                <h2 className="pa__kpi-label">{m.label}</h2>
              </article>
            ))}
          </section>

          <section className="pa__charts">
            <article className="pa__card pa__chart-card">
              <h2 className="pa__card-title">User Growth</h2>
              <div className="pa-chart">
                <div className="pa-chart__y" aria-hidden>
                  <span>14k</span>
                  <span>10.5k</span>
                  <span>7k</span>
                  <span>3.5k</span>
                  <span>0</span>
                </div>
                <div className="pa-chart__plot">
                  <UserGrowthChart />
                  <div className="pa-chart__x">
                    {USER_GROWTH.map((p) => (
                      <span key={p.month}>{p.month}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="pa__card pa__chart-card">
              <h2 className="pa__card-title">Weekly Booking Trends</h2>
              <div className="pa-chart">
                <div className="pa-chart__y" aria-hidden>
                  <span>1.6k</span>
                  <span>1.2k</span>
                  <span>800</span>
                  <span>400</span>
                  <span>0</span>
                </div>
                <div className="pa-chart__plot">
                  <WeeklyBookingsChart />
                  <div className="pa-chart__x">
                    {WEEKLY_BOOKINGS.map((p) => (
                      <span key={p.day}>{p.day}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="pa__lists">
            <article className="pa__card">
              <h2 className="pa__card-title pa__card-title--solo">Top Performing Clubs</h2>
              <ol className="pa__ranked">
                {TOP_CLUBS.map((c) => (
                  <li key={c.rank} className="pa__ranked-row">
                    <span className="pa__rank">#{c.rank}</span>
                    <div className="pa__ranked-main">
                      <span className="pa__ranked-name">{c.name}</span>
                      <span className="pa__ranked-meta">{c.bookings.toLocaleString()} bookings</span>
                    </div>
                    <span className="pa__ranked-rev">{c.revenue}</span>
                    <span className="pa__ranked-rating">★ {c.rating}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="pa__card">
              <h2 className="pa__card-title pa__card-title--solo">Top Events</h2>
              <ol className="pa__ranked">
                {TOP_EVENTS.map((e) => (
                  <li key={e.rank} className="pa__ranked-row">
                    <span className="pa__rank">#{e.rank}</span>
                    <div className="pa__ranked-main">
                      <span className="pa__ranked-name">{e.name}</span>
                      <span className="pa__ranked-meta">{e.venue}</span>
                    </div>
                    <span className="pa__ranked-rev">{e.revenue}</span>
                    <span className="pa__ranked-book">{e.bookings} bookings</span>
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
