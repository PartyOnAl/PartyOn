import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAdminRole, resolveAccountRole } from '../lib/accountRoles'
import { ADMIN_ROLE_HINT_KEY } from '../lib/authSession'

const Spinner = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#000',
      color: '#8a8a8a',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '0.9375rem',
    }}
  >
    Loading...
  </div>
)

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, session, profile, isLoading } = useAuth()
  const location = useLocation()
  const roleHint =
    (location.state as { adminRole?: string } | null)?.adminRole ??
    sessionStorage.getItem(ADMIN_ROLE_HINT_KEY)

  const role = isAdminRole(roleHint)
    ? roleHint
    : resolveAccountRole(user, profile, roleHint)

  useEffect(() => {
    if (user && profile && isAdminRole(profile.role)) {
      sessionStorage.removeItem(ADMIN_ROLE_HINT_KEY)
    }
  }, [user, profile])

  if (isLoading) return <Spinner />

  if (!user && !session) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (!isAdminRole(role)) {
    return (
      <Navigate
        to={`/login?from=${encodeURIComponent(location.pathname)}`}
        replace
        state={{ adminAccessDenied: true }}
      />
    )
  }

  return <>{children}</>
}
