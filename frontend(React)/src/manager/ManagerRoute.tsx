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
    Loading…
  </div>
)

export default function ManagerRoute({ children }: { children: ReactNode }) {
  const { user, profile, isLoading } = useAuth()
  const location = useLocation()

  // Still resolving the initial session from storage
  if (isLoading) return <Spinner />

  // No session at all → send to login
  if (!user) {
    return (
      <Navigate
        to={`/login?from=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  // User is authenticated but the profile hasn't arrived from Supabase yet.
  // This happens right after login: onAuthStateChange fires and sets `user`
  // synchronously, but the profile SELECT is still in-flight. We must wait
  // here instead of reading profile===null as "not a manager".
  if (profile === null) return <Spinner />

  // Profile loaded — enforce manager role
  if (String(profile.role ?? '').toLowerCase().trim() !== 'manager') {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
