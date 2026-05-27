import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Calendar as CalendarIcon, Check as CheckIcon, Copy as CopyIcon, Info as InfoIcon, Lock as LockIcon } from 'lucide-react'
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
  email: string
  phone_number: string
  birth_date: string
}

type ManagerProfileRow = EditForm & {
  profile_id: string
  avatar_url: string | null
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
  const d = new Date(`${value}T00:00:00`)
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

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function isRealUsername(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^@/, '').toLowerCase()
  return Boolean(normalized && normalized !== 'username')
}

function formatRole(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return 'Manager'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function DatePickerPopover({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null
  const initialDate = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  useEffect(() => {
    if (!value) return
    const nextSelectedDate = new Date(`${value}T00:00:00`)
    if (Number.isNaN(nextSelectedDate.getTime())) return
    setViewYear(nextSelectedDate.getFullYear())
    setViewMonth(nextSelectedDate.getMonth())
  }, [value])

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((year) => year - 1)
      return
    }
    setViewMonth((month) => month - 1)
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((year) => year + 1)
      return
    }
    setViewMonth((month) => month + 1)
  }

  function selectDay(day: number) {
    const month = String(viewMonth + 1).padStart(2, '0')
    const date = String(day).padStart(2, '0')
    onChange(`${viewYear}-${month}-${date}`)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstDayOfWeek }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const displayValue =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(selectedDate)
      : null

  return (
    <div ref={wrapRef} className="manager-profile__datepicker-wrap">
      <button
        type="button"
        className={`manager-profile__datepicker-trigger${
          displayValue ? '' : ' manager-profile__datepicker-trigger--placeholder'
        }`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span>{displayValue ?? 'Select date'}</span>
        <CalendarIcon className="manager-profile__datepicker-icon" aria-hidden />
      </button>

      {open ? (
        <div className="manager-profile__datepicker-popover">
          <div className="manager-profile__datepicker-nav">
            <button type="button" className="manager-profile__datepicker-nav-btn" onClick={goToPreviousMonth}>
              ‹
            </button>
            <span className="manager-profile__datepicker-month-label">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" className="manager-profile__datepicker-nav-btn" onClick={goToNextMonth}>
              ›
            </button>
          </div>

          <div className="manager-profile__datepicker-grid">
            {DAY_NAMES.map((dayName) => (
              <span key={dayName} className="manager-profile__datepicker-dayname">
                {dayName}
              </span>
            ))}
            {calendarCells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />
              const selected =
                selectedDate &&
                !Number.isNaN(selectedDate.getTime()) &&
                selectedDate.getFullYear() === viewYear &&
                selectedDate.getMonth() === viewMonth &&
                selectedDate.getDate() === day

              return (
                <button
                  key={day}
                  type="button"
                  className={`manager-profile__datepicker-day${
                    selected ? ' manager-profile__datepicker-day--selected' : ''
                  }`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="manager-profile__datepicker-footer">
            <button
              type="button"
              className="manager-profile__datepicker-clear"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="manager-profile__datepicker-confirm"
              onClick={() => setOpen(false)}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ManagerProfile() {
  const { profile } = useAuth()
  const { club } = useManagerClub()

  const [managerProfile, setManagerProfile] = useState<ManagerProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [copiedClubId, setCopiedClubId] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copiedClubIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [form, setForm] = useState<EditForm>({
    name: '',
    surname: '',
    username: '',
    email: '',
    phone_number: '',
    birth_date: '',
  })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    return () => {
      if (copiedClubIdTimerRef.current) clearTimeout(copiedClubIdTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!profile?.id || !managerSupabase) {
      setManagerProfile(null)
      return
    }

    let cancelled = false
    setProfileLoading(true)

    void managerSupabase
      .from('manager_profiles')
      .select('profile_id, name, surname, username, email, phone_number, birth_date, avatar_url, created_at, updated_at')
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
    email: managerProfile?.email ?? profile?.email ?? '',
    phone_number: managerProfile?.phone_number ?? profile?.phone_number ?? '',
    birth_date: managerProfile?.birth_date ?? profile?.birth_date ?? '',
  }), [managerProfile, profile])

  useEffect(() => {
    if (!profile || editing) return
    setForm({
      ...profileDetails,
      username: isRealUsername(profileDetails.username) ? profileDetails.username : '',
    })
  }, [profile, profileDetails, editing])

  const fullName = useMemo(() => {
    const parts = [profileDetails.name, profileDetails.surname].map((v) => v?.trim()).filter(Boolean)
    return parts.join(' ') || 'Unnamed Manager'
  }, [profileDetails])

  const visibleUsername = isRealUsername(profileDetails.username) ? profileDetails.username.trim() : ''
  const currentAvatarUrl = removeAvatar ? null : avatarPreviewUrl ?? managerProfile?.avatar_url ?? null
  const normalizedCurrentEmail = profileDetails.email.trim().toLowerCase()
  const normalizedFormEmail = form.email.trim().toLowerCase()
  const emailChanged = Boolean(normalizedFormEmail && normalizedFormEmail !== normalizedCurrentEmail)

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    }
  }, [avatarPreviewUrl])

  function handleAvatarClick() {
    if (!editing) {
      startEdit()
      return
    }
    fileInputRef.current?.click()
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
    setRemoveAvatar(false)
  }

  function handleRemoveAvatar() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setRemoveAvatar(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadAvatar() {
    if (!profile || !managerSupabase || !avatarFile) return null

    const extension = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/${Date.now()}.${extension}`

    const { error: uploadError } = await managerSupabase.storage
      .from('manager-avatars')
      .upload(path, avatarFile, { cacheControl: '3600', upsert: true })

    if (uploadError) throw uploadError

    const { data } = managerSupabase.storage.from('manager-avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleCopyClubId() {
    if (!profile?.club_id) return

    try {
      await navigator.clipboard.writeText(profile.club_id)
      setCopiedClubId(true)
      if (copiedClubIdTimerRef.current) clearTimeout(copiedClubIdTimerRef.current)
      copiedClubIdTimerRef.current = setTimeout(() => setCopiedClubId(false), 1500)
    } catch {
      setToast({ variant: 'error', message: 'Could not copy club ID.' })
    }
  }

  function startEdit() {
    setEditing(true)
  }

  function cancelEdit() {
    if (saving) return
    setEditing(false)
    if (profile) {
      setForm({
        ...profileDetails,
        username: isRealUsername(profileDetails.username) ? profileDetails.username : '',
      })
    }
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setRemoveAvatar(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    if (!profile || !managerSupabase) return

    setSaving(true)

    let nextAvatarUrl = managerProfile?.avatar_url ?? null

    try {
      if (removeAvatar) {
        nextAvatarUrl = null
      } else if (avatarFile) {
        nextAvatarUrl = await uploadAvatar()
      }
    } catch (uploadError) {
      setSaving(false)
      setToast({
        variant: 'error',
        message:
          uploadError instanceof Error
            ? uploadError.message
            : 'Could not upload profile photo.',
      })
      return
    }

    const payload = {
      profile_id: profile.id,
      name: form.name.trim() || null,
      surname: form.surname.trim() || null,
      username: isRealUsername(form.username) ? form.username.trim().replace(/^@/, '') : null,
      email: form.email.trim() || null,
      phone_number: form.phone_number.trim() || null,
      birth_date: form.birth_date || null,
      avatar_url: nextAvatarUrl,
      updated_at: new Date().toISOString(),
    }

    if (emailChanged) {
      const { error: authEmailError } = await managerSupabase.auth.updateUser({
        email: form.email.trim(),
      })

      if (authEmailError) {
        setSaving(false)
        setToast({ variant: 'error', message: authEmailError.message })
        return
      }

      await managerSupabase
        .from('profiles')
        .update({ email: form.email.trim(), updated_at: new Date().toISOString() })
        .eq('id', profile.id)
    }

    const { data, error: updateError } = await managerSupabase
      .from('manager_profiles')
      .upsert(payload, { onConflict: 'profile_id' })
      .select('profile_id, name, surname, username, email, phone_number, birth_date, avatar_url, created_at, updated_at')
      .single()

    setSaving(false)

    if (updateError || !data) {
      setToast({
        variant: 'error',
        message: updateError?.message ?? 'Could not save profile changes.',
      })
      return
    }

    setManagerProfile(data as ManagerProfileRow)
    setForm({
      name: data.name ?? '',
      surname: data.surname ?? '',
      username: isRealUsername(data.username) ? data.username : '',
      email: data.email ?? '',
      phone_number: data.phone_number ?? '',
      birth_date: data.birth_date ?? '',
    })
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarFile(null)
    setAvatarPreviewUrl(null)
    setRemoveAvatar(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setEditing(false)
    setToast({
      variant: 'success',
      message: emailChanged
        ? 'Profile saved. A confirmation link will be sent to your new email address.'
        : 'Profile updated successfully.',
    })
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-profile__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-profile__bound">
            <div className="manager-profile__shell">
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
                    <div className="manager-profile__avatar-wrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="manager-profile__avatar-file-input"
                        onChange={handleAvatarChange}
                      />
                      <button
                        type="button"
                        className="manager-profile__avatar-btn-wrap"
                        onClick={handleAvatarClick}
                        aria-label={editing ? 'Change profile photo' : 'Edit profile photo'}
                      >
                        {currentAvatarUrl ? (
                          <img src={currentAvatarUrl} alt="Profile" className="manager-profile__avatar-img" />
                        ) : (
                          <div className="manager-profile__avatar" aria-hidden>
                            {getInitials(profileDetails.name, profileDetails.surname, profile.email || 'M')}
                          </div>
                        )}
                        <span className="manager-profile__avatar-overlay" aria-hidden>
                          <IconCamera />
                          <span>Change Photo</span>
                        </span>
                        <span className="manager-profile__avatar-badge" aria-hidden>
                          <IconCamera />
                        </span>
                      </button>
                      {editing && currentAvatarUrl ? (
                        <button
                          type="button"
                          className="manager-profile__remove-photo"
                          onClick={handleRemoveAvatar}
                          disabled={saving}
                        >
                          Remove photo
                        </button>
                      ) : null}
                    </div>
                    <div className="manager-profile__hero-info">
                      <h2 className="manager-profile__name">{fullName}</h2>
                      {visibleUsername ? (
                        <p className="manager-profile__handle">@{visibleUsername}</p>
                      ) : null}
                      <span className="manager-profile__role">
                        <IconShield />
                        {profile.role || 'manager'}
                      </span>
                    </div>
                  </div>

                  <div className="manager-profile__hero-actions">
                    {!editing ? (
                      <button
                        type="button"
                        className="manager-profile__btn manager-profile__btn--primary"
                        onClick={startEdit}
                      >
                        <IconPencil />
                        Edit Profile
                      </button>
                    ) : null}
                  </div>
                  </section>

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

                    {editing || visibleUsername ? (
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
                          <p className="manager-profile__field-value">@{visibleUsername}</p>
                        )}
                      </div>
                    ) : null}

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
                        <DatePickerPopover
                          value={form.birth_date}
                          onChange={(birthDate) => setForm((f) => ({ ...f, birth_date: birthDate }))}
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
                      {editing ? (
                        <>
                          <input
                            className="manager-profile__input"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            disabled={saving}
                            placeholder="manager@example.com"
                          />
                          {emailChanged ? (
                            <p className="manager-profile__field-hint">
                              A confirmation link will be sent to your new email address.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="manager-profile__field-value manager-profile__field-value--readonly">
                          {profileDetails.email?.trim() || 'Not provided'}
                        </p>
                      )}
                    </div>
                  </div>

                  {editing ? (
                    <div className="manager-profile__form-actions">
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
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  ) : null}
                  </section>

                  <section className="manager-profile__card manager-profile__card--readonly" aria-labelledby="profile-club-title">
                  <header className="manager-profile__card-head">
                    <div>
                      <h3 id="profile-club-title" className="manager-profile__card-title manager-profile__card-title--readonly">
                        <LockIcon aria-hidden />
                        Club Assignment
                      </h3>
                      <p className="manager-profile__card-sub manager-profile__card-sub--info">
                        <InfoIcon aria-hidden />
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
                        {formatRole(profile.role)}
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
                      {profile.club_id ? (
                        <div className="manager-profile__club-id-row">
                          <div className="manager-profile__club-id-wrap">
                            <p className="manager-profile__field-value manager-profile__field-value--readonly manager-profile__club-id-text">
                              {profile.club_id.slice(0, 8)}…
                            </p>
                            <span className="manager-profile__club-id-tooltip">{profile.club_id}</span>
                          </div>
                          <button
                            type="button"
                            className="manager-profile__copy-id-btn"
                            onClick={() => void handleCopyClubId()}
                            aria-label="Copy full Club ID"
                            title="Copy full ID"
                          >
                            {copiedClubId ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
                          </button>
                        </div>
                      ) : (
                        <p className="manager-profile__field-value manager-profile__field-value--readonly">
                          Not assigned
                        </p>
                      )}
                    </div>
                  </div>
                  </section>
                </>
              )}
            </div>
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
