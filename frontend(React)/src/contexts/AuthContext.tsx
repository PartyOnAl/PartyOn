import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

import { isAuthBanError, isUserBlocked } from '@/lib/accountBlocked'
import { roleFromUser } from '@/lib/accountRoles'
import { persistAdminRoleHint, recoverPersistedSession } from '@/lib/authSession'
import {
  authClientForLane,
  authLaneFromPathname,
  getAuthUser,
  isSupabaseConfigured,
  type AuthLane,
} from '@/lib/supabase'

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
  isLoading: boolean
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const PROFILE_COLUMNS =
  'id, role, name, surname, username, email, birth_date, phone_number, club_id, created_at, updated_at'

function profileFromUserMetadata(user: User): UserProfile | null {
  const role = roleFromUser(user)
  if (!role) return null

  return {
    id: user.id,
    role,
    name: null,
    surname: null,
    username: null,
    email: typeof user.email === 'string' ? user.email : null,
    birth_date: null,
    phone_number: null,
    club_id: null,
    created_at: null,
    updated_at: null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const lane = authLaneFromPathname(location.pathname)
  const authClient = authClientForLane(lane)
  const laneRef = useRef(lane)
  const pathnameRef = useRef(location.pathname)

  laneRef.current = lane
  pathnameRef.current = location.pathname

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [readyLane, setReadyLane] = useState<AuthLane | null>(null)

  const clearState = useCallback(() => {
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const redirectBlockedToLogin = useCallback(() => {
    const path = pathnameRef.current
    if (path === '/login' || path === '/signup' || path === '/reset-password') return
    navigate('/login', { replace: true, state: { accountBlocked: true } })
  }, [navigate])

  const loadProfile = useCallback(
    async (client: SupabaseClient, nextUser: User | null) => {
      if (!nextUser?.id) {
        setProfile(null)
        return
      }

      const { data, error } = await client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', nextUser.id)
        .single()

      setProfile(error ? profileFromUserMetadata(nextUser) : (data as UserProfile))
    },
    [],
  )

  const applySession = useCallback(
    async (
      nextSession: Session | null,
      client: SupabaseClient,
      sessionLane: AuthLane,
      options?: { verifyBlocked?: boolean },
    ) => {
      if (laneRef.current !== sessionLane) return

      if (!nextSession) {
        clearState()
        return
      }

      if (isUserBlocked(nextSession.user)) {
        await client.auth.signOut({ scope: 'local' })
        clearState()
        redirectBlockedToLogin()
        return
      }

      if (options?.verifyBlocked) {
        const { data, error } = await getAuthUser(sessionLane)
        if ((!error || isAuthBanError(error)) && isUserBlocked(data.user)) {
          await client.auth.signOut({ scope: 'local' })
          clearState()
          redirectBlockedToLogin()
          return
        }
      }

      if (laneRef.current !== sessionLane) return

      setSession(nextSession)
      setUser(nextSession.user ?? null)
      await loadProfile(client, nextSession.user ?? null)

      if (sessionLane === 'admin') {
        persistAdminRoleHint(nextSession.user)
      }
    },
    [clearState, loadProfile, redirectBlockedToLogin],
  )

  useEffect(() => {
    if (!isSupabaseConfigured || !authClient) {
      clearState()
      setReadyLane(lane)
      return
    }

    const effectLane = lane
    const client = authClient
    let cancelled = false
    let initialized = false

    setReadyLane(null)
    clearState()

    const markReady = () => {
      if (cancelled || laneRef.current !== effectLane) return
      initialized = true
      setReadyLane(effectLane)
    }

    const handleSession = async (
      nextSession: Session | null,
      options?: { verifyBlocked?: boolean; clearWhenNull?: boolean },
    ) => {
      if (cancelled || laneRef.current !== effectLane) return

      if (!nextSession && options?.clearWhenNull === false) {
        markReady()
        return
      }

      await applySession(nextSession, client, effectLane, {
        verifyBlocked: options?.verifyBlocked,
      })
      markReady()
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled || laneRef.current !== effectLane) return

      if (event === 'SIGNED_OUT') {
        if (initialized) void handleSession(null)
        return
      }

      if (!nextSession) return

      void handleSession(nextSession, {
        verifyBlocked:
          effectLane === 'user' && (event === 'SIGNED_IN' || event === 'USER_UPDATED'),
      })
    })

    void (async () => {
      const restored = await recoverPersistedSession(client, effectLane)
      if (cancelled || laneRef.current !== effectLane) return

      await handleSession(restored, {
        clearWhenNull: true,
        verifyBlocked: effectLane === 'user',
      })
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [applySession, authClient, clearState, lane])

  useEffect(() => {
    if (!isSupabaseConfigured || !authClient || !session || lane !== 'user') return

    const check = () => {
      if (laneRef.current !== 'user') return
      void getAuthUser('user').then(async ({ data, error }) => {
        if (error && !isAuthBanError(error)) return
        if (!isUserBlocked(data.user)) return

        await authClient.auth.signOut({ scope: 'local' })
        clearState()
        redirectBlockedToLogin()
      })
    }

    const intervalId = window.setInterval(check, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [authClient, clearState, redirectBlockedToLogin, lane, session])

  const signOut = useCallback(async () => {
    if (!authClient) return
    await authClient.auth.signOut({ scope: 'local' })
    clearState()
    setReadyLane(lane)
  }, [authClient, clearState, lane])

  const hasRole = useCallback(
    (role: string) => {
      const currentRole = profile?.role ?? user?.user_metadata?.role
      return currentRole === role
    },
    [profile, user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isLoading: isSupabaseConfigured && Boolean(authClient) && readyLane !== lane,
      signOut,
      hasRole,
    }),
    [authClient, hasRole, lane, profile, readyLane, session, signOut, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
