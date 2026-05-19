import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './UserManagement.css'

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
  { id: 'users', label: 'User Management', href: 'user-management.html', active: true },
  { id: 'revenue', label: 'Revenue & Payments', href: 'revenue-and-payments.html' },
  { id: 'featured', label: 'Featured Events', href: 'featured-events.html' },
  { id: 'analysis', label: 'Platform Analytics', href: 'platform-analytics.html' },
  { id: 'settings', label: 'Settings', href: 'platform-settings.html' },
]

type RoleTab = 'all' | 'customer' | 'managers' | 'staff'

const STATS: {
  id: string
  label: string
  value: string
  tone: 'default' | 'complaints'
}[] = [
  { id: 'total', label: 'Total Users', value: '5', tone: 'default' },
  { id: 'active', label: 'Active', value: '4', tone: 'default' },
  { id: 'blocked', label: 'Blocked', value: '1', tone: 'default' },
  { id: 'complaints', label: 'With Complaints', value: '2', tone: 'complaints' },
]

const TABS: { id: RoleTab; label: string; count: number }[] = [
  { id: 'all', label: 'All', count: 5 },
  { id: 'customer', label: 'Customer', count: 4 },
  { id: 'managers', label: 'Club Managers', count: 1 },
  { id: 'staff', label: 'Staff', count: 0 },
]

type UserType = 'customer' | 'manager' | 'staff'

type UserStatus = 'active' | 'blocked'

type UserRow = {
  id: string
  name: string
  joined: string
  email: string
  phone: string
  type: UserType
  bookings: number
  spent: string
  status: UserStatus
  complaints: number
}

const USERS: UserRow[] = [
  {
    id: '1',
    name: 'Alexander Smith',
    joined: '1/15/2026',
    email: 'alex.smith@email.com',
    phone: '+1 555 123 4567',
    type: 'customer',
    bookings: 24,
    spent: '€4,580',
    status: 'active',
    complaints: 0,
  },
  {
    id: '2',
    name: 'Isabella Johnson',
    joined: '2/20/2026',
    email: 'isabella.j@email.com',
    phone: '+44 7700 900123',
    type: 'customer',
    bookings: 12,
    spent: '€2,340',
    status: 'active',
    complaints: 1,
  },
  {
    id: '3',
    name: 'Michael Chen',
    joined: '11/5/2025',
    email: 'mchen@email.com',
    phone: '+1 555 987 6543',
    type: 'customer',
    bookings: 45,
    spent: '€8,920',
    status: 'active',
    complaints: 0,
  },
  {
    id: '4',
    name: 'Sophie Dubois',
    joined: '3/15/2026',
    email: 'sophie@folieterrace.fr',
    phone: '+33 1 42 96 12 34',
    type: 'manager',
    bookings: 0,
    spent: '€0',
    status: 'active',
    complaints: 0,
  },
  {
    id: '5',
    name: 'David Wilson',
    joined: '3/10/2026',
    email: 'dwilson@email.com',
    phone: '+1 555 456 7890',
    type: 'customer',
    bookings: 3,
    spent: '€450',
    status: 'blocked',
    complaints: 3,
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

function IconAlertCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
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

function IconBan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" strokeLinecap="round" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
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

function matchesRoleTab(u: UserRow, tab: RoleTab): boolean {
  if (tab === 'all') return true
  if (tab === 'customer') return u.type === 'customer'
  if (tab === 'managers') return u.type === 'manager'
  return u.type === 'staff'
}

function typeLabel(t: UserType): string {
  if (t === 'manager') return 'Manager'
  if (t === 'staff') return 'Staff'
  return 'Customer'
}

export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RoleTab>('all')
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

  const visible = USERS.filter((u) => matchesRoleTab(u, activeTab))

  return (
    <div className="um">
      {sidebarOpen ? (
        <button
          type="button"
          className="um__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`um__sidebar${sidebarOpen ? ' um__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="um__brand">
          <span className="um__brand-title">PartyOn</span>
          <span className="um__brand-sub">Platform Admin</span>
        </div>

        <nav className="um__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`um__nav-link${item.active ? ' um__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="um__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="um__user">
          <div className="um__avatar" aria-hidden>
            <IconShield />
          </div>
          <div className="um__user-text">
            <span className="um__user-name">Super Admin</span>
            <span className="um__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="um__main">
        <header className="um__topbar">
          <button
            type="button"
            className="um__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="um__menu-btn-text">Menu</span>
          </button>
          <span className="um__topbar-title">PartyOn Platform</span>
          <button type="button" className="um__icon-btn" aria-label="Security">
            <IconShield />
          </button>
        </header>

        <main className="um__content">
          <header className="um__page-head">
            <h1 className="um__h1">User Management</h1>
            <p className="um__sub">Monitor and manage all platform users</p>
          </header>

          <section className="um__stat-row" aria-label="User stats">
            {STATS.map((s) => (
              <article
                key={s.id}
                className={`um__card um__stat${s.tone === 'complaints' ? ' um__stat--complaints' : ''}`}
              >
                {s.tone === 'complaints' ? (
                  <div className="um__stat-head">
                    <span className="um__stat-warn-icon" aria-hidden>
                      <IconAlertCircle />
                    </span>
                  </div>
                ) : null}
                <p className="um__stat-value">{s.value}</p>
                <h2 className="um__stat-label">{s.label}</h2>
              </article>
            ))}
          </section>

          <div className="um__tabs" role="tablist" aria-label="Filter by role">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`um__tab${activeTab === t.id ? ' um__tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {visible.length > 0 ? (
            <div className="um__table-wrap">
              <table className="um__table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Type</th>
                    <th scope="col">Bookings</th>
                    <th scope="col">Total Spent</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="um__user-cell">
                          <span className="um__user-avatar" aria-hidden />
                          <div>
                            <div className="um__user-name-cell">{u.name}</div>
                            <div className="um__user-joined">Joined {u.joined}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="um__contact-cell">
                          <span>{u.email}</span>
                          <span className="um__contact-phone">{u.phone}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`um__badge um__badge--type-${u.type === 'manager' ? 'manager' : u.type === 'staff' ? 'staff' : 'customer'}`}
                        >
                          {typeLabel(u.type)}
                        </span>
                      </td>
                      <td>{u.bookings}</td>
                      <td>{u.spent}</td>
                      <td>
                        <div className="um__status-cell">
                          <span
                            className={`um__badge um__badge--status-${u.status === 'blocked' ? 'blocked' : 'active'}`}
                          >
                            {u.status}
                          </span>
                          {u.complaints > 0 ? (
                            <span className="um__complaint-pill" title="Complaints">
                              {u.complaints}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="um__actions">
                          <button type="button" className="um__icon-action" aria-label={`View ${u.name}`}>
                            <IconEye />
                          </button>
                          {u.status === 'blocked' ? (
                            <button
                              type="button"
                              className="um__icon-action um__icon-action--unblock"
                              aria-label={`Unblock ${u.name}`}
                            >
                              <IconCheckCircle />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="um__icon-action"
                              aria-label={`Block ${u.name}`}
                            >
                              <IconBan />
                            </button>
                          )}
                          <button type="button" className="um__icon-action" aria-label={`Delete ${u.name}`}>
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="um__empty">No users in this filter.</p>
          )}
        </main>
      </div>
    </div>
  )
}
