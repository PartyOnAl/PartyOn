import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import styles from './ForgotPasswordModal.module.css'

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  initialEmail?: string
}

const RESEND_SECONDS = 60
const OTP_LENGTH = 8

const emptyDigits = () => Array<string>(OTP_LENGTH).fill('')

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export default function ForgotPasswordModal({
  open,
  onClose,
  initialEmail = '',
}: ForgotPasswordModalProps) {
  const navigate = useNavigate()
  const titleId = useId()
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState(emptyDigits)
  const [sendLoading, setSendLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [step1Error, setStep1Error] = useState<string | null>(null)
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [resendSeconds, setResendSeconds] = useState(0)

  const resetState = useCallback(() => {
    setStep(1)
    setEmail('')
    setDigits(emptyDigits())
    setStep1Error(null)
    setStep2Error(null)
    setSendLoading(false)
    setVerifyLoading(false)
    setResendSeconds(0)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }
    setEmail(initialEmail.trim())
    setStep(1)
    setStep1Error(null)
    setStep2Error(null)
    setDigits(emptyDigits())
  }, [open, initialEmail, resetState])

  useEffect(() => {
    if (resendSeconds <= 0) return
    const t = window.setInterval(() => {
      setResendSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [resendSeconds])

  useEffect(() => {
    if (step === 2 && open) {
      requestAnimationFrame(() => {
        otpRefs.current[0]?.focus()
      })
    }
  }, [step, open])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setStep1Error(null)
    if (!supabase || !isSupabaseConfigured) {
      setStep1Error('Supabase is not configured.')
      return
    }
    if (!isValidEmail(email)) {
      setStep1Error('Enter a valid email address.')
      return
    }
    setSendLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setSendLoading(false)
    // Always go to step 2 if the request was sent (do not reveal whether the email exists).
    setStep2Error(null)
    setDigits(emptyDigits())
    setStep(2)
    setResendSeconds(RESEND_SECONDS)
    if (error) {
      // Only show errors that block the flow (e.g. rate limit). Generic failures still show step 2.
      const msg = error.message.toLowerCase()
      if (msg.includes('rate') || msg.includes('too many')) {
        setStep(1)
        setStep1Error(error.message)
      }
    }
  }

  function getCodeString(): string {
    return digits.join('').replace(/\D/g, '').slice(0, OTP_LENGTH)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setStep2Error(null)
    const code = getCodeString()
    if (code.length !== OTP_LENGTH) {
      setStep2Error(`Please enter the full ${OTP_LENGTH}-digit code.`)
      return
    }
    if (!supabase || !isSupabaseConfigured) {
      setStep2Error('Supabase is not configured.')
      return
    }
    setVerifyLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    })
    setVerifyLoading(false)
    if (error) {
      setStep2Error('Invalid or expired code. Please try again.')
      return
    }
    onClose()
    navigate('/reset-password')
  }

  async function handleResend() {
    if (resendSeconds > 0 || !supabase || !isSupabaseConfigured) return
    setStep2Error(null)
    setSendLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setSendLoading(false)
    if (error) {
      setStep2Error(error.message)
      return
    }
    setResendSeconds(RESEND_SECONDS)
    setDigits(emptyDigits())
    otpRefs.current[0]?.focus()
  }

  function setDigitAt(index: number, value: string) {
    const d = value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = d
      return next
    })
    if (d && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigits((prev) => {
          const next = [...prev]
          next[index] = ''
          return next
        })
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus()
        setDigits((prev) => {
          const next = [...prev]
          next[index - 1] = ''
          return next
        })
      }
      e.preventDefault()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = emptyDigits()
    for (let i = 0; i < OTP_LENGTH; i += 1) {
      next[i] = pasted[i] ?? ''
    }
    setDigits(next)
    const lastFilled = Math.min(pasted.length, OTP_LENGTH - 1)
    otpRefs.current[lastFilled]?.focus()
  }

  if (!open) return null

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === 1 ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 ? (
          <div key="step1" className={styles.stepPanel}>
            <div className={styles.headerRow}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={onClose}
                aria-label="Close"
              >
                ←
              </button>
            </div>
            <h2 id={titleId} className={styles.modalTitle}>
              Forgot your password?
            </h2>
            <p className={styles.modalSub}>
              Enter your email and we&apos;ll send you an 8-digit code
            </p>
            <form className={styles.form} onSubmit={handleSendCode}>
              <label className={styles.srOnly} htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                className={`${styles.input} ${step1Error ? styles.inputInvalid : ''}`}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sendLoading}
              />
              {step1Error ? (
                <p className={styles.error} role="alert">
                  {step1Error}
                </p>
              ) : null}
              <button type="submit" className={styles.primaryBtn} disabled={sendLoading}>
                {sendLoading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          </div>
        ) : (
          <div key="step2" className={styles.stepPanel}>
            <div className={styles.headerRow}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  setStep2Error(null)
                  setStep(1)
                }}
                aria-label="Back to email"
              >
                ←
              </button>
            </div>
            <h2 className={styles.modalTitle}>Enter the code</h2>
            <p className={styles.modalSub}>
              We sent an 8-digit code to{' '}
              <strong className={styles.emailHighlight}>{email.trim()}</strong>
            </p>
            <form className={styles.form} onSubmit={handleVerifyCode}>
              <div className={styles.otpRow}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el
                    }}
                    className={`${styles.otpBox} ${step2Error ? styles.inputInvalid : ''}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                    onChange={(e) => setDigitAt(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                  />
                ))}
              </div>
              {step2Error ? (
                <p className={styles.error} role="alert">
                  {step2Error}
                </p>
              ) : null}
              <button type="submit" className={styles.primaryBtn} disabled={verifyLoading}>
                {verifyLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <p className={styles.resendRow}>
                <button
                  type="button"
                  className={styles.resendLink}
                  onClick={handleResend}
                  disabled={resendSeconds > 0 || sendLoading}
                >
                  {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
                </button>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
