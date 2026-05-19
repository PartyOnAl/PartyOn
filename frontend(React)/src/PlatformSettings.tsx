import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './PlatformSettings.css'

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
  { id: 'analysis', label: 'Platform Analytics', href: 'platform-analytics.html' },
  { id: 'settings', label: 'Settings', href: 'platform-settings.html', active: true },
]

type ToggleKey =
  | 'clubRegistration'
  | 'autoApproveEvents'
  | 'enableRefunds'
  | 'notifyClubApps'
  | 'notifyDisputes'
  | 'notifyRevenue'

type CommissionKey =
  | 'ticketCommission'
  | 'tableCommission'
  | 'subscriptionFee'
  | 'featuredEventFee'

const TOGGLE_ROWS: {
  key: ToggleKey
  title: string
  description: string
}[] = [
  {
    key: 'clubRegistration',
    title: 'Allow New Club Registration',
    description: 'Let clubs apply to join platform',
  },
  {
    key: 'autoApproveEvents',
    title: 'Auto-Approve Events',
    description: 'Events go live without manual review',
  },
  {
    key: 'enableRefunds',
    title: 'Enable Refunds',
    description: 'Allow users to request refunds',
  },
]

const NOTIFICATION_ROWS: {
  key: ToggleKey
  title: string
  description: string
}[] = [
  {
    key: 'notifyClubApps',
    title: 'New Club Applications',
    description: 'Get notified of new club applications',
  },
  {
    key: 'notifyDisputes',
    title: 'New Disputes',
    description: 'Alert when users file complaints',
  },
  {
    key: 'notifyRevenue',
    title: 'Revenue Milestones',
    description: 'Celebrate revenue achievements',
  },
]

const COMMISSION_FIELDS: {
  key: CommissionKey
  label: string
  defaultValue: string
}[] = [
  { key: 'ticketCommission', label: 'Ticket Commission (%)', defaultValue: '15' },
  {
    key: 'tableCommission',
    label: 'Table Reservation Commission (%)',
    defaultValue: '15',
  },
  { key: 'subscriptionFee', label: 'Monthly Subscription Fee (€)', defaultValue: '299' },
  { key: 'featuredEventFee', label: 'Featured Event Fee (€/week)', defaultValue: '500' },
]

const SECURITY_ACTIONS = [
  'Change Password',
  'Two-Factor Authentication',
  'View Activity Log',
] as const

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

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" strokeLinecap="round" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
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

type ToggleRowProps = {
  id: string
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({ id, title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="ps__toggle-row">
      <label className="ps__toggle-label" htmlFor={id}>
        <span className="ps__toggle-title">{title}</span>
        <span className="ps__toggle-desc">{description}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`ps__toggle${checked ? ' ps__toggle--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ps__toggle-knob" />
      </button>
    </div>
  )
}

export default function PlatformSettings() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    clubRegistration: false,
    autoApproveEvents: false,
    enableRefunds: false,
    notifyClubApps: false,
    notifyDisputes: false,
    notifyRevenue: false,
  })
  const [commissions, setCommissions] = useState<Record<CommissionKey, string>>({
    ticketCommission: '15',
    tableCommission: '15',
    subscriptionFee: '299',
    featuredEventFee: '500',
  })
  const navId = useId()
  const togglePrefix = useId().replace(/:/g, '')

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const setToggle = (key: ToggleKey, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="ps">
      {sidebarOpen ? (
        <button
          type="button"
          className="ps__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`ps__sidebar${sidebarOpen ? ' ps__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="ps__brand">
          <span className="ps__brand-title">PartyOn</span>
          <span className="ps__brand-sub">Platform Admin</span>
        </div>

        <nav className="ps__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`ps__nav-link${item.active ? ' ps__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="ps__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ps__user">
          <div className="ps__avatar" aria-hidden />
          <div className="ps__user-text">
            <span className="ps__user-name">Super Admin</span>
            <span className="ps__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="ps__main">
        <header className="ps__topbar">
          <button
            type="button"
            className="ps__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="ps__menu-btn-text">Menu</span>
          </button>
          <span className="ps__topbar-title">PartyOn Platform</span>
          <button type="button" className="ps__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="ps__content">
          <header className="ps__page-head">
            <h1 className="ps__h1">Platform Settings</h1>
            <p className="ps__sub">Manage platform-wide configurations</p>
          </header>

          <div className="ps__sections">
            <article className="ps__card ps__section">
              <header className="ps__section-head">
                <span className="ps__section-icon" aria-hidden>
                  <IconGear />
                </span>
                <div>
                  <h2 className="ps__section-title">Platform Configuration</h2>
                  <p className="ps__section-sub">General platform settings</p>
                </div>
              </header>
              <div className="ps__section-body">
                {TOGGLE_ROWS.map((row, i) => (
                  <ToggleRow
                    key={row.key}
                    id={`${togglePrefix}-cfg-${i}`}
                    title={row.title}
                    description={row.description}
                    checked={toggles[row.key]}
                    onChange={(v) => setToggle(row.key, v)}
                  />
                ))}
              </div>
            </article>

            <article className="ps__card ps__section">
              <header className="ps__section-head">
                <span className="ps__section-icon" aria-hidden>
                  <IconDollar />
                </span>
                <div>
                  <h2 className="ps__section-title">Commission Rates</h2>
                  <p className="ps__section-sub">Set platform commission percentages</p>
                </div>
              </header>
              <div className="ps__fields">
                {COMMISSION_FIELDS.map((field) => (
                  <label key={field.key} className="ps__field">
                    <span className="ps__field-label">{field.label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="ps__input"
                      value={commissions[field.key]}
                      onChange={(e) =>
                        setCommissions((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </article>

            <article className="ps__card ps__section">
              <header className="ps__section-head">
                <span className="ps__section-icon" aria-hidden>
                  <IconBell />
                </span>
                <div>
                  <h2 className="ps__section-title">Admin Notifications</h2>
                  <p className="ps__section-sub">Configure admin alert preferences</p>
                </div>
              </header>
              <div className="ps__section-body">
                {NOTIFICATION_ROWS.map((row, i) => (
                  <ToggleRow
                    key={row.key}
                    id={`${togglePrefix}-ntf-${i}`}
                    title={row.title}
                    description={row.description}
                    checked={toggles[row.key]}
                    onChange={(v) => setToggle(row.key, v)}
                  />
                ))}
              </div>
            </article>

            <article className="ps__card ps__section">
              <header className="ps__section-head">
                <span className="ps__section-icon" aria-hidden>
                  <IconLock />
                </span>
                <div>
                  <h2 className="ps__section-title">Security</h2>
                  <p className="ps__section-sub">Admin account security</p>
                </div>
              </header>
              <div className="ps__security-actions">
                {SECURITY_ACTIONS.map((label) => (
                  <button key={label} type="button" className="ps__security-btn">
                    {label}
                  </button>
                ))}
              </div>
            </article>
          </div>

          <footer className="ps__footer">
            <button type="button" className="ps__btn ps__btn--logout">
              <IconLogout />
              Logout
            </button>
            <button type="button" className="ps__btn ps__btn--save">
              <IconSave />
              Save Changes
            </button>
          </footer>
        </main>
      </div>
    </div>
  )
}
