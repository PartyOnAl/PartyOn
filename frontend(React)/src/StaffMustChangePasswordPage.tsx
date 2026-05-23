import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { userMustChangePassword } from './lib/mustChangePassword'
import { useAuth } from './contexts/AuthContext'
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
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * First-login flow for staff created with a temporary password.
 * Clears `must_change_password` in auth metadata after a successful update.
 */
export default function StaffMustChangePasswordPage() {
  const navigate = useNavigate()
  const { isLoading: authLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!supabase || !isSupabaseConfigured) {
      navigate('/login', { replace: true })
      return
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }
      if (!userMustChangePassword(session.user)) {
        navigate('/home', { replace: true })
        return
      }
      setReady(true)
    })
  }, [authLoading, navigate])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    setError(null)
    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase is not configured.')
      return
    }
    if (password.length < 8 || password !== confirm) return

    setBusy(true)
    void supabase.auth
      .updateUser({
        password,
        data: { must_change_password: false },
      })
      .then(({ error: err }) => {
        setBusy(false)
        if (err) {
          setError(err.message)
          return
        }
        navigate('/home', { replace: true })
      })
  }

  const passwordTooShort = submitAttempted && password.length < 8
  const mismatch = submitAttempted && password !== confirm

  if (authLoading || !ready) {
    return (
      <div className={styles.page}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.inner}>
          <p className={styles.muted}>Checking session…</p>
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
          <h1 className={styles.heading}>Choose a new password</h1>
          <p className={styles.sub}>
            Your account was created with a temporary password. Set a new password to continue.
          </p>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="staff-new-password">
                New password
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="staff-new-password"
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
              <label className={styles.fieldLabel} htmlFor="staff-confirm-password">
                Confirm password
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="staff-confirm-password"
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
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
