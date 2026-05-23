import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUserStatus,
  type AdminUser,
  type AdminUsersData,
} from './adminApi'
import { invalidateAdminCache, setCachedAdminData } from './adminDataCache'
import { useAdminData } from './useAdminData'
import AdminNavLink from './AdminNavLink'
import './UserManagement.css'
import './admin-controls.css'

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
  { id: 'overview', label: 'Platform Overview', href: '/admin/platform-analysis' },
  { id: 'clubs', label: 'Club Approvals', href: '/admin/club-approvals' },
  { id: 'users', label: 'User Management', href: '/admin/user-management', active: true },
  { id: 'revenue', label: 'Revenue & Payments', href: '/admin/revenue-payments' },
  { id: 'featured', label: 'Featured Events', href: '/admin/featured-events' },
  { id: 'analysis', label: 'Platform Analytics', href: '/admin/platform-analytics' },
  { id: 'settings', label: 'Settings', href: '/admin/settings' },
]

type RoleTab = 'all' | 'customer' | 'managers' | 'staff'
type ConfirmKind = 'block' | 'unblock' | 'delete'

type StatCard = {
  id: string
  label: string
  value: string
  tone: 'default' | 'complaints'
}

type Tab = { id: RoleTab; label: string; count: number }
type ConfirmAction = { kind: ConfirmKind; user: AdminUser }

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
  settings: <IconSettings />,
}

function formatCurrency(value: number): string {
  return `€${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function matchesRoleTab(u: AdminUser, tab: RoleTab): boolean {
  if (tab === 'all') return true
  if (tab === 'customer') return u.type === 'customer'
  if (tab === 'managers') return normalizeUserType(u) === 'club_manager'
  return u.type === 'staff'
}

function typeLabel(t: AdminUser['type']): string {
  if (t === 'club_manager') return 'Club Manager'
  if (t === 'staff') return 'Staff'
  if (t === 'admin') return 'Admin'
  return 'Customer'
}

function normalizeUserType(user: AdminUser): AdminUser['type'] {
  const typeRaw = String(user.type ?? '').toLowerCase().trim()
  const roleRaw = String(user.roleRaw ?? '').toLowerCase().trim()
  const combined = `${typeRaw}|${roleRaw}`

  if (
    combined.includes('club_manager') ||
    combined.includes('club-manager') ||
    combined.includes('clubmanager') ||
    combined.includes('manager')
  ) {
    return 'club_manager'
  }
  if (combined.includes('staff')) return 'staff'
  if (combined.includes('admin') || combined.includes('super_admin') || combined.includes('superadmin')) {
    return 'admin'
  }
  return 'customer'
}

export default function UserManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RoleTab>('all')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const { session } = useAuth()
  const {
    data,
    loading,
    error,
    setData,
    reload: reloadUsers,
  } = useAdminData<AdminUsersData>(
    'admin:users',
    session?.access_token,
    fetchAdminUsers,
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

  const applyUsersPatch = useCallback(
    (updater: (prev: AdminUsersData) => AdminUsersData) => {
      setData((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        setCachedAdminData('admin:users', next)
        return next
      })
    },
    [setData],
  )

  const setUserStatus = async (userId: string, status: AdminUser['status']) => {
    const token = session?.access_token
    if (!token) return false
    const result = await updateAdminUserStatus(token, userId, status)
    if (result.error) return false
    applyUsersPatch((prev) => {
      const users = prev.users.map((user) =>
        user.id === userId ? { ...user, status } : user,
      )
      return {
        ...prev,
        users,
        stats: {
          total: users.length,
          active: users.filter((user) => user.status === 'active').length,
          blocked: users.filter((user) => user.status === 'blocked').length,
          complaints: users.filter((user) => user.complaints > 0).length,
        },
      }
    })
    void reloadUsers({ silent: true })
    return true
  }

  const removeUser = async (userId: string) => {
    const token = session?.access_token
    if (!token) return false
    const result = await deleteAdminUser(token, userId)
    if (result.error) return false
    applyUsersPatch((prev) => {
      const users = prev.users.filter((user) => user.id !== userId)
      return {
        ...prev,
        users,
        stats: {
          total: users.length,
          active: users.filter((user) => user.status === 'active').length,
          blocked: users.filter((user) => user.status === 'blocked').length,
          complaints: users.filter((user) => user.complaints > 0).length,
        },
        tabs: {
          all: users.length,
          customer: users.filter((user) => user.type === 'customer').length,
          managers: users.filter((user) => user.type === 'club_manager').length,
          staff: users.filter((user) => user.type === 'staff').length,
        },
      }
    })
    invalidateAdminCache('admin:users')
    void reloadUsers({ silent: true })
    return true
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!import.meta.env.DEV || !data?.users?.length) return
    console.table(
      data.users.map((user) => ({
        id: user.id,
        name: user.name,
        roleRaw: user.roleRaw,
        type: user.type,
        normalizedType: normalizeUserType(user),
      })),
    )
  }, [data])

  const closeDetails = useCallback(() => setSelectedUser(null), [])

  const askForAction = (action: ConfirmAction) => {
    setConfirmAction(action)
  }

  const closeConfirm = useCallback(() => {
    if (actionBusy) return
    setConfirmAction(null)
  }, [actionBusy])

  const confirmTitle = confirmAction
    ? confirmAction.kind === 'delete'
      ? 'Delete User'
      : confirmAction.kind === 'block'
        ? 'Block User'
        : 'Unblock User'
    : ''

  const confirmMessage = confirmAction
    ? confirmAction.kind === 'delete'
      ? `Permanently delete ${confirmAction.user.name}? This cannot be undone.`
      : confirmAction.kind === 'block'
        ? `Block ${confirmAction.user.name}? They will lose access to the platform.`
        : `Unblock ${confirmAction.user.name}? They will regain access to the platform.`
    : ''

  const confirmButtonLabel = confirmAction
    ? confirmAction.kind === 'delete'
      ? 'Delete User'
      : confirmAction.kind === 'block'
        ? 'Block User'
        : 'Unblock User'
    : 'Confirm'

  const confirmButtonClass = confirmAction
    ? confirmAction.kind === 'delete'
      ? 'um__btn um__btn--danger'
      : confirmAction.kind === 'block'
        ? 'um__btn um__btn--danger'
        : 'um__btn um__btn--success'
    : 'um__btn um__btn--ghost'

  const runAction = async () => {
    if (!confirmAction) return
    setActionBusy(true)
    let ok = false
    if (confirmAction.kind === 'delete') {
      ok = await removeUser(confirmAction.user.id)
      if (ok) {
        setToast(`${confirmAction.user.name} deleted successfully.`)
      }
    } else if (confirmAction.kind === 'block') {
      ok = await setUserStatus(confirmAction.user.id, 'blocked')
      if (ok) {
        setToast(`${confirmAction.user.name} blocked successfully.`)
      }
    } else {
      ok = await setUserStatus(confirmAction.user.id, 'active')
      if (ok) {
        setToast(`${confirmAction.user.name} unblocked successfully.`)
      }
    }
    setActionBusy(false)
    if (ok) {
      if (selectedUser?.id === confirmAction.user.id) {
        closeDetails()
      }
      setConfirmAction(null)
    }
  }

  const normalizedUsers = (data?.users ?? []).map((user) => ({
    ...user,
    type: normalizeUserType(user),
  }))

  const stats: StatCard[] = data
    ? [
        { id: 'total', label: 'Total Users', value: String(data.stats.total), tone: 'default' },
        { id: 'active', label: 'Active', value: String(data.stats.active), tone: 'default' },
        { id: 'blocked', label: 'Blocked', value: String(data.stats.blocked), tone: 'default' },
        { id: 'complaints', label: 'With Complaints', value: String(data.stats.complaints), tone: 'complaints' },
      ]
    : []

  const tabs: Tab[] = [
    { id: 'all', label: 'All', count: normalizedUsers.length },
    { id: 'customer', label: 'Customer', count: normalizedUsers.filter((u) => matchesRoleTab(u, 'customer')).length },
    { id: 'managers', label: 'Club Managers', count: normalizedUsers.filter((u) => matchesRoleTab(u, 'managers')).length },
    { id: 'staff', label: 'Staff', count: normalizedUsers.filter((u) => matchesRoleTab(u, 'staff')).length },
  ]

  const visible = normalizedUsers.filter((u) => matchesRoleTab(u, activeTab))

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
      {selectedUser || confirmAction ? (
        <button
          type="button"
          className="um__overlay"
          aria-label="Close dialog"
          onClick={confirmAction ? closeConfirm : closeDetails}
        />
      ) : null}

      <aside
        className={`um__sidebar${sidebarOpen ? ' um__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="um__sidebar-scroll">
          <div className="um__brand">
            <span className="um__brand-title">PartyOn</span>
            <span className="um__brand-sub">Platform Admin</span>
          </div>

          <nav className="um__nav">
            {NAV.map((item) =>
              item.href === '#' ? (
                <span key={item.id} className="um__nav-link um__nav-link--muted">
                  <span className="um__nav-icon" aria-hidden>
                    {NAV_ICONS[item.id]}
                  </span>
                  {item.label}
                </span>
              ) : (
                <AdminNavLink
                  key={item.id}
                  to={item.href}
                  className="um__nav-link"
                  activeClassName=" um__nav-link--active"
                  onNavigate={closeSidebar}
                >
                  <span className="um__nav-icon" aria-hidden>
                    {NAV_ICONS[item.id]}
                  </span>
                  {item.label}
                </AdminNavLink>
              ),
            )}
          </nav>
        </div>

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

          {loading ? <p className="um__empty">Loading users...</p> : null}
          {error ? <p className="um__empty">{error}</p> : null}

          <section className="um__stat-row" aria-label="User stats">
            {stats.map((s) => (
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
            {tabs.map((t) => (
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
                          {u.avatar ? (
                            <img className="um__user-avatar um__user-avatar--img" src={u.avatar} alt="" />
                          ) : (
                            <span className="um__user-avatar" aria-hidden />
                          )}
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
                          className={`um__badge um__badge--type-${u.type === 'club_manager' ? 'manager' : u.type === 'staff' ? 'staff' : u.type === 'admin' ? 'admin' : 'customer'}`}
                        >
                          {typeLabel(u.type)}
                        </span>
                      </td>
                      <td>{u.bookings}</td>
                      <td>{formatCurrency(u.spent)}</td>
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
                          <button
                            type="button"
                            className="um__icon-action"
                            aria-label={`View ${u.name}`}
                            title="View Details"
                            data-tooltip="View Details"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedUser({
                                ...u,
                                bookingHistory: Array.isArray(u.bookingHistory) ? u.bookingHistory : [],
                                roleRaw: u.roleRaw ?? '',
                                avatar: u.avatar ?? null,
                              })
                            }}
                          >
                            <IconEye />
                          </button>
                          {u.status === 'blocked' ? (
                            <button
                              type="button"
                              className="um__icon-action um__icon-action--unblock"
                              aria-label={`Unblock ${u.name}`}
                              title="Unblock User"
                              data-tooltip="Unblock User"
                              onClick={() => askForAction({ kind: 'unblock', user: u })}
                            >
                              <IconCheckCircle />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="um__icon-action"
                              aria-label={`Block ${u.name}`}
                              title="Block User"
                              data-tooltip="Block User"
                              onClick={() => askForAction({ kind: 'block', user: u })}
                            >
                              <IconBan />
                            </button>
                          )}
                          <button
                            type="button"
                            className="um__icon-action"
                            aria-label={`Delete ${u.name}`}
                            title="Delete User"
                            data-tooltip="Delete User"
                            onClick={() => askForAction({ kind: 'delete', user: u })}
                            disabled={u.type === 'admin'}
                          >
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

          {selectedUser ? (
            <section className="um__modal" role="dialog" aria-modal="true" aria-labelledby="um-user-title">
              <header className="um__modal-head">
                <h2 id="um-user-title" className="um__modal-title">
                  User Profile
                </h2>
                <button type="button" className="um__icon-action" aria-label="Close profile" onClick={closeDetails}>
                  <IconClose />
                </button>
              </header>
              <div className="um__detail-grid">
                <p><strong>Name:</strong> {selectedUser.name}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Phone:</strong> {selectedUser.phone}</p>
                <p><strong>Type:</strong> {typeLabel(selectedUser.type)}</p>
                <p><strong>Joined:</strong> {selectedUser.joined}</p>
                <p><strong>Status:</strong> {selectedUser.status}</p>
                <p><strong>Bookings count:</strong> {selectedUser.bookings}</p>
                <p><strong>Total spent:</strong> {formatCurrency(selectedUser.spent)}</p>
                <p><strong>Complaints/notes:</strong> {selectedUser.complaints > 0 ? `${selectedUser.complaints} flagged item(s)` : 'No complaints'}</p>
              </div>
              <div className="um__booking-history">
                <h3>Booking history</h3>
                {(selectedUser.bookingHistory ?? []).length > 0 ? (
                  <ul>
                    {(selectedUser.bookingHistory ?? []).map((booking) => (
                      <li key={booking.id}>
                        {booking.date} · {booking.type} · {booking.status} · #{booking.id}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No bookings yet.</p>
                )}
              </div>
              <div className="um__modal-actions">
                {selectedUser.status === 'blocked' ? (
                  <button
                    type="button"
                    className="um__btn um__btn--success"
                    onClick={() => askForAction({ kind: 'unblock', user: selectedUser })}
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    type="button"
                    className="um__btn um__btn--danger"
                    onClick={() => askForAction({ kind: 'block', user: selectedUser })}
                  >
                    Block
                  </button>
                )}
                <button
                  type="button"
                  className="um__btn um__btn--danger"
                  onClick={() => askForAction({ kind: 'delete', user: selectedUser })}
                  disabled={selectedUser.type === 'admin'}
                >
                  Delete
                </button>
              </div>
            </section>
          ) : null}

          {confirmAction ? (
            <section className="um__modal um__modal--confirm" role="dialog" aria-modal="true" aria-labelledby="um-confirm-title">
              <header className="um__modal-head">
                <h2 id="um-confirm-title" className="um__modal-title">
                  {confirmTitle}
                </h2>
              </header>
              <p className="um__confirm-copy">{confirmMessage}</p>
              <div className="um__modal-actions">
                <button type="button" className="um__btn um__btn--ghost" onClick={closeConfirm} disabled={actionBusy}>
                  Cancel
                </button>
                <button type="button" className={confirmButtonClass} onClick={() => void runAction()} disabled={actionBusy}>
                  {actionBusy ? 'Please wait...' : confirmButtonLabel}
                </button>
              </div>
            </section>
          ) : null}

          {toast ? <div className="um__toast">{toast}</div> : null}
        </main>
      </div>
    </div>
  )
}
