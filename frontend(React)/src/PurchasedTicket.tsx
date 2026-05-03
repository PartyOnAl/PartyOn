import './PurchasedTicket.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'

type BookingDetail = {
  reservationId: string
  reservationReference: string
  eventId: string
  eventName: string
  eventImage: string | null
  eventStartingDate: string | null
  eventHours: string | null
  clubName: string | null
  clubAddress: string | null
  quantity: number
  bookingType: 'ticket' | 'reservation'
  status: string
  qrValue: string
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M6 12l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9h16M8 5V3M16 5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 6h16v12H4V6zm0 0l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 4v10m0 0l-3-3m3 3l3-3M5 18h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M5 12h12m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatEventDate(dateString: string | null) {
  if (!dateString) return 'Date not available'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Date not available'

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${formattedDate} • ${time}`
}

function normalizeType(type: string | null | undefined): 'ticket' | 'reservation' {
  const t = String(type ?? '').toLowerCase()
  return t.includes('reservation') || t.includes('table') ? 'reservation' : 'ticket'
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function orderIdFrom(reservationId: string): string {
  return `PO-${reservationId.slice(0, 8).toUpperCase()}`
}

function buildIcs({
  title,
  startIso,
  location,
  description,
}: {
  title: string
  startIso: string
  location: string
  description: string
}) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PartyOn//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@partyon`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function PurchasedTicket() {
  const navigate = useNavigate()
  const { bookingId, id, quantity } = useParams()
  const checkoutSessionId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('checkout_session_id')
      : null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  async function persistTicketBookingIfNeeded(payload: {
    eventId: string
    quantity: number
    qrValueSeed: string
  }) {
    if (!supabase || !isSupabaseConfigured) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) return

    const key = `ticket-booking:${user.id}:${payload.eventId}:${payload.quantity}:${payload.qrValueSeed}`
    if (sessionStorage.getItem(key) === '1') return

    const nowIso = new Date().toISOString()
    const random = Math.floor(1000 + Math.random() * 9000)
    const ticketRef = `TKT-${new Date().getFullYear()}-${String(random)}`
    const qrUnique = `TKT-${payload.eventId}-${Date.now()}-${random}`

    // Try newer schema first.
    const modernInsert = await supabase
      .from('reservations')
      .insert({
        user_id: user.id,
        event_id: payload.eventId,
        number_of_people: payload.quantity,
        time_slot: null,
        special_requests: null,
        status: 'confirmed',
        reservation_reference: ticketRef,
        created_at: nowIso,
        updated_at: nowIso,
      })

    if (modernInsert.error) {
      // Fallback to legacy schema in this project.
      const legacyInsert = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          event_id: payload.eventId,
          nr_of_people: payload.quantity,
          expected_arrival_time: null,
          notes: `Stripe checkout${checkoutSessionId ? ` (${checkoutSessionId})` : ''}`,
          status: 'confirmed',
          type: 'ticket',
          qr_code: qrUnique,
          reservation_date: nowIso,
          created_at: nowIso,
        })

      if (legacyInsert.error) {
        return
      }
    }

    sessionStorage.setItem(key, '1')
  }

  useEffect(() => {
  if (!id || id === 'undefined') return

  let active = true

  async function loadEvent() {
    try {
      const res = await fetch(`http://localhost:3000/event/${id}`)
      if (!res.ok) throw new Error('Failed to fetch event')

      const data = await res.json()

      if (!active) return
      setEvents(data)
    } catch (err) {
      if (!active) return
      console.error('Event fetch error:', err)
      setEvents(null)
    }
  }

  loadEvent()

  return () => {
    active = false
  }
}, [id])
  return (
    <div className="purchased-ticket">
      <Navbar />
      <div className="purchased-ticket__glow" aria-hidden={true} />
      <div className="purchased-ticket__inner" style={{ paddingTop: '88px' }}>
        <Link to="/my-bookings" className="purchased-ticket__back-link">
          ← Back to My Bookings
        </Link>

        {loading ? (
          <div className="purchased-ticket__card">Loading booking details...</div>
        ) : error || !booking ? (
          <div className="purchased-ticket__card">{error || 'Could not load booking details.'}</div>
        ) : (
          <>
            <header className="purchased-ticket__success">
              <div className="purchased-ticket__check">
                <CheckIcon />
              </div>
              <h1 className="purchased-ticket__headline">You&apos;re in</h1>
              <p className="purchased-ticket__sub">Your booking is confirmed</p>
            </header>

            <div className="purchased-ticket__summary">
              <div
                className="payment-page__event-thumb"
                style={{
                  backgroundImage: booking.eventImage ? `url(${booking.eventImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div>
                <p className="purchased-ticket__summary-title">{booking.eventName}</p>
                <p className="purchased-ticket__summary-meta">
                  <CalendarSmallIcon />
                  <span>{formatEventDate(booking.eventStartingDate)}</span>
                </p>
              </div>
            </div>

            <div className="purchased-ticket__card">
              <div className="purchased-ticket__card-grid">
                <div className="purchased-ticket__qr">
                  <img src={qrSrc} alt="Booking QR code" width={220} height={220} loading="lazy" />
                </div>
                <div className="purchased-ticket__details">
                  <h2 className="purchased-ticket__event-title">{booking.eventName}</h2>
                  <p className="purchased-ticket__tier">
                    {booking.bookingType === 'reservation' ? 'Reservation' : 'General Admission'}
                  </p>
                  <div className="purchased-ticket__detail-line">
                    <CalendarSmallIcon />
                    <div>
                      <div>{formatEventDate(booking.eventStartingDate)}</div>
                      <div>• Doors open at {booking.eventHours || 'TBA'}</div>
                    </div>
                  </div>
                  <div className="purchased-ticket__detail-line">
                    <PinIcon />
                    <div>
                      <div>{booking.clubName || 'Venue not set'}</div>
                      <div>{booking.clubAddress || 'Address not available'}</div>
                    </div>
                  </div>
                  <div className="purchased-ticket__label-row">
                    <div className="purchased-ticket__meta-label">Quantity</div>
                    <div className="purchased-ticket__meta-value">{quantityLabel}</div>
                  </div>
                  <div className="purchased-ticket__label-row">
                    <div className="purchased-ticket__meta-label">
                      {booking.bookingType === 'reservation' ? 'Reservation reference' : 'Order number'}
                    </div>
                    <div className="purchased-ticket__meta-value">#{orderId}</div>
                  </div>
                </div>
              </div>

              <div className="purchased-ticket__util-row">
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => setPreviewOpen(true)}
                >
                  <EyeIcon />
                  View
                </button>
                <button type="button" className="purchased-ticket__util-btn" onClick={handleEmail}>
                  <MailIcon />
                  Email
                </button>
                <button type="button" className="purchased-ticket__util-btn" onClick={() => void handleDownloadPdf()}>
                  <DownloadIcon />
                  Download
                </button>
              </div>

              <button type="button" className="purchased-ticket__calendar-btn" onClick={handleAddToCalendar}>
                <PlusIcon />
                Add to Calendar
              </button>
            </div>

            <p className="purchased-ticket__secure">Your booking is securely stored in your account</p>

            <nav className="purchased-ticket__nav" aria-label="Next steps">
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--ghost"
                onClick={() => navigate({ pathname: '/', hash: 'events' })}
              >
                View more events
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary"
                onClick={() => navigate('/my-bookings')}
              >
                Go to My Bookings
                <ArrowRightIcon />
              </button>
            </nav>

            {previewOpen ? (
              <div className="purchased-ticket__preview-overlay" onClick={() => setPreviewOpen(false)}>
                <div
                  className="purchased-ticket__preview-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="purchased-ticket__preview-title">{booking.eventName}</h3>
                  <p className="purchased-ticket__preview-sub">{formatEventDate(booking.eventStartingDate)}</p>
                  <div className="purchased-ticket__preview-qr-wrap">
                    <img src={qrSrc} alt="Booking QR enlarged" className="purchased-ticket__preview-qr" />
                  </div>
                  <p className="purchased-ticket__preview-ref">
                    {booking.bookingType === 'reservation' ? 'Reservation Reference' : 'Order Number'}: #{orderId}
                  </p>
                  <div className="purchased-ticket__preview-actions">
                    <button type="button" className="purchased-ticket__util-btn" onClick={() => window.print()}>
                      Print
                    </button>
                    <button type="button" className="purchased-ticket__util-btn" onClick={() => setPreviewOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
      <LovableFooter />
    </div>
  )
}
