import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { toLeafletLatLng } from '@/lib/geoNormalize'

/** Earth distance in km — same semantics as TopClubs (lat/lng in degrees). */
function haversineKm(
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

/** Ignore far-away pins when framing the map so one bad coordinate does not jump the globe. */
const MAX_CLUB_KM_FOR_USER_FIT = 900
import 'leaflet/dist/leaflet.css'

export type MapClub = {
  id: string
  name: string
  club_lat?: number
  club_lng?: number
}

type Coordinates = { lat: number; lng: number }

const pinkPinHtml = (active: boolean) =>
  `<div class="clubs-map-pin${active ? ' clubs-map-pin--active' : ''}" aria-hidden="true"></div>`

function clubDivIcon(active: boolean) {
  return L.divIcon({
    className: 'clubs-map-pin-shell',
    html: pinkPinHtml(active),
    iconSize: [28, 34],
    iconAnchor: [14, 32],
    popupAnchor: [0, -28],
  })
}

const userHereIcon = L.divIcon({
  className: 'clubs-map-user-shell',
  html: `
    <div class="clubs-map-user-marker" aria-hidden="true">
      <span class="clubs-map-user-marker__pulse"></span>
      <span class="clubs-map-user-marker__dot"></span>
    </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
})

function FitInitialBounds({
  clubsWithCoords,
  userCoords,
  userFitGeneration,
}: {
  clubsWithCoords: MapClub[]
  userCoords: Coordinates | null
  userFitGeneration: number
}) {
  const map = useMap()
  const didDefault = useRef(false)

  useEffect(() => {
    if (userCoords && userFitGeneration > 0) {
      const uLat = userCoords.lat
      const uLng = userCoords.lng
      const nearbySorted = [...clubsWithCoords]
        .filter(
          (c) =>
            typeof c.club_lat === 'number' && typeof c.club_lng === 'number',
        )
        .map((c) => ({
          c,
          km: haversineKm(
            uLat,
            uLng,
            c.club_lat as number,
            c.club_lng as number,
          ),
        }))
        .filter(({ km }) => km <= MAX_CLUB_KM_FOR_USER_FIT)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
        .map(({ c }) => c)

      const pts: L.LatLngTuple[] = [toLeafletLatLng(uLat, uLng)]
      for (const c of nearbySorted) {
        pts.push(
          toLeafletLatLng(c.club_lat as number, c.club_lng as number),
        )
      }
      if (pts.length === 1) {
        map.setView(pts[0], 13, { animate: true })
        return
      }
      const b = L.latLngBounds(pts[0], pts[0])
      pts.forEach((p) => b.extend(p))
      map.fitBounds(b, { padding: [48, 48], maxZoom: 14, animate: true })
      return
    }

    if (!userCoords && !didDefault.current && clubsWithCoords.length > 0) {
      didDefault.current = true
      const pts: L.LatLngTuple[] = clubsWithCoords.map((c) =>
        toLeafletLatLng(c.club_lat as number, c.club_lng as number),
      )
      if (pts.length === 1) {
        map.setView(pts[0], 13, { animate: false })
        return
      }
      const b = L.latLngBounds(pts[0], pts[0])
      pts.forEach((p) => b.extend(p))
      map.fitBounds(b, { padding: [40, 40], maxZoom: 13, animate: false })
    }
  }, [map, clubsWithCoords, userCoords, userFitGeneration])

  return null
}

function FlyToClub({
  targetId,
  clubsWithCoords,
  onDone,
}: {
  targetId: string | null
  clubsWithCoords: MapClub[]
  onDone: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!targetId) return
    const club = clubsWithCoords.find((c) => c.id === targetId)
    if (
      !club ||
      typeof club.club_lat !== 'number' ||
      typeof club.club_lng !== 'number'
    ) {
      onDone()
      return
    }
    map.setView(
      toLeafletLatLng(club.club_lat, club.club_lng),
      15,
      { animate: true },
    )
    const t = window.setTimeout(onDone, 550)
    return () => window.clearTimeout(t)
  }, [targetId, clubsWithCoords, map, onDone])
  return null
}

function ClubMarker({
  club,
  selected,
  openPopupSignal,
  onSelect,
  onPopupOpened,
}: {
  club: MapClub & { club_lat: number; club_lng: number }
  selected: boolean
  openPopupSignal: number
  onSelect: () => void
  onPopupOpened: () => void
}) {
  const ref = useRef<L.Marker | null>(null)
  const lastSignal = useRef(0)

  useEffect(() => {
    if (openPopupSignal > 0 && openPopupSignal !== lastSignal.current) {
      lastSignal.current = openPopupSignal
      window.setTimeout(() => {
        ref.current?.openPopup()
        onPopupOpened()
      }, 480)
    }
  }, [openPopupSignal, onPopupOpened])

  return (
    <Marker
      ref={ref}
      position={toLeafletLatLng(club.club_lat, club.club_lng)}
      icon={clubDivIcon(selected)}
      eventHandlers={{
        click: () => onSelect(),
      }}
    >
      <Popup>{club.name}</Popup>
    </Marker>
  )
}

type ClubsNearMapProps = {
  clubs: MapClub[]
  userCoords: Coordinates | null
  selectedClubId: string
  onMarkerSelect: (id: string) => void
  /** Increment to open popup for selectedClubId (Show on map). */
  popupSignal: number
  onPopupHandled: () => void
  flyToClubId: string | null
  onFlyToDone: () => void
  userFitGeneration: number
}

export function ClubsNearMap({
  clubs,
  userCoords,
  selectedClubId,
  onMarkerSelect,
  popupSignal,
  onPopupHandled,
  flyToClubId,
  onFlyToDone,
  userFitGeneration,
}: ClubsNearMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const clubsWithCoords = useMemo(
    () =>
      clubs.filter(
        (c) =>
          typeof c.club_lat === 'number' && typeof c.club_lng === 'number',
      ) as (MapClub & { club_lat: number; club_lng: number })[],
    [clubs],
  )

  /** Tirana — Leaflet order [latitude, longitude]. */
  const defaultCenter = toLeafletLatLng(41.3275, 19.8187)

  if (!mounted) {
    return (
      <div
        className="clubs-map-leaflet clubs-map-leaflet--placeholder"
        aria-hidden
      />
    )
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="clubs-map-leaflet"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitInitialBounds
        clubsWithCoords={clubsWithCoords}
        userCoords={userCoords}
        userFitGeneration={userFitGeneration}
      />
      <FlyToClub
        targetId={flyToClubId}
        clubsWithCoords={clubsWithCoords}
        onDone={onFlyToDone}
      />
      {userCoords ? (
        <Marker
          position={toLeafletLatLng(userCoords.lat, userCoords.lng)}
          icon={userHereIcon}
        >
          <Popup>You are here</Popup>
        </Marker>
      ) : null}
      {clubsWithCoords.map((club) => (
        <ClubMarker
          key={club.id}
          club={club}
          selected={selectedClubId === club.id}
          openPopupSignal={
            selectedClubId === club.id ? popupSignal : 0
          }
          onSelect={() => onMarkerSelect(club.id)}
          onPopupOpened={onPopupHandled}
        />
      ))}
    </MapContainer>
  )
}
