const DEFAULT_TTL_MS = 45_000

type CacheEntry = {
  data: unknown
  expires: number
}

const cache = new Map<string, CacheEntry>()

export function getCachedAdminData<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCachedAdminData(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expires: Date.now() + ttlMs })
}

export function invalidateAdminCache(prefix?: string): void {
  if (!prefix) {
    cache.clear()
    return
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
