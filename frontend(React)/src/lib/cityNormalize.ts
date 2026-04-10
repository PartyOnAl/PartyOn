/**
 * After NFD + strip combining marks, "Tiranë" becomes "tirane" but "Tirana" stays
 * "tirana" — same city, different keys. Map known SQ/EN pairs to one key.
 */
const CITY_KEY_ALIASES: Record<string, string> = {
  tirane: 'tirana',
}

/** Fixed label for a match key (overrides merged spelling from data). */
const CANONICAL_CITY_LABEL: Record<string, string> = {
  tirana: 'Tirana',
}

/** Fold for matching; merges Tirana / Tiranë / ASCII "Tirane". */
export function cityMatchKey(city: string): string {
  let k = city
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  k = CITY_KEY_ALIASES[k] ?? k
  return k
}

/** When two spellings share a key, prefer the one with native diacritics (unless overridden below). */
export function preferCityDisplayName(a: string, b: string): string {
  const aT = a.trim()
  const bT = b.trim()
  if (aT === bT) return aT
  const aHasDiacritic = /[^\u0000-\u007f]/.test(aT)
  const bHasDiacritic = /[^\u0000-\u007f]/.test(bT)
  if (aHasDiacritic && !bHasDiacritic) return aT
  if (bHasDiacritic && !aHasDiacritic) return bT
  return aT.localeCompare(bT, 'sq') <= 0 ? aT : bT
}

/** One entry per real city; optional fixed labels (e.g. Tirana for tirana key). */
export function uniqueCanonicalCities(raw: Iterable<string>): string[] {
  const byKey = new Map<string, string>()
  for (const r of raw) {
    const t = r?.trim()
    if (!t || t === '—' || t === '-') continue
    const key = cityMatchKey(t)
    const prev = byKey.get(key)
    const merged = prev ? preferCityDisplayName(prev, t) : t
    byKey.set(key, CANONICAL_CITY_LABEL[key] ?? merged)
  }
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'sq'))
}
