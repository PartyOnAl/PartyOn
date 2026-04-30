import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'

// Required for iOS — closes the auth session when the redirect comes back
WebBrowser.maybeCompleteAuthSession()

type AuthCtx = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, name: string, surname: string) => Promise<string | null>
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setUser(s?.user ?? null)
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
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        surname,
      })
    }
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function signInWithGoogle(): Promise<string | null> {
    try {
      // In Expo Go dev mode this is exp://..., in production it's your app scheme
      const redirectUrl = Linking.createURL('/auth/callback')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      })

      if (error || !data.url) return error?.message ?? 'Google sign-in failed'

      // Open the OAuth page in a system browser; it will redirect back when done
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)

      if (result.type !== 'success') return null // user cancelled — not an error

      // Extract tokens from the redirect URL hash fragment
      const rawUrl = result.url
      const hashString = rawUrl.includes('#') ? rawUrl.split('#')[1] : rawUrl.split('?')[1] ?? ''
      const params = new URLSearchParams(hashString)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')

      if (!accessToken || !refreshToken) return 'Could not extract session from redirect'

      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      return sessionErr ? sessionErr.message : null
    } catch (err: any) {
      return err?.message ?? 'Google sign-in failed'
    }
  }

  async function resetPassword(email: string): Promise<string | null> {
    const redirectUrl = Linking.createURL('/auth/reset-password')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })
    return error ? error.message : null
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithGoogle, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
