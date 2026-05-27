import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

function isAdminRole(role: unknown): boolean {
  const normalized = String(role ?? '')
    .toLowerCase()
    .trim()
  return normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin'
}

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Spinner />

  if (!user) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (profile === null) return <Spinner />

  if (!isAdminRole(profile.role)) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
