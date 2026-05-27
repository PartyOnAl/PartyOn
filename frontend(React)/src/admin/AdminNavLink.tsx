import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

type AdminNavLinkProps = {
  to: string
  className?: string
  activeClassName?: string
  onNavigate?: () => void
  children: ReactNode
}

/** SPA navigation — avoids full reloads that reset Supabase manager auth. */
export default function AdminNavLink({
  to,
  className = '',
  activeClassName = '',
  onNavigate,
  children,
}: AdminNavLinkProps) {
  const location = useLocation()
  const isActive =
    to !== '#' &&
    (location.pathname === to || location.pathname.startsWith(`${to}/`))

  return (
    <Link
      to={to}
      className={`${className}${isActive ? activeClassName : ''}`}
      onClick={onNavigate}
    >
      {children}
    </Link>
  )
}
