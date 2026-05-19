import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './FeaturedEvents.css'

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
  { id: 'featured', label: 'Featured Events', href: 'featured-events.html', active: true },
  { id: 'analysis', label: 'Platform Analytics', href: 'platform-analytics.html' },
  { id: 'settings', label: 'Settings', href: 'platform-settings.html' },
]

type SummaryIconId = 'eye' | 'cursor' | 'ticket' | 'chart'

const SUMMARY_STATS: {
  icon: SummaryIconId
  label: string
  value: string
  trend?: string
}[] = [
  { icon: 'eye', label: 'Total Impressions', value: '69,120' },
  { icon: 'cursor', label: 'Total Clicks', value: '5,100' },
  { icon: 'ticket', label: 'Total Bookings', value: '674' },
  { icon: 'chart', label: 'Avg. CTR', value: '7.38%', trend: '+2.1%' },
]

type FeaturedEvent = {
  id: string
  rank: number
  title: string
  venue: string
  eventDate: string
  featuredSince: string
  impressions: string
  clicks: string
  bookings: number
  ctr: string
  conversion: string
}

const FEATURED_EVENTS: FeaturedEvent[] = [
  {
    id: '1',
    rank: 1,
    title: 'Saturday Night Fever',
    venue: 'Folie Terrace',
    eventDate: '3/30/2026',
    featuredSince: '3/20/2026',
    impressions: '45,670',
    clicks: '3,210',
    bookings: 487,
    ctr: '7.03%',
    conversion: '15.17%',
  },
  {
    id: '2',
    rank: 2,
    title: 'Rooftop Sessions',
    venue: 'Folie Terrace',
    eventDate: '4/5/2026',
    featuredSince: '3/25/2026',
    impressions: '23,450',
    clicks: '1,890',
    bookings: 187,
    ctr: '8.06%',
    conversion: '9.89%',
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

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconCursor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m4 4 7 17 2.5-6.5L21 12 4 4Z" strokeLinejoin="round" />
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

function IconChevronUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconStarFilled() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 2l2.9 7.4h7.6l-6 4.6 2.3 7.4L12 16.9 5.2 21.4 7.5 14l-6-4.6h7.6L12 2z" />
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

const SUMMARY_ICONS: Record<SummaryIconId, ReactNode> = {
  eye: <IconEye />,
  cursor: <IconCursor />,
  ticket: <IconTicket />,
  chart: <IconChart />,
}

export default function FeaturedEvents() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [events, setEvents] = useState(FEATURED_EVENTS)
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

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    setEvents((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((e, i) => ({ ...e, rank: i + 1 }))
    })
  }

  return (
    <div className="fe">
      {sidebarOpen ? (
        <button
          type="button"
          className="fe__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`fe__sidebar${sidebarOpen ? ' fe__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="fe__brand">
          <span className="fe__brand-title">PartyOn</span>
          <span className="fe__brand-sub">Platform Admin</span>
        </div>

        <nav className="fe__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`fe__nav-link${item.active ? ' fe__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="fe__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="fe__user">
          <div className="fe__avatar" aria-hidden />
          <div className="fe__user-text">
            <span className="fe__user-name">Super Admin</span>
            <span className="fe__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="fe__main">
        <header className="fe__topbar">
          <button
            type="button"
            className="fe__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="fe__menu-btn-text">Menu</span>
          </button>
          <span className="fe__topbar-title">PartyOn Platform</span>
          <button type="button" className="fe__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="fe__content">
          <header className="fe__page-head">
            <div className="fe__page-head-text">
              <h1 className="fe__h1">Featured Events</h1>
              <p className="fe__sub">
                Manage homepage featured events and promotions
              </p>
            </div>
            <button type="button" className="fe__btn fe__btn--primary">
              Add Featured Event
            </button>
          </header>

          <section className="fe__stat-row" aria-label="Featured events summary">
            {SUMMARY_STATS.map((s) => (
              <article key={s.label} className="fe__card fe__stat">
                <div className="fe__stat-head">
                  <span className="fe__stat-icon" aria-hidden>
                    {SUMMARY_ICONS[s.icon]}
                  </span>
                  {s.trend ? (
                    <span className="fe__stat-trend">
                      <IconTrendUp />
                      {s.trend}
                    </span>
                  ) : null}
                </div>
                <p className="fe__stat-value">{s.value}</p>
                <h2 className="fe__stat-label">{s.label}</h2>
              </article>
            ))}
          </section>

          <ul className="fe__event-list">
            {events.map((event, index) => (
              <li key={event.id}>
                <article className="fe__card fe__event">
                  <div className="fe__event-rank" aria-label={`Rank ${event.rank}`}>
                    <button
                      type="button"
                      className="fe__rank-btn"
                      aria-label={`Move ${event.title} up`}
                      disabled={index === 0}
                      onClick={() => moveEvent(index, 'up')}
                    >
                      <IconChevronUp />
                    </button>
                    <span className="fe__rank-num">#{event.rank}</span>
                    <button
                      type="button"
                      className="fe__rank-btn"
                      aria-label={`Move ${event.title} down`}
                      disabled={index === events.length - 1}
                      onClick={() => moveEvent(index, 'down')}
                    >
                      <IconChevronDown />
                    </button>
                  </div>

                  <div className="fe__event-body">
                    <header className="fe__event-head">
                      <h2 className="fe__event-title">{event.title}</h2>
                      <div className="fe__badges">
                        <span className="fe__badge fe__badge--active">active</span>
                        <span className="fe__badge fe__badge--venue">{event.venue}</span>
                        <span className="fe__badge fe__badge--featured">
                          <IconStarFilled />
                          Featured
                        </span>
                      </div>
                    </header>

                    <dl className="fe__event-metrics">
                      <div className="fe__metric">
                        <dt>Event Date</dt>
                        <dd>{event.eventDate}</dd>
                      </div>
                      <div className="fe__metric">
                        <dt>Featured Since</dt>
                        <dd>{event.featuredSince}</dd>
                      </div>
                      <div className="fe__metric">
                        <dt>Impressions</dt>
                        <dd>{event.impressions}</dd>
                      </div>
                      <div className="fe__metric">
                        <dt>Clicks</dt>
                        <dd>{event.clicks}</dd>
                      </div>
                      <div className="fe__metric">
                        <dt>Bookings</dt>
                        <dd>{event.bookings}</dd>
                      </div>
                    </dl>

                    <footer className="fe__event-footer">
                      <div className="fe__rates">
                        <div className="fe__rate">
                          <span className="fe__rate-label">Click-Through Rate</span>
                          <span className="fe__rate-value">{event.ctr}</span>
                        </div>
                        <div className="fe__rate">
                          <span className="fe__rate-label">Conversion Rate</span>
                          <span className="fe__rate-value">{event.conversion}</span>
                        </div>
                      </div>
                      <div className="fe__event-actions">
                        <button type="button" className="fe__btn fe__btn--ghost">
                          View Analytics
                        </button>
                        <button type="button" className="fe__btn fe__btn--remove">
                          Remove
                        </button>
                      </div>
                    </footer>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}
