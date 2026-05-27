import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PartyOnLogo } from '../components/PartyOnLogo'
import { useAuth } from '../contexts/AuthContext'
import { managerSupabase } from '../lib/supabase'
import { NO_SHOW_BADGE_EVENT, clearNoShowBadgeCount, getNoShowBadgeCount } from './noShow'

export const MANAGER_NAV = [
  { id: 'dashboard', label: 'Dashboard', to: '/manager/dashboard' },
  { id: 'club', label: 'Club Profile', to: '/manager/club-profile' },
  { id: 'events', label: 'Events', to: '/manager/events' },
  { id: 'tables', label: 'Tables', to: '/manager/tables' },
  { id: 'reservations', label: 'Reservations', to: '/manager/reservations' },
  { id: 'promotions', label: 'Promotions', to: '/manager/promotions' },
  { id: 'analytics', label: 'Analytics', to: '/manager/analytics' },
  { id: 'reviews', label: 'Reviews', to: '/manager/reviews' },
  { id: 'staff', label: 'Staff Approval', to: '/manager/staff-approval' },
  { id: 'disputes', label: 'Disputes', to: '/manager/disputes' },
  { id: 'settings', label: 'Settings', to: '/manager/settings' },
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

function IconStar() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
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

function IconBell() {
  return (
    <svg className="manager-dash__topbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18H5l1.4-1.6a2 2 0 0 0 .6-1.4V11a5 5 0 0 1 10 0v4a2 2 0 0 0 .6 1.4L19 18h-4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className="manager-dash__topbar-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUserCircle() {
  return (
    <svg className="manager-dash__menu-item-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg className="manager-dash__menu-item-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.3-2.3 1 .5-.8 2-1.1-.2a7.6 7.6 0 0 1-1.3.8l-.2 1.1-2.2.5-.6-1a7.6 7.6 0 0 1-1.5 0l-.6 1-2.2-.5-.2-1.1a7.6 7.6 0 0 1-1.3-.8l-1.1.2-.8-2 1-.5a7.6 7.6 0 0 1 0-1.5l-1-.5.8-2 1.1.2c.4-.3.8-.5 1.3-.8l.2-1.1 2.2-.5.6 1a7.6 7.6 0 0 1 1.5 0l.6-1 2.2.5.2 1.1c.5.2.9.5 1.3.8l1.1-.2.8 2-1 .5a7.6 7.6 0 0 1 0 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getInitials(name?: string | null, surname?: string | null, email?: string | null) {
  const first = name?.trim()?.[0] ?? ''
  const second = surname?.trim()?.[0] ?? ''
  const initials = `${first}${second}`.toUpperCase()
  if (initials) return initials
  const fallback = email?.trim()?.slice(0, 2).toUpperCase()
  return fallback || 'M'
}

function formatRole(role?: string | null) {
  const normalized = role?.trim()
  if (!normalized) return 'Venue Manager'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

function UserAvatar({
  size = 34,
  imageUrl,
  initials,
  roundedSquare = false,
}: {
  size?: number
  imageUrl?: string | null
  initials: string
  roundedSquare?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(imageUrl && !failed)
  const borderRadius = roundedSquare ? 10 : 999

  return (
    <div
      className="manager-dash__user-avatar"
      style={{ width: size, height: size, borderRadius }}
      aria-hidden
    >
      {showImage ? (
        <img
          src={imageUrl ?? ''}
          alt=""
          className="manager-dash__user-avatar-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="manager-dash__user-avatar-fallback">{initials}</span>
      )}
    </div>
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
    case 'reviews': return <IconStar />
    case 'staff': return <IconUsers />
    case 'disputes': return <IconAlert />
    case 'settings': return <IconGear />
    default: return <IconDashboard />
  }
}

export function ManagerSidebar() {
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [noShowBadgeCount, setNoShowBadgeCount] = useState(getNoShowBadgeCount)
  const initials = getInitials(profile?.name, profile?.surname, profile?.email)

  useEffect(() => {
    if (!profile?.id || !managerSupabase) {
      setAvatarUrl(null)
      return
    }

    let cancelled = false
    void managerSupabase
      .from('manager_profiles')
      .select('avatar_url')
      .eq('profile_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.id])

  useEffect(() => {
    function syncBadge() {
      setNoShowBadgeCount(getNoShowBadgeCount())
    }
    window.addEventListener(NO_SHOW_BADGE_EVENT, syncBadge)
    window.addEventListener('storage', syncBadge)
    return () => {
      window.removeEventListener(NO_SHOW_BADGE_EVENT, syncBadge)
      window.removeEventListener('storage', syncBadge)
    }
  }, [])

  function getActiveId(): ManagerNavId | null {
    if (pathname === '/manager/dashboard') return 'dashboard'
    if (pathname.startsWith('/manager/tables')) return 'tables'
    if (pathname.startsWith('/manager/club')) return 'club'
    if (pathname.startsWith('/manager/events')) return 'events'
    if (pathname.startsWith('/manager/reservations')) return 'reservations'
    if (pathname.startsWith('/manager/promotions')) return 'promotions'
    if (pathname.startsWith('/manager/analytics')) return 'analytics'
    if (pathname.startsWith('/manager/reviews')) return 'reviews'
    if (pathname.startsWith('/manager/staff-approval')) return 'staff'
    if (pathname.startsWith('/manager/disputes')) return 'disputes'
    if (pathname.startsWith('/manager/settings')) return 'settings'
    return null
  }

  const activeId = getActiveId()

  useEffect(() => {
    if (activeId !== 'reservations') return
    clearNoShowBadgeCount()
    setNoShowBadgeCount(0)
  }, [activeId])

  return (
    <aside className="manager-dash__sidebar" aria-label="Manager navigation">
      <div className="manager-dash__brand">
        <PartyOnLogo size="sm" showDiscoBall={false} className="manager-dash__brand-logo" />
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
              {item.id === 'reservations' && noShowBadgeCount > 0 ? (
                <span className="manager-dash__nav-badge" aria-label={`${noShowBadgeCount} no-show notifications`}>
                  {noShowBadgeCount > 9 ? '9+' : noShowBadgeCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="manager-dash__sidebar-user">
        <Link to="/manager/profile" className="manager-dash__sidebar-user-link" aria-label="Open profile">
          <UserAvatar size={40} imageUrl={avatarUrl} initials={initials} key={`sidebar-${avatarUrl ?? 'fallback'}`} />
          <div className="manager-dash__sidebar-user-meta">
            <p className="manager-dash__sidebar-user-name">
              {profile?.name ? `${profile.name} ${profile.surname ?? ''}`.trim() : 'Manager'}
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          title="Sign out"
          className="manager-dash__sidebar-logout"
          aria-label="Sign out"
        >
          <IconLogout />
        </button>
      </div>
    </aside>
  )
}

export function ManagerTopBar({ clubName }: { clubName?: string }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState(false)
  const [bellCount, setBellCount] = useState(getNoShowBadgeCount)
  const menuRef = useRef<HTMLDivElement>(null)
  const initials = useMemo(() => getInitials(profile?.name, profile?.surname, profile?.email), [profile?.name, profile?.surname, profile?.email])
  const fullName = profile?.name ? `${profile.name} ${profile.surname ?? ''}`.trim() : 'Manager'

  useEffect(() => {
    if (!profile?.id || !managerSupabase) {
      setAvatarUrl(null)
      return
    }

    let cancelled = false
    void managerSupabase
      .from('manager_profiles')
      .select('avatar_url')
      .eq('profile_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.id])

  useEffect(() => {
    function syncBell() { setBellCount(getNoShowBadgeCount()) }
    window.addEventListener(NO_SHOW_BADGE_EVENT, syncBell)
    window.addEventListener('storage', syncBell)
    return () => {
      window.removeEventListener(NO_SHOW_BADGE_EVENT, syncBell)
      window.removeEventListener('storage', syncBell)
    }
  }, [])

  useEffect(() => {
    if (!openMenu) return
    function handleMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openMenu])

  function handleBellClick() {
    navigate(bellCount > 0 ? '/manager/reservations' : '/manager/disputes')
  }

  return (
    <header className="manager-dash__topbar">
      <span className="manager-dash__club-name">{clubName ?? '—'}</span>

      <div className="manager-dash__topbar-actions">
        <button
          type="button"
          className="manager-dash__bell-btn"
          aria-label={bellCount > 0 ? `${bellCount} items need attention` : 'Go to disputes'}
          onClick={handleBellClick}
        >
          <IconBell />
          {bellCount > 0 && (
            <span className="manager-dash__bell-badge" aria-hidden>
              {bellCount > 9 ? '9+' : bellCount}
            </span>
          )}
        </button>

        <div className="manager-dash__profile-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="manager-dash__avatar-btn"
            aria-label="Open profile menu"
            onClick={() => setOpenMenu((prev) => !prev)}
          >
            <UserAvatar size={34} imageUrl={avatarUrl} initials={initials} key={`top-${avatarUrl ?? 'fallback'}`} />
          </button>

          {openMenu ? (
            <div className="manager-dash__profile-menu">
              <div className="manager-dash__profile-menu-head">
                <UserAvatar
                  size={44}
                  imageUrl={avatarUrl}
                  initials={initials}
                  roundedSquare
                  key={`menu-${avatarUrl ?? 'fallback'}`}
                />
                <div className="manager-dash__profile-menu-meta">
                  <p className="manager-dash__profile-menu-name">{fullName}</p>
                  <p className="manager-dash__profile-menu-role">{formatRole(profile?.role)}</p>
                  <p className="manager-dash__profile-menu-email">{profile?.email ?? ''}</p>
                </div>
              </div>

              <div className="manager-dash__profile-menu-line" />

              <Link to="/manager/profile" className="manager-dash__menu-item" onClick={() => setOpenMenu(false)}>
                <IconUserCircle />
                <span>View profile</span>
              </Link>

              <Link to="/manager/settings" className="manager-dash__menu-item" onClick={() => setOpenMenu(false)}>
                <IconSettings />
                <span>Account settings</span>
              </Link>

              <div className="manager-dash__profile-menu-line" />

              <button
                type="button"
                className="manager-dash__menu-item manager-dash__menu-item--danger"
                onClick={() => void signOut()}
              >
                <IconLogout />
                <span>Log out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
