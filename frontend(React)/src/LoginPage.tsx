import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ForgotPasswordModal from './ForgotPasswordModal'
import { isSupabaseConfigured, supabase } from './lib/supabase'
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

function AppleIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 814 1000" aria-hidden>
      <path
        fill="currentColor"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103 39.5-165.1 39.5s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 251.2-297.5 66.1 0 121.2 43.4 162.7 43.4 39.8 0 101.9-46 176.1-46 28.5 0 130.9 2.6 198.3 99.2zm-194.7-91.5c32.1-38.5 53.8-91.6 53.8-144.6 0-7.1-.6-14.3-1.9-20.1-51.1 2.4-111.1 35.6-147.6 80.4-29.5 32.9-55.1 84.7-55.1 137.9 0 7.3 1.2 14.4 1.8 16.8 1.1.6 2.8 1.3 4.6 1.3 45.9 0 98.9-30.5 144.4-75.7z"
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

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const emailErrorId = useId()
  const passwordErrorId = useId()

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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      setIsSubmitting(false)

      if (error) {
        setRequestError(error.message)
        return
      }

      navigate('/home')
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

  async function handleSocialLogin(provider: 'google' | 'apple') {
    setRequestError(null)
    if (!supabase || !isSupabaseConfigured) {
      setRequestError(
        'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in frontend .env.',
      )
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/home`,
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

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
                  placeholder="••••••••"
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

          <button type="button" className={styles.social} onClick={() => handleSocialLogin('google')}>
            <span className={styles.socialIcon}>
              <GoogleIcon />
            </span>
            <span className={styles.socialLabel}>Continue with Google</span>
          </button>
          <button type="button" className={styles.social} onClick={() => handleSocialLogin('apple')}>
            <span className={styles.socialIcon}>
              <AppleIcon />
            </span>
            <span className={styles.socialLabel}>Continue with Apple</span>
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
