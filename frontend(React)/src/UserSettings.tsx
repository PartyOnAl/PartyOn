import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Receipt,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/* ── Types ── */

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other'

type SavedCard = {
  id: string
  lastFour: string
  brand: CardBrand
  expiryMonth: string
  expiryYear: string
  nameOnCard: string
  addedAt: string
}

type NotificationPrefs = {
  bookingConfirmations: boolean
  eventUpdates: boolean
}

type Toast = { message: string; variant: 'success' | 'info' | 'error' }

/* ── Card storage (localStorage per user) ── */

function cardsKey(userId: string) {
  return `partyOn_cards_${userId}`
}
function loadCards(userId: string): SavedCard[] {
  try {
    const raw = localStorage.getItem(cardsKey(userId))
    return raw ? (JSON.parse(raw) as SavedCard[]) : []
  } catch {
    return []
  }
}
function persistCards(userId: string, cards: SavedCard[]) {
  try {
    localStorage.setItem(cardsKey(userId), JSON.stringify(cards))
  } catch {
    // ignore
  }
}

/* ── Notification prefs ── */

function loadNotifPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem('partyOn_notifPrefs')
    if (raw) return JSON.parse(raw) as NotificationPrefs
  } catch {
    // ignore
  }
  return { bookingConfirmations: true, eventUpdates: true }
}
function persistNotifPrefs(prefs: NotificationPrefs) {
  try {
    localStorage.setItem('partyOn_notifPrefs', JSON.stringify(prefs))
  } catch {
    // ignore
  }
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

/* ── BrandBadge ── */

function BrandBadge({ brand }: { brand: CardBrand }) {
  const styles: Record<CardBrand, string> = {
    visa: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    mastercard: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    amex: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    other: 'border-white/15 bg-white/5 text-muted-foreground',
  }
  const labels: Record<CardBrand, string> = {
    visa: 'VISA',
    mastercard: 'MC',
    amex: 'AMEX',
    other: 'CARD',
  }
  return (
    <span
      className={`inline-flex h-6 min-w-[2.75rem] items-center justify-center rounded border px-1.5 text-[10px] font-extrabold tracking-widest ${styles[brand]}`}
    >
      {labels[brand]}
    </span>
  )
}

/* ── Saved card row ── */

function CardItem({ card, onDelete }: { card: SavedCard; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <BrandBadge brand={card.brand} />
      <span className="text-sm font-semibold tracking-wider text-white">•••• {card.lastFour}</span>
      <span className="text-xs text-muted-foreground">
        {card.expiryMonth}/{card.expiryYear}
      </span>
      <span className="ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground/60">
        {card.nameOnCard}
      </span>
      <button
        type="button"
        onClick={() => onDelete(card.id)}
        className="ml-2 rounded-lg p-1.5 text-muted-foreground/40 transition hover:bg-red-500/10 hover:text-red-400"
        aria-label="Remove card"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ── Add Card form ── */

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
    if (digits.length < 13 || digits.length > 19) {
      setFieldError('Please enter a valid card number.')
      return
    }
    const expiryMatch = expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/)
    if (!expiryMatch || parseInt(expiryMatch[1], 10) < 1 || parseInt(expiryMatch[1], 10) > 12) {
      setFieldError('Please enter a valid expiry date (MM / YY).')
      return
    }
    const cvcClean = cvc.replace(/\D/g, '')
    if (cvcClean.length < 3 || cvcClean.length > 4) {
      setFieldError(`CVC must be ${expectedCvcLen} digits.`)
      return
    }
    if (!nameOnCard.trim()) {
      setFieldError('Please enter the name on the card.')
      return
    }

    const newCard: SavedCard = {
      id: crypto.randomUUID(),
      lastFour: digits.slice(-4),
      brand,
      expiryMonth: expiryMatch[1],
      expiryYear: expiryMatch[2],
      nameOnCard: nameOnCard.trim(),
      addedAt: new Date().toISOString(),
    }
    persistCards(userId, [...loadCards(userId), newCard])
    onSaved(newCard)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#0d0d10] p-5">
        {/* Card number */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Card number
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardInput(e.target.value))}
              placeholder="1234 5678 9012 3456"
              className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-2.5 pl-3.5 pr-16 text-sm text-white outline-none transition focus:border-primary/50 focus:bg-white/[0.06]"
            />
            {cardNumber && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <BrandBadge brand={brand} />
              </span>
            )}
          </div>
        </div>

        {/* Expiry + CVC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Expiry date
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
              placeholder="MM / YY"
              className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-primary/50 focus:bg-white/[0.06]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              CVC / CVV
            </label>
            <div className="relative">
              <input
                type={showCvc ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="cc-csc"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, expectedCvcLen))}
                placeholder={isAmex ? '••••' : '•••'}
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-2.5 pl-3.5 pr-9 text-sm text-white outline-none transition focus:border-primary/50 focus:bg-white/[0.06]"
              />
              <button
                type="button"
                onClick={() => setShowCvc((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition hover:text-muted-foreground"
              >
                {showCvc ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Name on card */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Name on card
          </label>
          <input
            type="text"
            autoComplete="cc-name"
            value={nameOnCard}
            onChange={(e) => setNameOnCard(e.target.value)}
            placeholder="Full name as shown on card"
            className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-primary/50 focus:bg-white/[0.06]"
          />
        </div>

        {fieldError && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-xs text-red-300">
            {fieldError}
          </p>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Save Card
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/8"
          >
            Cancel
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/40">
          CVC is used for verification only and is never stored. Card details are saved on your
          device for display — actual payments are processed securely via Stripe.
        </p>
      </div>
    </motion.div>
  )
}

/* ── Change Password form ── */

function ChangePasswordForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  async function handleSubmit() {
    setFieldError(null)
    if (newPassword.length < 6) { setFieldError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setFieldError('Passwords do not match.'); return }
    if (!supabase || !isSupabaseConfigured) { setFieldError('Authentication not configured.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) { setFieldError(error.message); return }
    onSuccess()
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden"
    >
      <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#0d0d10] p-5">
        {[
          { label: 'New password', val: newPassword, set: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v), ph: 'Min. 6 characters' },
          { label: 'Confirm new password', val: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v), ph: 'Re-enter password' },
        ].map(({ label, val, set, show, toggle, ph }) => (
          <div key={label}>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-2.5 pl-3.5 pr-10 text-sm text-white outline-none transition focus:border-primary/50 focus:bg-white/[0.06]"
              />
              <button type="button" onClick={toggle} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition hover:text-muted-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
        {fieldError && (
          <p className="rounded-xl border border-red-500/25 bg-red-500/8 px-3.5 py-2.5 text-xs text-red-300">
            {fieldError}
          </p>
        )}
        <div className="flex gap-2.5 pt-1">
          <button type="button" onClick={() => void handleSubmit()} disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-55">
            {saving ? 'Updating…' : 'Update Password'}
          </button>
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/8">
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Reusable card shell ── */

function Card({
  icon,
  title,
  subtitle,
  children,
  className = '',
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-white/8 bg-[#101016]/80 p-5 ${className}`}>
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-muted-foreground">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function ActionBtn({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/12 hover:bg-white/5">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/35" />
    </button>
  )
}

function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 py-3 last:border-0">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-all duration-200 ${
          checked ? 'border-fuchsia-500/50 bg-gradient-to-r from-pink-500 to-fuchsia-500' : 'border-white/12 bg-white/8'
        }`}>
        <span className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5 bg-white' : 'translate-x-0.5 bg-white/50'
        }`} />
      </button>
    </div>
  )
}

/* ── Main page ── */

export default function UserSettings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const [toast, setToast] = useState<Toast | null>(null)
  const [notifications, setNotifications] = useState<NotificationPrefs>(loadNotifPrefs)
  const [changingPassword, setChangingPassword] = useState(false)
  const [addingCard, setAddingCard] = useState(false)
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])

  useEffect(() => { if (userId) setSavedCards(loadCards(userId)) }, [userId])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  function toggleNotif(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...notifications, [key]: value }
    setNotifications(next)
    persistNotifPrefs(next)
    setToast({ message: 'Preference saved.', variant: 'success' })
  }

  function handleCardSaved(card: SavedCard) {
    setSavedCards((prev) => [...prev, card])
    setAddingCard(false)
    setToast({ message: 'Card saved.', variant: 'success' })
  }

  function handleDeleteCard(id: string) {
    const updated = savedCards.filter((c) => c.id !== id)
    setSavedCards(updated)
    persistCards(userId, updated)
    setToast({ message: 'Card removed.', variant: 'info' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        {/* Same max-width as MyBookings */}
        <div className="mx-auto w-full max-w-5xl">

          <button type="button" onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/70 hover:bg-primary/10">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Page title — sits directly on page background, same as MyBookings */}
            <header className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your security, payment methods, and preferences
              </p>
            </header>

            <div className="grid gap-5 lg:grid-cols-2">

              {/* Security */}
              <Card icon={<KeyRound className="h-4 w-4" />} title="Security" subtitle="Manage your login password">
                <button type="button" onClick={() => setChangingPassword((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/12 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-white">Change Password</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Update your login password</p>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground/35 transition-transform duration-200 ${changingPassword ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {changingPassword && (
                    <ChangePasswordForm
                      onSuccess={() => { setChangingPassword(false); setToast({ message: 'Password updated successfully.', variant: 'success' }) }}
                      onCancel={() => setChangingPassword(false)}
                    />
                  )}
                </AnimatePresence>
              </Card>

              {/* Notifications */}
              <Card icon={<Bell className="h-4 w-4" />} title="Notifications" subtitle="Email preferences for account activity">
                <Toggle
                  title="Booking Confirmations"
                  description="Receive emails when a booking is confirmed"
                  checked={notifications.bookingConfirmations}
                  onChange={(v) => toggleNotif('bookingConfirmations', v)}
                />
                <Toggle
                  title="Event Updates"
                  description="Get notified about changes to events you've booked"
                  checked={notifications.eventUpdates}
                  onChange={(v) => toggleNotif('eventUpdates', v)}
                />
                <p className="mt-3 text-[11px] text-muted-foreground/45">
                  These control what PartyOn sends to your email address.
                </p>
              </Card>

              {/* Billing & Payments — full width */}
              <Card
                icon={<CreditCard className="h-4 w-4" />}
                title="Billing & Payments"
                subtitle="Saved cards and transaction history"
                className="lg:col-span-2"
              >
                {/* Billing history */}
                <ActionBtn
                  icon={<Receipt className="h-4 w-4" />}
                  label="Billing History"
                  description="View past purchases and tickets"
                  onClick={() => navigate('/my-bookings')}
                />

                {/* Saved cards */}
                <div className="mt-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Saved Cards
                    </p>
                    {!addingCard && (
                      <button type="button" onClick={() => setAddingCard(true)}
                        className="text-xs font-semibold text-primary transition hover:text-primary/80">
                        + Add card
                      </button>
                    )}
                  </div>

                  {savedCards.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {savedCards.map((card) => (
                        <CardItem key={card.id} card={card} onDelete={handleDeleteCard} />
                      ))}
                    </div>
                  )}

                  {savedCards.length === 0 && !addingCard && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/[0.015] px-6 py-8 text-center">
                      <CreditCard className="mb-2 h-7 w-7 text-muted-foreground/25" />
                      <p className="text-sm font-medium text-muted-foreground/60">No saved cards</p>
                      <p className="mt-1 text-xs text-muted-foreground/40">
                        Add a card for faster checkout when buying tickets
                      </p>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {addingCard && (
                      <AddCardForm
                        userId={userId}
                        onSaved={handleCardSaved}
                        onCancel={() => setAddingCard(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* Account — full width */}
              <section className="rounded-2xl border border-white/8 bg-[#101016]/80 p-5 lg:col-span-2">
                <header className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/15 bg-red-500/8 text-red-400">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-white">Account</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Session management</p>
                  </div>
                </header>
                <button type="button" onClick={() => void signOut()}
                  className="flex items-center gap-3 rounded-xl border border-red-500/18 bg-red-500/[0.04] px-4 py-3 text-left transition hover:border-red-500/30 hover:bg-red-500/8">
                  <LogOut className="h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">Sign Out</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Sign out of your PartyOn account</p>
                  </div>
                </button>
              </section>

            </div>
          </motion.div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            role="status"
            className={`fixed bottom-6 right-6 z-[200] max-w-[min(92vw,360px)] rounded-xl px-4 py-3.5 text-sm font-semibold shadow-2xl ${
              toast.variant === 'success'
                ? 'border border-emerald-500/40 bg-[#0a1a12] text-emerald-300'
                : toast.variant === 'error'
                  ? 'border border-red-500/40 bg-[#1a0a0a] text-red-300'
                  : 'border border-white/12 bg-[#1a1a1f] text-white/80'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
