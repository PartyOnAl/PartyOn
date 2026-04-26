import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteJsonAuth,
  getJsonAuth,
  postJsonAuth,
} from '@/api'
import type { Event } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { getAccessTokenForApi } from '@/lib/supabaseAccessToken'

type SavedEventsState = {
  savedEvents: Event[]
  loading: boolean
  refresh: (opts?: {
    silent?: boolean
    authToken?: string | null
  }) => Promise<void>
  saveEvent: (eventId: string) => Promise<{ ok: boolean; error?: string }>
  removeEvent: (eventId: string) => Promise<{ ok: boolean; error?: string }>
  isSaved: (eventId: string) => boolean
}

const SavedEventsContext = createContext<SavedEventsState | null>(null)

function idsFromEvents(list: Event[]): Set<string> {
  return new Set(list.map((e) => e.id).filter(Boolean))
}

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [savedEvents, setSavedEvents] = useState<Event[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)

  const applyPayload = useCallback((list: Event[]) => {
    const arr = Array.isArray(list) ? list : []
    setSavedEvents(arr)
    setSavedIds(idsFromEvents(arr))
  }, [])

  const refresh = useCallback(
    async (opts?: { silent?: boolean; authToken?: string | null }) => {
      if (!user) {
        applyPayload([])
        return
      }
      const token =
        opts?.authToken !== undefined ? opts.authToken : await getAccessTokenForApi()
      if (!token) {
        applyPayload([])
        return
      }
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      try {
        const { data, error } = await getJsonAuth<{ events: Event[] }>(
          '/me/saved-events',
          token,
        )
        if (error || !data) {
          if (!silent) applyPayload([])
        } else {
          applyPayload(Array.isArray(data.events) ? data.events : [])
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [user?.id, applyPayload],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveEvent = useCallback(
    async (eventId: string) => {
      if (!user) {
        return { ok: false, error: 'Sign in to save events.' }
      }
      const token = await getAccessTokenForApi()
      if (!token) {
        return { ok: false, error: 'Sign in to save events.' }
      }
      const { error } = await postJsonAuth<{ ok: true }>(
        '/me/saved-events',
        token,
        { eventId },
      )
      if (error) {
        return { ok: false, error }
      }
      setSavedIds((prev) => new Set(prev).add(eventId))
      void refresh({ silent: true, authToken: token })
      return { ok: true }
    },
    [user, refresh],
  )

  const removeEvent = useCallback(
    async (eventId: string) => {
      if (!user) {
        return { ok: false, error: 'Sign in to manage saved events.' }
      }
      const token = await getAccessTokenForApi()
      if (!token) {
        return { ok: false, error: 'Sign in to manage saved events.' }
      }
      const { error } = await deleteJsonAuth<{ ok: true }>(
        `/me/saved-events/${encodeURIComponent(eventId)}`,
        token,
      )
      if (error) {
        return { ok: false, error }
      }
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(eventId)
        return next
      })
      void refresh({ silent: true, authToken: token })
      return { ok: true }
    },
    [user, refresh],
  )

  const isSaved = useCallback(
    (eventId: string) => savedIds.has(eventId),
    [savedIds],
  )

  const value = useMemo(
    () => ({
      savedEvents,
      loading,
      refresh,
      saveEvent,
      removeEvent,
      isSaved,
    }),
    [savedEvents, loading, refresh, saveEvent, removeEvent, isSaved],
  )

  return (
    <SavedEventsContext.Provider value={value}>
      {children}
    </SavedEventsContext.Provider>
  )
}

export function useSavedEvents(): SavedEventsState {
  const ctx = useContext(SavedEventsContext)
  if (!ctx) {
    throw new Error('useSavedEvents must be used within SavedEventsProvider')
  }
  return ctx
}
