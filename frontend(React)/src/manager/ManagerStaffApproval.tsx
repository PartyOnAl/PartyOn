import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import './ManagerDashboard.css'
import './ManagerStaffApproval.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import type { InviteStaffRole } from '../lib/staffRoles'
import { API_BASE_URL } from '../api'

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffToastVariant = 'access-removed' | 'access-restored' | 'error' | 'default'
type StaffToast = { message: string; variant: StaffToastVariant }
type StaffStatus = 'approved' | 'pending' | 'rejected'
type StaffFilter = 'all' | 'approved' | 'rejected'
type InviteRole = InviteStaffRole

type ProfileRow = {
  id: string
  name: string | null
  surname: string | null
  email: string | null
  phone_number: string | null
  role: string | null
  club_id: string | null
  created_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Manager role is intentionally excluded — staff can only be Hostess or Security. */
const ROLE_OPTIONS: { value: InviteRole; label: string; permissions: string }[] = [
  {
    value: 'hostess',
    label: 'Hostess',
    permissions: 'Can view events and check in guests at the door.',
  },
  {
    value: 'security',
    label: 'Security',
    permissions: 'Can view guest lists and verify entries at the door.',
  },
]

const EMPTY_INVITE_FORM = {
  fullName: '',
  email: '',
  role: 'hostess' as InviteRole,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleStatus(role: string | null): StaffStatus {
  const n = (role ?? '').toLowerCase()
  if (n.includes('rejected')) return 'rejected'
  if (n.includes('pending')) return 'pending'
  return 'approved'
}

function statusLabel(status: StaffStatus) {
  if (status === 'approved') return 'Active'
  if (status === 'pending') return 'Pending'
  return 'Rejected'
}

function roleLabel(role: string | null) {
  const n = (role ?? 'staff').toLowerCase()
  if (n.includes('hostess')) return 'Hostess'
  if (n.includes('security')) return 'Security'
  if (n.includes('manager')) return 'Manager'
  return 'Staff'
}

function approvedRoleForLabel(label: string) {
  return label === 'Manager' ? 'staff_manager' : label.toLowerCase()
}

function fullName(profile: ProfileRow) {
  const name = `${profile.name ?? ''} ${profile.surname ?? ''}`.trim()
  return name || profile.email || 'Unnamed staff member'
}

function initials(profile: ProfileRow) {
  const label = fullName(profile)
  return label
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(value: string | null) {
  if (!value) return 'No join date'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function avatarAccent(role: string | null) {
  const n = (role ?? '').toLowerCase()
  if (n.includes('hostess')) return 'pink'
  if (n.includes('security')) return 'blue'
  if (n.includes('manager')) return 'purple'
  return 'gray'
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconMail() {
  return (
    <svg className="staff-approval__meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6h16v12H4V6Zm0 2 8 5 8-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg className="staff-approval__meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg className="staff-approval__meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-5.2 7-12A7 7 0 0 0 5 9c0 6.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg className="staff-approval__meta-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconStatUserCheck() {
  return (
    <svg className="staff-approval__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 11 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconStatUserX() {
  return (
    <svg className="staff-approval__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="m17 9 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconStatUsers() {
  return (
    <svg className="staff-approval__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

// ─── Custom role dropdown (pink highlight) ────────────────────────────────────

function RoleSelect({ value, onChange }: { value: InviteRole; onChange: (v: InviteRole) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const selected = ROLE_OPTIONS.find((r) => r.value === value)

  return (
    <div className="staff-approval__role-select" ref={wrapRef}>
      <button
        type="button"
        className="staff-approval__role-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((o) => !o)}
      >
        <span>{selected?.label ?? 'Select role'}</span>
        <svg className="staff-approval__role-chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d={isOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <ul className="staff-approval__role-list" role="listbox" aria-label="Select role">
          {ROLE_OPTIONS.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              className={
                value === option.value
                  ? 'staff-approval__role-option staff-approval__role-option--selected'
                  : 'staff-approval__role-option'
              }
              onMouseDown={() => {
                onChange(option.value as InviteRole)
                setIsOpen(false)
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />
        <div className="manager-dash__main staff-approval__main">{children}</div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManagerStaffApproval() {
  const { session } = useAuth()
  const { club, clubId } = useManagerClub()
  const hasLoadedStaffRef = useRef(false)
  const [staff, setStaff] = useState<ProfileRow[]>([])
  const [filter, setFilter] = useState<StaffFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<StaffToast | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteSuccessEmail, setInviteSuccessEmail] = useState<string | null>(null)
  const [inviteTemporaryPassword, setInviteTemporaryPassword] = useState<string | null>(null)
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null)
  const [accessConfirm, setAccessConfirm] = useState<
    null | { kind: 'remove' | 'restore'; person: ProfileRow }
  >(null)
  const [accessConfirmBusy, setAccessConfirmBusy] = useState(false)

  // ── Fetch all staff from DB via backend API ──────────────────────────────────
  useEffect(() => {
    if (!clubId || !session?.access_token) {
      setLoading(false)
      return
    }

    const isInitialLoad = !hasLoadedStaffRef.current
    if (isInitialLoad) {
      setLoading(true)
      setError(null)
    }

    void fetch(`${API_BASE_URL}/staff`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.message ?? `Could not fetch staff (${res.status}).`)
        }
        return res.json() as Promise<{ staff: ProfileRow[] }>
      })
      .then(({ staff: rows }) => {
        hasLoadedStaffRef.current = true
        setStaff(rows)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (isInitialLoad) {
          setError(err instanceof Error ? err.message : String(err))
        } else {
          setToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
        }
        setLoading(false)
      })
  }, [clubId, refreshKey, session?.access_token])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!session?.access_token) return
    const interval = window.setInterval(() => setRefreshKey((k) => k + 1), 30_000)
    return () => window.clearInterval(interval)
  }, [session?.access_token])

  // ── Derived stats (no Pending card) ─────────────────────────────────────────
  const stats = useMemo(() => {
    const approved = staff.filter((p) => roleStatus(p.role) === 'approved').length
    const rejected = staff.filter((p) => roleStatus(p.role) === 'rejected').length
    return { approved, rejected, total: staff.length }
  }, [staff])

  const filteredStaff = useMemo(() => {
    if (filter === 'approved') return staff.filter((p) => roleStatus(p.role) === 'approved')
    if (filter === 'rejected') return staff.filter((p) => roleStatus(p.role) === 'rejected')
    return staff
  }, [staff, filter])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function updateStaffRole(
    person: ProfileRow,
    nextRole: string,
    successToast: 'remove' | 'restore' | null = null,
  ): Promise<boolean> {
    if (!session?.access_token) {
      setToast({ variant: 'error', message: 'You must be signed in as a manager to update staff.' })
      return false
    }

    const nextStatus = nextRole.startsWith('rejected_') ? 'rejected' : 'approved'
    const res = await fetch(`${API_BASE_URL}/staff/${person.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setToast({ variant: 'error', message: body?.message ?? `Could not update staff (${res.status}).` })
      return false
    }

    const data = (await res.json()) as { profile: ProfileRow }
    setStaff((current) => current.map((row) => (row.id === person.id ? data.profile : row)))
    const name = fullName(person)
    if (successToast === 'remove') setToast({ variant: 'access-removed', message: `Access removed for ${name}` })
    else if (successToast === 'restore') setToast({ variant: 'access-restored', message: `Access restored for ${name}` })
    return true
  }

  async function executeAccessConfirm() {
    if (!accessConfirm || !session?.access_token) return
    const { kind, person } = accessConfirm
    const nextRole =
      kind === 'remove'
        ? `rejected_${roleLabel(person.role).toLowerCase()}`
        : approvedRoleForLabel(roleLabel(person.role))
    setAccessConfirmBusy(true)
    try {
      const ok = await updateStaffRole(person, nextRole, kind === 'remove' ? 'remove' : 'restore')
      if (ok) setAccessConfirm(null)
    } finally {
      setAccessConfirmBusy(false)
    }
  }

  async function deleteStaffRequest(person: ProfileRow) {
    if (!session?.access_token) {
      setToast({ variant: 'error', message: 'You must be signed in as a manager to delete staff.' })
      return
    }
    setDeletingStaffId(person.id)
    const res = await fetch(`${API_BASE_URL}/staff/${person.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setDeletingStaffId(null)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setToast({ variant: 'error', message: body?.message ?? `Could not delete (${res.status}).` })
      return
    }
    setStaff((current) => current.filter((row) => row.id !== person.id))
    setToast({ variant: 'default', message: `${fullName(person)} was removed.` })
  }

  function closeInviteModal() {
    if (isSendingInvite) return
    setShowInviteModal(false)
    setInviteForm(EMPTY_INVITE_FORM)
    setInviteError(null)
    setInviteSuccessEmail(null)
    setInviteTemporaryPassword(null)
  }

  async function handleSendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = inviteForm.fullName.trim()
    const email = inviteForm.email.trim().toLowerCase()
    if (!name) { setInviteError('Full name is required.'); return }
    if (!email || !email.includes('@')) { setInviteError('A valid email address is required.'); return }
    if (!session?.access_token) { setInviteError('You must be signed in as a manager to invite staff.'); return }

    setIsSendingInvite(true)
    setInviteError(null)

    const res = await fetch(`${API_BASE_URL}/staff/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ fullName: name, email, role: inviteForm.role }),
    })
    setIsSendingInvite(false)

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null)
      setInviteError(errorBody?.message ?? `Could not send invite (${res.status}).`)
      return
    }

    const data = (await res.json()) as { profile: ProfileRow; temporaryPassword?: string }
    setStaff((current) => [data.profile, ...current])
    setFilter('all')
    setInviteSuccessEmail(email)
    setInviteTemporaryPassword(data.temporaryPassword ?? null)
  }

  // ── Loading / Error ───────────────────────────────────────────────────────────

  if (loading) return <Shell><span style={{ color: '#8a8a8a' }}>Loading staff...</span></Shell>
  if (error) return <Shell><span style={{ color: '#f87171' }}>Error: {error}</span></Shell>

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main staff-approval__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="staff-approval__bound">

            {/* ── Page header ──────────────────────────────────────── */}
            <header className="staff-approval__head">
              <div>
                <h1 className="manager-dash__page-title">Staff Management</h1>
                <p className="manager-dash__page-sub">Manage your team and control venue access</p>
              </div>
              <button
                type="button"
                className="staff-approval__invite"
                onClick={() => setShowInviteModal(true)}
              >
                <IconPlus />
                Invite Staff
              </button>
            </header>

            {/* ── Invite modal ─────────────────────────────────────── */}
            {showInviteModal && (
              <div className="staff-approval__modal-overlay" role="presentation" onClick={closeInviteModal}>
                <aside
                  className="staff-approval__modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Add staff member"
                  onClick={(e) => e.stopPropagation()}
                >
                  {inviteSuccessEmail ? (
                    <div className="staff-approval__invite-success">
                      <span className="staff-approval__success-icon" aria-hidden>✓</span>
                      <h2>Account created</h2>
                      <p>
                        Share the temporary password below with <strong>{inviteSuccessEmail}</strong>. They must set a new
                        password when they first sign in.
                      </p>
                      {inviteTemporaryPassword && (
                        <div className="staff-approval__field" style={{ width: '100%' }}>
                          <label>Temporary password</label>
                          <input
                            type="text"
                            readOnly
                            value={inviteTemporaryPassword}
                            aria-label="Temporary password"
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            className="staff-approval__modal-btn staff-approval__modal-btn--send"
                            onClick={() => void navigator.clipboard.writeText(inviteTemporaryPassword)}
                          >
                            Copy password
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="staff-approval__modal-btn staff-approval__modal-btn--cancel"
                        onClick={() => {
                          setShowInviteModal(false)
                          setInviteForm(EMPTY_INVITE_FORM)
                          setInviteSuccessEmail(null)
                          setInviteTemporaryPassword(null)
                          setRefreshKey((k) => k + 1)
                        }}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendInvite}>
                      <div className="staff-approval__modal-head">
                        <div>
                          <h2>Add Staff Member</h2>
                          <p>Create an account and share the temporary password with them.</p>
                        </div>
                        <button
                          type="button"
                          className="staff-approval__modal-close"
                          onClick={closeInviteModal}
                          aria-label="Close modal"
                        >
                          ×
                        </button>
                      </div>

                      <div className="staff-approval__modal-body">
                        <div className="staff-approval__field">
                          <label>Full Name</label>
                          <input
                            type="text"
                            value={inviteForm.fullName}
                            placeholder="e.g. Emma Laurent"
                            onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))}
                          />
                        </div>

                        <div className="staff-approval__field">
                          <label>Email Address</label>
                          <input
                            type="email"
                            value={inviteForm.email}
                            placeholder="name@example.com"
                            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </div>

                        <div className="staff-approval__field">
                          <label>Role</label>
                          <RoleSelect
                            value={inviteForm.role}
                            onChange={(role) => setInviteForm((f) => ({ ...f, role }))}
                          />
                          <p className="staff-approval__permission-preview">
                            {ROLE_OPTIONS.find((r) => r.value === inviteForm.role)?.permissions}
                          </p>
                        </div>

                        {inviteError && <p className="staff-approval__modal-error">{inviteError}</p>}
                      </div>

                      <div className="staff-approval__modal-footer">
                        <button
                          type="button"
                          className="staff-approval__modal-btn staff-approval__modal-btn--cancel"
                          onClick={closeInviteModal}
                          disabled={isSendingInvite}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="staff-approval__modal-btn staff-approval__modal-btn--send"
                          disabled={isSendingInvite}
                        >
                          {isSendingInvite ? 'Creating...' : 'Add Staff Member'}
                        </button>
                      </div>
                    </form>
                  )}
                </aside>
              </div>
            )}

            {/* ── Stat cards (3 only — no Pending) ────────────────── */}
            <section className="staff-approval__stats" aria-label="Staff statistics">
              {[
                { label: 'Active Staff',  value: stats.approved, accent: 'green',  icon: <IconStatUserCheck /> },
                { label: 'Rejected',      value: stats.rejected,  accent: 'red',    icon: <IconStatUserX /> },
                { label: 'Total Staff',   value: stats.total,     accent: 'purple', icon: <IconStatUsers /> },
              ].map((stat) => (
                <article key={stat.label} className={`staff-approval__stat staff-approval__stat--${stat.accent}`}>
                  <div className="staff-approval__stat-body">
                    <p className="staff-approval__stat-value">{stat.value}</p>
                    <p className="staff-approval__stat-label">{stat.label}</p>
                  </div>
                  <span className={`staff-approval__stat-icon staff-approval__stat-icon--${stat.accent}`} aria-hidden>
                    {stat.icon}
                  </span>
                </article>
              ))}
            </section>

            {/* ── Filter tabs (no Pending) ─────────────────────────── */}
            <div className="staff-approval__tabs" role="tablist" aria-label="Filter staff">
              {[
                { id: 'all',      label: `All (${stats.total})` },
                { id: 'approved', label: `Active (${stats.approved})` },
                { id: 'rejected', label: `Rejected (${stats.rejected})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  className={filter === tab.id ? 'staff-approval__tab staff-approval__tab--active' : 'staff-approval__tab'}
                  onClick={() => setFilter(tab.id as StaffFilter)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Staff card list ──────────────────────────────────── */}
            <section className="staff-approval__list" aria-label="Staff list">
              {filteredStaff.length === 0 ? (
                <p className="staff-approval__empty">No staff found for this filter.</p>
              ) : (
                filteredStaff.map((person) => {
                  const status = roleStatus(person.role)
                  const accent = avatarAccent(person.role)
                  return (
                    <article
                      key={person.id}
                      className={`staff-approval__card staff-approval__card--${status}`}
                    >
                      {/* Avatar */}
                      <div className={`staff-approval__avatar staff-approval__avatar--${accent}`}>
                        {initials(person)}
                      </div>

                      {/* Main content */}
                      <div className="staff-approval__content">
                        <div className="staff-approval__person-head">
                          <h2>{fullName(person)}</h2>
                          <span className={`staff-approval__role-badge staff-approval__role-badge--${accent}`}>
                            {roleLabel(person.role)}
                          </span>
                          <span className={`staff-approval__status-badge staff-approval__status-badge--${status}`}>
                            {statusLabel(status)}
                          </span>
                        </div>

                        <div className="staff-approval__meta-grid">
                          <span><IconMail />{person.email ?? 'No email'}</span>
                          <span><IconPhone />{person.phone_number ?? 'No phone number'}</span>
                          <span><IconPin />{club?.club_name ?? 'Assigned club'}</span>
                          <span><IconClock />Joined {formatDate(person.created_at)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="staff-approval__actions">
                        {status === 'rejected' ? (
                          <button
                            type="button"
                            className="staff-approval__btn staff-approval__btn--restore"
                            onClick={() => setAccessConfirm({ kind: 'restore', person })}
                          >
                            Restore Access
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="staff-approval__btn staff-approval__btn--ghost"
                            onClick={() => setAccessConfirm({ kind: 'remove', person })}
                          >
                            Remove Access
                          </button>
                        )}
                        <button
                          type="button"
                          className="staff-approval__btn staff-approval__btn--danger"
                          disabled={deletingStaffId === person.id}
                          onClick={() => void deleteStaffRequest(person)}
                        >
                          {deletingStaffId === person.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ── Access confirm dialog ─────────────────────────────────── */}
      {accessConfirm && (
        <div
          className="staff-approval__access-confirm-backdrop"
          role="presentation"
          onClick={() => !accessConfirmBusy && setAccessConfirm(null)}
        >
          <div
            className="staff-approval__access-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-access-confirm-title"
            aria-describedby="staff-access-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={
                accessConfirm.kind === 'remove'
                  ? 'staff-approval__access-confirm-icon staff-approval__access-confirm-icon--remove'
                  : 'staff-approval__access-confirm-icon staff-approval__access-confirm-icon--restore'
              }
              aria-hidden
            >
              {accessConfirm.kind === 'remove' ? (
                <UserMinus className="staff-approval__access-confirm-lucide" strokeWidth={2} />
              ) : (
                <UserPlus className="staff-approval__access-confirm-lucide" strokeWidth={2} />
              )}
            </div>
            <h2 id="staff-access-confirm-title" className="staff-approval__access-confirm-title">
              {accessConfirm.kind === 'remove' ? 'Remove Staff Access' : 'Restore Staff Access'}
            </h2>
            <p id="staff-access-confirm-desc" className="staff-approval__access-confirm-message">
              {accessConfirm.kind === 'remove' ? (
                <>
                  Are you sure you want to remove access for{' '}
                  <strong>{fullName(accessConfirm.person)}</strong>? They will no longer be able to access
                  the venue dashboard.
                </>
              ) : (
                <>
                  Are you sure you want to restore access for{' '}
                  <strong>{fullName(accessConfirm.person)}</strong>? They will regain access to the venue
                  dashboard.
                </>
              )}
            </p>
            <div className="staff-approval__access-confirm-actions">
              <button
                type="button"
                className="staff-approval__access-confirm-btn staff-approval__access-confirm-btn--cancel"
                disabled={accessConfirmBusy}
                onClick={() => setAccessConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  accessConfirm.kind === 'remove'
                    ? 'staff-approval__access-confirm-btn staff-approval__access-confirm-btn--remove'
                    : 'staff-approval__access-confirm-btn staff-approval__access-confirm-btn--restore'
                }
                disabled={accessConfirmBusy}
                onClick={() => void executeAccessConfirm()}
              >
                {accessConfirmBusy
                  ? 'Please wait…'
                  : accessConfirm.kind === 'remove'
                    ? 'Remove Access'
                    : 'Restore Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`staff-approval__toast-float staff-approval__toast-float--${toast.variant}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
