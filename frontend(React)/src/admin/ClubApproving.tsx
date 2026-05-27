import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  createAdminClub,
  deleteAdminClub,
  fetchAdminClubs,
  updateAdminClubStatus,
  type AdminClub,
  type AdminClubsData,
} from './adminApi'
import './ClubApproving.css'

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
  { id: 'clubs', label: 'Club Approvals', href: '/admin/club-approvals', active: true },
  { id: 'users', label: 'User Management', href: '/admin/user-management' },
  { id: 'revenue', label: 'Revenue & Payments', href: '/admin/revenue-payments' },
  { id: 'featured', label: 'Featured Events', href: '#' },
  { id: 'analysis', label: 'Platform Analytics', href: '#' },
  { id: 'settings', label: 'Settings', href: '#' },
]

type TabFilter = 'pending' | 'approved' | 'rejected' | 'suspended' | 'all'

type StatCard = {
  id: 'pending' | 'approved' | 'rejected' | 'suspended' | 'total'
  label: string
  value: string
  tone: 'pending' | 'approved' | 'rejected' | 'suspended' | 'neutral'
}

type Tab = { id: TabFilter; label: string; count: number }
type ConfirmKind = 'revoke' | 'suspend' | 'reinstate'
type ConfirmAction = { kind: ConfirmKind; club: AdminClub }

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

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
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

function IconMapPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.11a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function IconLicense() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" strokeLinecap="round" />
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

const STAT_ICONS: Record<StatCard['tone'], ReactNode> = {
  pending: <IconClock />,
  approved: <IconCheck />,
  rejected: <IconX />,
  suspended: <IconClock />,
  neutral: <IconBuilding />,
}

function matchesFilter(club: AdminClub, tab: TabFilter): boolean {
  if (tab === 'all') return true
  return club.status === tab
}

export default function ClubApproving() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [data, setData] = useState<AdminClubsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addClubOpen, setAddClubOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<AdminClub | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [newClubName, setNewClubName] = useState('')
  const [newClubEmail, setNewClubEmail] = useState('')
  const [newClubAddress, setNewClubAddress] = useState('')
  const [newClubPhone, setNewClubPhone] = useState('')
  const [newClubDescription, setNewClubDescription] = useState('')
  const [formErrors, setFormErrors] = useState<{
    name?: string
    email?: string
    address?: string
  }>({})
  const [addClubError, setAddClubError] = useState<string | null>(null)
  const [addingClub, setAddingClub] = useState(false)
  const { session } = useAuth()
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

  const loadClubs = useCallback(async () => {
    const token = session?.access_token
    if (!token) return
    setLoading(true)
    setError(null)
    const result = await fetchAdminClubs(token)
    if (result.error) {
      setError(result.error)
      setData(null)
    } else {
      setData(result.data)
    }
    setLoading(false)
  }, [session?.access_token])

  useEffect(() => {
    void loadClubs()
  }, [loadClubs])

  const setClubStatus = async (clubId: string, status: AdminClub['status']) => {
    const token = session?.access_token
    if (!token) return false
    const result = await updateAdminClubStatus(token, clubId, status)
    if (result.error) {
      setError(result.error)
      return false
    }
    await loadClubs()
    return true
  }

  const resetAddClubForm = useCallback(() => {
    setNewClubName('')
    setNewClubEmail('')
    setNewClubAddress('')
    setNewClubPhone('')
    setNewClubDescription('')
    setFormErrors({})
    setAddClubError(null)
  }, [])

  const closeAddClubModal = useCallback(() => {
    setAddClubOpen(false)
    resetAddClubForm()
  }, [resetAddClubForm])

  const submitAddClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = session?.access_token
    if (!token) return

    const payload = {
      name: newClubName.trim(),
      email: newClubEmail.trim(),
      address: newClubAddress.trim(),
      phone: newClubPhone.trim(),
      description: newClubDescription.trim() || undefined,
    }

    const errors: { name?: string; email?: string; address?: string } = {}
    if (!payload.name) errors.name = 'Club name is required.'
    if (!payload.email) errors.email = 'Email is required.'
    if (!payload.address) errors.address = 'Address is required.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }

    setAddingClub(true)
    setAddClubError(null)
    const result = await createAdminClub(token, payload)
    setAddingClub(false)

    if (result.error) {
      setAddClubError(result.error)
      return
    }

    closeAddClubModal()
    setActiveTab('all')
    await loadClubs()
  }

  const closeDetailsModal = useCallback(() => setSelectedClub(null), [])

  const handleDetailStatus = async (status: AdminClub['status']) => {
    if (!selectedClub) return
    const didUpdate = await setClubStatus(selectedClub.id, status)
    if (didUpdate) {
      closeDetailsModal()
    }
  }

  const performDeleteClub = async (club: AdminClub) => {
    const token = session?.access_token
    if (!token) return
    const result = await deleteAdminClub(token, club.id)
    if (result.error) {
      setError(result.error)
      return
    }
    if (selectedClub?.id === club.id) {
      closeDetailsModal()
    }
    await loadClubs()
  }

  const performRevokeClub = async (club: AdminClub) => {
    await performDeleteClub(club)
  }

  const performSuspendClub = async (club: AdminClub) => {
    await setClubStatus(club.id, 'suspended')
    if (selectedClub?.id === club.id) closeDetailsModal()
  }

  const performReinstateClub = async (club: AdminClub) => {
    await setClubStatus(club.id, 'approved')
    if (selectedClub?.id === club.id) closeDetailsModal()
  }

  const askForConfirmation = (kind: ConfirmKind, club: AdminClub) => {
    setConfirmAction({ kind, club })
  }

  const closeConfirmModal = useCallback(() => {
    if (confirmBusy) return
    setConfirmAction(null)
  }, [confirmBusy])

  const confirmMessage = confirmAction
    ? confirmAction.kind === 'revoke'
      ? `Revoke ${confirmAction.club.name}? This permanently removes the club from the platform and cannot be undone.`
      : confirmAction.kind === 'suspend'
        ? `Suspend ${confirmAction.club.name}? They will lose access to the platform until reinstated.`
        : `Reinstate ${confirmAction.club.name} and restore platform access?`
    : ''

  const confirmTitle = confirmAction
    ? confirmAction.kind === 'revoke'
      ? 'Revoke Club'
      : confirmAction.kind === 'suspend'
        ? 'Suspend Club'
        : 'Reinstate Club'
    : ''

  const confirmButtonLabel = confirmAction
    ? confirmAction.kind === 'revoke'
      ? 'Revoke Club'
      : confirmAction.kind === 'suspend'
        ? 'Suspend Club'
        : 'Reinstate Club'
    : 'Confirm'

  const confirmButtonClass = confirmAction
    ? confirmAction.kind === 'revoke'
      ? 'cap__btn cap__btn--revoke'
      : confirmAction.kind === 'suspend'
        ? 'cap__btn cap__btn--suspend'
        : 'cap__btn cap__btn--reinstate'
    : 'cap__btn cap__btn--ghost'

  const runConfirmedAction = async () => {
    if (!confirmAction) return
    setConfirmBusy(true)
    if (confirmAction.kind === 'revoke') {
      await performRevokeClub(confirmAction.club)
    } else if (confirmAction.kind === 'suspend') {
      await performSuspendClub(confirmAction.club)
    } else {
      await performReinstateClub(confirmAction.club)
    }
    setConfirmBusy(false)
    setConfirmAction(null)
  }

  const stats: StatCard[] = data
    ? [
        { id: 'pending', label: 'Pending Review', value: String(data.stats.pending), tone: 'pending' },
        { id: 'approved', label: 'Approved', value: String(data.stats.approved), tone: 'approved' },
        { id: 'rejected', label: 'Rejected', value: String(data.stats.rejected), tone: 'rejected' },
        { id: 'suspended', label: 'Suspended', value: String(data.stats.suspended), tone: 'suspended' },
        { id: 'total', label: 'Total Applications', value: String(data.stats.total), tone: 'neutral' },
      ]
    : []

  const tabs: Tab[] = data
    ? [
        { id: 'pending', label: 'Pending', count: data.stats.pending },
        { id: 'approved', label: 'Approved', count: data.stats.approved },
        { id: 'rejected', label: 'Rejected', count: data.stats.rejected },
        { id: 'suspended', label: 'Suspended', count: data.stats.suspended },
        { id: 'all', label: 'All', count: data.stats.total },
      ]
    : []

  const visibleClubs = (data?.clubs ?? []).filter((c) => matchesFilter(c, activeTab))

  const renderStatusActions = (club: AdminClub) => {
    if (club.status === 'pending') {
      return (
        <>
          <button
            type="button"
            className="cap__btn cap__btn--approve"
            title="Approve Club"
            data-tooltip="Approve Club"
            onClick={() => void setClubStatus(club.id, 'approved')}
          >
            Approve
          </button>
          <button
            type="button"
            className="cap__btn cap__btn--reject"
            title="Reject Club"
            data-tooltip="Reject Club"
            onClick={() => void setClubStatus(club.id, 'rejected')}
          >
            Reject
          </button>
        </>
      )
    }

    if (club.status === 'approved') {
      return (
        <>
          <button
            type="button"
            className="cap__btn cap__btn--suspend"
            title="Suspend Club"
            data-tooltip="Suspend Club"
            onClick={() => askForConfirmation('suspend', club)}
          >
            Suspend
          </button>
          <button
            type="button"
            className="cap__btn cap__btn--revoke"
            title="Revoke Club"
            data-tooltip="Revoke Club"
            onClick={() => askForConfirmation('revoke', club)}
          >
            Revoke
          </button>
        </>
      )
    }

    if (club.status === 'rejected') {
      return (
        <button
          type="button"
          className="cap__btn cap__btn--approve"
          title="Approve Club"
          data-tooltip="Approve Club"
          onClick={() => void setClubStatus(club.id, 'approved')}
        >
          Approve
        </button>
      )
    }

    if (club.status === 'suspended') {
      return (
        <>
          <button
            type="button"
            className="cap__btn cap__btn--reinstate"
            title="Reinstate Club"
            data-tooltip="Reinstate Club"
            onClick={() => askForConfirmation('reinstate', club)}
          >
            Reinstate
          </button>
          <button
            type="button"
            className="cap__btn cap__btn--revoke"
            title="Revoke Club"
            data-tooltip="Revoke Club"
            onClick={() => askForConfirmation('revoke', club)}
          >
            Revoke
          </button>
        </>
      )
    }

    return null
  }

  return (
    <div className="cap">
      {sidebarOpen ? (
        <button
          type="button"
          className="cap__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}
      {addClubOpen || selectedClub || confirmAction ? (
        <button
          type="button"
          className="cap__modal-backdrop"
          aria-label="Close modal"
          onClick={confirmAction ? closeConfirmModal : addClubOpen ? closeAddClubModal : closeDetailsModal}
        />
      ) : null}

      <aside
        className={`cap__sidebar${sidebarOpen ? ' cap__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="cap__sidebar-scroll">
          <div className="cap__brand">
            <span className="cap__brand-title">PartyOn</span>
            <span className="cap__brand-sub">Platform Admin</span>
          </div>

          <nav className="cap__nav">
            {NAV.map((item) => (
              <a
                key={item.id}
                className={`cap__nav-link${item.active ? ' cap__nav-link--active' : ''}`}
                href={item.href}
                onClick={closeSidebar}
              >
                <span className="cap__nav-icon" aria-hidden>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="cap__user">
          <div className="cap__avatar" aria-hidden>
            <IconShield />
          </div>
          <div className="cap__user-text">
            <span className="cap__user-name">Super Admin</span>
            <span className="cap__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="cap__main">
        <header className="cap__topbar">
          <button
            type="button"
            className="cap__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="cap__menu-btn-text">Menu</span>
          </button>
          <span className="cap__topbar-title">PartyOn Platform</span>
          <button type="button" className="cap__icon-btn" aria-label="Account">
            <IconShield />
          </button>
        </header>

        <main className="cap__content">
          <header className="cap__page-head">
            <div className="cap__page-head-top">
              <h1 className="cap__h1">Club Approving</h1>
              <button type="button" className="cap__add-btn" onClick={() => setAddClubOpen(true)}>
                + Add Club
              </button>
            </div>
            <p className="cap__sub">Review and approve clubs before they can operate on the platform</p>
          </header>

          {loading ? <p className="cap__empty">Loading club applications...</p> : null}
          {error ? <p className="cap__empty">{error}</p> : null}

          <section className="cap__stat-row" aria-label="Application stats">
            {stats.map((s) => (
              <article key={s.id} className={`cap__card cap__stat cap__stat--${s.tone}`}>
                <span className={`cap__stat-icon cap__stat-icon--${s.tone}`} aria-hidden>
                  {STAT_ICONS[s.tone]}
                </span>
                <p className="cap__stat-value">{s.value}</p>
                <h2 className="cap__stat-label">{s.label}</h2>
              </article>
            ))}
          </section>

          <div className="cap__tabs" role="tablist" aria-label="Filter applications">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`cap__tab${activeTab === t.id ? ' cap__tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {visibleClubs.length > 0 ? (
            <ul className="cap__club-list">
              {visibleClubs.map((club) => (
                <li key={club.id}>
                  <article className="cap__card cap__club">
                    <header className="cap__club-head">
                      <div className="cap__club-title-block">
                        <span className="cap__club-logo" aria-hidden>
                          <IconBuilding />
                        </span>
                        <div>
                          <h2 className="cap__club-name">{club.name}</h2>
                          <span className={`cap__badge cap__badge--${club.status}`}>{club.status}</span>
                        </div>
                      </div>
                      <div className="cap__club-actions">
                        <button
                          type="button"
                          className="cap__btn cap__btn--ghost"
                          title="View Details"
                          data-tooltip="View Details"
                          onClick={() => setSelectedClub(club)}
                        >
                          <IconEye />
                          View Details
                        </button>
                        {renderStatusActions(club)}
                      </div>
                    </header>

                    <div className="cap__club-grid">
                      <div className="cap__club-col">
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconMapPin />
                          </span>
                          {club.location}
                        </p>
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconPhone />
                          </span>
                          {club.phone}
                        </p>
                        <p className="cap__club-desc">{club.description}</p>
                      </div>
                      <div className="cap__club-col">
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconMail />
                          </span>
                          {club.email}
                        </p>
                        <p className="cap__detail">
                          <span className="cap__detail-icon" aria-hidden>
                            <IconLicense />
                          </span>
                          {club.license}
                        </p>
                      </div>
                    </div>

                    <footer className="cap__club-footer">
                      Contact: {club.contact} · Applied: {club.applied}
                    </footer>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cap__empty">No clubs in this filter.</p>
          )}

          {addClubOpen ? (
            <section className="cap__modal" role="dialog" aria-modal="true" aria-labelledby="cap-add-club-title">
              <header className="cap__modal-head">
                <h2 id="cap-add-club-title" className="cap__modal-title">
                  Add Club
                </h2>
                <button
                  type="button"
                  className="cap__modal-close"
                  aria-label="Close add club form"
                  onClick={closeAddClubModal}
                >
                  <IconClose />
                </button>
              </header>

              <form className="cap__modal-form" onSubmit={(event) => void submitAddClub(event)}>
                <label className="cap__field">
                  <span>Club name</span>
                  <input
                    type="text"
                    value={newClubName}
                    onChange={(event) => {
                      setNewClubName(event.target.value)
                      if (formErrors.name) setFormErrors((current) => ({ ...current, name: undefined }))
                    }}
                    placeholder="Enter club name"
                    required
                  />
                  {formErrors.name ? <span className="cap__field-error">{formErrors.name}</span> : null}
                </label>

                <label className="cap__field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={newClubEmail}
                    onChange={(event) => {
                      setNewClubEmail(event.target.value)
                      if (formErrors.email) setFormErrors((current) => ({ ...current, email: undefined }))
                    }}
                    placeholder="club@email.com"
                    required
                  />
                  {formErrors.email ? <span className="cap__field-error">{formErrors.email}</span> : null}
                </label>

                <label className="cap__field">
                  <span>Address</span>
                  <input
                    type="text"
                    value={newClubAddress}
                    onChange={(event) => {
                      setNewClubAddress(event.target.value)
                      if (formErrors.address) setFormErrors((current) => ({ ...current, address: undefined }))
                    }}
                    placeholder="Street, city"
                    required
                  />
                  {formErrors.address ? <span className="cap__field-error">{formErrors.address}</span> : null}
                </label>

                <label className="cap__field">
                  <span>Phone (optional)</span>
                  <input
                    type="text"
                    value={newClubPhone}
                    onChange={(event) => setNewClubPhone(event.target.value)}
                    placeholder="+355..."
                  />
                </label>

                <label className="cap__field">
                  <span>Description (optional)</span>
                  <textarea
                    value={newClubDescription}
                    onChange={(event) => setNewClubDescription(event.target.value)}
                    placeholder="Brief club description"
                    rows={4}
                  />
                </label>

                {addClubError ? <p className="cap__form-error">{addClubError}</p> : null}

                <div className="cap__modal-actions">
                  <button type="button" className="cap__btn cap__btn--ghost" onClick={closeAddClubModal}>
                    Cancel
                  </button>
                  <button type="submit" className="cap__btn cap__btn--approve" disabled={addingClub}>
                    {addingClub ? 'Adding...' : 'Create Club'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {selectedClub ? (
            <section className="cap__modal" role="dialog" aria-modal="true" aria-labelledby="cap-club-details-title">
              <header className="cap__modal-head">
                <h2 id="cap-club-details-title" className="cap__modal-title">
                  Club Details
                </h2>
                <button
                  type="button"
                  className="cap__modal-close"
                  aria-label="Close club details"
                  onClick={closeDetailsModal}
                >
                  <IconClose />
                </button>
              </header>

              <div className="cap__detail-list">
                <p>
                  <strong>Name:</strong> {selectedClub.name}
                </p>
                <p>
                  <strong>Status:</strong> {selectedClub.status}
                </p>
                <p>
                  <strong>Address:</strong> {selectedClub.location}
                </p>
                <p>
                  <strong>Email:</strong> {selectedClub.email}
                </p>
                <p>
                  <strong>Phone:</strong> {selectedClub.phone}
                </p>
                <p>
                  <strong>Description:</strong> {selectedClub.description}
                </p>
                <p>
                  <strong>Owner / Contact:</strong> {selectedClub.contact}
                </p>
                <p>
                  <strong>Applied date:</strong> {selectedClub.applied}
                </p>
                <p>
                  <strong>Document ID:</strong> {selectedClub.license}
                </p>
              </div>

              <div className="cap__modal-actions">
                {selectedClub.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="cap__btn cap__btn--approve"
                      onClick={() => void handleDetailStatus('approved')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="cap__btn cap__btn--reject"
                      onClick={() => void handleDetailStatus('rejected')}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {selectedClub.status === 'approved' ? (
                  <>
                    <button
                      type="button"
                      className="cap__btn cap__btn--suspend"
                      onClick={() => askForConfirmation('suspend', selectedClub)}
                    >
                      Suspend
                    </button>
                    <button
                      type="button"
                      className="cap__btn cap__btn--revoke"
                      onClick={() => askForConfirmation('revoke', selectedClub)}
                    >
                      Revoke
                    </button>
                  </>
                ) : null}
                {selectedClub.status === 'rejected' ? (
                  <button
                    type="button"
                    className="cap__btn cap__btn--approve"
                    onClick={() => void handleDetailStatus('approved')}
                  >
                    Approve
                  </button>
                ) : null}
                {selectedClub.status === 'suspended' ? (
                  <>
                    <button
                      type="button"
                      className="cap__btn cap__btn--reinstate"
                      onClick={() => askForConfirmation('reinstate', selectedClub)}
                    >
                      Reinstate
                    </button>
                    <button
                      type="button"
                      className="cap__btn cap__btn--revoke"
                      onClick={() => askForConfirmation('revoke', selectedClub)}
                    >
                      Revoke
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {confirmAction ? (
            <section className="cap__modal cap__confirm" role="dialog" aria-modal="true" aria-labelledby="cap-confirm-title">
              <header className="cap__modal-head">
                <h2 id="cap-confirm-title" className="cap__modal-title">
                  {confirmTitle}
                </h2>
                <button
                  type="button"
                  className="cap__modal-close"
                  aria-label="Close confirmation"
                  onClick={closeConfirmModal}
                  disabled={confirmBusy}
                >
                  <IconClose />
                </button>
              </header>
              <p className="cap__confirm-message">{confirmMessage}</p>
              <div className="cap__modal-actions">
                <button
                  type="button"
                  className="cap__btn cap__btn--ghost"
                  onClick={closeConfirmModal}
                  disabled={confirmBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={confirmButtonClass}
                  onClick={() => void runConfirmedAction()}
                  disabled={confirmBusy}
                >
                  {confirmBusy ? 'Please wait...' : confirmButtonLabel}
                </button>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}
