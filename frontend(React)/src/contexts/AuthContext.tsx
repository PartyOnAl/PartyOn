import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import type { Session, User, SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, managerSupabase, userSupabase } from '@/lib/supabase'

type UserProfile = {
  id: string
  role: string | null
  name: string | null
  surname: string | null
  username: string | null
  email: string | null
  birth_date: string | null
  phone_number: string | null
  club_id: string | null
  avatar_url: string | null
  created_at: string | null
  updated_at: string | null
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthLane = 'user' | 'manager'

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const lane: AuthLane =
    location.pathname.startsWith('/manager') || location.pathname.startsWith('/admin')
      ? 'manager'
      : 'user'
  const authClient: SupabaseClient | null =
    lane === 'manager' ? managerSupabase : userSupabase
  const laneRef = useRef(lane)
  laneRef.current = lane

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  /** Last lane we finished loading session+profile for (see auth race fix). */
  const [readyLane, setReadyLane] = useState<AuthLane | null>(null)

  const syncProfile = useCallback(async (client: SupabaseClient | null, nextUser: User | null) => {
    if (!client || !nextUser?.id) {
      setProfile(null)
      return
    }
    const { data, error } = await client
      .from('profiles')
      .select(
        'id, role, name, surname, username, email, birth_date, phone_number, club_id, avatar_url, created_at, updated_at',
      )
      .eq('id', nextUser.id)
      .single()

    if (error) {
      setProfile(null)
      return
    }
    setProfile(data as UserProfile)
  }, [])

  const isLoading =
    !isSupabaseConfigured || !authClient
      ? false
      : readyLane !== lane

  useEffect(() => {
    if (!isSupabaseConfigured || !authClient) {
      setUser(null)
      setSession(null)
      setProfile(null)
      setReadyLane(lane)
      return
    }

    const laneAtStart = lane
    let cancelled = false

    const applySession = async (s: Session | null) => {
      setSession(s ?? null)
      const nextUser = s?.user ?? null
      setUser(nextUser)
      await syncProfile(authClient, nextUser)
      if (!cancelled && laneRef.current === laneAtStart) {
        setReadyLane(laneAtStart)
      }
    }

    void authClient.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled || laneRef.current !== laneAtStart) return
      void applySession(s ?? null)
    })

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((_event, s) => {
      if (laneRef.current !== laneAtStart) return
      void applySession(s ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [lane, authClient, syncProfile])

  const signOut = useCallback(async () => {
    if (authClient) await authClient.auth.signOut()
  }, [authClient])

  const hasRole = useCallback((role: string) => {
    const r = profile?.role ?? user?.user_metadata?.role
    return typeof r === 'string' && r === role
  }, [profile, user])

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
