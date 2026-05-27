import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import styles from './SignupPage.module.css'
import { API_BASE_URL } from './api'

const TERMS_SECTIONS = [
  {
    heading: 'Account Eligibility',
    body: 'By creating an account on PartyOn, you confirm that you are at least 18 years old or the legal age required in your jurisdiction to use this service. You agree to provide accurate and complete information during registration and to keep your account information updated. We reserve the right to suspend or terminate accounts that contain false or misleading information.',
  },
  {
    heading: 'Your Responsibilities',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree not to share your password with others and to notify us immediately if you suspect unauthorized access to your account. You agree to use the platform respectfully and not to engage in illegal, abusive, or harmful behavior while using PartyOn.',
  },
  {
    heading: 'Updates to Terms',
    body: 'PartyOn may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the revised terms. We encourage you to review this page periodically and will notify you of material changes when required.',
  },
  {
    heading: 'Liability',
    body: 'The service is provided "as is" without warranties of any kind. To the fullest extent permitted by law, PartyOn shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform.',
  },
  {
    heading: 'Contact Us',
    body: 'If you have questions about these terms, please contact our support team through the in-app help center or the email address listed on our website. We aim to respond to inquiries within a reasonable timeframe.',
  },
] as const

const TERMS_DOCUMENT_GRADIENT_ID = 'partyon-terms-document-gradient'

type CountryOption = {
  code: string
  name: string
  dialCode: string
  flag: string
  expectedLocalDigits: number
}

const COUNTRIES: CountryOption[] = [
  { code: 'AL', name: 'Albania', dialCode: '+355', flag: '🇦🇱', expectedLocalDigits: 9 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', expectedLocalDigits: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', expectedLocalDigits: 10 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', expectedLocalDigits: 11 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', expectedLocalDigits: 9 },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', expectedLocalDigits: 10 },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', expectedLocalDigits: 9 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', expectedLocalDigits: 9 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', flag: '🇸🇪', expectedLocalDigits: 9 },
  { code: 'NO', name: 'Norway', dialCode: '+47', flag: '🇳🇴', expectedLocalDigits: 8 },
  { code: 'DK', name: 'Denmark', dialCode: '+45', flag: '🇩🇰', expectedLocalDigits: 8 },
  { code: 'CH', name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', expectedLocalDigits: 9 },
  { code: 'AT', name: 'Austria', dialCode: '+43', flag: '🇦🇹', expectedLocalDigits: 10 },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', expectedLocalDigits: 9 },
  { code: 'GR', name: 'Greece', dialCode: '+30', flag: '🇬🇷', expectedLocalDigits: 10 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', flag: '🇹🇷', expectedLocalDigits: 10 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', expectedLocalDigits: 10 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', expectedLocalDigits: 10 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', expectedLocalDigits: 11 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', expectedLocalDigits: 10 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', expectedLocalDigits: 9 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', expectedLocalDigits: 9 },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', expectedLocalDigits: 10 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', expectedLocalDigits: 10 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', expectedLocalDigits: 10 },
]

const CALENDAR_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function DocumentIcon() {
  const g = TERMS_DOCUMENT_GRADIENT_ID
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={g} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ec407a" />
          <stop offset="0.55" stopColor="#ab47bc" />
          <stop offset="1" stopColor="#e040fb" />
        </linearGradient>
      </defs>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke={`url(#${g})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h8M8 9h4"
        stroke={`url(#${g})`}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

function isAtLeast18(dateString: string): boolean {
  if (!dateString) return false
  const today = new Date()
  const birth = new Date(dateString)
  const age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    return age - 1 >= 18
  }
  return age >= 18
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

function splitNameParts(fullName: string): { name: string | null; surname: string | null } {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { name: null, surname: null }
  if (parts.length === 1) return { name: parts[0], surname: null }
  return {
    name: parts[0],
    surname: parts.slice(1).join(' '),
  }
}


export default function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')

  const [email, setEmail] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0])
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('')
  const [showCountryMenu, setShowCountryMenu] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [calendarView, setCalendarView] = useState<'days' | 'months' | 'years'>('days')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fullNameErrorId = useId()
  const dateOfBirthErrorId = useId()
  const phoneErrorId = useId()
  const emailErrorId = useId()
  const passwordErrorId = useId()
  const confirmPasswordErrorId = useId()
  const termsErrorId = useId()
  const termsCheckboxId = useId()
  const termsModalTitleId = useId()
  const countrySearchId = useId()
  const countryMenuRef = useRef<HTMLDivElement | null>(null)
  const datePickerRef = useRef<HTMLDivElement | null>(null)
  const maxAllowedBirthDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setFullYear(d.getFullYear() - 18)
    return d
  }, [])
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    base.setFullYear(base.getFullYear() - 18)
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  useEffect(() => {
    if (!showTerms && !showDatePicker) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowTerms(false)
      if (e.key === 'Escape') setShowDatePicker(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showTerms, showDatePicker])

  useEffect(() => {
    if (!showCountryMenu) return
    function handlePointerDown(e: MouseEvent) {
      if (
        countryMenuRef.current &&
        !countryMenuRef.current.contains(e.target as Node)
      ) {
        setShowCountryMenu(false)
      }
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [showCountryMenu])

  useEffect(() => {
    if (!showDatePicker) return
    function handlePointerDown(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [showDatePicker])

  useEffect(() => {
    if (!dateOfBirth) return
    const [year, month] = dateOfBirth.split('-')
    const y = Number(year)
    const m = Number(month)
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      setCalendarMonth(new Date(y, m - 1, 1))
    }
  }, [dateOfBirth])

  // Full Name: instant error as soon as they type something invalid
  const fullNameInvalid = fullName.length > 0 && !/^[a-zA-Z\s]*$/.test(fullName)
  const fullNameEmpty = submitAttempted && !fullName.trim()
  const fullNameError = fullNameInvalid
    ? 'Name can only contain letters and spaces.'
    : fullNameEmpty
    ? 'Please enter your full name.'
    : null

  const dateOfBirthError =
    submitAttempted && !dateOfBirth
      ? 'Please enter your date of birth.'
      : submitAttempted && dateOfBirth && !isAtLeast18(dateOfBirth)
      ? 'You must be at least 18 years old to sign up.'
      : null

  const phoneEmpty = submitAttempted && !phoneLocalNumber.trim()
  const phoneTooShort =
    submitAttempted &&
    phoneLocalNumber.trim().length > 0 &&
    phoneLocalNumber.length < selectedCountry.expectedLocalDigits
  const phoneError = phoneEmpty
    ? 'Please enter your phone number.'
    : phoneTooShort
    ? `Phone number is too short for ${selectedCountry.name} (${selectedCountry.expectedLocalDigits} digits expected).`
    : null

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return COUNTRIES
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.dialCode.includes(query),
    )
  }, [countrySearch])

  const selectedDate = useMemo(() => {
    if (!dateOfBirth) return null
    const [year, month, day] = dateOfBirth.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }, [dateOfBirth])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const mondayStart = (first.getDay() + 6) % 7
    const cells: Array<{ date: Date | null }> = []

    for (let i = 0; i < mondayStart; i += 1) {
      cells.push({ date: null })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day) })
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null })
    }
    return cells
  }, [calendarMonth])

  const yearOptions = useMemo(() => {
    const maxYear = maxAllowedBirthDate.getFullYear()
    const minYear = maxYear - 100
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index)
  }, [maxAllowedBirthDate])

  const emailError =
    submitAttempted && !email.includes('@')
      ? 'Enter an email address that contains @.'
      : null
  const passwordError =
    submitAttempted && password.length < 8
      ? 'Password must be at least 8 characters.'
      : null
  const confirmPasswordLive = confirmPassword.length > 0 && confirmPassword !== password
  const confirmPasswordOnSubmit = submitAttempted && confirmPassword !== password
  const confirmPasswordError =
    confirmPasswordOnSubmit || confirmPasswordLive ? 'Passwords do not match.' : null
  const termsError =
    submitAttempted && !termsAccepted
      ? 'You must accept the Terms and Conditions to continue.'
      : null

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
      fullName.trim().length > 0 &&
      /^[a-zA-Z\s]+$/.test(fullName) &&
      dateOfBirth !== '' &&
      isAtLeast18(dateOfBirth) &&
      phoneLocalNumber.trim().length > 0 &&
      phoneLocalNumber.length >= selectedCountry.expectedLocalDigits &&
      email.includes('@') &&
      password.length >= 8 &&
      confirmPassword === password &&
      termsAccepted

    if (valid) {
      setIsSubmitting(true)
      const normalizedEmail = email.trim().toLowerCase()
      const fullPhoneNumber = `${selectedCountry.dialCode}${phoneLocalNumber}`
      const { name, surname } = splitNameParts(fullName)
      const { data: signupData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            date_of_birth: dateOfBirth,
            phone_number: fullPhoneNumber,
          },
        },
      })

      if (error) {
        setIsSubmitting(false)
        setRequestError(error.message)
        return
      }

      const userId = signupData.user?.id
      if (!userId) {
        setIsSubmitting(false)
        setRequestError(
          'Signup succeeded, but no user id was returned by Supabase. Please try again.',
        )
        return
      }

      // Use backend endpoint (service role key) to upsert profile — bypasses RLS entirely.
      const profileRes = await fetch(`${API_BASE_URL}/auth/create-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          email: normalizedEmail,
          name,
          surname,
          phone_number: fullPhoneNumber,
          birth_date: dateOfBirth || null,
        }),
      })

      setIsSubmitting(false)
      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}))
        const msg: string = Array.isArray(body?.message)
          ? body.message.join(' ')
          : (body?.message ?? profileRes.statusText)
        setRequestError(msg)
        return
      }

      navigate('/home')
    }
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

  function handleUnderstandTerms() {
    setTermsAccepted(true)
    setShowTerms(false)
  }

  // Only allow letters and spaces in Full Name
  function handleFullNameChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (/^[a-zA-Z\s]*$/.test(value)) {
      setFullName(value)
    }
  }

  function handlePhoneLocalChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (/^\d*$/.test(value)) {
      setPhoneLocalNumber(value.slice(0, selectedCountry.expectedLocalDigits))
    }
  }

  function handleCountrySelect(country: CountryOption) {
    setSelectedCountry(country)
    setPhoneLocalNumber((prev) => prev.slice(0, country.expectedLocalDigits))
    setShowCountryMenu(false)
    setCountrySearch('')
  }

  function handleSelectDate(date: Date) {
    setDateOfBirth(toLocalIsoDate(date))
    setShowDatePicker(false)
    setCalendarView('days')
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.logo}>
          Party<span className={styles.logoAccent}>On</span>
        </div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join and start your night</p>

        <div className={styles.card}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            {/* Full Name */}
            <div className={styles.field}>
              <input
                className={`${styles.input} ${fullNameError ? styles.inputInvalid : ''}`}
                type="text"
                name="fullName"
                autoComplete="name"
                placeholder="Full Name"
                value={fullName}
                onChange={handleFullNameChange}
                aria-label="Full Name"
                aria-invalid={fullNameError ? true : undefined}
                aria-describedby={fullNameError ? fullNameErrorId : undefined}
              />
              {fullNameError ? (
                <p id={fullNameErrorId} className={styles.error} role="alert">
                  {fullNameError}
                </p>
              ) : null}
            </div>

            {/* Date of Birth */}
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="dateOfBirth">
              </label>
              <div className={styles.dateInputWrap} ref={datePickerRef}>
                <button
                  id="dateOfBirth"
                  type="button"
                  className={`${styles.input} ${styles.customDateButton} ${dateOfBirthError ? styles.inputInvalid : ''}`}
                  onClick={() => {
                    setShowDatePicker((prev) => !prev)
                    setCalendarView('days')
                  }}
                  aria-label="Date of Birth"
                  aria-invalid={dateOfBirthError ? true : undefined}
                  aria-describedby={dateOfBirthError ? dateOfBirthErrorId : undefined}
                  aria-haspopup="dialog"
                  aria-expanded={showDatePicker}
                >
                  {dateOfBirth ? formatDisplayDate(dateOfBirth) : 'Date of Birth'}
                </button>
                <span className={styles.dateIcon} aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 2v3M17 2v3M3.5 9h17M6 5h12a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 18 21H6a2.5 2.5 0 0 1-2.5-2.5v-11A2.5 2.5 0 0 1 6 5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {showDatePicker ? (
                  <div className={styles.calendarPopup} role="dialog" aria-label="Date picker">
                    <div className={styles.calendarHeader}>
                      <button
                        type="button"
                        className={styles.calendarNav}
                        onClick={() =>
                          setCalendarMonth(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                          )
                        }
                        aria-label="Previous month"
                      >
                        ‹
                      </button>
                      <div className={styles.calendarTitleGroup}>
                        <button
                          type="button"
                          className={styles.calendarTitleButton}
                          onClick={() => setCalendarView('months')}
                        >
                          {calendarMonth.toLocaleDateString('en-US', { month: 'long' })}
                        </button>
                        <button
                          type="button"
                          className={styles.calendarTitleButton}
                          onClick={() => setCalendarView('years')}
                        >
                          {calendarMonth.getFullYear()}
                        </button>
                      </div>
                      <button
                        type="button"
                        className={styles.calendarNav}
                        onClick={() =>
                          setCalendarMonth(
                            (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                          )
                        }
                        aria-label="Next month"
                      >
                        ›
                      </button>
                    </div>
                    {calendarView === 'days' ? (
                      <>
                        <div className={styles.calendarWeekDays}>
                          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                            <span key={day}>{day}</span>
                          ))}
                        </div>
                        <div className={styles.calendarGrid}>
                          {calendarDays.map((cell, index) => {
                            if (!cell.date) {
                              return (
                                <span key={`empty-${index}`} className={styles.calendarEmpty} />
                              )
                            }

                            const iso = toLocalIsoDate(cell.date)
                            const isDisabled = cell.date > maxAllowedBirthDate
                            const isToday = toLocalIsoDate(cell.date) === toLocalIsoDate(today)
                            const isSelected = selectedDate && iso === toLocalIsoDate(selectedDate)

                            const dayClass = [
                              styles.calendarDay,
                              isToday ? styles.calendarDayToday : '',
                              isSelected ? styles.calendarDaySelected : '',
                              isDisabled ? styles.calendarDayDisabled : '',
                            ]
                              .filter(Boolean)
                              .join(' ')

                            return (
                              <button
                                key={iso}
                                type="button"
                                className={dayClass}
                                onClick={() => handleSelectDate(cell.date as Date)}
                                disabled={isDisabled}
                              >
                                {cell.date.getDate()}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    ) : null}
                    {calendarView === 'months' ? (
                      <div className={styles.calendarMonthGrid}>
                        {CALENDAR_MONTHS.map((month, monthIndex) => {
                          const isSelectedMonth =
                            calendarMonth.getMonth() === monthIndex &&
                            selectedDate?.getFullYear() === calendarMonth.getFullYear()
                          return (
                            <button
                              key={month}
                              type="button"
                              className={`${styles.calendarMonthItem} ${isSelectedMonth ? styles.calendarMonthItemSelected : ''}`}
                              onClick={() => {
                                setCalendarMonth(
                                  new Date(calendarMonth.getFullYear(), monthIndex, 1),
                                )
                                setCalendarView('days')
                              }}
                            >
                              {month.slice(0, 3)}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                    {calendarView === 'years' ? (
                      <div className={styles.calendarYearGrid}>
                        {yearOptions.map((year) => {
                          const isSelectedYear = selectedDate?.getFullYear() === year
                          return (
                            <button
                              key={year}
                              type="button"
                              className={`${styles.calendarYearItem} ${isSelectedYear ? styles.calendarYearItemSelected : ''}`}
                              onClick={() => {
                                setCalendarMonth(new Date(year, calendarMonth.getMonth(), 1))
                                setCalendarView('months')
                              }}
                            >
                              {year}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {dateOfBirthError ? (
                <p id={dateOfBirthErrorId} className={styles.error} role="alert">
                  {dateOfBirthError}
                </p>
              ) : null}
            </div>

            {/* Email */}
            <div className={styles.field}>
              <input
                className={`${styles.input} ${emailError ? styles.inputInvalid : ''}`}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email Address"
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? emailErrorId : undefined}
              />
              {emailError ? (
                <p id={emailErrorId} className={styles.error} role="alert">
                  {emailError}
                </p>
              ) : null}
            </div>

            {/* Phone Number */}
            <div className={styles.field}>
              <div className={styles.phoneRow}>
                <div className={styles.countryPicker} ref={countryMenuRef}>
                  <button
                    type="button"
                    className={`${styles.countryButton} ${phoneError ? styles.inputInvalid : ''}`}
                    onClick={() => setShowCountryMenu((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={showCountryMenu}
                    aria-controls={countrySearchId}
                  >
                    <span className={styles.countryFlag}>{selectedCountry.flag}</span>
                    <span className={styles.countryDial}>{selectedCountry.dialCode}</span>
                    <span className={styles.countryCaret}>▾</span>
                  </button>
                  {showCountryMenu ? (
                    <div className={styles.countryMenu}>
                      <input
                        id={countrySearchId}
                        className={styles.countrySearch}
                        type="text"
                        placeholder="Search country"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                      />
                      <div className={styles.countryList} role="listbox">
                        {filteredCountries.length > 0 ? (
                          filteredCountries.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              className={styles.countryOption}
                              onClick={() => handleCountrySelect(country)}
                            >
                              <span className={styles.countryOptionFlag}>{country.flag}</span>
                              <span className={styles.countryOptionName}>{country.name}</span>
                              <span className={styles.countryOptionDial}>{country.dialCode}</span>
                            </button>
                          ))
                        ) : (
                          <p className={styles.countryNoResult}>No countries found.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <input
                  className={`${styles.input} ${styles.phoneInput} ${phoneError ? styles.inputInvalid : ''}`}
                  type="tel"
                  name="phoneLocalNumber"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="Phone Number"
                  value={phoneLocalNumber}
                  onChange={handlePhoneLocalChange}
                  aria-label="Phone Number"
                  aria-invalid={phoneError ? true : undefined}
                  aria-describedby={phoneError ? phoneErrorId : undefined}
                />
              </div>
              {phoneError ? (
                <p id={phoneErrorId} className={styles.error} role="alert">
                  {phoneError}
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className={styles.field}>
              <div className={styles.passwordWrap}>
                <input
                  className={`${styles.input} ${styles.passwordInput} ${passwordError ? styles.inputInvalid : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="Password"
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

            {/* Confirm Password */}
            <div className={styles.field}>
              <div className={styles.passwordWrap}>
                <input
                  className={`${styles.input} ${styles.passwordInput} ${confirmPasswordError ? styles.inputInvalid : ''}`}
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-label="Confirm Password"
                  aria-invalid={confirmPasswordError ? true : undefined}
                  aria-describedby={confirmPasswordError ? confirmPasswordErrorId : undefined}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
              {confirmPasswordError ? (
                <p id={confirmPasswordErrorId} className={styles.error} role="alert">
                  {confirmPasswordError}
                </p>
              ) : null}
            </div>

            {/* Terms and Conditions */}
            <div className={styles.field}>
              <div className={styles.termsRow}>
                <input
                  id={termsCheckboxId}
                  className={styles.checkbox}
                  type="checkbox"
                  name="termsAccepted"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  aria-invalid={termsError ? true : undefined}
                  aria-describedby={termsError ? termsErrorId : undefined}
                />
                <div className={styles.termsLabelBlock}>
                  <label htmlFor={termsCheckboxId} className={styles.termsLabel}>
                    I agree to the{' '}
                  </label>
                  <button
                    type="button"
                    className={styles.termsLink}
                    onClick={() => setShowTerms(true)}
                  >
                    Terms and Conditions
                  </button>
                </div>
              </div>
              {termsError ? (
                <p id={termsErrorId} className={styles.error} role="alert">
                  {termsError}
                </p>
              ) : null}
            </div>

            {requestError ? (
              <p className={styles.error} role="alert">
                {requestError}
              </p>
            ) : null}
            <button type="submit" className={styles.submit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} aria-hidden />
            <span className={styles.dividerText}>or continue with</span>
            <span className={styles.dividerLine} aria-hidden />
          </div>

          <button type="button" className={styles.social} onClick={() => void handleGoogleLogin()}>
            <span className={styles.socialIcon}><GoogleIcon /></span>
            <span className={styles.socialLabel}>Continue with Google</span>
          </button>

          <p className={styles.footer}>
            Already have an account?{' '}
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
          </p>
        </div>
      </div>

      {showTerms ? (
        <div
          className={styles.modalRoot}
          role="dialog"
          aria-modal="true"
          aria-labelledby={termsModalTitleId}
          onClick={() => setShowTerms(false)}
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTopAccent} aria-hidden />
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <span className={styles.modalDocWrap}><DocumentIcon /></span>
                <h2 id={termsModalTitleId} className={styles.modalTitle}>
                  Terms and Conditions
                </h2>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowTerms(false)}
                aria-label="Close terms"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className={styles.modalScrollShell}>
              <div className={styles.modalBody}>
                {TERMS_SECTIONS.map((section) => (
                  <section key={section.heading} className={styles.modalSection}>
                    <h3 className={styles.modalSectionTitle}>{section.heading}</h3>
                    <p className={styles.modalSectionText}>{section.body}</p>
                  </section>
                ))}
              </div>
              <div className={styles.modalScrollFade} aria-hidden />
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalUnderstand}
                onClick={handleUnderstandTerms}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
