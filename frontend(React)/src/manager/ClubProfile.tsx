import { useEffect, useRef, useState, type FormEvent } from 'react'
import './ManagerDashboard.css'
import './ClubProfile.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

function IconUpload() {
  return (
    <svg className="club-profile__upload-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0 3.5-3.5M12 14 8.5 10.5M5 14h14v7H5v-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSave() {
  return (
    <svg className="club-profile__save-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 4v4h4M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function ClubProfile() {
  const { club, clubId, loading: clubLoading, error: clubError } = useManagerClub()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clubName, setClubName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!club) return
    setClubName(club.club_name ?? '')
    setLocation(club.club_address ?? '')
    setDescription(club.club_description ?? '')
    setEmail(club.club_email_id ?? '')
    setPhone(club.club_phone_number ?? '')
  }, [club])

  function resetForm() {
    if (!club) return
    setClubName(club.club_name ?? '')
    setLocation(club.club_address ?? '')
    setDescription(club.club_description ?? '')
    setEmail(club.club_email_id ?? '')
    setPhone(club.club_phone_number ?? '')
    setSaveError(null)
    setSaveSuccess(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clubId || !supabase || !isSupabaseConfigured) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const { error: err } = await supabase
      .from('clubs')
      .update({
        club_name: clubName.trim(),
        club_address: location.trim() || null,
        club_description: description.trim() || null,
        club_email_id: email.trim() || null,
        club_phone_number: phone.trim() || null,
      })
      .eq('club_id', clubId)

    setSaving(false)
    if (err) {
      setSaveError(err.message)
    } else {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  if (clubLoading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--club-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#8a8a8a' }}>Loading club…</span>
          </div>
        </div>
      </div>
    )
  }

  if (clubError) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--club-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#f87171' }}>Error: {clubError}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-dash__main--club-profile">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="club-profile__bound">
            <div className="manager-dash__page-head club-profile__page-head">
              <h1 className="manager-dash__page-title">Club Profile Editor</h1>
              <p className="manager-dash__page-sub">
                Manage your club&apos;s information and branding
              </p>
            </div>

            <form className="club-profile" onSubmit={(e) => void handleSubmit(e)}>
              <section className="club-profile__card" aria-labelledby="club-cover-heading">
                <h2 id="club-cover-heading" className="club-profile__card-title">
                  Cover Image
                </h2>
                <div className="club-profile__cover">
                  {club?.club_image ? (
                    <img
                      src={club.club_image}
                      alt="Club cover"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="club-profile__cover-inner">
                      <IconUpload />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="club-profile__file-input"
                    aria-label="Choose cover image"
                  />
                  <button
                    type="button"
                    className="club-profile__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Image
                  </button>
                </div>
              </section>

              <section className="club-profile__card" aria-labelledby="club-info-heading">
                <h2 id="club-info-heading" className="club-profile__card-title">
                  Club Information
                </h2>
                <div className="club-profile__fields">
                  <label className="club-profile__field">
                    <span className="club-profile__label">Club Name</span>
                    <input
                      className="club-profile__input"
                      type="text"
                      name="clubName"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      autoComplete="organization"
                      required
                    />
                  </label>
                  <label className="club-profile__field">
                    <span className="club-profile__label">Location / Address</span>
                    <input
                      className="club-profile__input"
                      type="text"
                      name="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      autoComplete="street-address"
                    />
                  </label>
                  <label className="club-profile__field">
                    <span className="club-profile__label">Description</span>
                    <textarea
                      className="club-profile__input club-profile__textarea"
                      name="description"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label className="club-profile__field">
                    <span className="club-profile__label">Contact Email</span>
                    <input
                      className="club-profile__input"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </label>
                  <label className="club-profile__field">
                    <span className="club-profile__label">Phone Number</span>
                    <input
                      className="club-profile__input"
                      type="tel"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                    />
                  </label>
                </div>
              </section>

              {saveError && (
                <p style={{ color: '#f87171', fontSize: '0.875rem', margin: '0' }}>
                  Error saving: {saveError}
                </p>
              )}
              {saveSuccess && (
                <p style={{ color: '#34d399', fontSize: '0.875rem', margin: '0' }}>
                  Changes saved successfully.
                </p>
              )}

              <div className="club-profile__actions">
                <button
                  type="button"
                  className="club-profile__btn club-profile__btn--ghost"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="club-profile__btn club-profile__btn--primary"
                  disabled={saving}
                >
                  <IconSave />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
