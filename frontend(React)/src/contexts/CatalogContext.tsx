import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getJson } from '@/api'
import type { Club, Event, Promotion } from '@/types'

type CatalogState = {
  events: Event[]
  clubs: Club[]
  promotions: Promotion[]
  terms: string | null
  termsUpdatedAt: string | null
  loading: boolean
  error: string | null
}

const CatalogContext = createContext<CatalogState | null>(null)

type CatalogPayload = {
  events: Event[]
  clubs: Club[]
  promotions?: Promotion[]
  terms?: string
  termsUpdatedAt?: string
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [terms, setTerms] = useState<string | null>(null)
  const [termsUpdatedAt, setTermsUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await getJson<CatalogPayload>('/catalog')
      if (cancelled) return
      if (err) {
        setError(err)
        setEvents([])
        setClubs([])
        setPromotions([])
        setTerms(null)
        setTermsUpdatedAt(null)
      } else {
        setError(null)
        setEvents(Array.isArray(data?.events) ? data.events : [])
        setClubs(Array.isArray(data?.clubs) ? data.clubs : [])
        setPromotions(Array.isArray(data?.promotions) ? data.promotions : [])
        setTerms(data?.terms ?? null)
        setTermsUpdatedAt(data?.termsUpdatedAt ?? null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({ events, clubs, promotions, terms, termsUpdatedAt, loading, error }),
    [events, clubs, promotions, terms, termsUpdatedAt, loading, error],
  )

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  )
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext)
  if (!ctx) {
    throw new Error('useCatalog must be used within CatalogProvider')
  }
  return ctx
}
