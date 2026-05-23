import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ManagerDashboard.css'
import './ManagerSettings.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

type NotificationKey = 'newReservations' | 'staffRequests' | 'eventReminders'
type Toast = { message: string; variant: 'default' | 'info' }

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4 13a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ManagerSettings() {
  const { club } = useManagerClub()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    newReservations: true,
    staffRequests: true,
    eventReminders: true,
  })

  const [toast, setToast] = useState<Toast | null>(null)

  // Terms & Conditions state
  const [tcText, setTcText] = useState<string>('')
  const [tcUpdatedAt, setTcUpdatedAt] = useState<string | null>(null)
  const [tcDraft, setTcDraft] = useState<string>('')
  const [tcEditing, setTcEditing] = useState(false)
  const [tcSaving, setTcSaving] = useState(false)

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    supabase
      .from('global_settings')
      .select('value, updated_at')
      .eq('key', 'terms_and_conditions')
      .single()
      .then(({ data }) => {
        if (data) {
          setTcText((data as { value: string; updated_at: string }).value ?? '')
          setTcUpdatedAt((data as { value: string; updated_at: string }).updated_at ?? null)
        }
      })
  }, [])

  async function saveTc() {
    if (!supabase || !isSupabaseConfigured) return
    setTcSaving(true)
    const { error } = await supabase
      .from('global_settings')
      .upsert({ key: 'terms_and_conditions', value: tcDraft, updated_at: new Date().toISOString() })
    setTcSaving(false)
    if (error) {
      setToast({ variant: 'default', message: `Failed to save: ${error.message}` })
    } else {
      setTcText(tcDraft)
      setTcUpdatedAt(new Date().toISOString())
      setTcEditing(false)
      setToast({ variant: 'default', message: 'Terms & Conditions saved.' })
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function toggleNotification(key: NotificationKey) {
    setNotifications((current) => ({ ...current, [key]: !current[key] }))
  }

  const notificationItems: { key: NotificationKey; title: string; desc: string }[] = [
    { key: 'newReservations', title: 'New Reservations', desc: 'Get notified of new bookings' },
    { key: 'staffRequests', title: 'Staff Requests', desc: 'Approval requests from staff' },
    { key: 'eventReminders', title: 'Event Reminders', desc: 'Upcoming event notifications' },
  ]

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-settings__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-settings__bound">
            {/* Header */}
            <div className="manager-settings__head">
              <h1 className="manager-dash__page-title">Settings</h1>
              <p className="manager-dash__page-sub">Manage your club preferences and account</p>
            </div>

            {/* Notifications */}
            <section className="manager-settings__card" aria-labelledby="settings-notif-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconBell />
                </span>
                <div>
                  <h2 id="settings-notif-title" className="manager-settings__card-title">
                    Notifications
                  </h2>
                  <p className="manager-settings__card-sub">Manage notification preferences</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                {notificationItems.map((item) => (
                  <div key={item.key} className="manager-settings__row">
                    <div>
                      <p className="manager-settings__row-title">{item.title}</p>
                      <p className="manager-settings__row-desc">{item.desc}</p>
                    </div>
                    <label className="manager-settings__toggle">
                      <input
                        type="checkbox"
                        checked={notifications[item.key]}
                        onChange={() => toggleNotification(item.key)}
                        aria-label={`Toggle ${item.title}`}
                      />
                      <span className="manager-settings__toggle-track" aria-hidden>
                        <span className="manager-settings__toggle-thumb" />
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </section>

            {/* Security */}
            <section className="manager-settings__card" aria-labelledby="settings-security-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconLock />
                </span>
                <div>
                  <h2 id="settings-security-title" className="manager-settings__card-title">
                    Security
                  </h2>
                  <p className="manager-settings__card-sub">Password and authentication</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() => navigate('/reset-password')}
                >
                  Change Password
                </button>
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() =>
                    setToast({
                      variant: 'info',
                      message: 'Two-factor authentication is coming soon.',
                    })
                  }
                >
                  Two-Factor Authentication
                </button>
              </div>
            </section>

            {/* Team Access */}
            <section className="manager-settings__card" aria-labelledby="settings-team-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconUsers />
                </span>
                <div>
                  <h2 id="settings-team-title" className="manager-settings__card-title">
                    Team Access
                  </h2>
                  <p className="manager-settings__card-sub">Manage team members and permissions</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() => navigate('/manager/staff-approval')}
                >
                  Manage Team Members
                </button>
              </div>
            </section>

            {/* Billing */}
            <section className="manager-settings__card" aria-labelledby="settings-billing-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconCard />
                </span>
                <div>
                  <h2 id="settings-billing-title" className="manager-settings__card-title">
                    Billing
                  </h2>
                  <p className="manager-settings__card-sub">Manage subscription and payments</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() =>
                    setToast({ variant: 'info', message: 'Billing history is coming soon.' })
                  }
                >
                  View Billing History
                </button>
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() =>
                    setToast({
                      variant: 'info',
                      message: 'Payment method updates are coming soon.',
                    })
                  }
                >
                  Update Payment Method
                </button>
              </div>
            </section>

            {/* Terms & Conditions */}
            <section className="manager-settings__card" aria-labelledby="settings-tc-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconFile />
                </span>
                <div>
                  <h2 id="settings-tc-title" className="manager-settings__card-title">
                    Terms &amp; Conditions
                  </h2>
                  <p className="manager-settings__card-sub">
                    Shown on every offer detail page
                  </p>
                </div>
              </header>

              {tcUpdatedAt ? (
                <p className="manager-settings__tc-meta">
                  Last updated: {formatUpdatedAt(tcUpdatedAt)}
                </p>
              ) : null}

              {tcEditing ? (
                <>
                  <textarea
                    className="manager-settings__tc-textarea"
                    value={tcDraft}
                    onChange={(e) => setTcDraft(e.target.value)}
                    aria-label="Terms and conditions text"
                    rows={10}
                  />
                  <div className="manager-settings__tc-actions">
                    <button
                      type="button"
                      className="manager-settings__tc-save"
                      disabled={tcSaving || tcDraft.trim() === tcText.trim()}
                      onClick={() => void saveTc()}
                    >
                      {tcSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="manager-settings__tc-cancel"
                      onClick={() => setTcEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <pre className="manager-settings__tc-text">
                    {tcText || 'No terms set yet.'}
                  </pre>
                  <button
                    type="button"
                    className="manager-settings__tc-edit"
                    onClick={() => {
                      setTcDraft(tcText)
                      setTcEditing(true)
                    }}
                  >
                    Edit
                  </button>
                </>
              )}
            </section>

            {/* Logout */}
            <button
              type="button"
              className="manager-settings__logout"
              onClick={() => void signOut()}
            >
              <IconLogout />
              Logout
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`manager-settings__toast manager-settings__toast--${toast.variant}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
