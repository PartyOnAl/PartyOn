import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import styles from './ResetPasswordPage.module.css'

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

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [sessionReady, setSessionReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!supabase || !isSupabaseConfigured) {
        if (!cancelled) navigate('/login', { replace: true })
        return
      }
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (!data.session) {
        navigate('/login', { replace: true })
        return
      }
      setSessionReady(true)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (!success) return
    const t = window.setTimeout(() => navigate('/login'), 2000)
    return () => window.clearTimeout(t)
  }, [success, navigate])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    setError(null)
    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase is not configured.')
      return
    }
    if (password.length < 8 || password !== confirm) return
    setLoading(true)
    void supabase.auth.updateUser({ password }).then(({ error: err }) => {
      setLoading(false)
      if (err) {
        setError(err.message)
        return
      }
      setSuccess(true)
    })
  }

  const passwordTooShort = submitAttempted && password.length < 8
  const mismatch = submitAttempted && password !== confirm

  if (!sessionReady) {
    return (
      <div className={styles.page}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.inner}>
          <p className={styles.muted}>Checking session…</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.inner}>
          <div className={styles.card}>
            <div className={styles.successIcon} aria-hidden>
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" fill="rgba(97, 255, 141, 0.15)" stroke="#66bb6a" strokeWidth="2" />
                <path
                  d="M18 33l10 10L46 24"
                  stroke="#66bb6a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className={styles.heading}>Password updated!</h1>
            <p className={styles.sub}>Redirecting to login…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.logo}>
          Party<span className={styles.logoAccent}>On</span>
        </div>
        <div className={styles.card}>
          <h1 className={styles.heading}>Create new password</h1>
          <p className={styles.sub}>Choose a strong password for your account</p>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="reset-new-password">
                New password
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="reset-new-password"
                  className={`${styles.input} ${styles.inputPadded} ${passwordTooShort ? styles.inputInvalid : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {passwordTooShort ? (
                <p className={styles.error}>Password must be at least 8 characters.</p>
              ) : null}
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="reset-confirm-password">
                Confirm password
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="reset-confirm-password"
                  className={`${styles.input} ${styles.inputPadded} ${mismatch ? styles.inputInvalid : ''}`}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {mismatch ? (
                <p className={styles.error}>Passwords do not match.</p>
              ) : null}
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
