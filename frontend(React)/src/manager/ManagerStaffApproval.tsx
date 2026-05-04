import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './ManagerDashboard.css'
import './ManagerStaffApproval.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import type { InviteStaffRole } from '../lib/staffRoles'

type StaffStatus = 'approved' | 'pending' | 'rejected'
type StaffFilter = 'all' | StaffStatus
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

const STAFF_ROLES = [
  'staff',
  'hostess',
  'security',
  'staff_manager',
  'pending_staff',
  'pending_hostess',
  'pending_security',
  'pending_staff_manager',
  'pending_manager',
  'staff_pending',
  'hostess_pending',
  'security_pending',
  'staff_manager_pending',
  'manager_pending',
  'rejected_staff',
  'rejected_hostess',
  'rejected_security',
  'rejected_staff_manager',
  'rejected_manager',
] as const

const ROLE_OPTIONS: { value: InviteRole; label: string; permissions: string }[] = [
  { value: 'hostess', label: 'Hostess', permissions: 'Hostess can view events and check in guests.' },
  { value: 'security', label: 'Security', permissions: 'Security can view event guest lists and verify entries at the door.' },
  { value: 'staff_manager', label: 'Manager', permissions: 'Manager can review staff activity and help manage venue operations.' },
]

const EMPTY_INVITE_FORM = {
  fullName: '',
  email: '',
  role: 'hostess' as InviteRole,
  message: '',
}

function roleStatus(role: string | null): StaffStatus {
  const normalized = (role ?? '').toLowerCase()
  if (normalized.includes('rejected')) return 'rejected'
  if (normalized.includes('pending')) return 'pending'
  return 'approved'
}

function statusLabel(status: StaffStatus) {
  if (status === 'approved') return 'Active'
  if (status === 'pending') return 'Pending'
  return 'Rejected'
}

function roleLabel(role: string | null) {
  const normalized = (role ?? 'staff').toLowerCase()
  if (normalized.includes('hostess')) return 'Hostess'
  if (normalized.includes('security')) return 'Security'
  if (normalized.includes('manager')) return 'Manager'
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />
        <div className="manager-dash__main staff-approval__main">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ManagerStaffApproval() {
  const { session } = useAuth()
  const { club, clubId } = useManagerClub()
  const hasLoadedStaffRef = useRef(false)
  const [staff, setStaff] = useState<ProfileRow[]>([])
  const [filter, setFilter] = useState<StaffFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteSuccessEmail, setInviteSuccessEmail] = useState<string | null>(null)
  const [inviteTemporaryPassword, setInviteTemporaryPassword] = useState<string | null>(null)
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null)

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

    void fetch('/api/staff', {
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
      .catch((err) => {
        if (isInitialLoad) {
          setError(err instanceof Error ? err.message : String(err))
        } else {
          setToast(err instanceof Error ? err.message : String(err))
        }
        setLoading(false)
      })
  }, [clubId, refreshKey, session?.access_token])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!session?.access_token) return
    const interval = window.setInterval(() => {
      setRefreshKey((key) => key + 1)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [session?.access_token])

  const stats = useMemo(() => {
    const approved = staff.filter((person) => roleStatus(person.role) === 'approved').length
    const pending = staff.filter((person) => roleStatus(person.role) === 'pending').length
    const rejected = staff.filter((person) => roleStatus(person.role) === 'rejected').length
    return { approved, pending, rejected, total: staff.length }
  }, [staff])

  const filteredStaff = useMemo(() => {
    if (filter === 'all') return staff
    return staff.filter((person) => roleStatus(person.role) === filter)
  }, [staff, filter])

  async function updateStaffRole(person: ProfileRow, nextRole: string, successMessage: string) {
    if (!session?.access_token) {
      setToast('You must be signed in as a manager to update staff.')
      return
    }

    const nextStatus = nextRole.startsWith('rejected_') ? 'rejected' : 'approved'
    const res = await fetch(`/api/staff/${person.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setToast(body?.message ?? `Could not update staff (${res.status}).`)
      return
    }

    const data = (await res.json()) as { profile: ProfileRow }
    setStaff((current) => current.map((row) => (row.id === person.id ? data.profile : row)))
    setToast(successMessage)
  }

  async function deleteStaffRequest(person: ProfileRow) {
    if (!session?.access_token) {
      setToast('You must be signed in as a manager to delete staff requests.')
      return
    }

    setDeletingStaffId(person.id)
    const res = await fetch(`/api/staff/${person.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setDeletingStaffId(null)

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setToast(body?.message ?? `Could not delete request (${res.status}).`)
      return
    }

    setStaff((current) => current.filter((row) => row.id !== person.id))
    setToast(`${fullName(person)} was removed.`)
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
    const fullName = inviteForm.fullName.trim()
    const email = inviteForm.email.trim().toLowerCase()

    if (!fullName) {
      setInviteError('Full name is required.')
      return
    }
    if (!email || !email.includes('@')) {
      setInviteError('A valid email address is required.')
      return
    }
    if (!session?.access_token) {
      setInviteError('You must be signed in as a manager to invite staff.')
      return
    }

    setIsSendingInvite(true)
    setInviteError(null)

    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fullName,
        email,
        role: inviteForm.role,
        message: inviteForm.message.trim(),
      }),
    })

    setIsSendingInvite(false)

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null)
      setInviteError(errorBody?.message ?? `Could not send invite (${res.status}).`)
      return
    }

    const data = (await res.json()) as { profile: ProfileRow; temporaryPassword?: string }
    const invitedProfile = data.profile
    setStaff((current) => [invitedProfile, ...current])
    setFilter('all')
    setInviteSuccessEmail(email)
    setInviteTemporaryPassword(data.temporaryPassword ?? null)
  }

  if (loading) {
    return <Shell><span style={{ color: '#8a8a8a' }}>Loading staff approvals...</span></Shell>
  }

  if (error) {
    return <Shell><span style={{ color: '#f87171' }}>Error: {error}</span></Shell>
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main staff-approval__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="staff-approval__bound">
            <header className="staff-approval__head">
              <div>
                <h1 className="manager-dash__page-title">Staff &amp; Hostess Approval</h1>
                <p className="manager-dash__page-sub">
                  Invite staff and track who has accepted access to your venue
                </p>
              </div>
              <button
                type="button"
                className="staff-approval__invite"
                onClick={() => setShowInviteModal(true)}
              >
                Invite Staff
              </button>
            </header>

            {toast && <div className="staff-approval__toast">{toast}</div>}

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
                        Share the temporary password below with <strong>{inviteSuccessEmail}</strong> (e.g. in person
                        or chat). They must set a new password when they first sign in.
                      </p>
                      {inviteTemporaryPassword ? (
                        <div className="staff-approval__field">
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
                      ) : null}
                      <button
                        type="button"
                        className="staff-approval__modal-btn staff-approval__modal-btn--cancel"
                        onClick={() => {
                          setShowInviteModal(false)
                          setInviteForm(EMPTY_INVITE_FORM)
                          setInviteSuccessEmail(null)
                          setInviteTemporaryPassword(null)
                          setRefreshKey((key) => key + 1)
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
                          <p>Send an invite and add them as pending until they accept.</p>
                        </div>
                        <button
                          type="button"
                          className="staff-approval__modal-close"
                          onClick={closeInviteModal}
                          aria-label="Close add staff modal"
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
                            onChange={(e) => setInviteForm((form) => ({ ...form, fullName: e.target.value }))}
                          />
                        </div>

                        <div className="staff-approval__field">
                          <label>Email Address</label>
                          <input
                            type="email"
                            value={inviteForm.email}
                            placeholder="name@example.com"
                            onChange={(e) => setInviteForm((form) => ({ ...form, email: e.target.value }))}
                          />
                        </div>

                        <div className="staff-approval__field">
                          <label>Role</label>
                          <select
                            value={inviteForm.role}
                            onChange={(e) => setInviteForm((form) => ({ ...form, role: e.target.value as InviteRole }))}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                          <p className="staff-approval__permission-preview">
                            {ROLE_OPTIONS.find((role) => role.value === inviteForm.role)?.permissions}
                          </p>
                        </div>

                        <div className="staff-approval__field">
                          <label>Personal Message <span>Optional</span></label>
                          <textarea
                            rows={4}
                            value={inviteForm.message}
                            placeholder="Add a short note to include in the invite email..."
                            onChange={(e) => setInviteForm((form) => ({ ...form, message: e.target.value }))}
                          />
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
                          {isSendingInvite ? 'Sending...' : 'Send Invite'}
                        </button>
                      </div>
                    </form>
                  )}
                </aside>
              </div>
            )}

            <section className="staff-approval__stats" aria-label="Staff approval stats">
              <article className="staff-approval__stat staff-approval__stat--approved">
                <span className="staff-approval__stat-dot" />
                <div>
                  <strong>{stats.approved}</strong>
                  <p>Active</p>
                </div>
              </article>
              <article className="staff-approval__stat staff-approval__stat--pending">
                <span className="staff-approval__stat-dot" />
                <div>
                  <strong>{stats.pending}</strong>
                  <p>Pending</p>
                </div>
              </article>
              <article className="staff-approval__stat staff-approval__stat--rejected">
                <span className="staff-approval__stat-dot" />
                <div>
                  <strong>{stats.rejected}</strong>
                  <p>Rejected</p>
                </div>
              </article>
              <article className="staff-approval__stat staff-approval__stat--total">
                <span className="staff-approval__stat-dot" />
                <div>
                  <strong>{stats.total}</strong>
                  <p>Total Staff</p>
                </div>
              </article>
            </section>

            <div className="staff-approval__tabs" role="tablist" aria-label="Staff approval filters">
              {[
                { id: 'all', label: `All (${stats.total})` },
                { id: 'approved', label: `Active (${stats.approved})` },
                { id: 'pending', label: `Pending (${stats.pending})` },
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

            <section className="staff-approval__list" aria-label="Staff approval list">
              {filteredStaff.length === 0 ? (
                <p className="staff-approval__empty">No staff profiles found for this filter.</p>
              ) : (
                filteredStaff.map((person) => {
                  const status = roleStatus(person.role)
                  return (
                    <article key={person.id} className="staff-approval__row">
                      <div className="staff-approval__avatar">{initials(person)}</div>
                      <div className="staff-approval__content">
                        <div className="staff-approval__person-head">
                          <h2>{fullName(person)}</h2>
                          <span className="staff-approval__role-pill">{roleLabel(person.role)}</span>
                          <span className={`staff-approval__status staff-approval__status--${status}`}>{statusLabel(status)}</span>
                        </div>

                        <div className="staff-approval__meta-grid">
                          <span><IconMail />{person.email ?? 'No email'}</span>
                          <span><IconPhone />{person.phone_number ?? 'No phone number'}</span>
                          <span><IconPin />{club?.club_name ?? 'Assigned club'}</span>
                          <span><IconClock />Joined {formatDate(person.created_at)}</span>
                        </div>
                      </div>

                      <div className="staff-approval__actions">
                        {status === 'rejected' ? (
                          <>
                            <button
                              type="button"
                              className="staff-approval__btn staff-approval__btn--ghost"
                              onClick={() => void updateStaffRole(person, approvedRoleForLabel(roleLabel(person.role)), 'Staff access restored.')}
                            >
                              Restore Access
                            </button>
                            <button
                              type="button"
                              className="staff-approval__btn staff-approval__btn--danger"
                              disabled={deletingStaffId === person.id}
                              onClick={() => void deleteStaffRequest(person)}
                            >
                              {deletingStaffId === person.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="staff-approval__btn staff-approval__btn--ghost"
                              onClick={() => void updateStaffRole(person, `rejected_${roleLabel(person.role).toLowerCase()}`, 'Staff access removed.')}
                            >
                              Remove Access
                            </button>
                            <button
                              type="button"
                              className="staff-approval__btn staff-approval__btn--danger"
                              disabled={deletingStaffId === person.id}
                              onClick={() => void deleteStaffRequest(person)}
                            >
                              {deletingStaffId === person.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
