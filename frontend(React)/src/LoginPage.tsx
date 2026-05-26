import { useId, useState, useEffect, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ForgotPasswordModal from './ForgotPasswordModal'
import { isSupabaseConfigured, managerSupabase, supabase } from './lib/supabase'
import { userMustChangePassword } from './lib/mustChangePassword'
import {
  getStaffRoleFromUser,
  isMobileOnlyStaffRole,
} from './lib/staffRoles'
import styles from './LoginPage.module.css'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16v12H4V6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 7l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 15v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a18.5 18.5 0 0 1-4.2 4.8M6.3 6.3A18.5 18.5 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.5-1.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-5.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function safeInternalPath(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  return path
}

function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'superadmin' || role === 'super_admin'
}

/**
 * Manager/admin routes use a separate Supabase auth storage key. Prefer moving
 * the session from the user client; if that fails, sign in again on the
 * manager client (same credentials) so the dashboard always gets a session.
 */
async function ensureManagerSideSession(
  normalizedEmail: string,
  password: string,
  userSession: Session | null,
): Promise<{ error: string | null }> {
  if (!managerSupabase) {
    return { error: 'Authentication is not configured.' }
  }

  const access = userSession?.access_token
  const refresh = userSession?.refresh_token
  if (access && refresh) {
    const { error } = await managerSupabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    })
    if (!error) {
      const { data: afterSet } = await managerSupabase.auth.getSession()
      if (afterSet.session) return { error: null }
    }
  }

  const { data: signData, error: signErr } =
    await managerSupabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })
  if (signErr) return { error: signErr.message }

  const { data: afterSign } = await managerSupabase.auth.getSession()
  if (!afterSign.session && signData.session) {
    const { error: recoverErr } = await managerSupabase.auth.setSession({
      access_token: signData.session.access_token,
      refresh_token: signData.session.refresh_token,
    })
    if (recoverErr) return { error: recoverErr.message }
  }

  const { data: finalCheck } = await managerSupabase.auth.getSession()
  if (!finalCheck.session) {
    return {
      error:
        'Could not establish a manager session after sign-in. Please try again.',
    }
  }
  return { error: null }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const emailErrorId = useId()
  const passwordErrorId = useId()

  useEffect(() => {
    const st = location.state as { staffWebBlocked?: boolean } | null
    if (!st?.staffWebBlocked) return
    setRequestError(
      'Staff accounts cannot log in here. Please use the manager portal or the mobile app.',
    )
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true },
    )
  }, [location.state, location.pathname, location.search, navigate])

  const emailError =
    submitAttempted && !email.trim()
      ? 'Please enter your email.'
      : submitAttempted && email.trim() && !isValidEmail(email)
      ? 'Enter a valid email address.'
      : null

  const passwordError =
    submitAttempted && !password.trim() ? 'Please enter your password.' : null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitAttempted(true)
    setRequestError(null)

    if (!supabase || !isSupabaseConfigured) {
      setRequestError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in frontend .env.',
      )
      return
    }

    const valid =
      email.trim().length > 0 &&
      isValidEmail(email) &&
      password.trim().length > 0

    if (valid) {
      setIsSubmitting(true)
      try {
        const normalizedEmail = email.trim().toLowerCase()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (error) {
          setRequestError(error.message)
          return
        }

        if (userMustChangePassword(data.user)) {
          if (managerSupabase) {
            await managerSupabase.auth.signOut({ scope: 'local' })
          }
          navigate('/staff/change-password', { replace: true })
          return
        }

        const userId = data.user?.id
        if (!userId) {
          setRequestError(
            'Login succeeded, but no user id was returned by Supabase.',
          )
          return
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .single()

        if (profileError) {
          setRequestError(
            `Login succeeded, but profile could not be loaded: ${profileError.message}`,
          )
          await supabase.auth.signOut()
          return
        }

        const roleNorm = String(profileData?.role ?? '').toLowerCase().trim()

        if (roleNorm === 'manager') {
          const { error: mgrSessErr } = await ensureManagerSideSession(
            normalizedEmail,
            password,
            data.session ?? null,
          )
          if (mgrSessErr) {
            await supabase.auth.signOut({ scope: 'local' })
            await managerSupabase?.auth.signOut({ scope: 'local' })
            setRequestError(mgrSessErr)
            return
          }
          await supabase.auth.signOut({ scope: 'local' })
          navigate('/manager/dashboard', { replace: true })
          return
        }

        if (isAdminRole(roleNorm)) {
          const { error: mgrSessErr } = await ensureManagerSideSession(
            normalizedEmail,
            password,
            data.session ?? null,
          )
          if (mgrSessErr) {
            await supabase.auth.signOut({ scope: 'local' })
            await managerSupabase?.auth.signOut({ scope: 'local' })
            setRequestError(mgrSessErr)
            return
          }
          await supabase.auth.signOut({ scope: 'local' })
          navigate('/admin/platform-analysis', { replace: true })
          return
        }

        const staffRole = getStaffRoleFromUser(data.user)
        if (staffRole) {
          if (managerSupabase) {
            await managerSupabase.auth.signOut({ scope: 'local' })
          }
          if (isMobileOnlyStaffRole(staffRole)) {
            await supabase.auth.signOut({ scope: 'local' })
            navigate('/staff/mobile-only', { replace: true })
            return
          }
          await supabase.auth.signOut({ scope: 'local' })
          setRequestError(
            'Staff accounts cannot log in here. Please use the manager portal or the mobile app.',
          )
          return
        }

        if (managerSupabase) {
          await managerSupabase.auth.signOut({ scope: 'local' })
        }

        let target =
          safeInternalPath(searchParams.get('from')) ??
          safeInternalPath((location.state as { from?: string } | null)?.from) ??
          '/home'

        if (target.startsWith('/manager') && roleNorm !== 'manager') {
          target = '/home'
        }
        if (target.startsWith('/admin') && !isAdminRole(roleNorm)) {
          target = '/home'
        }
        navigate(target, { replace: true })
      } catch (err) {
        setRequestError(err instanceof Error ? err.message : String(err))
        try {
          await supabase.auth.signOut({ scope: 'local' })
          await managerSupabase?.auth.signOut({ scope: 'local' })
        } catch {
          /* ignore cleanup errors */
        }
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  function handleOpenForgot() {
    setRequestError(null)
    if (!supabase || !isSupabaseConfigured) {
      setRequestError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in frontend .env.',
      )
      return
    }
    setForgotOpen(true)
  }

  async function handleGoogleLogin() {
    setRequestError(null)
    if (!supabase || !isSupabaseConfigured) {
      setRequestError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in frontend .env.',
      )
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      setRequestError(error.message)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.logo}>
          Party<span className={styles.logoAccent}>On</span>
        </div>

        <div className={styles.card}>
          <h1 className={styles.heading}>Welcome back</h1>

          <form className={styles.form} onSubmit={handleSubmit} autoComplete="on" noValidate>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-email">
                Email
              </label>
              <div className={styles.inputWithIcons}>
                <span className={styles.inputIconLeft}>
                  <MailIcon />
                </span>
                <input
                  id="login-email"
                  className={`${styles.input} ${styles.inputPaddedLeft} ${emailError ? styles.inputInvalid : ''}`}
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? emailErrorId : undefined}
                />
              </div>
              {emailError ? (
                <p id={emailErrorId} className={styles.error} role="alert">
                  {emailError}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="login-password">
                Password
              </label>
              <div className={styles.inputWithIcons}>
                <span className={styles.inputIconLeft}>
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  className={`${styles.input} ${styles.inputPaddedBoth} ${passwordError ? styles.inputInvalid : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? passwordErrorId : undefined}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {passwordError ? (
                <p id={passwordErrorId} className={styles.error} role="alert">
                  {passwordError}
                </p>
              ) : null}
            </div>

            <div className={styles.forgotRow}>
              <button type="button" className={styles.forgotLink} onClick={handleOpenForgot}>
                Forgot password?
              </button>
            </div>

            {requestError ? (
              <p className={styles.error} role="alert">
                {requestError}
              </p>
            ) : null}
            <button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} aria-hidden />
            <span className={styles.dividerText}>or continue with</span>
            <span className={styles.dividerLine} aria-hidden />
          </div>

          <button type="button" className={styles.social} onClick={() => void handleGoogleLogin()}>
            <span className={styles.socialIcon}>
              <GoogleIcon />
            </span>
            <span className={styles.socialLabel}>Continue with Google</span>
          </button>

          <p className={styles.footer}>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => navigate('/signup')}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={email}
      />
    </div>
  )
}
