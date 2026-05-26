import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { ExternalLink, MapPin } from 'lucide-react'
import { toLeafletLatLng, normalizeLatLngPair } from '@/lib/geoNormalize'
import 'leaflet/dist/leaflet.css'

type OfferVenueMapProps = {
  lat?: number
  lng?: number
  venueName: string
  address?: string
}

function buildGoogleMapsUrl(
  lat: number | undefined,
  lng: number | undefined,
  venueName: string,
  address?: string,
): string {
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    const c = normalizeLatLngPair(lat, lng)
    return `https://www.google.com/maps?q=${c.lat},${c.lng}`
  }
  const query = [venueName, address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || venueName)}`
}

export function OfferVenueMap({ lat, lng, venueName, address }: OfferVenueMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const googleMapsHref = useMemo(
    () => buildGoogleMapsUrl(lat, lng, venueName, address),
    [lat, lng, venueName, address],
  )

  const coords = useMemo(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return normalizeLatLngPair(lat, lng)
  }, [lat, lng])

  const openInMapsLink = (
    <a
      href={googleMapsHref}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/50 bg-background/80 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
    >
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
      Open in Google Maps
    </a>
  )

  if (!mounted) {
    return (
      <div className="space-y-2">
        <div
          className="flex h-32 w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
          aria-hidden
        >
          Loading map…
        </div>
        {openInMapsLink}
      </div>
    )
  }

  if (!coords) {
    return (
      <a
        href={googleMapsHref}
        target="_blank"
        rel="noreferrer"
        className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
      >
        <MapPin className="h-6 w-6" aria-hidden />
        <span>Open in Google Maps</span>
      </a>
    )
  }

  const center = toLeafletLatLng(coords.lat, coords.lng)

  return (
    <div className="space-y-2">
      <div className="relative z-0 h-32 w-full overflow-hidden rounded-xl border border-border/40">
        <MapContainer
          center={center}
          zoom={15}
          className="h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
          scrollWheelZoom={false}
          dragging
          doubleClickZoom={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <CircleMarker
            center={center}
            radius={11}
            pathOptions={{
              color: '#f472b6',
              fillColor: '#ec4899',
              fillOpacity: 0.95,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{venueName}</strong>
              {address ? (
                <>
                  <br />
                  {address}
                </>
              ) : null}
              <br />
              <a
                href={googleMapsHref}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                Open in Google Maps
              </a>
            </Popup>
          </CircleMarker>
        </MapContainer>
      </div>
      {openInMapsLink}
    </div>
  )
}
