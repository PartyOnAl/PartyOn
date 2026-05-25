import { useEffect, useRef, useState, type FormEvent } from 'react'
import './ManagerDashboard.css'
import './ClubProfile.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { PhotoCarousel } from '../components/PhotoCarousel'

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

function IconEdit() {
  return (
    <svg className="club-profile__save-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="m14.5 6.7 2.8 2.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

type CoverPhoto = {
  id: string
  url: string
  file?: File
}

type ClubProfileSnapshot = {
  clubName: string
  location: string
  description: string
  email: string
  phone: string
  coverPhotos: CoverPhoto[]
}

export default function ClubProfile() {
  const { club, clubId, loading: clubLoading, error: clubError } = useManagerClub()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clubName, setClubName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [coverPhotos, setCoverPhotos] = useState<CoverPhoto[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<ClubProfileSnapshot | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const coverPhotosRef = useRef<CoverPhoto[]>([])

  function revokeCoverPhoto(photo: CoverPhoto) {
    if (photo.file && photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
  }

  function getClubSnapshot(): ClubProfileSnapshot | null {
    if (!club) return null

    return {
      clubName: club.club_name ?? '',
      location: club.club_address ?? '',
      description: club.club_description ?? '',
      email: club.club_email_id ?? '',
      phone: club.club_phone_number ?? '',
      coverPhotos:
        club.club_photos && club.club_photos.length > 0
          ? club.club_photos.map((p) => ({ id: p.id, url: p.photo_url }))
          : club.club_image
            ? [{ id: `saved-${club.club_image}`, url: club.club_image }]
            : [],
    }
  }

  function applySnapshot(snapshot: ClubProfileSnapshot) {
    const snapshotPhotoIds = new Set(snapshot.coverPhotos.map((photo) => photo.id))
    coverPhotosRef.current.forEach((photo) => {
      if (!snapshotPhotoIds.has(photo.id)) revokeCoverPhoto(photo)
    })
    setClubName(snapshot.clubName)
    setLocation(snapshot.location)
    setDescription(snapshot.description)
    setEmail(snapshot.email)
    setPhone(snapshot.phone)
    setCoverPhotos(snapshot.coverPhotos)
    setCurrentIndex(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!club) return
    const snapshot = getClubSnapshot()
    if (!snapshot) return
    setSavedSnapshot(snapshot)
    applySnapshot(snapshot)
  }, [club])

  useEffect(() => {
    coverPhotosRef.current = coverPhotos
  }, [coverPhotos])

  useEffect(() => {
    setCurrentIndex((index) => {
      if (coverPhotos.length === 0) return 0
      return Math.min(index, coverPhotos.length - 1)
    })
  }, [coverPhotos.length])

  useEffect(() => {
    return () => {
      coverPhotosRef.current.forEach(revokeCoverPhoto)
    }
  }, [])

  function resetForm() {
    if (savedSnapshot) applySnapshot(savedSnapshot)
    setSaveError(null)
    setSaveSuccess(false)
    setIsEditing(false)
  }

  function handleCoverFilesChange(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (selectedFiles.length === 0) return

    const nextPhotos = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      url: URL.createObjectURL(file),
      file,
    }))

    setCurrentIndex(coverPhotos.length)
    setCoverPhotos((current) => [...current, ...nextPhotos])
    setSaveSuccess(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleRemoveCoverPhoto(photoId: string) {
    setCoverPhotos((current) => {
      const removedPhoto = current.find((photo) => photo.id === photoId)
      const isSavedPhoto = savedSnapshot?.coverPhotos.some((photo) => photo.id === photoId) ?? false
      if (removedPhoto && !isSavedPhoto) revokeCoverPhoto(removedPhoto)
      return current.filter((photo) => photo.id !== photoId)
    })
    setSaveSuccess(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clubId || !supabase || !isSupabaseConfigured) return
    const sb = supabase
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    // 1. Save basic club info
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

    if (err) {
      setSaving(false)
      setSaveError(err.message)
      return
    }

    // 2. Upload new photos (those that have a File object) to Supabase storage
    const resolvedPhotos = await Promise.all(
      coverPhotos.map(async (photo) => {
        if (!photo.file) return photo
        const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${clubId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data: uploadData, error: uploadErr } = await sb.storage
          .from('club-photos')
          .upload(path, photo.file, { upsert: false })
        if (uploadErr || !uploadData) return null
        const { data: publicData } = sb.storage
          .from('club-photos')
          .getPublicUrl(uploadData.path)
        return { id: photo.id, url: publicData.publicUrl }
      }),
    )
    const finalPhotos = resolvedPhotos.filter((p): p is CoverPhoto => p !== null)

    // 3. Replace all club_photos rows with the current ordered list
    await supabase.from('club_photos').delete().eq('club_id', clubId)

    if (finalPhotos.length > 0) {
      await supabase.from('club_photos').insert(
        finalPhotos.map((photo, idx) => ({
          club_id: clubId,
          photo_url: photo.url,
          sort_order: idx,
          is_primary: idx === 0,
        })),
      )
      // Keep club_image in sync with the primary photo for backward compat
      await supabase
        .from('clubs')
        .update({ club_image: finalPhotos[0].url })
        .eq('club_id', clubId)
    }

    setSaving(false)
    setSavedSnapshot({
      clubName: clubName.trim(),
      location: location.trim(),
      description: description.trim(),
      email: email.trim(),
      phone: phone.trim(),
      coverPhotos: finalPhotos,
    })
    setCoverPhotos(finalPhotos)
    setIsEditing(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const hasClubDetails = clubName || location || description || email || phone
  const coverImageUrls = coverPhotos.map((photo) => photo.url)

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
              <div>
                <h1 className="manager-dash__page-title">Club Profile</h1>
                <p className="manager-dash__page-sub">
                  Manage your club&apos;s information and branding
                </p>
              </div>
              <div className="club-profile__mode-actions">
                {!isEditing && (
                  <button
                    type="button"
                    className="club-profile__btn club-profile__btn--primary"
                    onClick={() => {
                      setSaveError(null)
                      setSaveSuccess(false)
                      setIsEditing(true)
                    }}
                  >
                    <IconEdit />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            <form id="club-profile-form" className="club-profile" onSubmit={(e) => void handleSubmit(e)}>
              <section className="club-profile__card" aria-labelledby="club-cover-heading">
                <h2 id="club-cover-heading" className="club-profile__card-title">
                  Cover Image
                </h2>
                <div className="club-profile__cover-wrap">
                  <PhotoCarousel
                    images={coverImageUrls}
                    alt="Club cover"
                    variant="manager"
                    currentIndex={currentIndex}
                    onCurrentIndexChange={setCurrentIndex}
                    className="club-profile__cover"
                    emptyContent={(
                      <div className="club-profile__cover-inner">
                      <IconUpload />
                      </div>
                    )}
                  />
                  {isEditing && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="club-profile__file-input"
                      aria-label="Choose cover images"
                      onChange={(e) => handleCoverFilesChange(e.target.files)}
                    />
                  )}
                </div>
                {isEditing && (
                  <div className="club-profile__cover-actions">
                    <button
                      type="button"
                      className="club-profile__upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      + Add Photo
                    </button>
                  </div>
                )}
                {isEditing && coverPhotos.length > 0 && (
                  <div className="club-profile__thumbnail-strip" aria-label="Club cover photos">
                    {coverPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className={`club-profile__thumbnail${index === currentIndex ? ' club-profile__thumbnail--active' : ''}`}
                      >
                        <button
                          type="button"
                          className="club-profile__thumbnail-button"
                          aria-label={`Show photo ${index + 1}`}
                          onClick={() => setCurrentIndex(index)}
                        >
                          <img src={photo.url} alt={`Club cover thumbnail ${index + 1}`} />
                        </button>
                        <button
                          type="button"
                          className="club-profile__thumbnail-remove"
                          aria-label={`Remove photo ${index + 1}`}
                          onClick={() => handleRemoveCoverPhoto(photo.id)}
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="club-profile__card" aria-labelledby="club-info-heading">
                <h2 id="club-info-heading" className="club-profile__card-title">
                  Club Information
                </h2>
                {isEditing ? (
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
                ) : (
                  <div className="club-profile__details">
                    {hasClubDetails ? (
                      <>
                        <div className="club-profile__detail-row">
                          <span className="club-profile__label">Club Name</span>
                          <p className="club-profile__detail-value">{clubName || 'Not set'}</p>
                        </div>
                        <div className="club-profile__detail-row">
                          <span className="club-profile__label">Location / Address</span>
                          <p className="club-profile__detail-value">{location || 'Not set'}</p>
                        </div>
                        <div className="club-profile__detail-row club-profile__detail-row--full">
                          <span className="club-profile__label">Description</span>
                          <p className="club-profile__detail-value club-profile__detail-value--multiline">
                            {description || 'Not set'}
                          </p>
                        </div>
                        <div className="club-profile__detail-row">
                          <span className="club-profile__label">Contact Email</span>
                          <p className="club-profile__detail-value">{email || 'Not set'}</p>
                        </div>
                        <div className="club-profile__detail-row">
                          <span className="club-profile__label">Phone Number</span>
                          <p className="club-profile__detail-value">{phone || 'Not set'}</p>
                        </div>
                      </>
                    ) : (
                      <p className="club-profile__empty-text">No club details have been added yet.</p>
                    )}
                  </div>
                )}
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

              {isEditing && (
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
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
