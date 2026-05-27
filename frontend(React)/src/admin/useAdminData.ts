import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../api'
import { getCachedAdminData, setCachedAdminData } from './adminDataCache'

type UseAdminDataOptions = {
  /** When false, skip network fetch if cache hit (instant navigation). */
  revalidate?: boolean
}

/**
 * Cached admin fetch — shows cached data immediately when switching admin pages,
 * then refreshes in the background.
 */
export function useAdminData<T>(
  cacheKey: string,
  token: string | undefined,
  fetcher: (accessToken: string) => Promise<ApiResult<T>>,
  options?: UseAdminDataOptions,
) {
  const revalidate = options?.revalidate !== false
  const [data, setData] = useState<T | null>(() =>
    token ? getCachedAdminData<T>(cacheKey) : null,
  )
  const [loading, setLoading] = useState(() => {
    if (!token) return false
    return !getCachedAdminData<T>(cacheKey)
  })
  const [error, setError] = useState<string | null>(null)
  const fetchIdRef = useRef(0)
  const lastTokenRef = useRef<string | undefined>(token)
  if (token) lastTokenRef.current = token

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      const effectiveToken = token ?? lastTokenRef.current
      if (!effectiveToken) return
      const silent = opts?.silent ?? false
      const fetchId = ++fetchIdRef.current
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      const result = await fetcher(effectiveToken)
      if (fetchId !== fetchIdRef.current) return
      if (result.error) {
        setError(result.error)
        if (!silent) setData(null)
      } else if (result.data) {
        setCachedAdminData(cacheKey, result.data)
        setData(result.data)
        setError(null)
      }
      if (!silent) setLoading(false)
    },
    [token, fetcher, cacheKey],
  )

  useEffect(() => {
    const effectiveToken = token ?? lastTokenRef.current
    if (!effectiveToken) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const hit = getCachedAdminData<T>(cacheKey)
    if (hit) {
      setData(hit)
      setLoading(false)
      if (revalidate) void reload({ silent: true })
      return
    }

    setLoading(true)
    void (async () => {
      const fetchId = ++fetchIdRef.current
      const result = await fetcher(effectiveToken)
      if (fetchId !== fetchIdRef.current) return
      if (result.error) {
        setError(result.error)
        setData(null)
      } else if (result.data) {
        setCachedAdminData(cacheKey, result.data)
        setData(result.data)
        setError(null)
      }
      setLoading(false)
    })()
  }, [token, cacheKey, revalidate, reload, fetcher])

  return { data, loading, error, reload, setData }
}
