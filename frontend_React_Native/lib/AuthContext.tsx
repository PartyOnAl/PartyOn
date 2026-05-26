import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'
import type { Profile } from './types'

WebBrowser.maybeCompleteAuthSession()

type AuthCtx = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string, surname: string) => Promise<string | null>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
}

const AuthContext = createContext<AuthCtx | null>(null)

function isRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()
  return normalized.includes('refresh token') || normalized.includes('invalid refresh token')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    function clearAuthState() {
      setSession(null)
      setUser(null)
      setProfile(null)
      setLoading(false)
    }

    async function clearStaleSession() {
      clearAuthState()
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    }

    supabase.auth.getSession().then(({ data, error }) => {
      // Invalid / expired refresh token — wipe the stale session so the user
      // lands on the login screen instead of seeing a red error in the console.
      if (error && isRefreshTokenError(error)) {
        void clearStaleSession()
        setLoading(false)
        return
      }
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      if (isRefreshTokenError(error)) {
        void clearStaleSession()
        return
      }
      clearAuthState()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      // Supabase emits TOKEN_REFRESHED with null session when the refresh token
      // is rejected — treat it the same as a sign-out so we clear state cleanly.
      if (event === 'TOKEN_REFRESHED' && !s) {
        void clearStaleSession()
      }
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  }

  async function signUp(email: string, password: string, name: string, surname: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, surname } },
    })
    if (error) return error.message
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, email, name, surname })
    }
    return null
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error && isRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    }
  }

  async function signInWithGoogle(): Promise<string | null> {
    try {
      const redirectUrl = Linking.createURL('/auth/callback')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      })
      if (error || !data.url) return error?.message ?? 'Google sign-in failed'
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type !== 'success') return null
      const rawUrl = result.url
      const hashString = rawUrl.includes('#') ? rawUrl.split('#')[1] : rawUrl.split('?')[1] ?? ''
      const params = new URLSearchParams(hashString)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (!accessToken || !refreshToken) return 'Could not extract session from redirect'
      const { error: sessionErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      return sessionErr ? sessionErr.message : null
    } catch (err: any) {
      return err?.message ?? 'Google sign-in failed'
    }
  }

  async function resetPassword(email: string): Promise<string | null> {
    const redirectUrl = Linking.createURL('/auth/reset-password')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl })
    return error ? error.message : null
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
