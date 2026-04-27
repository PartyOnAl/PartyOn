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
    let active = true

    async function loadDetail() {
      setLoading(true)
      setError(null)

      if (bookingId) {
        if (!supabase || !isSupabaseConfigured) {
          if (active) {
            setError('Supabase is not configured.')
            setLoading(false)
          }
          return
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (!active) return
        if (userError || !user) {
          navigate('/login', { replace: true })
          return
        }

        // Legacy schema shape (first try with reservation_reference, then fallback if column doesn't exist)
        const firstLegacy = await supabase
          .from('reservations')
          .select(
            `reservation_id,nr_of_people,type,status,qr_code,expected_arrival_time,reservation_reference,
             event:events(event_id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
          )
          .eq('reservation_id', bookingId)
          .eq('user_id', user.id)
          .single()
        let data: unknown = firstLegacy.data
        let detailError: { message?: string } | null = firstLegacy.error as { message?: string } | null

        const missingReferenceColumn =
          detailError?.message?.toLowerCase().includes('reservation_reference') &&
          detailError?.message?.toLowerCase().includes('does not exist')
        if (missingReferenceColumn) {
          const retry = await supabase
            .from('reservations')
            .select(
              `reservation_id,nr_of_people,type,status,qr_code,expected_arrival_time,
               event:events(event_id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
            )
            .eq('reservation_id', bookingId)
            .eq('user_id', user.id)
            .single()
          data = retry.data
          detailError = retry.error
        }

        if (!active) return

        if (!detailError && data) {
          const row = data as unknown as {
            reservation_id: string
            nr_of_people: number | null
            type: string | null
            status: string | null
            qr_code: string | null
            expected_arrival_time: string | null
            reservation_reference?: string | null
            event: {
              event_id: string
              event_name: string
              event_starting_date: string | null
              event_hours: string | null
              event_image: string | null
              club: { club_name: string | null; club_address: string | null } | null
            } | null
          }
          const event = one(row.event)
          const club = one(event?.club ?? null)

          setBooking({
            reservationId: row.reservation_id,
            reservationReference: row.reservation_reference || row.qr_code || row.reservation_id,
            eventId: event?.event_id ?? '',
            eventName: event?.event_name ?? 'Event',
            eventImage: event?.event_image ?? null,
            eventStartingDate: event?.event_starting_date ?? null,
            eventHours: event?.event_hours ?? row.expected_arrival_time ?? null,
            clubName: club?.club_name ?? null,
            clubAddress: club?.club_address ?? null,
            quantity: Math.max(1, Number(row.nr_of_people || 1)),
            bookingType: normalizeType(row.type),
            status: String(row.status ?? 'pending'),
            qrValue: row.qr_code || row.reservation_reference || row.reservation_id,
          })
          setLoading(false)
          return
        }

        // Newer schema shape fallback (with same missing-column protection)
        const firstModern = await supabase
          .from('reservations')
          .select(
            `id,number_of_people,time_slot,status,reservation_reference,
             event:events(id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
          )
          .eq('id', bookingId)
          .eq('user_id', user.id)
          .single()
        let modernData: unknown = firstModern.data
        let modernError: { message?: string } | null = firstModern.error as { message?: string } | null

        const modernMissingReference =
          modernError?.message?.toLowerCase().includes('reservation_reference') &&
          modernError?.message?.toLowerCase().includes('does not exist')
        if (modernMissingReference) {
          const retryModern = await supabase
            .from('reservations')
            .select(
              `id,number_of_people,time_slot,status,
               event:events(id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
            )
            .eq('id', bookingId)
            .eq('user_id', user.id)
            .single()
          modernData = retryModern.data
          modernError = retryModern.error
        }

        if (!active) return

        if (!modernError && modernData) {
          const row = modernData as unknown as {
            id: string
            number_of_people: number | null
            time_slot: string | null
            status: string | null
            reservation_reference?: string | null
            event: {
              id: string
              event_name: string
              event_starting_date: string | null
              event_hours: string | null
              event_image: string | null
              club: { club_name: string | null; club_address: string | null } | null
            } | null
          }
          const event = one(row.event)
          const club = one(event?.club ?? null)

          setBooking({
            reservationId: row.id,
            reservationReference: row.reservation_reference || row.id,
            eventId: event?.id ?? '',
            eventName: event?.event_name ?? 'Event',
            eventImage: event?.event_image ?? null,
            eventStartingDate: event?.event_starting_date ?? null,
            eventHours: event?.event_hours ?? row.time_slot ?? null,
            clubName: club?.club_name ?? null,
            clubAddress: club?.club_address ?? null,
            quantity: Math.max(1, Number(row.number_of_people || 1)),
            bookingType: 'reservation',
            status: String(row.status ?? 'pending'),
            qrValue: row.reservation_reference || row.id,
          })
          setLoading(false)
          return
        }

        // Tickets table fallback (for projects that separate tickets from reservations)
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(
            `id,quantity,status,
             event:events(id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
          )
          .eq('id', bookingId)
          .eq('user_id', user.id)
          .single()

        if (!active) return

        if (!ticketError && ticketData) {
          const row = ticketData as unknown as {
            id: string
            quantity: number | null
            status: string | null
            event: {
              id: string
              event_name: string
              event_starting_date: string | null
              event_hours: string | null
              event_image: string | null
              club: { club_name: string | null; club_address: string | null } | null
            } | null
          }
          const event = one(row.event)
          const club = one(event?.club ?? null)

          setBooking({
            reservationId: row.id,
            reservationReference: orderIdFrom(row.id),
            eventId: event?.id ?? '',
            eventName: event?.event_name ?? 'Event',
            eventImage: event?.event_image ?? null,
            eventStartingDate: event?.event_starting_date ?? null,
            eventHours: event?.event_hours ?? null,
            clubName: club?.club_name ?? null,
            clubAddress: club?.club_address ?? null,
            quantity: Math.max(1, Number(row.quantity || 1)),
            bookingType: 'ticket',
            status: String(row.status ?? 'confirmed'),
            qrValue: row.id,
          })
          setLoading(false)
          return
        }

        setError(
          detailError?.message ?? modernError?.message ?? ticketError?.message ?? 'Could not load booking details.',
        )
        setLoading(false)
        return
      }

      // Legacy fallback route from existing Stripe success_url: /purchased-ticket/:id/:quantity
      if (id && id !== 'undefined') {
        try {
          const res = await fetch(`http://localhost:3000/event/${id}`)
          const data = (await res.json()) as {
            event_id?: string
            event_name?: string
            event_image?: string
            event_starting_date?: string
            event_hours?: string
            club?: string
            club_address?: string
          }

          if (!active) return

          setBooking({
            reservationId: data.event_id || id,
            reservationReference: orderIdFrom(data.event_id || id),
            eventId: data.event_id || id,
            eventName: data.event_name || 'Event',
            eventImage: data.event_image || null,
            eventStartingDate: data.event_starting_date || null,
            eventHours: data.event_hours || null,
            clubName: data.club || null,
            clubAddress: data.club_address || null,
            quantity: Math.max(1, Number(quantity || 1)),
            bookingType: 'ticket',
            status: 'confirmed',
            qrValue: data.event_id || id,
          })

          // Persist paid ticket into reservations so it appears in "My Bookings".
          void persistTicketBookingIfNeeded({
            eventId: data.event_id || id,
            quantity: Math.max(1, Number(quantity || 1)),
            qrValueSeed: checkoutSessionId || 'legacy',
          })
        } catch {
          if (!active) return
          setError('Could not load booking details.')
        }
      } else if (active) {
        setError('Booking not found.')
      }

      if (active) setLoading(false)
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [bookingId, id, quantity, navigate, checkoutSessionId])

  const qrSrc = useMemo(() => {
    const raw = booking?.qrValue || booking?.reservationId || 'PartyOn'
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(
      raw,
    )}`
  }, [booking])

  const orderId = booking
    ? booking.bookingType === 'reservation'
      ? booking.reservationReference
      : orderIdFrom(booking.reservationId)
    : 'PO-UNKNOWN'
  const quantityLabel = booking
    ? `${booking.quantity} ${booking.bookingType}${booking.quantity > 1 ? 's' : ''}`
    : ''

  async function handleDownloadPdf() {
    if (!booking) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const qrDataUrl = await imageUrlToDataUrl(qrSrc).catch(() => null)

    doc.setFillColor(13, 13, 18)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.text('PartyOn Booking Confirmation', 14, 20)
    doc.setFontSize(12)
    doc.text(`Event: ${booking.eventName}`, 14, 32)
    doc.text(`When: ${formatEventDate(booking.eventStartingDate)}`, 14, 40)
    doc.text(`Venue: ${booking.clubName || 'Venue not set'}`, 14, 48)
    doc.text(`Quantity: ${quantityLabel}`, 14, 56)
    doc.text(
      `${booking.bookingType === 'reservation' ? 'Reservation Reference' : 'Order Number'}: #${orderId}`,
      14,
      64,
    )

    if (qrDataUrl) {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(14, 74, 58, 58, 4, 4, 'F')
      doc.addImage(qrDataUrl, 'PNG', 18, 78, 50, 50)
    } else {
      doc.setFontSize(10)
      doc.text('(QR code unavailable for PDF export)', 14, 82)
    }

    doc.setTextColor(180, 180, 186)
    doc.setFontSize(10)
    doc.text('Generated by PartyOn', 14, 286)
    doc.save(`${orderId}.pdf`)
  }

  function handleEmail() {
    if (!booking) return
    const subject = `PartyOn booking - ${booking.eventName}`
    const body = [
      `Booking confirmation details:`,
      ``,
      `Event: ${booking.eventName}`,
      `Date: ${formatEventDate(booking.eventStartingDate)}`,
      `Venue: ${booking.clubName || 'Venue not set'}`,
      `${booking.bookingType === 'reservation' ? 'Reservation Reference' : 'Order Number'}: #${orderId}`,
      `Quantity: ${quantityLabel}`,
      ``,
      `View booking: ${window.location.href}`,
    ].join('\n')
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  function handleAddToCalendar() {
    if (!booking) return
    const startIso = booking.eventStartingDate || new Date().toISOString()
    const ics = buildIcs({
      title: `${booking.eventName} - ${booking.bookingType === 'reservation' ? 'Reservation' : 'Ticket'}`,
      startIso,
      location: [booking.clubName, booking.clubAddress].filter(Boolean).join(', '),
      description: `${booking.bookingType === 'reservation' ? 'Reservation Reference' : 'Order Number'}: #${orderId}`,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${orderId}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

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
