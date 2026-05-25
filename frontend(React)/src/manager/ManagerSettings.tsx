import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CreditCard, Eye, EyeOff, X as XIcon } from 'lucide-react'
import './ManagerDashboard.css'
import './ManagerSettings.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase, updatePasswordViaRest } from '../lib/supabase'
import {
  DEFAULT_NO_SHOW_GRACE_MINUTES,
  loadNoShowGraceMinutes,
  saveNoShowGraceMinutes,
} from './noShow'

type NotificationKey = 'newReservations' | 'staffRequests' | 'eventReminders'
type Toast = { message: string; variant: 'default' | 'info' | 'success' | 'error' }
type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other'

type Invoice = {
  invoiceId: string
  invoiceNumber: string
  description: string
  type: string
  amount: number | null
  status: string | null
  invoiceDate: string | null
}

type SavedCard = {
  id: string
  lastFour: string
  brand: CardBrand
  expiryMonth: string
  expiryYear: string
  nameOnCard: string
}

/* ── SVG icons ── */

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9Zm4 13a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 9v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconSubscription() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 14l2.5 2.5L16 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconHeadphones() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── Notification localStorage helpers ── */

const NOTIF_KEY = 'partyOn_manager_notifPrefs'

function loadNotifPrefs(): Record<NotificationKey, boolean> {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return JSON.parse(raw) as Record<NotificationKey, boolean>
  } catch { /* ignore */ }
  return { newReservations: true, staffRequests: true, eventReminders: true }
}

function persistNotifPrefs(prefs: Record<NotificationKey, boolean>) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

/* ── Card localStorage helpers ── */

function cardsKey(userId: string) { return `partyOn_manager_cards_${userId}` }

function loadCards(userId: string): SavedCard[] {
  try {
    const raw = localStorage.getItem(cardsKey(userId))
    return raw ? (JSON.parse(raw) as SavedCard[]) : []
  } catch { return [] }
}

function persistCards(userId: string, cards: SavedCard[]) {
  try { localStorage.setItem(cardsKey(userId), JSON.stringify(cards)) } catch { /* ignore */ }
}

/* ── Card helpers ── */

function detectBrand(raw: string): CardBrand {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('4')) return 'visa'
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  return 'other'
}

function formatCardInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.match(/.{1,4}/g)?.join(' ') ?? ''
}

function formatExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length > 2) return `${digits.slice(0, 2)} / ${digits.slice(2)}`
  return digits
}

const BRAND_LABELS: Record<CardBrand, string> = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', other: 'CARD' }

/* ── Invoice helpers ── */

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatInvoiceDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function normalizeInvoiceStatus(status: string | null): 'paid' | 'pending' | 'overdue' | 'cancelled' {
  const s = String(status ?? '').toLowerCase()
  if (s === 'paid') return 'paid'
  if (s === 'overdue') return 'overdue'
  if (s === 'cancelled') return 'cancelled'
  return 'pending'
}

/* ── ChangePasswordForm ── */

function ChangePasswordForm({
  session,
  onSuccess,
  onCancel,
}: {
  session: Session | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  async function handleSubmit() {
    setFieldError(null)
    if (newPw.length < 6) { setFieldError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setFieldError('Passwords do not match.'); return }
    if (!supabase || !isSupabaseConfigured) { setFieldError('Authentication not configured.'); return }

    // Get the live access token. getSession() auto-refreshes if near expiry and
    // falls back to the prop token so we always have something to send.
    const { data: sessData } = await supabase.auth.getSession()
    const currentSession = sessData?.session ?? session
    const { data: refreshedData, error: refreshError } =
      currentSession
        ? await supabase.auth.refreshSession(currentSession)
        : { data: { session: null }, error: new Error('Session not found') }
    const accessToken = refreshedData.session?.access_token
    if (refreshError) {
      setFieldError('Your login session expired. Please log out, log back in, and try again.')
      return
    }
    if (!accessToken) {
      setFieldError('Session not found — please log out and back in, then try again.')
      return
    }

    setSaving(true)
    try {
      // Direct REST call bypasses the GoTrue client's internal currentSession
      // check entirely, so "Auth session missing!" can never happen, and no
      // onAuthStateChange event is fired that might redirect the user mid-update.
      await updatePasswordViaRest(accessToken, newPw)
      setSaving(false)
      onSuccess()
    } catch (err) {
      setSaving(false)
      setFieldError(err instanceof Error ? err.message : 'Failed to update password.')
    }
  }

  const fields = [
    { id: 'pw-new', label: 'New password', val: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew((v) => !v), ph: 'Min. 6 characters' },
    { id: 'pw-confirm', label: 'Confirm new password', val: confirmPw, set: setConfirmPw, show: showConfirm, toggle: () => setShowConfirm((v) => !v), ph: 'Re-enter password' },
  ]

  return (
    <div className="manager-settings__inline-form">
      {fields.map(({ id, label, val, set, show, toggle, ph }) => (
        <div key={id} className="manager-settings__inline-field">
          <label className="manager-settings__inline-label" htmlFor={id}>{label}</label>
          <div className="manager-settings__inline-input-wrap">
            <input
              id={id}
              type={show ? 'text' : 'password'}
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder={ph}
              className="manager-settings__inline-input"
              disabled={saving}
            />
            <button
              type="button"
              onClick={toggle}
              tabIndex={-1}
              className="manager-settings__eye-btn"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="manager-settings__eye-icon" /> : <Eye className="manager-settings__eye-icon" />}
            </button>
          </div>
        </div>
      ))}
      {fieldError && <p className="manager-settings__inline-error">{fieldError}</p>}
      <div className="manager-settings__inline-actions">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="manager-settings__inline-save"
        >
          {saving ? 'Updating…' : 'Update Password'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="manager-settings__inline-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ── AddCardForm ── */

function AddCardForm({
  userId,
  onSaved,
  onCancel,
}: {
  userId: string
  onSaved: (card: SavedCard) => void
  onCancel: () => void
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [showCvc, setShowCvc] = useState(false)
  const [nameOnCard, setNameOnCard] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const brand = detectBrand(cardNumber)
  const isAmex = brand === 'amex'
  const expectedCvcLen = isAmex ? 4 : 3

  function handleSave() {
    setFieldError(null)
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19) { setFieldError('Please enter a valid card number.'); return }
    const expiryMatch = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/)
    if (!expiryMatch || parseInt(expiryMatch[1], 10) < 1 || parseInt(expiryMatch[1], 10) > 12) {
      setFieldError('Please enter a valid expiry date (MM / YY).')
      return
    }
    const cvcClean = cvc.replace(/\D/g, '')
    if (cvcClean.length !== expectedCvcLen) { setFieldError(`CVC must be ${expectedCvcLen} digits.`); return }
    if (!nameOnCard.trim()) { setFieldError('Please enter the name on the card.'); return }

    const newCard: SavedCard = {
      id: crypto.randomUUID(),
      lastFour: digits.slice(-4),
      brand,
      expiryMonth: expiryMatch[1],
      expiryYear: expiryMatch[2],
      nameOnCard: nameOnCard.trim(),
    }
    persistCards(userId, [...loadCards(userId), newCard])
    onSaved(newCard)
  }

  return (
    <div className="manager-settings__inline-form manager-settings__inline-form--card">
      <div className="manager-settings__inline-field">
        <label className="manager-settings__inline-label">Card number</label>
        <div className="manager-settings__inline-input-wrap">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
            placeholder="1234 5678 9012 3456"
            className="manager-settings__inline-input"
          />
          {cardNumber && (
            <span className="manager-settings__brand-badge">{BRAND_LABELS[brand]}</span>
          )}
        </div>
      </div>

      <div className="manager-settings__inline-row">
        <div className="manager-settings__inline-field">
          <label className="manager-settings__inline-label">Expiry date</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
            placeholder="MM / YY"
            className="manager-settings__inline-input"
          />
        </div>
        <div className="manager-settings__inline-field">
          <label className="manager-settings__inline-label">CVC / CVV</label>
          <div className="manager-settings__inline-input-wrap">
            <input
              type={showCvc ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, expectedCvcLen))}
              placeholder={isAmex ? '••••' : '•••'}
              className="manager-settings__inline-input"
            />
            <button
              type="button"
              onClick={() => setShowCvc((v) => !v)}
              tabIndex={-1}
              className="manager-settings__eye-btn"
              aria-label={showCvc ? 'Hide CVC' : 'Show CVC'}
            >
              {showCvc ? <EyeOff className="manager-settings__eye-icon" /> : <Eye className="manager-settings__eye-icon" />}
            </button>
          </div>
        </div>
      </div>

      <div className="manager-settings__inline-field">
        <label className="manager-settings__inline-label">Name on card</label>
        <input
          type="text"
          autoComplete="cc-name"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          placeholder="Full name as shown on card"
          className="manager-settings__inline-input"
        />
      </div>

      {fieldError && <p className="manager-settings__inline-error">{fieldError}</p>}

      <div className="manager-settings__inline-actions">
        <button type="button" onClick={handleSave} className="manager-settings__inline-save">
          Save Card
        </button>
        <button type="button" onClick={onCancel} className="manager-settings__inline-cancel">
          Cancel
        </button>
      </div>

      <p className="manager-settings__inline-note">
        CVC is used for verification only and is never stored. Card details are saved on your device for display only.
      </p>
    </div>
  )
}

/* ── SavedCardItem ── */

function SavedCardItem({ card, onDelete }: { card: SavedCard; onDelete: (id: string) => void }) {
  return (
    <div className="manager-settings__card-item">
      <span className="manager-settings__card-badge">{BRAND_LABELS[card.brand]}</span>
      <span className="manager-settings__card-num">•••• {card.lastFour}</span>
      <span className="manager-settings__card-exp">{card.expiryMonth}/{card.expiryYear}</span>
      <span className="manager-settings__card-name">{card.nameOnCard}</span>
      <button
        type="button"
        onClick={() => onDelete(card.id)}
        className="manager-settings__card-delete"
        aria-label="Remove card"
      >
        <XIcon />
      </button>
    </div>
  )
}

/* ── Main component ── */

export default function ManagerSettings() {
  const { club } = useManagerClub()
  const { signOut, profile, session } = useAuth()
  const navigate = useNavigate()
  const userId = profile?.id ?? ''

  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>(loadNotifPrefs)
  const [noShowGrace, setNoShowGrace] = useState(() => String(loadNoShowGraceMinutes()))
  const [toast, setToast] = useState<Toast | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [addingCard, setAddingCard] = useState(false)
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [billingOpen, setBillingOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicesLoaded, setInvoicesLoaded] = useState(false)

  // Terms & Conditions state
  const [tcText, setTcText] = useState<string>('')
  const [tcUpdatedAt, setTcUpdatedAt] = useState<string | null>(null)
  const [tcDraft, setTcDraft] = useState<string>('')
  const [tcEditing, setTcEditing] = useState(false)
  const [tcSaving, setTcSaving] = useState(false)

  // Subscription state
  const [localSubStatus, setLocalSubStatus] = useState<string | null>(null)
  const [subActionLoading, setSubActionLoading] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null)
  const [planChangeLoading, setPlanChangeLoading] = useState(false)
  const [platformPrices, setPlatformPrices] = useState<{ monthly: number; annual: number; three_month: number } | null>(null)

  useEffect(() => { if (userId) setSavedCards(loadCards(userId)) }, [userId])

  // Sync local subscription status from club data once loaded
  useEffect(() => {
    if (club) {
      setLocalSubStatus(club.subscription_status ?? 'active')
      setNoShowGrace(String(club.no_show_grace_period_minutes ?? loadNoShowGraceMinutes()))
    }
  }, [club])

  // Fetch platform plan prices (publicly readable)
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['monthly_club_fee', 'annual_club_fee', 'three_month_club_fee'])
      .then(({ data }) => {
        if (!data) return
        const prices = { monthly: 70, annual: 550, three_month: 200 }
        for (const row of data as { key: string; value: string | number }[]) {
          if (row.key === 'monthly_club_fee') prices.monthly = Number(row.value)
          if (row.key === 'annual_club_fee') prices.annual = Number(row.value)
          if (row.key === 'three_month_club_fee') prices.three_month = Number(row.value)
        }
        setPlatformPrices(prices)
      })
  }, [])

  async function loadInvoices(clubId: string) {
    if (!supabase || !isSupabaseConfigured) return
    setInvoicesLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('club_invoices')
      .select('invoice_id, invoice_number, description, type, amount, status, invoice_date')
      .eq('club_id', clubId)
      .order('invoice_date', { ascending: false })
      .limit(50)
    setInvoicesLoading(false)
    setInvoicesLoaded(true)
    if (fetchErr || !data) return
    setInvoices(
      (data as Array<{
        invoice_id: string
        invoice_number: string
        description: string
        type: string
        amount: number | null
        status: string | null
        invoice_date: string | null
      }>).map((row) => ({
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        description: row.description,
        type: row.type,
        amount: row.amount,
        status: row.status,
        invoiceDate: row.invoice_date,
      })),
    )
  }

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    supabase
      .from('global_settings')
      .select('value, updated_at')
      .eq('key', 'terms_and_conditions')
      .single()
      .then(({ data }) => {
        if (data) {
          setTcText((data as { value: string; updated_at: string }).value ?? '')
          setTcUpdatedAt((data as { value: string; updated_at: string }).updated_at ?? null)
        }
      })
  }, [])

  async function saveTc() {
    if (!supabase || !isSupabaseConfigured) return
    setTcSaving(true)
    const { error } = await supabase
      .from('global_settings')
      .upsert({ key: 'terms_and_conditions', value: tcDraft, updated_at: new Date().toISOString() })
    setTcSaving(false)
    if (error) {
      setToast({ variant: 'error', message: `Failed to save: ${error.message}` })
    } else {
      setTcText(tcDraft)
      setTcUpdatedAt(new Date().toISOString())
      setTcEditing(false)
      setToast({ variant: 'success', message: 'Terms & Conditions saved.' })
    }
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  function toggleNotification(key: NotificationKey) {
    const next = { ...notifications, [key]: !notifications[key] }
    setNotifications(next)
    persistNotifPrefs(next)
    setToast({ variant: 'success', message: 'Preference saved.' })
  }

  async function handleNoShowGraceBlur() {
    const parsed = Number.parseInt(noShowGrace, 10)
    const saved = saveNoShowGraceMinutes(
      Number.isFinite(parsed) ? parsed : DEFAULT_NO_SHOW_GRACE_MINUTES,
    )
    setNoShowGrace(String(saved))

    if (!supabase || !isSupabaseConfigured || !club?.club_id) {
      setToast({ variant: 'success', message: 'No-show grace period saved.' })
      return
    }

    const { error } = await supabase
      .from('clubs')
      .update({ no_show_grace_period_minutes: saved })
      .eq('club_id', club.club_id)
    if (error) {
      setToast({ variant: 'error', message: `Could not save no-show grace period: ${error.message}` })
    } else {
      setToast({ variant: 'success', message: 'No-show grace period saved.' })
    }
  }

  async function handleCancelSubscription() {
    if (!supabase || !isSupabaseConfigured || !club?.club_id) return
    setSubActionLoading(true)
    const { error } = await supabase
      .from('clubs')
      .update({ subscription_status: 'cancelled', subscription_cancelled_at: new Date().toISOString() })
      .eq('club_id', club.club_id)
    setSubActionLoading(false)
    if (error) {
      setToast({ variant: 'error', message: `Could not cancel subscription: ${error.message}` })
    } else {
      setLocalSubStatus('cancelled')
      setConfirmingCancel(false)
      setToast({ variant: 'info', message: 'Subscription cancelled. Access continues until the billing date.' })
    }
  }

  async function handleRequestPlanChange(planKey: string, planLabel: string) {
    if (!supabase || !isSupabaseConfigured || !club?.club_id) return
    setPlanChangeLoading(true)
    const { error } = await supabase
      .from('clubs')
      .update({ requested_subscription_type: planKey, plan_change_requested_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('club_id', club.club_id)
    setPlanChangeLoading(false)
    setRequestingPlan(null)
    if (error) {
      setToast({ variant: 'info', message: `Request noted. Contact support@partyon.com to change to the ${planLabel} plan.` })
    } else {
      setToast({ variant: 'success', message: `Plan change to ${planLabel} requested. PartyOn admin will confirm shortly.` })
    }
  }

  async function handleReactivateSubscription() {
    if (!supabase || !isSupabaseConfigured || !club?.club_id) return
    setSubActionLoading(true)
    const { error } = await supabase
      .from('clubs')
      .update({ subscription_status: 'active', subscription_cancelled_at: null })
      .eq('club_id', club.club_id)
    setSubActionLoading(false)
    if (error) {
      setToast({ variant: 'error', message: `Could not reactivate subscription: ${error.message}` })
    } else {
      setLocalSubStatus('active')
      setToast({ variant: 'success', message: 'Subscription reactivated successfully!' })
    }
  }

  function handleCardSaved(card: SavedCard) {
    setSavedCards((prev) => [...prev, card])
    setAddingCard(false)
    setToast({ variant: 'success', message: 'Card saved.' })
  }

  function handleDeleteCard(id: string) {
    const updated = savedCards.filter((c) => c.id !== id)
    setSavedCards(updated)
    persistCards(userId, updated)
    setToast({ variant: 'info', message: 'Card removed.' })
  }

  const notificationItems: { key: NotificationKey; title: string; desc: string }[] = [
    { key: 'newReservations', title: 'New Reservations', desc: 'Get notified of new bookings' },
    { key: 'staffRequests', title: 'Staff Requests', desc: 'Approval requests from staff' },
    { key: 'eventReminders', title: 'Event Reminders', desc: 'Upcoming event notifications' },
  ]

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-settings__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-settings__bound">
            {/* Header */}
            <div className="manager-settings__head">
              <h1 className="manager-dash__page-title">Settings</h1>
              <p className="manager-dash__page-sub">Manage your club preferences and account</p>
            </div>

            {/* Subscription — always first */}
            {(() => {
              const subType = club?.subscription_type ?? null
              const isCancelled = localSubStatus === 'cancelled'
              const displayStatus =
                localSubStatus === 'active' ? 'Active'
                : localSubStatus === 'trialing' ? 'Trial'
                : localSubStatus === 'cancelled' ? 'Cancelled'
                : localSubStatus === 'past_due' ? 'Past Due'
                : '—'
              const statusKey = localSubStatus ?? 'active'
              const billingLabel = isCancelled ? 'Access Until' : 'Next Billing'
              const billingDate = club?.subscription_due_date
                ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(club.subscription_due_date))
                : '—'

              const plans = [
                {
                  key: 'monthly',
                  label: 'Monthly',
                  priceLabel: `€${platformPrices?.monthly ?? 70} / month`,
                  desc: 'Billed month-to-month. Cancel anytime.',
                  icon: <IconSubscription />,
                },
                {
                  key: 'three_month',
                  label: '3-Month',
                  priceLabel: `€${platformPrices?.three_month ?? 200} / 3 months`,
                  desc: `Three months together. Equivalent to €${Math.round((platformPrices?.three_month ?? 200) / 3)} / month.`,
                  icon: <IconLayers />,
                },
                {
                  key: 'annual',
                  label: 'Annual',
                  priceLabel: `€${platformPrices?.annual ?? 550} / year`,
                  desc: `Equivalent to €${Math.round((platformPrices?.annual ?? 550) / 12)} / month. Best value.`,
                  icon: <IconStar />,
                },
              ]

              return (
                <section className="manager-settings__card manager-settings__card--sub" aria-labelledby="settings-sub-title">
                  <header className="manager-settings__card-head">
                    <span className="manager-settings__card-icon manager-settings__card-icon--sub" aria-hidden>
                      <IconSubscription />
                    </span>
                    <div className="manager-settings__card-head-text">
                      <h2 id="settings-sub-title" className="manager-settings__card-title">Subscription</h2>
                      <p className="manager-settings__card-sub">Your PartyOn platform plan</p>
                    </div>
                    {localSubStatus && (
                      <span className={`manager-settings__sub-badge manager-settings__sub-badge--${statusKey}`}>
                        {displayStatus}
                      </span>
                    )}
                  </header>

                  {!club ? (
                    <p className="manager-settings__sub-loading">Loading subscription info…</p>
                  ) : (
                    <>
                      {/* Next billing bar */}
                      <div className="manager-settings__sub-billing-bar">
                        <span className="manager-settings__sub-billing-label">{billingLabel}</span>
                        <span className="manager-settings__sub-billing-val">{billingDate}</span>
                      </div>

                      {/* Toggle to show plans */}
                      <button
                        type="button"
                        className="manager-settings__change-plan-btn"
                        onClick={() => {
                          setShowPlans((v) => !v)
                          setRequestingPlan(null)
                        }}
                        disabled={isCancelled}
                      >
                        <span>{showPlans ? 'Hide Plans' : 'Change Plan'}</span>
                        <ChevronRight className={`manager-settings__action-chevron${showPlans ? ' manager-settings__action-chevron--open' : ''}`} />
                      </button>

                      {/* Plan option cards — shown only when expanded */}
                      {showPlans && (
                        <>
                          <p className="manager-settings__sub-plan-note">
                            Select a plan to request a billing-cycle change. PartyOn admin confirms changes before billing updates.
                          </p>

                          <div className="manager-settings__plan-list">
                            {plans.map((plan) => {
                              const isCurrent = subType === plan.key
                              const isRequesting = requestingPlan === plan.key
                              return (
                                <div key={plan.key}>
                                  <button
                                    type="button"
                                    className={[
                                      'manager-settings__plan-card',
                                      isCurrent ? 'manager-settings__plan-card--current' : '',
                                      isRequesting ? 'manager-settings__plan-card--requesting' : '',
                                    ].filter(Boolean).join(' ')}
                                    onClick={() => {
                                      if (isCurrent) return
                                      setRequestingPlan(isRequesting ? null : plan.key)
                                    }}
                                    disabled={isCurrent || subActionLoading}
                                  >
                                    <span className="manager-settings__plan-icon" aria-hidden>
                                      {plan.icon}
                                    </span>
                                    <div className="manager-settings__plan-body">
                                      <div className="manager-settings__plan-header-row">
                                        <span className="manager-settings__plan-name">{plan.label}</span>
                                        {isCurrent ? (
                                          <span className="manager-settings__plan-current-badge">Current</span>
                                        ) : (
                                          <ChevronRight className="manager-settings__plan-chevron" />
                                        )}
                                      </div>
                                      <span className="manager-settings__plan-price">{plan.priceLabel}</span>
                                      <span className="manager-settings__plan-desc">{plan.desc}</span>
                                    </div>
                                  </button>

                                  {isRequesting && (
                                    <div className="manager-settings__plan-request-panel">
                                      <p className="manager-settings__plan-request-text">
                                        Request a change to the <strong>{plan.label}</strong> plan? PartyOn admin will confirm before your billing updates.
                                      </p>
                                      <div className="manager-settings__plan-request-btns">
                                        <button
                                          type="button"
                                          className="manager-settings__sub-confirm-no"
                                          onClick={() => setRequestingPlan(null)}
                                          disabled={planChangeLoading}
                                        >
                                          Keep current
                                        </button>
                                        <button
                                          type="button"
                                          className="manager-settings__plan-request-confirm-btn"
                                          onClick={() => void handleRequestPlanChange(plan.key, plan.label)}
                                          disabled={planChangeLoading}
                                        >
                                          {planChangeLoading ? 'Requesting…' : 'Request Change'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Need another plan */}
                            <a
                              href="mailto:support@partyon.com"
                              className="manager-settings__plan-card manager-settings__plan-card--support"
                            >
                              <span className="manager-settings__plan-icon manager-settings__plan-icon--support" aria-hidden>
                                <IconHeadphones />
                              </span>
                              <div className="manager-settings__plan-body">
                                <div className="manager-settings__plan-header-row">
                                  <span className="manager-settings__plan-name">Need another plan?</span>
                                  <ChevronRight className="manager-settings__plan-chevron" />
                                </div>
                                <span className="manager-settings__plan-price--support">support@partyon.com</span>
                              </div>
                            </a>
                          </div>

                          <p className="manager-settings__sub-admin-note">
                            Admin contact: support@partyon.com. Managers can request a plan change here; final approval and billing updates are handled by PartyOn admin.
                          </p>
                        </>
                      )}

                      {isCancelled && (
                        <div className="manager-settings__sub-warning">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p>
                            Subscription cancelled. You'll retain access until <strong>{billingDate}</strong>, after which your club will be deactivated.
                          </p>
                        </div>
                      )}

                      <div className="manager-settings__sub-actions">
                        {isCancelled ? (
                          <button
                            type="button"
                            className="manager-settings__sub-reactivate-btn"
                            onClick={() => void handleReactivateSubscription()}
                            disabled={subActionLoading}
                          >
                            {subActionLoading ? 'Reactivating…' : 'Reactivate Subscription'}
                          </button>
                        ) : confirmingCancel ? (
                          <div className="manager-settings__sub-confirm">
                            <p className="manager-settings__sub-confirm-text">
                              Your subscription will be cancelled. You'll keep access until <strong>{billingDate}</strong>, then billing stops automatically.
                            </p>
                            <div className="manager-settings__sub-confirm-btns">
                              <button
                                type="button"
                                className="manager-settings__sub-confirm-no"
                                onClick={() => setConfirmingCancel(false)}
                                disabled={subActionLoading}
                              >
                                Keep subscription
                              </button>
                              <button
                                type="button"
                                className="manager-settings__sub-confirm-yes"
                                onClick={() => void handleCancelSubscription()}
                                disabled={subActionLoading}
                              >
                                {subActionLoading ? 'Cancelling…' : 'Yes, cancel'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="manager-settings__sub-cancel-btn"
                            onClick={() => setConfirmingCancel(true)}
                          >
                            Cancel Subscription
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )
            })()}

            {/* Notifications */}
            <section className="manager-settings__card" aria-labelledby="settings-notif-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconBell />
                </span>
                <div>
                  <h2 id="settings-notif-title" className="manager-settings__card-title">
                    Notifications
                  </h2>
                  <p className="manager-settings__card-sub">Manage notification preferences</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                {notificationItems.map((item) => (
                  <div key={item.key} className="manager-settings__row">
                    <div>
                      <p className="manager-settings__row-title">{item.title}</p>
                      <p className="manager-settings__row-desc">{item.desc}</p>
                    </div>
                    <label className="manager-settings__toggle">
                      <input
                        type="checkbox"
                        checked={notifications[item.key]}
                        onChange={() => toggleNotification(item.key)}
                        aria-label={`Toggle ${item.title}`}
                      />
                      <span className="manager-settings__toggle-track" aria-hidden>
                        <span className="manager-settings__toggle-thumb" />
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="manager-settings__card" aria-labelledby="settings-noshow-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconBell />
                </span>
                <div>
                  <h2 id="settings-noshow-title" className="manager-settings__card-title">
                    Reservation Rules
                  </h2>
                  <p className="manager-settings__card-sub">Automated no-show handling</p>
                </div>
              </header>

              <label className="manager-settings__inline-field">
                <span className="manager-settings__inline-label">No-Show Grace Period (minutes)</span>
                <input
                  className="manager-settings__inline-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={240}
                  value={noShowGrace}
                  onChange={(e) => setNoShowGrace(e.target.value)}
                  onBlur={() => void handleNoShowGraceBlur()}
                />
              </label>
            </section>

            {/* Security */}
            <section className="manager-settings__card" aria-labelledby="settings-security-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconLock />
                </span>
                <div>
                  <h2 id="settings-security-title" className="manager-settings__card-title">
                    Security
                  </h2>
                  <p className="manager-settings__card-sub">Password and authentication</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action manager-settings__action--expandable"
                  onClick={() => setChangingPassword((v) => !v)}
                >
                  <span>Change Password</span>
                  <ChevronRight
                    className={`manager-settings__action-chevron${changingPassword ? ' manager-settings__action-chevron--open' : ''}`}
                  />
                </button>

                {changingPassword && (
                  <ChangePasswordForm
                    session={session}
                    onSuccess={() => {
                      setChangingPassword(false)
                      setToast({ variant: 'success', message: 'Password updated successfully.' })
                    }}
                    onCancel={() => setChangingPassword(false)}
                  />
                )}

                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() =>
                    setToast({
                      variant: 'info',
                      message: 'Two-factor authentication is coming soon.',
                    })
                  }
                >
                  Two-Factor Authentication
                </button>
              </div>
            </section>

            {/* Team Access */}
            <section className="manager-settings__card" aria-labelledby="settings-team-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconUsers />
                </span>
                <div>
                  <h2 id="settings-team-title" className="manager-settings__card-title">
                    Team Access
                  </h2>
                  <p className="manager-settings__card-sub">Manage team members and permissions</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action"
                  onClick={() => navigate('/manager/staff-approval')}
                >
                  Manage Team Members
                </button>
              </div>
            </section>

            {/* Billing */}
            <section className="manager-settings__card" aria-labelledby="settings-billing-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconCard />
                </span>
                <div>
                  <h2 id="settings-billing-title" className="manager-settings__card-title">
                    Billing
                  </h2>
                  <p className="manager-settings__card-sub">Manage subscription and payments</p>
                </div>
              </header>

              <div className="manager-settings__rows">
                <button
                  type="button"
                  className="manager-settings__action manager-settings__action--expandable"
                  onClick={() => {
                    const next = !billingOpen
                    setBillingOpen(next)
                    if (next && !invoicesLoaded && club?.club_id) {
                      void loadInvoices(club.club_id)
                    }
                  }}
                >
                  <span>View Billing History</span>
                  <ChevronRight
                    className={`manager-settings__action-chevron${billingOpen ? ' manager-settings__action-chevron--open' : ''}`}
                  />
                </button>

                {billingOpen && (
                  <div className="manager-settings__tx-panel">
                    {invoicesLoading && (
                      <p className="manager-settings__tx-loading">Loading billing history…</p>
                    )}
                    {!invoicesLoading && invoicesLoaded && invoices.length === 0 && (
                      <p className="manager-settings__tx-empty">No invoices found for your club.</p>
                    )}
                    {!invoicesLoading && invoices.length > 0 && (
                      <>
                        <div className="manager-settings__tx-header">
                          <span>Transaction</span>
                          <span>Description</span>
                          <span>Date</span>
                          <span>Amount</span>
                          <span>Status</span>
                        </div>
                        <div className="manager-settings__tx-list">
                          {invoices.map((inv) => {
                            const norm = normalizeInvoiceStatus(inv.status)
                            return (
                              <div key={inv.invoiceId} className="manager-settings__tx-row">
                                <span className="manager-settings__tx-id" title={inv.invoiceId}>
                                  {inv.invoiceNumber}
                                </span>
                                <span className="manager-settings__tx-event">{inv.description}</span>
                                <span className="manager-settings__tx-date">{formatInvoiceDate(inv.invoiceDate)}</span>
                                <span className="manager-settings__tx-amount">{formatCurrency(inv.amount)}</span>
                                <span className={`manager-settings__tx-status manager-settings__tx-status--${norm}`}>
                                  {norm}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Saved cards */}
                {savedCards.length > 0 && (
                  <div className="manager-settings__cards-list">
                    {savedCards.map((card) => (
                      <SavedCardItem key={card.id} card={card} onDelete={handleDeleteCard} />
                    ))}
                  </div>
                )}

                {savedCards.length === 0 && !addingCard && (
                  <div className="manager-settings__cards-empty">
                    <CreditCard aria-hidden />
                    <p>No saved cards</p>
                    <span>Add a payment method for your club subscription</span>
                  </div>
                )}

                {!addingCard && (
                  <button
                    type="button"
                    className="manager-settings__add-card-btn"
                    onClick={() => setAddingCard(true)}
                  >
                    + Add Payment Method
                  </button>
                )}

                {addingCard && (
                  <AddCardForm
                    userId={userId}
                    onSaved={handleCardSaved}
                    onCancel={() => setAddingCard(false)}
                  />
                )}
              </div>
            </section>

            {/* Terms & Conditions */}
            <section className="manager-settings__card" aria-labelledby="settings-tc-title">
              <header className="manager-settings__card-head">
                <span className="manager-settings__card-icon" aria-hidden>
                  <IconFile />
                </span>
                <div>
                  <h2 id="settings-tc-title" className="manager-settings__card-title">
                    Terms &amp; Conditions
                  </h2>
                  <p className="manager-settings__card-sub">
                    Shown on every offer detail page
                  </p>
                </div>
              </header>

              {tcUpdatedAt ? (
                <p className="manager-settings__tc-meta">
                  Last updated: {formatUpdatedAt(tcUpdatedAt)}
                </p>
              ) : null}

              {tcEditing ? (
                <>
                  <textarea
                    className="manager-settings__tc-textarea"
                    value={tcDraft}
                    onChange={(e) => setTcDraft(e.target.value)}
                    aria-label="Terms and conditions text"
                    rows={10}
                  />
                  <div className="manager-settings__tc-actions">
                    <button
                      type="button"
                      className="manager-settings__tc-save"
                      disabled={tcSaving || tcDraft.trim() === tcText.trim()}
                      onClick={() => void saveTc()}
                    >
                      {tcSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="manager-settings__tc-cancel"
                      onClick={() => setTcEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <pre className="manager-settings__tc-text">
                    {tcText || 'No terms set yet.'}
                  </pre>
                  <button
                    type="button"
                    className="manager-settings__tc-edit"
                    onClick={() => {
                      setTcDraft(tcText)
                      setTcEditing(true)
                    }}
                  >
                    Edit
                  </button>
                </>
              )}
            </section>

            {/* Logout */}
            <button
              type="button"
              className="manager-settings__logout"
              onClick={() => void signOut()}
            >
              <IconLogout />
              Logout
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`manager-settings__toast manager-settings__toast--${toast.variant}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
