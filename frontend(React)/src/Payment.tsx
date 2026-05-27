import { useState, useEffect } from 'react'
import './Payment.css'
import { getJson, postJson, API_BASE_URL } from '@/api'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Lock, Minus, Plus, Ticket } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import type { EventDetail } from '@/types'

type Step = 'ticket' | 'payment'
const MAX_TICKET_QUANTITY = 5

type LegacyEvent = {
  event_id?: string
  event_name?: string
  event_starting_date?: string
  event_image?: string
  final_ticket_price?: number
  currency?: string
}

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

  const [step, setStep] = useState<Step>('ticket')
  const [legacyEvent, setLegacyEvent] = useState<LegacyEvent | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [organizerUpdates, setOrganizerUpdates] = useState(true)
  const [paying, setPaying] = useState(false)

  // fallback fetch
  useEffect(() => {
    if (stateEvent || !id || id === 'undefined') return

    getJson<any>(`/event/${id}`)
      .then(({ data, error }) => {
        if (error) return console.error(error)
        setLegacyEvent(data)
      })
      .catch(console.error)
  }, [id, stateEvent])

  const currency = stateEvent?.currency ?? legacyEvent?.currency ?? '€'
  const unitPrice = stateEvent?.price ?? legacyEvent?.final_ticket_price ?? 0
  const total = (unitPrice * quantity).toFixed(2)

  const eventName = stateEvent?.title ?? legacyEvent?.event_name ?? ''
  const eventDate =
    stateEvent?.rawDate ?? stateEvent?.date ?? legacyEvent?.event_starting_date
  const eventImage = stateEvent?.imageUrl ?? legacyEvent?.event_image ?? ''
  const eventVenue = stateEvent?.club ?? ''
  const legacyEventId = legacyEvent?.event_id

  async function handlePay() {
    if (paying) return
    if (quantity > MAX_TICKET_QUANTITY) {
      setQuantity(MAX_TICKET_QUANTITY)
      return
    }

    setPaying(true)

    try {
      const { data, error } = await postJson<{ url?: string }>('/event/pay', {
        amount: unitPrice * 100,
        quantity,
        events: legacyEvent ?? {
          event_id: id,
          event_name: eventName,
          event_starting_date: eventDate,
          event_image: eventImage,
          final_ticket_price: unitPrice,
        },
      })

      if (error || !data?.url) {
        console.error(error ?? 'Checkout did not return a Stripe URL')
        setPaying(false)
        return
      }

      window.location.href = data.url
    } catch (e) {
      console.error(e)
      setPaying(false)
    }
  }

  const EventHeader = (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/4 p-4">
      {eventImage ? (
        <img src={eventImage} className="h-14 w-14 rounded-xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/8">
          <Ticket className="h-6 w-6 text-white/40" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{eventName || 'Event'}</p>
        <p className="mt-0.5 text-sm text-white/50">{formatEventDate(eventDate)}</p>
        {eventVenue && (
          <p className="mt-0.5 text-xs text-white/35">{eventVenue}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="mx-auto max-w-lg px-4 pt-24 pb-20">
        <div className="mb-6 flex justify-between">
          <button onClick={() => (step === 'payment' ? setStep('ticket') : navigate(-1))}>
            <ArrowLeft /> Back
          </button>

          <nav className="flex items-center gap-2">
            <StepCrumb label="Ticket" active={step === 'ticket'} done={step === 'payment'} />
            <ChevronRight />
            <StepCrumb label="Payment" active={step === 'payment'} done={false} />
          </nav>

          <span />
        </div>

        <AnimatePresence mode="wait">
          {step === 'ticket' && (
            <motion.div key="ticket" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {EventHeader}

              <button onClick={() => setStep('payment')}>Continue</button>
            </motion.div>
          )}

          {step === 'payment' && (
            <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {EventHeader}

              <div>Total: {currency}{total}</div>

              <button onClick={() => void handlePay()} disabled={paying || (!legacyEventId && !stateEvent)}>
                {paying ? 'Redirecting…' : `Pay ${currency}${total}`}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <LovableFooter />
    </div>
  )
}