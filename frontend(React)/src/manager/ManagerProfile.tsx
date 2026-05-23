import { useEffect, useMemo, useState } from 'react'
import './ManagerDashboard.css'
import './ManagerProfile.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { managerSupabase } from '../lib/supabase'

type EditForm = {
  name: string
  surname: string
  username: string
  phone_number: string
  birth_date: string
}

type ManagerProfileRow = EditForm & {
  profile_id: string
  created_at: string | null
  updated_at: string | null
}

type Toast = { message: string; variant: 'success' | 'error' }

function getInitials(name: string | null, surname: string | null, fallback: string) {
  const a = name?.trim()?.[0] ?? ''
  const b = surname?.trim()?.[0] ?? ''
  const initials = `${a}${b}`.toUpperCase()
  if (initials) return initials
  const fb = fallback.trim()
  return fb ? fb.slice(0, 2).toUpperCase() : 'M'
}

function formatMemberSince(value: string | null) {
  if (!value) return 'Not available'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d)
}

function formatBirthDate(value: string | null) {
  if (!value) return 'Not provided'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

export default function ManagerProfile() {
  const { profile, signOut } = useAuth()
  const { club } = useManagerClub()

  const [managerProfile, setManagerProfile] = useState<ManagerProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [form, setForm] = useState<EditForm>({
    name: '',
    surname: '',
    username: '',
    phone_number: '',
    birth_date: '',
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!profile?.id || !managerSupabase) {
      setManagerProfile(null)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    setError(null)

    void managerSupabase
      .from('manager_profiles')
      .select('profile_id, name, surname, username, phone_number, birth_date, created_at, updated_at')
      .eq('profile_id', profile.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return

        if (fetchError) {
          setManagerProfile(null)
        } else {
          setManagerProfile((data as ManagerProfileRow | null) ?? null)
        }

        setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile?.id])

  const profileDetails = useMemo(() => ({
    name: managerProfile?.name ?? profile?.name ?? '',
    surname: managerProfile?.surname ?? profile?.surname ?? '',
    username: managerProfile?.username ?? profile?.username ?? '',
    phone_number: managerProfile?.phone_number ?? profile?.phone_number ?? '',
    birth_date: managerProfile?.birth_date ?? profile?.birth_date ?? '',
  }), [managerProfile, profile])

  useEffect(() => {
    if (!profile || editing) return
    setForm(profileDetails)
  }, [profile, profileDetails, editing])

  const fullName = useMemo(() => {
    const parts = [profileDetails.name, profileDetails.surname].map((v) => v?.trim()).filter(Boolean)
    return parts.join(' ') || 'Unnamed Manager'
  }, [profileDetails])

  function startEdit() {
    setEditing(true)
    setError(null)
  }

  function cancelEdit() {
    if (saving) return
    setEditing(false)
    setError(null)
    if (profile) setForm(profileDetails)
  }

  async function handleSave() {
    if (!profile || !managerSupabase) return

    setSaving(true)
    setError(null)

    const payload = {
      profile_id: profile.id,
      name: form.name.trim() || null,
      surname: form.surname.trim() || null,
      username: form.username.trim() || null,
      phone_number: form.phone_number.trim() || null,
      birth_date: form.birth_date || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error: updateError } = await managerSupabase
      .from('manager_profiles')
      .upsert(payload, { onConflict: 'profile_id' })
      .select('profile_id, name, surname, username, phone_number, birth_date, created_at, updated_at')
      .single()

    setSaving(false)

    if (updateError || !data) {
      setError(
        updateError?.message?.includes('manager_profiles')
          ? 'Manager profile storage is not ready yet. Run backend/sql/manager_profiles.sql in Supabase.'
          : updateError?.message ?? 'Could not save profile changes.',
      )
      setToast({ variant: 'error', message: 'Could not save profile changes.' })
      return
    }

    setManagerProfile(data as ManagerProfileRow)
    setForm({
      name: data.name ?? '',
      surname: data.surname ?? '',
      username: data.username ?? '',
      phone_number: data.phone_number ?? '',
      birth_date: data.birth_date ?? '',
    })
    setEditing(false)
    setToast({ variant: 'success', message: 'Profile updated successfully.' })
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-profile__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-profile__bound">
            {/* Header */}
            <div className="manager-profile__head">
              <h1 className="manager-dash__page-title">My Profile</h1>
              <p className="manager-dash__page-sub">View and update your account details</p>
            </div>

            {!profile || profileLoading ? (
              <p className="manager-profile__loading">Loading profile…</p>
            ) : (
              <>
                {/* Hero card */}
                <section className="manager-profile__hero">
                  <div className="manager-profile__hero-left">
                    <div className="manager-profile__avatar" aria-hidden>
                      {getInitials(profileDetails.name, profileDetails.surname, profileDetails.username || profile.email || 'M')}
                    </div>
                    <div className="manager-profile__hero-info">
                      <h2 className="manager-profile__name">{fullName}</h2>
                      <p className="manager-profile__handle">
                        @{profileDetails.username?.trim() || 'username'}
                      </p>
                      <span className="manager-profile__role">
                        <IconShield />
                        {profile.role || 'manager'}
                      </span>
                    </div>
                  </div>

                  <div className="manager-profile__hero-actions">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="manager-profile__btn manager-profile__btn--ghost"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <IconX />
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="manager-profile__btn manager-profile__btn--primary"
                          onClick={() => void handleSave()}
                          disabled={saving}
                        >
                          <IconCheck />
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="manager-profile__btn manager-profile__btn--primary"
                        onClick={startEdit}
                      >
                        <IconPencil />
                        Edit Profile
                      </button>
                    )}
                  </div>
                </section>

                {/* Personal Info */}
                <section className="manager-profile__card" aria-labelledby="profile-personal-title">
                  <header className="manager-profile__card-head">
                    <div>
                      <h3 id="profile-personal-title" className="manager-profile__card-title">
                        Personal Information
                      </h3>
                      <p className="manager-profile__card-sub">Your name and contact details</p>
                    </div>
                  </header>

                  <div className="manager-profile__grid">
                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">First Name</p>
                      {editing ? (
                        <input
                          className="manager-profile__input"
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          disabled={saving}
                          placeholder="First name"
                        />
                      ) : (
                        <p className="manager-profile__field-value">
                          {profileDetails.name?.trim() || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Last Name</p>
                      {editing ? (
                        <input
                          className="manager-profile__input"
                          type="text"
                          value={form.surname}
                          onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                          disabled={saving}
                          placeholder="Last name"
                        />
                      ) : (
                        <p className="manager-profile__field-value">
                          {profileDetails.surname?.trim() || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Username</p>
                      {editing ? (
                        <input
                          className="manager-profile__input"
                          type="text"
                          value={form.username}
                          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                          disabled={saving}
                          placeholder="username"
                        />
                      ) : (
                        <p className="manager-profile__field-value">
                          @{profileDetails.username?.trim() || 'username'}
                        </p>
                      )}
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Phone</p>
                      {editing ? (
                        <input
                          className="manager-profile__input"
                          type="tel"
                          value={form.phone_number}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, phone_number: e.target.value }))
                          }
                          disabled={saving}
                          placeholder="+33 6 12 34 56 78"
                        />
                      ) : (
                        <p className="manager-profile__field-value">
                          {profileDetails.phone_number?.trim() || 'Not provided'}
                        </p>
                      )}
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Birth Date</p>
                      {editing ? (
                        <input
                          className="manager-profile__input"
                          type="date"
                          value={form.birth_date}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, birth_date: e.target.value }))
                          }
                          disabled={saving}
                        />
                      ) : (
                        <p className="manager-profile__field-value">
                          {formatBirthDate(profileDetails.birth_date)}
                        </p>
                      )}
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Email</p>
                      <p className="manager-profile__field-value manager-profile__field-value--readonly">
                        {profile.email?.trim() || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {error && <p className="manager-profile__error">{error}</p>}
                </section>

                {/* Club Info */}
                <section className="manager-profile__card" aria-labelledby="profile-club-title">
                  <header className="manager-profile__card-head">
                    <div>
                      <h3 id="profile-club-title" className="manager-profile__card-title">
                        Club Assignment
                      </h3>
                      <p className="manager-profile__card-sub">
                        Contact PartyOn to change club assignment
                      </p>
                    </div>
                  </header>

                  <div className="manager-profile__grid">
                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Assigned Club</p>
                      <p className="manager-profile__field-value manager-profile__field-value--readonly">
                        {club?.club_name?.trim() || 'No club assigned'}
                      </p>
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Role</p>
                      <p className="manager-profile__field-value manager-profile__field-value--readonly">
                        {profile.role || 'manager'}
                      </p>
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Member Since</p>
                      <p className="manager-profile__field-value manager-profile__field-value--readonly">
                        {formatMemberSince(profile.created_at)}
                      </p>
                    </div>

                    <div className="manager-profile__field">
                      <p className="manager-profile__field-label">Club ID</p>
                      <p className="manager-profile__field-value manager-profile__field-value--readonly">
                        {profile.club_id ? profile.club_id.slice(0, 8) + '…' : 'Not assigned'}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Logout */}
                <button
                  type="button"
                  className="manager-profile__logout"
                  onClick={() => void signOut()}
                >
                  <IconLogout />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`manager-profile__toast manager-profile__toast--${toast.variant}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
