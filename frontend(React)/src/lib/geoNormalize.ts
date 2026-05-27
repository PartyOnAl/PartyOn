/**
 * Leaflet and our app use geographic order: latitude first, then longitude.
 * Some datasets store the pair reversed in column names. For the Western
 * Balkans (incl. Albania ~41°N, ~19–20°E), detect obvious swaps and fix.
 */
export function normalizeLatLngPair(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const latMin = 38.5
  const latMax = 46.5
  const lngMin = 17.5
  const lngMax = 24.5

  const orderLooksCorrect =
    lat >= latMin &&
    lat <= latMax &&
    lng >= lngMin &&
    lng <= lngMax

  if (orderLooksCorrect) {
    return { lat, lng }
  }

  const swappedLooksCorrect =
    lng >= latMin &&
    lng <= latMax &&
    lat >= lngMin &&
    lat <= lngMax

  if (swappedLooksCorrect) {
    return { lat: lng, lng: lat }
  }

  return { lat, lng }
}

/** Tuple for Leaflet: [latitude, longitude] — never [lng, lat]. */
export function toLeafletLatLng(lat: number, lng: number): [number, number] {
  return [lat, lng]
}
