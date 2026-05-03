import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './ClubApproving.css'

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
  { id: 'clubs', label: 'Club Approvals', href: 'club-approving.html', active: true },
  { id: 'users', label: 'User Management', href: 'user-management.html' },
  { id: 'revenue', label: 'Revenue & Payments', href: 'revenue-and-payments.html' },
  { id: 'featured', label: 'Featured Events', href: '#' },
  { id: 'analysis', label: 'Platform Analytics', href: '#' },
  { id: 'settings', label: 'Settings', href: '#' },
]

type TabFilter = 'pending' | 'approved' | 'rejected' | 'all'

const STATS: {
  id: 'pending' | 'approved' | 'rejected' | 'total'
  label: string
  value: string
  tone: 'pending' | 'approved' | 'rejected' | 'neutral'
}[] = [
  { id: 'pending', label: 'Pending Review', value: '2', tone: 'pending' },
  { id: 'approved', label: 'Approved', value: '1', tone: 'approved' },
  { id: 'rejected', label: 'Rejected', value: '0', tone: 'rejected' },
  { id: 'total', label: 'Total Applications', value: '3', tone: 'neutral' },
]

const TABS: { id: TabFilter; label: string; count: number }[] = [
  { id: 'pending', label: 'Pending', count: 2 },
  { id: 'approved', label: 'Approved', count: 1 },
  { id: 'rejected', label: 'Rejected', count: 0 },
  { id: 'all', label: 'All', count: 3 },
]

type ClubStatus = 'pending' | 'approved' | 'rejected'

type Club = {
  id: string
  name: string
  status: ClubStatus
  location: string
  phone: string
  description: string
  email: string
  license: string
  contact: string
  applied: string
}

const CLUBS: Club[] = [
  {
    id: '1',
    name: 'Neon Paradise',
    status: 'pending',
    location: 'Miami, USA',
    phone: '+1 305 555 0123',
    description: 'Upscale nightclub featuring electronic music and VIP experiences',
    email: 'carlos@neonparadise.com',
    license: 'License: BL-2026-MIA-4521',
    contact: 'Carlos Rivera',
    applied: '3/28/2024',
  },
  {
    id: '2',
    name: 'The Vault Underground',
    status: 'pending',
    location: 'London, UK',
    phone: '+44 20 7946 0958',
    description: 'Underground techno venue with cutting-edge sound system',
    email: 'sarah@vaultclub.co.uk',
    license: 'License: BL-2026-LON-8934',
    contact: 'Sarah Mitchell',
    applied: '3/27/2024',
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

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
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

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
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

function IconMapPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.11a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function IconLicense() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" strokeLinecap="round" />
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

const STAT_ICONS: Record<(typeof STATS)[number]['tone'], ReactNode> = {
  pending: <IconClock />,
  approved: <IconCheck />,
  rejected: <IconX />,
  neutral: <IconBuilding />,
}

function matchesFilter(club: Club, tab: TabFilter): boolean {
  if (tab === 'all') return true
  return club.status === tab
}

export default function ClubApproving() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabFilter>('pending')
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

  const visibleClubs = CLUBS.filter((c) => matchesFilter(c, activeTab))

  return (
    <div className="cap">
      {sidebarOpen ? (
        <button
          type="button"
          className="cap__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`cap__sidebar${sidebarOpen ? ' cap__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="cap__brand">
          <span className="cap__brand-title">PartyOn</span>
          <span className="cap__brand-sub">Platform Admin</span>
        </div>

        <nav className="cap__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`cap__nav-link${item.active ? ' cap__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="cap__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="cap__user">
          <div className="cap__avatar" aria-hidden>
            <IconShield />
          </div>
          <div className="cap__user-text">
            <span className="cap__user-name">Super Admin</span>
            <span className="cap__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="cap__main">
        <header className="cap__topbar">
          <button
            type="button"
            className="cap__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="cap__menu-btn-text">Menu</span>
          </button>
          <span className="cap__topbar-title">PartyOn Platform</span>
          <button type="button" className="cap__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="cap__content">
          <header className="cap__page-head">
            <h1 className="cap__h1">Club Approving</h1>
            <p className="cap__sub">
              Review and approve clubs before they can operate on the platform
            </p>
          </header>

          <section className="cap__stat-row" aria-label="Application stats">
            {STATS.map((s) => (
              <article key={s.id} className={`cap__card cap__stat cap__stat--${s.tone}`}>
                <span className={`cap__stat-icon cap__stat-icon--${s.tone}`} aria-hidden>
                  {STAT_ICONS[s.tone]}
                </span>
                <p className="cap__stat-value">{s.value}</p>
                <h2 className="cap__stat-label">{s.label}</h2>
              </article>
            ))}
          </section>

          <div className="cap__tabs" role="tablist" aria-label="Filter applications">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`cap__tab${activeTab === t.id ? ' cap__tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {visibleClubs.length > 0 ? (
            <ul className="cap__club-list">
              {visibleClubs.map((club) => (
                <li key={club.id}>
                  <article className="cap__card cap__club">
                    <header className="cap__club-head">
                      <div className="cap__club-title-block">
                        <span className="cap__club-logo" aria-hidden>
                          <IconBuilding />
                        </span>
                        <div>
                          <h2 className="cap__club-name">{club.name}</h2>
                          <span className="cap__badge cap__badge--pending">{club.status}</span>
                        </div>
                      </div>
                      <div className="cap__club-actions">
                        <button type="button" className="cap__btn cap__btn--ghost">
                          <IconEye />
                          View Details
                        </button>
                        <button type="button" className="cap__btn cap__btn--approve">
                          Approve
                        </button>
                        <button type="button" className="cap__btn cap__btn--reject">
                          Reject
                        </button>
                      </div>
                    </header>

                    <div className="cap__club-grid">
                      <div className="cap__club-col">
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconMapPin />
                          </span>
                          {club.location}
                        </p>
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconPhone />
                          </span>
                          {club.phone}
                        </p>
                        <p className="cap__club-desc">{club.description}</p>
                      </div>
                      <div className="cap__club-col">
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconMail />
                          </span>
                          {club.email}
                        </p>
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconLicense />
                          </span>
                          {club.license}
                        </p>
                      </div>
                    </div>

                    <footer className="cap__club-footer">
                      Contact: {club.contact} · Applied: {club.applied}
                    </footer>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cap__empty">No clubs in this filter.</p>
          )}
        </main>
      </div>
    </div>
  )
}
