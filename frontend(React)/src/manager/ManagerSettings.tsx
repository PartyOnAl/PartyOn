import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ManagerDashboard.css'
import './ManagerSettings.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'

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
