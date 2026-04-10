import { useMemo, useState } from 'react'
import { ExternalLink, LocateFixed } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { mockClubs } from '@/data/mockData'
import './TopClubs.css'

type Coordinates = { lat: number; lng: number }

function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s1 = Math.sin(dLat / 2) ** 2
  const s2 =
    Math.cos(toRad(a.lat)) *
    Math.cos(toRad(b.lat)) *
    Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(s1 + s2))
}

function getGoogleMapsUrl(
  club: { name: string; address?: string; city?: string; lat?: number; lng?: number },
  userCoords: Coordinates | null,
): string {
  if (typeof club.lat === 'number' && typeof club.lng === 'number') {
    const destination = `${club.lat},${club.lng}`
    if (userCoords) {
      const origin = `${userCoords.lat},${userCoords.lng}`
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
  }

  const fallbackQuery = [club.name, club.address, club.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`
}

function getGoogleMapsEmbedUrl(club: {
  name: string
  address?: string
  city?: string
  lat?: number
  lng?: number
}) {
  const query =
    typeof club.lat === 'number' && typeof club.lng === 'number'
      ? `${club.lat},${club.lng}`
      : [club.name, club.address, club.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps?hl=en&q=${encodeURIComponent(query)}&z=14&output=embed`
}

/** Regional overview when no club is focused (matches listed venues). */
function getDefaultMapEmbedUrl() {
  const query = 'Tirana, Albania'
  return `https://www.google.com/maps?hl=en&q=${encodeURIComponent(query)}&z=12&output=embed`
}

function getDefaultMapOpenUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Tirana, Albania')}`
}

export default function TopClubs() {
  const [userCoords, setUserCoords] = useState<Coordinates | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState<string>('')

  const clubs = useMemo(
    () =>
      mockClubs
        .filter((club) => typeof club.lat === 'number' && typeof club.lng === 'number')
        .map((club) => {
          const coords = { lat: club.lat as number, lng: club.lng as number }
          const distanceKm = userCoords ? haversineKm(userCoords, coords) : null
          return { ...club, coords, distanceKm }
        })
        .sort((a, b) => {
          if (a.distanceKm === null || b.distanceKm === null) return 0
          return a.distanceKm - b.distanceKm
        }),
    [userCoords],
  )

  const selectedClub =
    selectedClubId === '' ? null : (clubs.find((club) => club.id === selectedClubId) ?? null)

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.')
      return
    }
    setIsLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsLocating(false)
      },
      () => {
        setGeoError('Could not get your location. Please allow location access.')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="clubs-map-main w-full pt-16">
        <div className="po-container flex min-h-0 flex-1 flex-col py-4 sm:py-6 pb-10">
          <div className="clubs-map-page__topbar shrink-0">
            <div>
              <h1 className="clubs-map-page__title">Clubs Near You</h1>
              <p className="clubs-map-page__subtitle">
                Browse registered clubs on a live-style map and discover what is closest.
              </p>
            </div>
            <button
              type="button"
              className="clubs-map-page__locate-btn"
              onClick={handleLocateMe}
              disabled={isLocating}
            >
              <LocateFixed className="h-4 w-4" />
              {isLocating ? 'Locating...' : 'Use my location'}
            </button>
          </div>

          {geoError ? <p className="clubs-map-page__error shrink-0">{geoError}</p> : null}

          <div className="clubs-map-layout mt-4 sm:mt-5">
            <div className="clubs-map-canvas">
              <iframe
                key={selectedClub?.id ?? '__default__'}
                title={
                  selectedClub
                    ? `Google map — ${selectedClub.name}`
                    : 'Google map — Tirana area'
                }
                src={
                  selectedClub
                    ? getGoogleMapsEmbedUrl(selectedClub)
                    : getDefaultMapEmbedUrl()
                }
                className="clubs-map-iframe"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={
                  selectedClub
                    ? getGoogleMapsUrl(selectedClub, userCoords)
                    : getDefaultMapOpenUrl()
                }
                target="_blank"
                rel="noreferrer"
                className="clubs-map-open-link"
              >
                <ExternalLink className="h-4 w-4" />
                Open full Google Maps
              </a>
            </div>

            <aside className="clubs-nearby-list" id="nearby-clubs">
              <h2 className="clubs-nearby-list__title">Nearby registered clubs</h2>
              <div className="clubs-nearby-list__items">
                {clubs.map((club) => (
                  <article
                    key={club.id}
                    className={`clubs-nearby-card ${
                      selectedClubId === club.id ? 'clubs-nearby-card--active' : ''
                    }`}
                  >
                    <img src={club.imageUrl} alt={club.name} className="clubs-nearby-card__img" />
                    <div className="clubs-nearby-card__body">
                      <h3 className="clubs-nearby-card__name">{club.name}</h3>
                      <p className="clubs-nearby-card__meta">
                        {club.city ?? 'Unknown city'} {club.address ? `- ${club.address}` : ''}
                      </p>
                      <p className="clubs-nearby-card__distance">
                        {club.distanceKm !== null
                          ? `${club.distanceKm.toFixed(1)} km from you`
                          : 'Enable location to see distance'}
                      </p>
                      <div className="clubs-nearby-card__actions">
                        <button
                          type="button"
                          className="clubs-nearby-card__show-btn"
                          onClick={() => setSelectedClubId(club.id)}
                        >
                          Show on map
                        </button>
                        <a
                          href={getGoogleMapsUrl(club, userCoords)}
                          target="_blank"
                          rel="noreferrer"
                          className="clubs-nearby-card__maps-link"
                        >
                          <ExternalLink className="clubs-nearby-card__maps-icon" aria-hidden />
                          Google Maps
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <LovableFooter />
    </div>
  )
}
