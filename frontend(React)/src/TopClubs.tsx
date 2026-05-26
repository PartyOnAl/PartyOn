import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
} from 'lucide-react'
import { ClubCoverImage } from '@/components/ClubCoverImage'
import { ClubsNearMap } from '@/components/ClubsNearMap'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { Button } from '@/components/ui/Button'
import { useCatalog } from '@/contexts/CatalogContext'
import type { Club } from '@/types'
import { normalizeLatLngPair } from '@/lib/geoNormalize'
import './TopClubs.css'

type Coordinates = { lat: number; lng: number }

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistanceAway(km: number): string {
  if (km >= 1) return `${km.toFixed(1)} km away`
  return `${Math.round(km * 1000)} m away`
}

function getGoogleMapsUrl(
  club: {
    name: string
    address?: string
    city?: string
    club_lat?: number
    club_lng?: number
  },
  userCoords: Coordinates | null,
): string {
  if (
    typeof club.club_lat === 'number' &&
    typeof club.club_lng === 'number'
  ) {
    const destination = `${club.club_lat},${club.club_lng}`
    if (userCoords) {
      const origin = `${userCoords.lat},${userCoords.lng}`
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
  }

  const fallbackQuery = [club.name, club.address, club.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery)}`
}

function getDefaultMapOpenUrl() {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Tirana, Albania')}`
}

type ClubRow = Club & {
  coords: Coordinates | null
  distanceKm: number | null
}

export default function TopClubs() {
  const navigate = useNavigate()
  const { clubs: catalogClubs, loading: clubsLoading, error: clubsError } =
    useCatalog()

  const [userCoords, setUserCoords] = useState<Coordinates | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationActive, setLocationActive] = useState(false)
  const [userFitGeneration, setUserFitGeneration] = useState(0)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [flyToClubId, setFlyToClubId] = useState<string | null>(null)
  const [mapPopupTick, setMapPopupTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  const showToast = useCallback((message: string) => {
    setToast(message)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 5200)
    return () => window.clearTimeout(t)
  }, [toast])

  const clubs = useMemo((): ClubRow[] => {
    return catalogClubs
      .map((club) => {
        const coords =
          typeof club.club_lat === 'number' &&
          typeof club.club_lng === 'number' &&
          Number.isFinite(club.club_lat) &&
          Number.isFinite(club.club_lng)
            ? normalizeLatLngPair(club.club_lat, club.club_lng)
            : null
        const distanceKm =
          userCoords && coords
            ? haversineDistance(
                userCoords.lat,
                userCoords.lng,
                coords.lat,
                coords.lng,
              )
            : null
        // Map, links, and bounds must use the same normalized club_lat/club_lng as distances.
        const club_lat = coords?.lat ?? club.club_lat
        const club_lng = coords?.lng ?? club.club_lng
        return { ...club, club_lat, club_lng, coords, distanceKm }
      })
      .sort((a, b) => {
        if (a.distanceKm != null && b.distanceKm != null) {
          return a.distanceKm - b.distanceKm
        }
        if (a.distanceKm != null) return -1
        if (b.distanceKm != null) return 1
        return a.name.localeCompare(b.name)
      })
  }, [userCoords, catalogClubs])

  const selectedClub =
    selectedClubId === ''
      ? null
      : (clubs.find((club) => club.id === selectedClubId) ?? null)

  const scrollCardIntoView = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    })
  }, [])

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast("Your browser doesn't support location services.")
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // W3C: coords.latitude / .longitude are always geographic lat/lng — do not swap.
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationActive(true)
        setIsLocating(false)
        setUserFitGeneration((g) => g + 1)
      },
      (err) => {
        setIsLocating(false)
        if (err.code === 1) {
          showToast(
            'Location access denied. Please enable it in your browser settings.',
          )
        } else {
          showToast('Could not get your location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const onMarkerSelect = useCallback(
    (id: string) => {
      setSelectedClubId(id)
      scrollCardIntoView(id)
    },
    [scrollCardIntoView],
  )

  const onShowOnMap = (club: ClubRow) => {
    if (club.coords === null) return
    setSelectedClubId(club.id)
    setFlyToClubId(club.id)
    setMapPopupTick((t) => t + 1)
    scrollCardIntoView(club.id)
  }

  const onFlyToDone = useCallback(() => {
    setFlyToClubId(null)
  }, [])

  const onMapPopupHandled = useCallback(() => {}, [])

  const mapsOpenHref = selectedClub
    ? getGoogleMapsUrl(selectedClub, userCoords)
    : userCoords
      ? `https://www.google.com/maps/search/?api=1&query=${userCoords.lat},${userCoords.lng}`
      : getDefaultMapOpenUrl()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      {toast ? (
        <div className="clubs-map-toast" role="alert">
          {toast}
        </div>
      ) : null}
      <main className="clubs-map-main w-full pt-16">
        <div className="po-container flex min-h-0 flex-1 flex-col py-4 sm:py-6 pb-10">
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-0.5 h-9 w-9 shrink-0 rounded-full border-border/50 bg-transparent text-muted-foreground shadow-none transition-all duration-200 hover:border-transparent hover:bg-[linear-gradient(to_right,hsl(var(--primary)),hsl(var(--accent)))] hover:text-primary-foreground hover:shadow-[0_0_20px_-4px_hsl(330_81%_60%/0.45)]"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Clubs Near You
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse registered clubs on a live map and discover what is closest.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 self-start rounded-full border-border/50 bg-transparent px-4 text-muted-foreground shadow-none transition-all duration-200 hover:border-transparent hover:bg-[linear-gradient(to_right,hsl(var(--primary)),hsl(var(--accent)))] hover:text-primary-foreground hover:shadow-[0_0_20px_-4px_hsl(330_81%_60%/0.45)] sm:self-auto"
              onClick={handleLocateMe}
              disabled={isLocating}
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : locationActive ? (
                <MapPin className="h-4 w-4" aria-hidden />
              ) : (
                <LocateFixed className="h-4 w-4" aria-hidden />
              )}
              {isLocating
                ? 'Locating…'
                : locationActive
                  ? 'Location active'
                  : 'Use my location'}
            </Button>
          </div>

          {clubsError ? (
            <p className="clubs-map-page__error shrink-0">{clubsError}</p>
          ) : null}
          {clubsLoading && catalogClubs.length === 0 ? (
            <p className="po-container py-4 text-sm text-muted-foreground">
              Loading clubs…
            </p>
          ) : null}

          <div className="clubs-map-layout mt-4 sm:mt-5">
            <div className="clubs-map-canvas">
              <ClubsNearMap
                clubs={clubs}
                userCoords={userCoords}
                selectedClubId={selectedClubId}
                onMarkerSelect={onMarkerSelect}
                popupSignal={mapPopupTick}
                onPopupHandled={onMapPopupHandled}
                flyToClubId={flyToClubId}
                onFlyToDone={onFlyToDone}
                userFitGeneration={userFitGeneration}
              />
              <a
                href={mapsOpenHref}
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
                    ref={(el) => {
                      cardRefs.current[club.id] = el
                    }}
                    className={`clubs-nearby-card cursor-pointer ${
                      selectedClubId === club.id ? 'clubs-nearby-card--active' : ''
                    }`}
                    onClick={() => navigate(`/clubs/${encodeURIComponent(club.id)}`)}
                  >
                    <ClubCoverImage
                      src={club.imageUrl}
                      alt={club.name}
                      className="clubs-nearby-card__img"
                    />
                    <div className="clubs-nearby-card__body">
                      <h3 className="clubs-nearby-card__name">{club.name}</h3>
                      <p className="clubs-nearby-card__meta">
                        {club.city ?? 'Unknown city'}{' '}
                        {club.address ? `- ${club.address}` : ''}
                      </p>
                      <p
                        className={
                          club.distanceKm !== null
                            ? 'clubs-nearby-card__distance'
                            : 'clubs-nearby-card__distance clubs-nearby-card__distance--muted'
                        }
                      >
                        {club.distanceKm !== null
                          ? formatDistanceAway(club.distanceKm)
                          : userCoords
                            ? 'Location unavailable'
                            : 'Enable location to see distance'}
                      </p>
                      <div className="clubs-nearby-card__actions">
                        <button
                          type="button"
                          className="clubs-nearby-card__show-btn"
                          disabled={club.coords === null}
                          onClick={(e) => { e.stopPropagation(); onShowOnMap(club) }}
                        >
                          Show on map
                        </button>
                        <a
                          href={getGoogleMapsUrl(club, userCoords)}
                          target="_blank"
                          rel="noreferrer"
                          className="clubs-nearby-card__maps-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink
                            className="clubs-nearby-card__maps-icon"
                            aria-hidden
                          />
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
