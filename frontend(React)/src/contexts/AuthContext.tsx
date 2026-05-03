import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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
  created_at: string | null
  updated_at: string | null
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const syncProfile = useCallback(async (nextUser: User | null) => {
    if (!supabase || !nextUser?.id) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, role, name, surname, username, email, birth_date, phone_number, club_id, created_at, updated_at',
      )
      .eq('id', nextUser.id)
      .single()

    if (error) {
      setProfile(null)
      return
    }
    setProfile(data as UserProfile)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
      const nextUser = s?.user ?? null
      setUser(nextUser)
      void syncProfile(nextUser)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
      const nextUser = s?.user ?? null
      setUser(nextUser)
      void syncProfile(nextUser)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [syncProfile])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  const hasRole = useCallback((role: string) => {
    const r = profile?.role ?? user?.user_metadata?.role
    return typeof r === 'string' && r === role
  }, [profile, user])

  return (
    <AuthContext.Provider value={{ user, session, profile, signOut, hasRole }}>
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
