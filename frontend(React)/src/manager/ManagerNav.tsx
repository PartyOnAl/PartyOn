import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const MANAGER_NAV = [
  { id: 'dashboard', label: 'Dashboard', to: '/manager/dashboard' },
  { id: 'club', label: 'Club Profile', to: '/manager/club-profile' },
  { id: 'events', label: 'Events', to: '/manager/events' },
  { id: 'tables', label: 'Tables', to: '/manager/reservations#tables' },
  { id: 'reservations', label: 'Reservations', to: '/manager/reservations' },
  { id: 'promotions', label: 'Promotions', to: '/manager/promotions' },
  { id: 'analytics', label: 'Analytics', to: '/manager/analytics' },
  { id: 'staff', label: 'Staff Approval', to: '/manager/staff-approval' },
  { id: 'disputes', label: 'Disputes', to: '#disputes' },
  { id: 'settings', label: 'Settings', to: '#settings' },
] as const

export type ManagerNavId = (typeof MANAGER_NAV)[number]['id']

function IconDashboard() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClub() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 21V8l9-5 9 5v13M9 21v-8h6v8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v10H4V7Zm0 5h16M9 7v10M15 7v10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconBookmark() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMegaphone() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 14V6l-4 2H7v4h3l4 2zm4 2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2v8zM6 18h1a2 2 0 0 0 2-2v-1H6v3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChart() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16M8 15v-3m4 5V8m4 3v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 9v4m0 4h.01M10.3 3.2 3.1 17a2 2 0 0 0 1.8 2.8h14.2a2 2 0 0 0 1.8-2.8L13.7 3.2a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGear() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.94-2.08 1.06.62-1 2.3-1.18-.24a8 8 0 0 1-1.37.79l-.18 1.19-2.5.5-.6-1.06a8 8 0 0 1-1.58 0l-.6 1.06-2.5-.5-.18-1.19a8 8 0 0 1-1.37-.79l-1.18.24-1-2.3 1.06-.62a8 8 0 0 1 0-1.58l-1.06-.62 1-2.3 1.18.24c.43-.3.89-.56 1.37-.79l.18-1.19 2.5-.5.6 1.06c.52-.07 1.06-.07 1.58 0l.6-1.06 2.5.5.18 1.19c.48.23.94.49 1.37.79l1.18-.24 1 2.3-1.06.62a8 8 0 0 1 0 1.58Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavIcon({ id }: { id: string }) {
  switch (id) {
    case 'dashboard': return <IconDashboard />
    case 'club': return <IconClub />
    case 'events': return <IconCalendar />
    case 'tables': return <IconTable />
    case 'reservations': return <IconBookmark />
    case 'promotions': return <IconMegaphone />
    case 'analytics': return <IconChart />
    case 'staff': return <IconUsers />
    case 'disputes': return <IconAlert />
    case 'settings': return <IconGear />
    default: return <IconDashboard />
  }
}

export function ManagerSidebar() {
  const { pathname, hash } = useLocation()
  const { profile, signOut } = useAuth()

  function getActiveId(): ManagerNavId {
    if (pathname.startsWith('/manager/club')) return 'club'
    if (pathname.startsWith('/manager/events')) return 'events'
    if (pathname.startsWith('/manager/reservations')) {
      return hash === '#tables' ? 'tables' : 'reservations'
    }
    if (pathname.startsWith('/manager/promotions')) return 'promotions'
    if (pathname.startsWith('/manager/analytics')) return 'analytics'
    if (pathname.startsWith('/manager/staff-approval')) return 'staff'
    return 'dashboard'
  }

  const activeId = getActiveId()

  return (
    <aside className="manager-dash__sidebar" aria-label="Manager navigation">
      <div className="manager-dash__brand">
        <p className="manager-dash__brand-name">PartyOn</p>
        <p className="manager-dash__brand-sub">Manager Dashboard</p>
      </div>

      <nav className="manager-dash__nav">
        {MANAGER_NAV.map((item) => {
          const isActive = item.id === activeId
          return (
            <Link
              key={item.id}
              to={item.to}
              className={
                isActive
                  ? 'manager-dash__nav-link manager-dash__nav-link--active'
                  : 'manager-dash__nav-link'
              }
              aria-current={isActive ? 'page' : undefined}
            >
              <NavIcon id={item.id} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="manager-dash__sidebar-user">
        <div className="manager-dash__sidebar-avatar" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 0c-3.3 0-6 2-6 5v1h12v-1c0-3-2.7-5-6-5Z"
              fill="currentColor"
              opacity="0.85"
            />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="manager-dash__sidebar-user-name">
            {profile?.name ? `${profile.name} ${profile.surname ?? ''}`.trim() : 'Manager'}
          </p>
          <p className="manager-dash__sidebar-user-email">{profile?.email ?? ''}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title="Sign out"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#8a8a8a',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Sign out"
        >
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden>
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  )
}

export function ManagerTopBar({ clubName }: { clubName?: string }) {
  return (
    <header className="manager-dash__topbar">
      <span className="manager-dash__club-name">{clubName ?? '—'}</span>
      <button type="button" className="manager-dash__avatar-btn" aria-label="Account menu">
        <span className="manager-dash__avatar-ring" />
      </button>
    </header>
  )
}
