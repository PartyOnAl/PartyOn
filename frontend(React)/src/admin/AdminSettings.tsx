import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import AdminNavLink from './AdminNavLink'
import { fetchAdminOverview, type AdminOverviewData } from './adminApi'
import { useAdminData } from './useAdminData'
import AdminSelect from './AdminSelect'
import './AdminSettings.css'
import './admin-controls.css'

type NavId = 'overview' | 'clubs' | 'users' | 'revenue' | 'featured' | 'analysis' | 'settings'
type ActivityTone = 'info' | 'success' | 'warn'

type NavItem = {
  id: NavId
  label: string
  href: string
}

type SettingsState = {
  allowNewClubRegistration: boolean
  autoApproveEvents: boolean
  enableRefunds: boolean
  ticketCommission: string
  tableReservationCommission: string
  monthlySubscriptionFee: string
  featuredEventFee: string
  notifyNewClubApplications: boolean
  notifyNewDisputes: boolean
  notifyRevenueMilestones: boolean
  requireMfa: boolean
  sessionTimeout: '30' | '60' | '120'
  trustedDeviceDays: '7' | '14' | '30'
  maintenanceMode: 'live' | 'banner' | 'read-only'
  maintenanceMessage: string
  supportEmail: string
}

type ActivityEntry = {
  id: string
  title: string
  detail: string
  createdAt: string
  tone: ActivityTone
}

type StoredSettings = {
  savedAt: string | null
  settings: SettingsState
  activityLog: ActivityEntry[]
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

const SETTINGS_STORAGE_KEY = 'partyon-admin-settings-v3'

const DEFAULT_SETTINGS: SettingsState = {
  allowNewClubRegistration: true,
  autoApproveEvents: false,
  enableRefunds: true,
  ticketCommission: '15',
  tableReservationCommission: '15',
  monthlySubscriptionFee: '299',
  featuredEventFee: '500',
  notifyNewClubApplications: true,
  notifyNewDisputes: true,
  notifyRevenueMilestones: true,
  requireMfa: true,
  sessionTimeout: '60',
  trustedDeviceDays: '14',
  maintenanceMode: 'live',
  maintenanceMessage: 'PartyOn is live across clubs, reservations, and payout operations.',
  supportEmail: 'admin@partyon.com',
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

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.83l.05.05a2 2 0 1 1-2.82 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.82-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.83l-.05-.05a2 2 0 0 1 2.82-2.83l.06.06A1.7 1.7 0 0 0 8.9 4a1.7 1.7 0 0 0 1.03-1.56V2.4a2 2 0 1 1 4 0v.04A1.7 1.7 0 0 0 14.96 4a1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.82 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.05A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function IconCoins() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 16c0 1.7 3.1 3 7 3s7-1.3 7-3-3.1-3-7-3-7 1.3-7 3Z" />
      <path d="M7 10c0 1.7 3.1 3 7 3s7-1.3 7-3-3.1-3-7-3-7 1.3-7 3Z" />
      <path d="M3 8c0 1.4 2.2 2.5 5 2.9M3 14c0 1.5 2.2 2.7 5 3.1" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" />
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

function formatDate(value?: string | null): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not saved yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not saved yet'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

function createActivityEntry(title: string, detail: string, tone: ActivityTone): ActivityEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    detail,
    createdAt: new Date().toISOString(),
    tone,
  }
}

function buildDefaultActivityLog(): ActivityEntry[] {
  return [
    createActivityEntry('Settings workspace initialized', 'Platform controls are ready for editing and secure review.', 'success'),
    createActivityEntry('Notifications armed', 'Application, dispute, and milestone alerts are enabled for the admin team.', 'info'),
    createActivityEntry('Security posture reviewed', 'MFA and session controls are active for high-value admin actions.', 'info'),
  ]
}

function loadStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return { settings: DEFAULT_SETTINGS, savedAt: null, activityLog: buildDefaultActivityLog() }
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return { settings: DEFAULT_SETTINGS, savedAt: null, activityLog: buildDefaultActivityLog() }
    }

    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
      activityLog: Array.isArray(parsed.activityLog) && parsed.activityLog.length > 0
        ? parsed.activityLog
        : buildDefaultActivityLog(),
    }
  } catch {
    return { settings: DEFAULT_SETTINGS, savedAt: null, activityLog: buildDefaultActivityLog() }
  }
}

export default function AdminSettings() {
  const initialStored = loadStoredSettings()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stored, setStored] = useState<StoredSettings>(initialStored)
  const [draft, setDraft] = useState<SettingsState>(initialStored.settings)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const activityRef = useRef<HTMLElement | null>(null)
  const { user, profile, session, signOut } = useAuth()
  const { data, loading, error } = useAdminData<AdminOverviewData>(
    'admin:overview',
    session?.access_token,
    fetchAdminOverview,
  )
  const navId = useId()
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const persistStored = useCallback((next: StoredSettings) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
    }
    setStored(next)
  }, [])

  const updateStored = useCallback(
    (updater: (current: StoredSettings) => StoredSettings) => {
      setStored((current) => {
        const next = updater(current)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next))
        }
        return next
      })
    },
    [],
  )

  const appendActivity = useCallback(
    (title: string, detail: string, tone: ActivityTone = 'info') => {
      updateStored((current) => ({
        ...current,
        activityLog: [createActivityEntry(title, detail, tone), ...current.activityLog].slice(0, 8),
      }))
    },
    [updateStored],
  )

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const displayName =
    [profile?.name, profile?.surname].filter(Boolean).join(' ').trim() ||
    profile?.username ||
    user?.email ||
    'Super Admin'
  const role = profile?.role ?? user?.user_metadata?.role ?? 'admin'
  const serializedDraft = JSON.stringify(draft)
  const serializedStored = JSON.stringify(stored.settings)
  const hasUnsavedChanges = serializedDraft !== serializedStored

  const enabledNotifications = useMemo(
    () =>
      [
        draft.notifyNewClubApplications,
        draft.notifyNewDisputes,
        draft.notifyRevenueMilestones,
      ].filter(Boolean).length,
    [draft],
  )

  const changeSummary = useMemo(() => {
    const changes: string[] = []
    if (draft.allowNewClubRegistration !== stored.settings.allowNewClubRegistration) changes.push('club registration')
    if (draft.autoApproveEvents !== stored.settings.autoApproveEvents) changes.push('event approval')
    if (draft.enableRefunds !== stored.settings.enableRefunds) changes.push('refund policy')
    if (draft.ticketCommission !== stored.settings.ticketCommission) changes.push('ticket commission')
    if (draft.monthlySubscriptionFee !== stored.settings.monthlySubscriptionFee) changes.push('subscription fee')
    if (draft.requireMfa !== stored.settings.requireMfa) changes.push('MFA')
    if (draft.maintenanceMode !== stored.settings.maintenanceMode) changes.push('maintenance mode')
    return changes
  }, [draft, stored.settings])

  const saveSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const savedAt = new Date().toISOString()
    persistStored({
      savedAt,
      settings: draft,
      activityLog: [
        createActivityEntry(
          'Settings saved',
          `Platform settings were updated with ${changeSummary.length || 1} configuration changes.`,
          'success',
        ),
        ...stored.activityLog,
      ].slice(0, 8),
    })
  }

  const resetToDefaults = () => {
    setDraft(DEFAULT_SETTINGS)
  }

  const scrollToActivity = () => {
    activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    appendActivity('Activity log opened', 'Recent admin-side actions were brought into focus for review.', 'info')
  }

  const handlePasswordAction = () => {
    appendActivity(
      'Password reset prepared',
      `A secure password reset flow was simulated for ${user?.email ?? 'the current admin account'}.`,
      'warn',
    )
  }

  const handleMfaAction = () => {
    const nextValue = !draft.requireMfa
    setDraft((current) => ({ ...current, requireMfa: nextValue }))
    appendActivity(
      nextValue ? 'Two-factor enabled in draft' : 'Two-factor relaxed in draft',
      nextValue
        ? 'The admin workspace now requires MFA in the current draft configuration.'
        : 'MFA was switched off in the current draft configuration and should be reviewed before saving.',
      nextValue ? 'success' : 'warn',
    )
  }

  const handleTestNotification = () => {
    appendActivity(
      'Test notification sent',
      'A simulated admin alert was issued to confirm notification preferences and delivery rules.',
      'success',
    )
  }

  const handleLogout = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="as">
      {sidebarOpen ? (
        <button type="button" className="as__backdrop" aria-label="Close menu" onClick={closeSidebar} />
      ) : null}

      <aside
        className={`as__sidebar${sidebarOpen ? ' as__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="as__sidebar-scroll">
          <div className="as__brand">
            <span className="as__brand-title">PartyOn</span>
            <span className="as__brand-sub">Platform Admin</span>
          </div>

          <nav className="as__nav">
            {NAV.map((item) => (
              <AdminNavLink
                key={item.id}
                to={item.href}
                className="as__nav-link"
                activeClassName=" as__nav-link--active"
                onNavigate={closeSidebar}
              >
                <span className="as__nav-icon" aria-hidden>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </AdminNavLink>
            ))}
          </nav>
        </div>

        <div className="as__user">
          <div className="as__avatar" aria-hidden />
          <div className="as__user-text">
            <span className="as__user-name">{displayName}</span>
            <span className="as__user-email">{user?.email ?? 'admin@partyon.com'}</span>
          </div>
        </div>
      </aside>

      <div className="as__main">
        <header className="as__topbar">
          <button
            type="button"
            className="as__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="as__menu-btn-text">Menu</span>
          </button>
          <span className="as__topbar-title">PartyOn Platform</span>
          <button type="button" className="as__icon-btn" aria-label="Settings">
            <IconSettings />
          </button>
        </header>

        <main className="as__content">
          <header className="as__page-head">
            <div>
              <h1 className="as__h1">Platform Settings</h1>
              <p className="as__sub">Manage platform-wide configurations with a cleaner, more focused admin control surface.</p>
            </div>
          </header>

          {loading ? <p className="as__empty">Loading platform settings context...</p> : null}
          {error ? <p className="as__empty">{error}</p> : null}

          <div className="as__layout">
            <form className="as__stack" onSubmit={saveSettings}>
              <section className="as__card as__config-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconCog />
                    </span>
                    <div>
                      <h2>Platform Configuration</h2>
                      <span className="as__section-note">General platform settings</span>
                    </div>
                  </div>
                </div>

                <div className="as__simple-list">
                  <label className="as__simple-row">
                    <div>
                      <strong>Allow New Club Registration</strong>
                      <small>Let clubs apply to join the PartyOn platform.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.allowNewClubRegistration}
                      onChange={(event) => setDraft((current) => ({ ...current, allowNewClubRegistration: event.target.checked }))}
                    />
                  </label>

                  <label className="as__simple-row">
                    <div>
                      <strong>Auto-Approve Events</strong>
                      <small>Events can go live without manual review.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.autoApproveEvents}
                      onChange={(event) => setDraft((current) => ({ ...current, autoApproveEvents: event.target.checked }))}
                    />
                  </label>

                  <label className="as__simple-row">
                    <div>
                      <strong>Enable Refunds</strong>
                      <small>Allow users to request refunds for eligible bookings.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.enableRefunds}
                      onChange={(event) => setDraft((current) => ({ ...current, enableRefunds: event.target.checked }))}
                    />
                  </label>
                </div>

                <div className="as__field-grid as__field-grid--compact">
                  <label className="as__field">
                    <span>Maintenance mode</span>
                    <AdminSelect
                      value={draft.maintenanceMode}
                      onChange={(maintenanceMode) =>
                        setDraft((current) => ({ ...current, maintenanceMode }))
                      }
                      options={[
                        { value: 'live', label: 'Live' },
                        { value: 'banner', label: 'Banner only' },
                        { value: 'read-only', label: 'Read only' },
                      ]}
                    />
                  </label>

                  <label className="as__field">
                    <span>Support email</span>
                    <input
                      type="email"
                      value={draft.supportEmail}
                      onChange={(event) => setDraft((current) => ({ ...current, supportEmail: event.target.value }))}
                    />
                  </label>
                </div>

                <label className="as__field as__field--full">
                  <span>Status banner copy</span>
                  <textarea
                    rows={3}
                    value={draft.maintenanceMessage}
                    onChange={(event) => setDraft((current) => ({ ...current, maintenanceMessage: event.target.value }))}
                  />
                </label>
              </section>

              <section className="as__card as__config-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconCoins />
                    </span>
                    <div>
                      <h2>Commission Rates</h2>
                      <span className="as__section-note">Set platform commission percentages</span>
                    </div>
                  </div>
                </div>

                <div className="as__input-stack">
                  <label className="as__field">
                    <span>Ticket Commission (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.ticketCommission}
                      onChange={(event) => setDraft((current) => ({ ...current, ticketCommission: event.target.value }))}
                    />
                  </label>

                  <label className="as__field">
                    <span>Table Reservation Commission (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.tableReservationCommission}
                      onChange={(event) => setDraft((current) => ({ ...current, tableReservationCommission: event.target.value }))}
                    />
                  </label>

                  <label className="as__field">
                    <span>Monthly Subscription Fee (€)</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.monthlySubscriptionFee}
                      onChange={(event) => setDraft((current) => ({ ...current, monthlySubscriptionFee: event.target.value }))}
                    />
                  </label>

                  <label className="as__field">
                    <span>Featured Event Fee (€ / week)</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.featuredEventFee}
                      onChange={(event) => setDraft((current) => ({ ...current, featuredEventFee: event.target.value }))}
                    />
                  </label>
                </div>
              </section>

              <section className="as__card as__config-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconBell />
                    </span>
                    <div>
                      <h2>Admin Notifications</h2>
                      <span className="as__section-note">Configure admin alert preferences</span>
                    </div>
                  </div>
                  <button type="button" className="as__mini-action" onClick={handleTestNotification}>
                    Send test alert
                  </button>
                </div>

                <div className="as__simple-list">
                  <label className="as__simple-row">
                    <div>
                      <strong>New Club Applications</strong>
                      <small>Get notified of new club applications.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.notifyNewClubApplications}
                      onChange={(event) => setDraft((current) => ({ ...current, notifyNewClubApplications: event.target.checked }))}
                    />
                  </label>

                  <label className="as__simple-row">
                    <div>
                      <strong>New Disputes</strong>
                      <small>Alert when users file complaints or booking disputes.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.notifyNewDisputes}
                      onChange={(event) => setDraft((current) => ({ ...current, notifyNewDisputes: event.target.checked }))}
                    />
                  </label>

                  <label className="as__simple-row">
                    <div>
                      <strong>Revenue Milestones</strong>
                      <small>Celebrate milestone revenue achievements and monthly targets.</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft.notifyRevenueMilestones}
                      onChange={(event) => setDraft((current) => ({ ...current, notifyRevenueMilestones: event.target.checked }))}
                    />
                  </label>
                </div>
              </section>

              <section className="as__card as__config-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconShield />
                    </span>
                    <div>
                      <h2>Security</h2>
                      <span className="as__section-note">Admin account security</span>
                    </div>
                  </div>
                </div>

                <div className="as__input-stack">
                  <label className="as__field">
                    <span>Session timeout</span>
                    <AdminSelect
                      value={draft.sessionTimeout}
                      onChange={(sessionTimeout) =>
                        setDraft((current) => ({ ...current, sessionTimeout }))
                      }
                      options={[
                        { value: '30', label: '30 minutes' },
                        { value: '60', label: '60 minutes' },
                        { value: '120', label: '120 minutes' },
                      ]}
                    />
                  </label>

                  <label className="as__field">
                    <span>Trusted device window</span>
                    <AdminSelect
                      value={draft.trustedDeviceDays}
                      onChange={(trustedDeviceDays) =>
                        setDraft((current) => ({ ...current, trustedDeviceDays }))
                      }
                      options={[
                        { value: '7', label: '7 days' },
                        { value: '14', label: '14 days' },
                        { value: '30', label: '30 days' },
                      ]}
                    />
                  </label>
                </div>

                <div className="as__security-actions">
                  <button type="button" className="as__security-btn" onClick={handlePasswordAction}>
                    Change Password
                  </button>
                  <button type="button" className="as__security-btn" onClick={handleMfaAction}>
                    {draft.requireMfa ? 'Disable Two-Factor Authentication' : 'Enable Two-Factor Authentication'}
                  </button>
                  <button type="button" className="as__security-btn" onClick={scrollToActivity}>
                    View Activity Log
                  </button>
                </div>
              </section>

              <section className="as__footer-bar">
                <div className={`as__save-state${hasUnsavedChanges ? ' as__save-state--pending' : ''}`}>
                  {hasUnsavedChanges ? `Pending changes: ${changeSummary.join(', ') || 'draft updates ready'}` : 'All changes are up to date'}
                </div>

                <button
                  type="button"
                  className="as__button as__button--danger"
                  disabled={isSigningOut}
                  onClick={() => void handleLogout()}
                >
                  <span className="as__button-icon" aria-hidden>
                    <IconLogout />
                  </span>
                  {isSigningOut ? 'Logging out...' : 'Logout'}
                </button>

                <div className="as__footer-actions">
                  <button type="button" className="as__button as__button--ghost" onClick={resetToDefaults}>
                    Reset Defaults
                  </button>
                  <button type="submit" className="as__button as__button--primary">
                    Save Changes
                  </button>
                </div>
              </section>
            </form>

            <aside className="as__rail">
              <section className="as__card as__profile-card">
                <div className="as__profile-avatar" aria-hidden>
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2>{displayName}</h2>
                  <p>{user?.email ?? profile?.email ?? 'No email available'}</p>
                  <div className="as__pill-row">
                    <span className="as__pill as__pill--ready">Role: {role}</span>
                    <span className="as__pill">Joined {formatDate(profile?.created_at ?? user?.created_at)}</span>
                  </div>
                </div>
              </section>

              <section className="as__card as__status-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconChart />
                    </span>
                    <div>
                      <h2>Workspace Snapshot</h2>
                      <span className="as__section-note">Live admin overview context</span>
                    </div>
                  </div>
                </div>

                <div className="as__snapshot">
                  <span><strong>{formatNumber(data?.metrics.totalUsers ?? 0)}</strong> users</span>
                  <span><strong>{formatNumber(data?.metrics.activeClubs ?? 0)}</strong> active clubs</span>
                  <span><strong>{formatNumber(data?.metrics.totalEvents ?? 0)}</strong> events</span>
                  <span><strong>{formatNumber(data?.metrics.pendingApprovals ?? 0)}</strong> pending approvals</span>
                </div>
              </section>

              <section className="as__card as__summary-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconSettings />
                    </span>
                    <div>
                      <h2>Current Summary</h2>
                      <span className="as__section-note">Current platform configuration snapshot</span>
                    </div>
                  </div>
                </div>

                <div className="as__health-list">
                  <span><strong>Registration:</strong> {draft.allowNewClubRegistration ? 'Open to new clubs' : 'Closed to new clubs'}</span>
                  <span><strong>Event review:</strong> {draft.autoApproveEvents ? 'Auto-approval enabled' : 'Manual review required'}</span>
                  <span><strong>Refunds:</strong> {draft.enableRefunds ? 'Allowed for eligible cases' : 'Disabled at platform level'}</span>
                  <span><strong>Notifications:</strong> {enabledNotifications} alert channels enabled</span>
                  <span><strong>Security:</strong> {draft.requireMfa ? 'MFA required' : 'MFA relaxed'}, {draft.sessionTimeout}-minute timeout</span>
                  <span><strong>Last update:</strong> {formatTimestamp(stored.savedAt)}</span>
                </div>
              </section>

              <section ref={activityRef} className="as__card as__activity-card">
                <div className="as__section-head">
                  <div className="as__section-heading">
                    <span className="as__section-icon" aria-hidden>
                      <IconBell />
                    </span>
                    <div>
                      <h2>Activity Log</h2>
                      <span className="as__section-note">Recent admin actions and security events</span>
                    </div>
                  </div>
                </div>

                <div className="as__activity-list">
                  {stored.activityLog.map((entry) => (
                    <article key={entry.id} className={`as__activity as__activity--${entry.tone}`}>
                      <div className="as__activity-head">
                        <strong>{entry.title}</strong>
                        <span>{formatTimestamp(entry.createdAt)}</span>
                      </div>
                      <p>{entry.detail}</p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}
