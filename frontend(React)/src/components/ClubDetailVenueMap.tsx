import { useEffect, useState } from 'react'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { normalizeLatLngPair, toLeafletLatLng } from '@/lib/geoNormalize'
import 'leaflet/dist/leaflet.css'
import './ClubDetailVenueMap.css'

const pinHtml = `<div class="club-detail-map-pin" aria-hidden="true"></div>`

function venuePinIcon() {
  return L.divIcon({
    className: 'club-detail-map-pin-shell',
    html: pinHtml,
    iconSize: [28, 34],
    iconAnchor: [14, 32],
    popupAnchor: [0, -28],
  })
}

/** Leaflet often needs a resize after mount when the map lives in a responsive grid. */
function MapInvalidateOnMount() {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
    }, 50)
    return () => window.clearTimeout(id)
  }, [map])
  return null
}

type ClubDetailVenueMapProps = {
  /** From DB column `club_lat` */
  club_lat: number
  /** From DB column `club_lng` */
  club_lng: number
  name: string
}

export function ClubDetailVenueMap({
  club_lat,
  club_lng,
  name,
}: ClubDetailVenueMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { lat, lng } = normalizeLatLngPair(club_lat, club_lng)
  const center = toLeafletLatLng(lat, lng)

  if (!mounted) {
    return <div className="club-detail-map--placeholder" aria-hidden />
  }

  return (
    <MapContainer
      key={`${lat},${lng}`}
      center={center}
      zoom={15}
      className="club-detail-map"
      scrollWheelZoom={false}
    >
      <MapInvalidateOnMount />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={center} icon={venuePinIcon()}>
        <Popup>{name}</Popup>
      </Marker>
    </MapContainer>
  )
}
