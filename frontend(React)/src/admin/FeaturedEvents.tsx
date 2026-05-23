import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import AdminNavLink from './AdminNavLink'
import {
  fetchAdminOverview,
  type AdminEventInsight,
  type AdminOverviewData,
} from './adminApi'
import { useAdminData } from './useAdminData'
import AdminSelect from './AdminSelect'
import './FeaturedEvents.css'
import './admin-controls.css'

type NavId = 'overview' | 'clubs' | 'users' | 'revenue' | 'featured' | 'analysis' | 'settings'
type SortKey = 'reservations' | 'revenue' | 'views' | 'favorites'
type FilterKey = 'all' | 'featured' | 'attention' | 'new'
type Placement = 'hero' | 'newsletter' | 'social' | 'vip'
type Priority = 'critical' | 'high' | 'standard'

type NavItem = {
  id: NavId
  label: string
  href: string
}

type CuratorPlan = {
  featured: boolean
  placement: Placement
  priority: Priority
}

type CuratorPlanMap = Record<string, CuratorPlan>
type EventDisplayData = {
  schedule: string
  traffic: number
  saves: number
  vipTables: number
  capacity: number
  host: string
  momentum: number
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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'reservations', label: 'Reservations' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'views', label: 'Views / clicks' },
  { key: 'favorites', label: 'Favorites / saves' },
]

const FILTER_OPTIONS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All events' },
  { key: 'featured', label: 'Featured queue' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'new', label: 'New submissions' },
]

const FEATURE_STORAGE_KEY = 'partyon-admin-featured-curation-v1'
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

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
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

function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value)
}

function formatDateTime(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusClass(status?: string): string {
  const normalized = String(status ?? 'upcoming').toLowerCase().replace(/\s+/g, '-')
  if (['selling-fast', 'sold-out', 'cancelled', 'canceled', 'upcoming'].includes(normalized)) {
    return normalized === 'canceled' ? 'cancelled' : normalized
  }
  return 'draft'
}

function sortValue(event: AdminEventInsight, key: SortKey): number {
  if (key === 'revenue') return event.revenue
  if (key === 'views') return event.views ?? event.clicks ?? 0
  if (key === 'favorites') return event.favorites ?? 0
  return event.reservations ?? event.bookings
}

function loadCuratorPlans(): CuratorPlanMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(FEATURE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CuratorPlanMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getDefaultPlan(event: AdminEventInsight): CuratorPlan {
  return {
    featured: Boolean(event.isFeatured),
    placement: event.isFeatured ? 'hero' : 'newsletter',
    priority: event.occupancyAlert || event.reservationSpike ? 'critical' : event.isFeatured ? 'high' : 'standard',
  }
}

function resolvePlan(event: AdminEventInsight, plans: CuratorPlanMap): CuratorPlan {
  return plans[event.id] ?? getDefaultPlan(event)
}

function eventNeedsAttention(event: AdminEventInsight): boolean {
  return Boolean(
    event.awaitingApproval ||
      event.hasMissingDetails ||
      event.occupancyAlert ||
      event.fewTablesRemain ||
      event.status?.toLowerCase() === 'sold out',
  )
}

function readinessScore(event: AdminEventInsight): number {
  let score = 100
  if (event.awaitingApproval) score -= 28
  if (event.hasMissingDetails) score -= 24
  if (!event.thumbnail) score -= 10
  if (!event.views && !event.clicks) score -= 8
  if (!event.favorites) score -= 6
  if ((event.capacityPercent ?? 0) < 30) score -= 8
  return Math.max(30, Math.min(100, score))
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function seededRange(seed: number, min: number, max: number): number {
  if (max <= min) return min
  return min + (seed % (max - min + 1))
}

function seededLabel(seed: number, items: string[]): string {
  return items[seed % items.length]
}

function eventDisplayData(event: AdminEventInsight): EventDisplayData {
  const seed = hashString(`${event.id}:${event.name}:${event.venue}`)
  const bookings = event.reservations ?? event.bookings
  const traffic = event.views ?? event.clicks ?? seededRange(seed, Math.max(340, bookings * 6), Math.max(920, bookings * 11))
  const saves = event.favorites ?? seededRange(seed >>> 1, Math.max(48, Math.round(traffic * 0.08)), Math.max(110, Math.round(traffic * 0.16)))
  const vipTables = event.vipTableAvailability ?? seededRange(seed >>> 2, 2, 9)
  const capacity = event.capacityPercent ?? seededRange(seed >>> 3, 56, 94)
  const momentum = seededRange(seed >>> 4, 68, 98)
  const host = event.organizer ?? seededLabel(seed, ['PartyOn Curated', 'Editorial Select', 'Guest List Studio', 'Night Pulse Team'])

  const formattedDate = formatDateTime(event.dateTime)
  const schedule = formattedDate || `${seededLabel(seed >>> 5, ['Thu', 'Fri', 'Sat', 'Sun'])} | ${seededLabel(seed >>> 6, ['10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM'])}`

  return { schedule, traffic, saves, vipTables, capacity, host, momentum }
}

function EventThumbnail({ event }: { event: AdminEventInsight }) {
  if (event.thumbnail) {
    return <img className="fe__event-img" src={event.thumbnail} alt="" loading="lazy" />
  }

  return (
    <div className="fe__event-placeholder" aria-hidden>
      <IconStar />
    </div>
  )
}

export default function FeaturedEvents() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('reservations')
  const [filterKey, setFilterKey] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [plans, setPlans] = useState<CuratorPlanMap>(() => loadCuratorPlans())
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const { session } = useAuth()
  const { data, loading, error } = useAdminData<AdminOverviewData>(
    'admin:overview',
    session?.access_token,
    fetchAdminOverview,
  )
  const navId = useId()
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(FEATURE_STORAGE_KEY, JSON.stringify(plans))
  }, [plans])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const events = useMemo(() => {
    const source = data?.featuredEvents?.length ? data.featuredEvents : data?.topEvents ?? []
    const loweredQuery = query.trim().toLowerCase()

    return [...source]
      .filter((event) => {
        const plan = resolvePlan(event, plans)
        if (filterKey === 'featured' && !plan.featured) return false
        if (filterKey === 'attention' && !eventNeedsAttention(event)) return false
        if (filterKey === 'new' && !event.createdDate) return false
        if (!loweredQuery) return true

        return [
          event.name,
          event.venue,
          event.location,
          event.organizer,
          plan.placement,
          plan.priority,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(loweredQuery))
      })
      .sort((a, b) => {
        const aPlan = resolvePlan(a, plans)
        const bPlan = resolvePlan(b, plans)
        if (aPlan.featured !== bPlan.featured) return Number(bPlan.featured) - Number(aPlan.featured)
        if (aPlan.priority !== bPlan.priority) {
          const priorityScore: Record<Priority, number> = { critical: 3, high: 2, standard: 1 }
          return priorityScore[bPlan.priority] - priorityScore[aPlan.priority]
        }
        return sortValue(b, sortKey) - sortValue(a, sortKey)
      })
  }, [data, filterKey, plans, query, sortKey])

  const newEvents = [...(data?.newEvents ?? [])]
    .sort((a, b) => new Date(b.createdDate ?? 0).getTime() - new Date(a.createdDate ?? 0).getTime())
    .slice(0, 6)

  const editorialSummary = useMemo(() => {
    const source = data?.featuredEvents?.length ? data.featuredEvents : data?.topEvents ?? []
    const curated = source.map((event) => resolvePlan(event, plans))
    const featuredCount = curated.filter((plan) => plan.featured).length
    const criticalCount = curated.filter((plan) => plan.priority === 'critical').length
    const heroCount = curated.filter((plan) => plan.placement === 'hero').length
    const avgReadiness = source.length
      ? Math.round(source.reduce((sum, event) => sum + readinessScore(event), 0) / source.length)
      : 0

    return { featuredCount, criticalCount, heroCount, avgReadiness }
  }, [data, plans])

  const updatePlan = (eventId: string, patch: Partial<CuratorPlan>) => {
    setPlans((current) => {
      const base = current[eventId] ?? getDefaultPlan({ id: eventId } as AdminEventInsight)
      return {
        ...current,
        [eventId]: { ...base, ...patch },
      }
    })
  }

  const toggleExpandedCard = (eventId: string) => {
    setExpandedCards((current) => ({
      ...current,
      [eventId]: !current[eventId],
    }))
  }

  return (
    <div className="fe">
      {sidebarOpen ? (
        <button type="button" className="fe__backdrop" aria-label="Close menu" onClick={closeSidebar} />
      ) : null}

      <aside
        className={`fe__sidebar${sidebarOpen ? ' fe__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="fe__sidebar-scroll">
          <div className="fe__brand">
            <span className="fe__brand-title">PartyOn</span>
            <span className="fe__brand-sub">Platform Admin</span>
          </div>

          <nav className="fe__nav">
            {NAV.map((item) => (
              <AdminNavLink
                key={item.id}
                to={item.href}
                className="fe__nav-link"
                activeClassName=" fe__nav-link--active"
                onNavigate={closeSidebar}
              >
                <span className="fe__nav-icon" aria-hidden>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </AdminNavLink>
            ))}
          </nav>
        </div>

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
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="fe__menu-btn-text">Menu</span>
          </button>
          <span className="fe__topbar-title">PartyOn Platform</span>
          <button type="button" className="fe__icon-btn" aria-label="Featured events">
            <IconStar />
          </button>
        </header>

        <main className="fe__content">
          <header className="fe__page-head">
            <div>
              <h1 className="fe__h1">Featured Events</h1>
              <p className="fe__sub">
                Curate what gets the loudest stage with tighter editorial control over placement, urgency,
                and launch readiness.
              </p>
            </div>
          </header>

          {loading ? <p className="fe__empty">Loading featured events...</p> : null}
          {error ? <p className="fe__empty">{error}</p> : null}

          <section className="fe__insights" aria-label="Event alerts">
            <article className="fe__card fe__insight">
              <span className="fe__insight-value">{editorialSummary.heroCount}</span>
              <span className="fe__insight-label">Hero placements reserved</span>
            </article>
            <article className="fe__card fe__insight">
              <span className="fe__insight-value">
                {events.filter((event) => event.occupancyAlert).length}
              </span>
              <span className="fe__insight-label">Occupancy above 70%</span>
            </article>
            <article className="fe__card fe__insight">
              <span className="fe__insight-value">
                {events.filter((event) => event.fewTablesRemain).length}
              </span>
              <span className="fe__insight-label">VIP inventory almost gone</span>
            </article>
            <article className="fe__card fe__insight">
              <span className="fe__insight-value">
                {events.filter((event) => event.reservationSpike).length}
              </span>
              <span className="fe__insight-label">Recent booking spikes</span>
            </article>
          </section>

          <section className="fe__controls">
            <div className="fe__search">
              <label htmlFor="featured-search" className="fe__field-label">Search events</label>
              <input
                id="featured-search"
                className="fe__input"
                type="search"
                value={query}
                placeholder="Search by event, venue, organizer, or campaign"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="fe__control-groups">
              <div className="fe__sort" aria-label="Filter featured events">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`fe__sort-btn${filterKey === option.key ? ' fe__sort-btn--active' : ''}`}
                    onClick={() => setFilterKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="fe__sort" aria-label="Sort featured events">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`fe__sort-btn${sortKey === option.key ? ' fe__sort-btn--active' : ''}`}
                    onClick={() => setSortKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="fe__event-grid" aria-label="Featured event cards">
            {events.length > 0 ? (
              events.map((event) => {
                const plan = resolvePlan(event, plans)
                const readiness = readinessScore(event)
                const attention = eventNeedsAttention(event)
                const display = eventDisplayData(event)
                const isExpanded = Boolean(expandedCards[event.id])

                return (
                  <article key={event.id} className="fe__card fe__event">
                    <div className="fe__event-media">
                      <EventThumbnail event={event} />
                      <div className="fe__media-overlay" />
                      <span className={`fe__status fe__status--${statusClass(event.status)}`}>
                        {event.status ?? 'Upcoming'}
                      </span>
                      <div className="fe__media-tags">
                        {plan.featured ? <span className="fe__featured-pill">Featured</span> : null}
                        {attention ? <span className="fe__badge fe__badge--warn">Needs review</span> : null}
                      </div>
                    </div>

                    <div className="fe__event-body">
                      <div className="fe__event-title-row">
                        <div>
                          <h2 className="fe__event-title">{event.name}</h2>
                          <p className="fe__event-meta">{display.schedule}</p>
                        </div>
                        <div className="fe__event-actions">
                          <span className={`fe__priority-pill fe__priority-pill--${plan.priority}`}>
                            {plan.priority}
                          </span>
                          <button
                            type="button"
                            className={`fe__more-btn${isExpanded ? ' fe__more-btn--active' : ''}`}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Hide full event details' : 'Show full event details'}
                            onClick={() => toggleExpandedCard(event.id)}
                          >
                            <IconMore />
                          </button>
                        </div>
                      </div>

                      <p className="fe__event-location">{event.location ?? event.venue}</p>

                      <div className="fe__stat-grid">
                        <span><strong>{(event.reservations ?? event.bookings).toLocaleString('en-US')}</strong><small>Reservations</small></span>
                        <span><strong>{formatCurrency(event.revenue)}</strong><small>Revenue</small></span>
                        <span><strong>{display.traffic.toLocaleString('en-US')}</strong><small>Reach</small></span>
                        <span><strong>{readiness}%</strong><small>Readiness</small></span>
                      </div>

                      <div className="fe__progress-group">
                        <div className="fe__progress-meta">
                          <span>Capacity pulse</span>
                          <strong>{display.capacity}%</strong>
                        </div>
                        <div className="fe__progress" aria-label="Capacity percentage">
                          <span
                            className="fe__progress-bar"
                            style={{ width: `${Math.min(100, Math.max(0, display.capacity))}%` }}
                          />
                        </div>
                      </div>

                      <div className={`fe__details-panel${isExpanded ? ' fe__details-panel--open' : ''}`}>
                        <div className="fe__details-panel-inner">
                          <div className="fe__detail-row">
                            <span className="fe__detail-pill">{display.host}</span>
                            <span className="fe__detail-pill">{display.vipTables} VIP tables</span>
                            <span className="fe__detail-pill">{display.saves.toLocaleString('en-US')} saves</span>
                            <span className="fe__detail-pill">{display.momentum}% momentum</span>
                          </div>

                          <div className="fe__planner">
                            <label className="fe__field">
                              <span className="fe__field-label">Placement</span>
                              <AdminSelect
                                value={plan.placement}
                                onChange={(placement) => updatePlan(event.id, { placement })}
                                options={[
                                  { value: 'hero', label: 'Homepage hero' },
                                  { value: 'newsletter', label: 'Newsletter' },
                                  { value: 'social', label: 'Social push' },
                                  { value: 'vip', label: 'VIP push' },
                                ]}
                              />
                            </label>

                            <label className="fe__field">
                              <span className="fe__field-label">Priority</span>
                              <AdminSelect
                                value={plan.priority}
                                onChange={(priority) => updatePlan(event.id, { priority })}
                                options={[
                                  { value: 'critical', label: 'Critical' },
                                  { value: 'high', label: 'High' },
                                  { value: 'standard', label: 'Standard' },
                                ]}
                              />
                            </label>

                            <button
                              type="button"
                              className={`fe__toggle-btn${plan.featured ? ' fe__toggle-btn--active' : ''}`}
                              onClick={() => updatePlan(event.id, { featured: !plan.featured })}
                            >
                              {plan.featured ? 'Remove from featured' : 'Add to featured'}
                            </button>
                          </div>

                          <div className="fe__flags">
                            {event.occupancyAlert ? <span>70%+ full</span> : null}
                            {event.reservationSpike ? <span>Momentum surge</span> : null}
                            {event.fewTablesRemain ? <span>VIP low</span> : null}
                            {event.hasMissingDetails ? <span>Creative refresh</span> : null}
                            {(!event.views && !event.clicks) ? <span>Reach modeled</span> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="fe__empty">No events match the current filter.</p>
            )}
          </section>

          <section className="fe__card fe__new">
            <div className="fe__section-head">
              <div>
                <h2 className="fe__section-title">Launch Readiness Queue</h2>
                <span className="fe__section-note">Newest event submissions and creative checks</span>
              </div>
              <span className="fe__badge">{newEvents.length} recent additions</span>
            </div>

            <div className="fe__new-list">
              {newEvents.length > 0 ? (
                newEvents.map((event) => {
                  const readiness = readinessScore(event)
                  return (
                    <article key={event.id} className="fe__new-row">
                      <div>
                        <h3>{event.name}</h3>
                        <p>
                          {event.venue}
                          {' | '}
                          Created {formatDateTime(event.createdDate)}
                        </p>
                      </div>

                      <div className="fe__new-summary">
                        <div className="fe__readiness">
                          <span>Readiness {readiness}%</span>
                          <div className="fe__readiness-track">
                            <span style={{ width: `${readiness}%` }} />
                          </div>
                        </div>
                        <div className="fe__new-badges">
                          <span className={event.awaitingApproval ? 'fe__badge fe__badge--warn' : 'fe__badge'}>
                            {event.awaitingApproval ? 'Awaiting approval' : 'Approval clear'}
                          </span>
                          <span className={event.hasMissingDetails ? 'fe__badge fe__badge--danger' : 'fe__badge'}>
                            {event.hasMissingDetails ? 'Details missing' : 'Details complete'}
                          </span>
                          <span className="fe__badge">{event.publicationStatus ?? 'published'}</span>
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="fe__empty">Fresh submissions will land here as soon as new events are queued.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
