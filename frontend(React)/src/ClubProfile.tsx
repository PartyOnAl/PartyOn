import { useRef, useState, type FormEvent } from 'react'
import './ManagerDashboard.css'
import './ClubProfile.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

const INITIAL = {
  clubName: 'Folie Terrace',
  location: 'Paris, France',
  description: '',
  musicType: 'House, Techno, Hip Hop',
  openingHours: '22:00 - 04:00',
}

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
      <path
        d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h4M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export default function ClubProfile() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clubName, setClubName] = useState(INITIAL.clubName)
  const [location, setLocation] = useState(INITIAL.location)
  const [description, setDescription] = useState(INITIAL.description)
  const [musicType, setMusicType] = useState(INITIAL.musicType)
  const [openingHours, setOpeningHours] = useState(INITIAL.openingHours)

  function resetForm() {
    setClubName(INITIAL.clubName)
    setLocation(INITIAL.location)
    setDescription(INITIAL.description)
    setMusicType(INITIAL.musicType)
    setOpeningHours(INITIAL.openingHours)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="club" />

        <div className="manager-dash__main manager-dash__main--club-profile">
          <ManagerTopBar />

          <div className="club-profile__bound">
            <div className="manager-dash__page-head club-profile__page-head">
              <h1 className="manager-dash__page-title">Club Profile Editor</h1>
              <p className="manager-dash__page-sub">
                Manage your club&apos;s information and branding
              </p>
            </div>

            <form className="club-profile" onSubmit={handleSubmit}>
            <section className="club-profile__card" aria-labelledby="club-cover-heading">
              <h2 id="club-cover-heading" className="club-profile__card-title">
                Cover Image
              </h2>
              <div className="club-profile__cover">
                <div className="club-profile__cover-inner">
                  <IconUpload />
                </div>
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
                  />
                </label>
                <label className="club-profile__field">
                  <span className="club-profile__label">Location</span>
                  <input
                    className="club-profile__input"
                    type="text"
                    name="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    autoComplete="address-level2"
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
                  <span className="club-profile__label">Music Type</span>
                  <input
                    className="club-profile__input"
                    type="text"
                    name="musicType"
                    value={musicType}
                    onChange={(e) => setMusicType(e.target.value)}
                  />
                </label>
                <label className="club-profile__field">
                  <span className="club-profile__label">Opening Hours</span>
                  <input
                    className="club-profile__input"
                    type="text"
                    name="openingHours"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                  />
                </label>
              </div>
            </section>

            <div className="club-profile__actions">
              <button type="button" className="club-profile__btn club-profile__btn--ghost" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" className="club-profile__btn club-profile__btn--primary">
                <IconSave />
                Save Changes
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
