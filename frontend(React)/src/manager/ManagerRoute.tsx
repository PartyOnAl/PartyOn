import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isManagerRole, resolveAccountRole } from '../lib/accountRoles'

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
    Loading…
  </div>
)

export default function ManagerRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth()
  const location = useLocation()
  const roleHint = (location.state as { managerRole?: string } | null)?.managerRole

  if (isLoading) return <Spinner />

  if (!user) {
    return (
      <Navigate
        to={`/login?from=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  const role = resolveAccountRole(user, profile, roleHint)
  if (!isManagerRole(role)) {
    return (
      <Navigate
        to={`/login?from=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  return <>{children}</>
}
