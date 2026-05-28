import { useEffect, useState } from 'react'
import './Payment.css'
import { getJson, postJson } from '@/api'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Lock, Minus, Plus, Ticket } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { useAuth } from '@/contexts/AuthContext'
import {
  buildStripeEventPayload,
  eventNeedsTicket,
  isReservationFlow,
  pickEventForFlow,
  resolveEventPrice,
  type LegacyEventPay,
} from '@/lib/eventCheckout'
import type { EventDetail } from '@/types'

type Step = 'ticket' | 'payment'
const MAX_TICKET_QUANTITY = 5

function formatEventDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return (
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d) +
    ' • ' +
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  )
}

function StepCrumb({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={`text-sm font-semibold transition-colors ${
        active ? 'text-white' : done ? 'text-primary/70' : 'text-white/30'
      }`}
    >
      {label}
    </span>
  )
}

export default function Payment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const stateEvent = (location.state as { event?: EventDetail } | null)?.event

  const { user, isLoading: authLoading } = useAuth()

  const [step, setStep] = useState<Step>('ticket')
  const [legacyEvent, setLegacyEvent] = useState<LegacyEventPay | null>(null)
  const [catalogEvent, setCatalogEvent] = useState<EventDetail | null>(null)
  const [loadingEvent, setLoadingEvent] = useState(!stateEvent && Boolean(id && id !== 'undefined'))
  const [quantity, setQuantity] = useState(1)
  const [organizerUpdates, setOrganizerUpdates] = useState(true)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || id === 'undefined') {
      setLoadingEvent(false)
      return
    }

    if (!stateEvent) setLoadingEvent(true)

    Promise.all([
      getJson<LegacyEventPay>(`/event/${id}`),
      getJson<EventDetail>(`/catalog/events/${id}`),
    ])
      .then(([legacyRes, catalogRes]) => {
        if (legacyRes.data) setLegacyEvent(legacyRes.data)
        if (catalogRes.data) setCatalogEvent(catalogRes.data)
        if (legacyRes.error) console.error(legacyRes.error)
        if (catalogRes.error) console.error(catalogRes.error)
      })
      .finally(() => setLoadingEvent(false))
  }, [id, stateEvent])

  useEffect(() => {
    if (authLoading) return
    if (!user && id && id !== 'undefined') {
      navigate(`/login?from=${encodeURIComponent(`/payment/${id}`)}`, { replace: true })
    }
  }, [authLoading, user, id, navigate])

  const activeEvent = pickEventForFlow(catalogEvent, stateEvent ?? undefined, undefined)
  const currency = activeEvent?.currency ?? legacyEvent?.currency ?? '€'
  const unitPrice = resolveEventPrice(activeEvent ?? undefined, legacyEvent)
  const total = (unitPrice * quantity).toFixed(2)

  const eventName = activeEvent?.title ?? legacyEvent?.event_name ?? ''
  const eventDate =
    activeEvent?.rawDate ?? activeEvent?.date ?? legacyEvent?.event_starting_date
  const eventImage = activeEvent?.imageUrl ?? legacyEvent?.event_image ?? ''
  const eventVenue = activeEvent?.club ?? ''
  const eventId = activeEvent?.id ?? legacyEvent?.event_id ?? id
  const hasEvent = Boolean(eventId && eventId !== 'undefined')

  useEffect(() => {
    if (loadingEvent || !activeEvent || !hasEvent) return
    if (isReservationFlow(activeEvent) || !eventNeedsTicket(activeEvent)) {
      navigate(`/reserve/${encodeURIComponent(eventId!)}`, {
        replace: true,
        state: { event: activeEvent },
      })
    }
  }, [activeEvent, eventId, hasEvent, loadingEvent, navigate])

  function handleBack() {
    if (step === 'payment') {
      setStep('ticket')
      return
    }
    if (eventId && eventId !== 'undefined') {
      navigate(`/event/${encodeURIComponent(eventId)}`, {
        state: activeEvent ? { event: activeEvent } : undefined,
      })
      return
    }
    navigate(-1)
  }
  const canContinue = hasEvent
  const canPay = hasEvent && unitPrice > 0

  async function handlePay() {
    if (paying || !canPay) return
    if (quantity > MAX_TICKET_QUANTITY) {
      setQuantity(MAX_TICKET_QUANTITY)
      return
    }

    setPaying(true)
    setPayError(null)

    try {
      const { data, error } = await postJson<{ url?: string }>('/event/pay', {
        amount: unitPrice * 100,
        quantity,
        events: buildStripeEventPayload({
          eventId: eventId!,
          eventName,
          legacy: legacyEvent,
        }),
      })

      if (error || !data?.url) {
        setPayError(error ?? 'Checkout did not return a payment URL. Try again.')
        setPaying(false)
        return
      }

      window.location.href = data.url
    } catch {
      setPayError('Could not start checkout. Check your connection and try again.')
      setPaying(false)
    }
  }

  const EventHeader = (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/4 p-4">
      {eventImage ? (
        <img
          src={eventImage}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/8">
          <Ticket className="h-6 w-6 text-white/40" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{eventName || 'Event'}</p>
        <p className="mt-0.5 text-sm text-white/50">{formatEventDate(eventDate)}</p>
        {eventVenue ? (
          <p className="mt-0.5 text-xs text-white/35">{eventVenue}</p>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 15% 40%, rgba(168,85,247,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 70%, rgba(236,72,153,0.14) 0%, transparent 55%)',
        }}
      />

      <div className="mx-auto max-w-lg px-4 pb-20 pt-24">
        {/* Nav */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <nav className="flex items-center gap-2" aria-label="Checkout progress">
            <StepCrumb label="Ticket" active={step === 'ticket'} done={step === 'payment'} />
            <ChevronRight className="h-3 w-3 text-white/20" />
            <StepCrumb label="Payment" active={step === 'payment'} done={false} />
            <ChevronRight className="h-3 w-3 text-white/20" />
            <StepCrumb label="Confirmation" active={false} done={false} />
          </nav>
          <span className="w-24" aria-hidden />
        </div>

        {loadingEvent ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-2xl bg-white/6" />
            <div className="h-40 rounded-2xl bg-white/6" />
            <div className="h-12 rounded-full bg-white/6" />
          </div>
        ) : !hasEvent && !loadingEvent ? (
          <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-5 text-center text-sm text-red-200">
            Could not load event details. Go back and try again.
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* Step 1 — Ticket */}
            {step === 'ticket' && (
              <motion.div
                key="ticket"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                {EventHeader}

                {/* Quantity */}
                <div className="rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
                  <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-white/40">
                    Quantity
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/6 text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2rem] text-center text-xl font-bold text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(MAX_TICKET_QUANTITY, q + 1))}
                      disabled={quantity >= MAX_TICKET_QUANTITY}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/6 text-white transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="ml-auto text-sm text-white/45">
                      {quantity} × {currency}
                      {unitPrice.toFixed(2)}
                    </span>
                  </div>
                  {quantity >= MAX_TICKET_QUANTITY && (
                    <p className="mt-3 text-xs text-white/35">
                      Ticket purchases are limited to {MAX_TICKET_QUANTITY} per order.
                    </p>
                  )}
                </div>

                {/* Total + opt-in */}
                <div className="rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-white/60">Total</span>
                    <span className="text-2xl font-extrabold text-white">
                      {currency}
                      {total}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/30">No booking fees · Final price</p>

                  <label className="mt-4 flex cursor-pointer items-start gap-3">
                    <div
                      onClick={() => setOrganizerUpdates((o) => !o)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-all ${
                        organizerUpdates ? 'border-primary bg-primary' : 'border-white/25'
                      }`}
                    >
                      {organizerUpdates && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <span
                      className="cursor-pointer text-xs leading-relaxed text-white/45"
                      onClick={() => setOrganizerUpdates((o) => !o)}
                    >
                      Get updates from this organizer about future events.
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('payment')}
                  disabled={!canContinue}
                  className="w-full cursor-pointer rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 text-base font-bold text-white shadow-xl shadow-pink-500/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to Payment
                </button>

                {canContinue && !canPay ? (
                  <p className="text-center text-xs text-amber-200/80">
                    This event has no ticket price set. Contact the venue or pick another event.
                  </p>
                ) : null}

                <p className="text-center text-xs text-white/25">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </motion.div>
            )}

            {/* Step 2 — Payment */}
            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                {EventHeader}

                {/* Order summary */}
                <div className="rounded-2xl border border-white/10 bg-white/4 px-5 py-5">
                  <p className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-white/40">
                    Order Summary
                  </p>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">Admission</span>
                      <span className="text-white/70">
                        {quantity}× {currency}
                        {unitPrice.toFixed(2)}
                      </span>
                    </div>
                    {quantity > 1 && (
                      <div className="flex items-center justify-between text-xs text-white/35">
                        <span>Unit price</span>
                        <span>
                          {currency}
                          {unitPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between border-t border-white/8 pt-4">
                    <span className="text-sm font-medium text-white/60">Total</span>
                    <span className="text-2xl font-extrabold text-white">
                      {currency}
                      {total}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/25">No booking fees · Final price</p>
                </div>

                {/* Stripe notice */}
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <p className="text-sm font-medium text-white/80">Secure payment via Stripe</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                      You&apos;ll be taken to Stripe&apos;s secure checkout. If you&apos;ve paid
                      before, your saved card will be shown there as a one-click option.
                    </p>
                  </div>
                </div>

                {payError ? (
                  <p className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {payError}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handlePay()}
                  disabled={paying || !canPay}
                  className="w-full cursor-pointer rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-4 text-base font-bold text-white shadow-xl shadow-pink-500/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {paying ? 'Redirecting to Stripe…' : `Pay ${currency}${total}`}
                </button>

                <p className="text-center text-xs text-white/25">
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <LovableFooter />
    </div>
  )
}
