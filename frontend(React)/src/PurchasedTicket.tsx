import './PurchasedTicket.css'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  QrCode,
  Share2,
  X,
} from 'lucide-react'

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
  ticketTypeName: string | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizeType(type: string | null | undefined): 'ticket' | 'reservation' {
  const t = String(type ?? '').toLowerCase()
  return t.includes('reservation') || t.includes('table') ? 'reservation' : 'ticket'
}

function orderIdFrom(reservationId: string): string {
  return `PO-${reservationId.slice(0, 8).toUpperCase()}`
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

function makeQrUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&bgcolor=ffffff&color=000000&data=${encodeURIComponent(data)}`
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
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

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
  const [qrIndex, setQrIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  // One QR per person for ticket bookings, single QR for table reservations
  const qrSrcs = useMemo(() => {
    if (!booking) return [makeQrUrl('PartyOn')]
    const base = booking.qrValue || booking.reservationId
    if (booking.bookingType === 'ticket' && booking.quantity > 1) {
      return Array.from({ length: booking.quantity }, (_, i) =>
        makeQrUrl(`${base}-T${i + 1}`)
      )
    }
    return [makeQrUrl(base)]
  }, [booking])

  // Reset QR index when booking changes
  useEffect(() => { setQrIndex(0) }, [booking])

  async function persistTicketBookingIfNeeded(payload: {
    eventId: string
    quantity: number
    qrValueSeed: string
  }) {
    if (!supabase || !isSupabaseConfigured) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return

    const key = `ticket-booking:${user.id}:${payload.eventId}:${payload.quantity}:${payload.qrValueSeed}`
    if (sessionStorage.getItem(key) === '1') return

    const nowIso = new Date().toISOString()
    const random = Math.floor(1000 + Math.random() * 9000)
    const qrUnique = `TKT-${payload.eventId}-${Date.now()}-${random}`

    const modernInsert = await supabase.from('reservations').insert({
      user_id: user.id,
      event_id: payload.eventId,
      number_of_people: payload.quantity,
      time_slot: null,
      special_requests: null,
      status: 'confirmed',
      created_at: nowIso,
      updated_at: nowIso,
    })

    if (modernInsert.error) {
      await supabase.from('reservations').insert({
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
          if (active) { setError('Supabase is not configured.'); setLoading(false) }
          return
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (!active) return
        if (userError || !user) { navigate('/login', { replace: true }); return }

        // Legacy schema
        const firstLegacy = await supabase
          .from('reservations')
          .select(
            `reservation_id,nr_of_people,type,status,qr_code,expected_arrival_time,reservation_reference,
             event:events(event_id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address)),
             ticket_type:ticket_types(name)`,
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
               event:events(event_id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address)),
               ticket_type:ticket_types(name)`,
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
            ticket_type: { name: string | null } | null
          }
          const event = one(row.event)
          const club = one(event?.club ?? null)
          const ticketType = one(row.ticket_type)

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
            ticketTypeName: ticketType?.name ?? null,
          })
          setLoading(false)
          return
        }

        // Modern schema fallback
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
            ticketTypeName: null,
          })
          setLoading(false)
          return
        }

        // Tickets table fallback
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(
            `id,quantity,status,
             event:events(id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address)),
             ticket_type:ticket_types(name)`,
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
            ticket_type: { name: string | null } | null
          }
          const event = one(row.event)
          const club = one(event?.club ?? null)
          const ticketType = one(row.ticket_type)

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
            ticketTypeName: ticketType?.name ?? null,
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

      // Legacy Stripe route: /purchased-ticket/:id/:quantity
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
            ticketTypeName: null,
          })

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
    return () => { active = false }
  }, [bookingId, id, quantity, navigate, checkoutSessionId])

  const orderId = booking
    ? booking.bookingType === 'reservation'
      ? booking.reservationReference
      : orderIdFrom(booking.reservationId)
    : 'PO-UNKNOWN'

  const quantityLabel = booking
    ? `${booking.quantity} ${booking.bookingType}${booking.quantity > 1 ? 's' : ''}`
    : ''

  async function buildPdfBlob(): Promise<{ blob: Blob; filename: string }> {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    for (let i = 0; i < qrSrcs.length; i++) {
      if (i > 0) doc.addPage()

      const qrDataUrl = await imageUrlToDataUrl(qrSrcs[i]).catch(() => null)

      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, 210, 297, 'F')

      doc.setTextColor(236, 72, 153)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('PartyOn', 14, 22)

      doc.setTextColor(20, 20, 20)
      doc.setFontSize(15)
      doc.text(booking!.eventName, 14, 34)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(90, 90, 90)
      doc.setFontSize(10)
      doc.text(`Date: ${formatEventDate(booking!.eventStartingDate)}`, 14, 44)
      doc.text(`Venue: ${booking!.clubName || 'Venue not set'}`, 14, 52)
      if (booking!.clubAddress) doc.text(booking!.clubAddress, 14, 59)
      doc.text(`Order: #${orderId}`, 14, 67)

      if (qrSrcs.length > 1) {
        doc.setTextColor(147, 51, 234)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(`Ticket ${i + 1} of ${qrSrcs.length}`, 14, 76)
      }

      if (qrDataUrl) {
        doc.setFillColor(245, 245, 245)
        doc.roundedRect(55, 84, 100, 100, 6, 6, 'F')
        doc.addImage(qrDataUrl, 'PNG', 60, 89, 90, 90)
      }

      doc.setTextColor(160, 160, 160)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Generated by PartyOn', 14, 288)
    }

    const blob = doc.output('blob')
    return { blob, filename: `${orderId}.pdf` }
  }

  async function handleDownloadPdf() {
    if (!booking) return
    const { blob, filename } = await buildPdfBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleShare() {
    if (!booking) return
    try {
      const { blob, filename } = await buildPdfBlob()
      const file = new File([blob], filename, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Share the PDF file directly (works on mobile)
        await navigator.share({
          title: booking.eventName,
          text: `Booking confirmation · #${orderId}`,
          files: [file],
        })
      } else if (navigator.share) {
        // File sharing not supported — share a text summary instead
        await navigator.share({
          title: booking.eventName,
          text: `Booking for ${booking.eventName}\nOrder: #${orderId}\nVenue: ${booking.clubName || 'TBA'}`,
        })
      } else {
        // Desktop fallback: download the PDF
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // dismissed or unavailable
    }
  }

  function handleAddToCalendar() {
    if (!booking) return
    const startIso = booking.eventStartingDate || new Date().toISOString()
    const ics = buildIcs({
      title: `${booking.eventName} – ${booking.bookingType === 'reservation' ? 'Reservation' : 'Ticket'}`,
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
          <ChevronLeft size={14} />
          Back to My Bookings
        </Link>

        {loading ? (
          <div style={{ paddingTop: 32 }}>
            {[80, 260, 100].map((h, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{ height: h, marginBottom: 14, borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}
              />
            ))}
          </div>
        ) : error || !booking ? (
          <div className="purchased-ticket__card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#a3a3a3', marginBottom: 24 }}>{error || 'Could not load booking details.'}</p>
            <Link to="/my-bookings" className="purchased-ticket__back-link">
              <ChevronLeft size={14} /> Back to My Bookings
            </Link>
          </div>
        ) : (
          <>
            {/* Success header */}
            <header className="purchased-ticket__success">
              <div className="purchased-ticket__check">
                <Check strokeWidth={2.5} />
              </div>
              <h1 className="purchased-ticket__headline">You&apos;re in</h1>
              <p className="purchased-ticket__sub">Your booking is confirmed</p>
            </header>

            {/* Event summary strip */}
            <div className="purchased-ticket__summary">
              <div
                className="payment-page__event-thumb"
                style={{
                  backgroundImage: booking.eventImage ? `url(${booking.eventImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p className="purchased-ticket__summary-title">{booking.eventName}</p>
                <p className="purchased-ticket__summary-meta">
                  <Calendar size={13} />
                  <span>{formatEventDate(booking.eventStartingDate)}</span>
                </p>
              </div>
            </div>

            {/* Main card */}
            <div className="purchased-ticket__card">
              <div className="purchased-ticket__card-grid">
                {/* QR panel — one QR per person, with navigation */}
                <div className="purchased-ticket__qr-panel">
                  <div className="purchased-ticket__qr">
                    <img
                      src={qrSrcs[qrIndex]}
                      alt={`Booking QR code ${qrSrcs.length > 1 ? `${qrIndex + 1} of ${qrSrcs.length}` : ''}`}
                      width={200}
                      height={200}
                      loading="lazy"
                    />
                  </div>

                  {qrSrcs.length > 1 && (
                    <div className="purchased-ticket__qr-controls">
                      <div className="purchased-ticket__qr-nav-row">
                        <button
                          type="button"
                          className="purchased-ticket__qr-arrow"
                          onClick={() => setQrIndex((p) => Math.max(0, p - 1))}
                          disabled={qrIndex === 0}
                          aria-label="Previous QR"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <span className="purchased-ticket__qr-counter">
                          {qrIndex + 1}&thinsp;/&thinsp;{qrSrcs.length}
                        </span>
                        <button
                          type="button"
                          className="purchased-ticket__qr-arrow"
                          onClick={() => setQrIndex((p) => Math.min(qrSrcs.length - 1, p + 1))}
                          disabled={qrIndex === qrSrcs.length - 1}
                          aria-label="Next QR"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                      <div className="purchased-ticket__qr-dots">
                        {qrSrcs.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`purchased-ticket__qr-dot${i === qrIndex ? ' purchased-ticket__qr-dot--active' : ''}`}
                            onClick={() => setQrIndex(i)}
                            aria-label={`QR ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="purchased-ticket__details">
                  <h2 className="purchased-ticket__event-title">{booking.eventName}</h2>
                  <p className="purchased-ticket__tier">
                    {booking.ticketTypeName ||
                      (booking.bookingType === 'reservation' ? 'Table Reservation' : 'General Admission')}
                  </p>
                  <div className="purchased-ticket__detail-line">
                    <Calendar size={15} />
                    <div>
                      <div>{formatEventDate(booking.eventStartingDate)}</div>
                      {booking.eventHours && <div>Doors open at {booking.eventHours}</div>}
                    </div>
                  </div>
                  {(booking.clubName || booking.clubAddress) && (
                    <div className="purchased-ticket__detail-line">
                      <MapPin size={15} />
                      <div>
                        {booking.clubName && <div>{booking.clubName}</div>}
                        {booking.clubAddress && <div>{booking.clubAddress}</div>}
                      </div>
                    </div>
                  )}
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

              {/* Action buttons */}
              <div className="purchased-ticket__util-row">
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => setPreviewOpen(true)}
                >
                  <QrCode size={20} />
                  Full QR
                </button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => void handleShare()}
                >
                  <Share2 size={20} />
                  Share
                </button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => void handleDownloadPdf()}
                >
                  <Download size={20} />
                  Download
                </button>
              </div>

              <button
                type="button"
                className="purchased-ticket__calendar-btn"
                onClick={handleAddToCalendar}
              >
                + Add to Calendar
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
              </button>
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary"
                onClick={() => navigate('/my-bookings')}
              >
                Go to My Bookings
              </button>
            </nav>
          </>
        )}
      </div>

      {/* Full QR modal — shows all QR codes at once */}
      {previewOpen && booking ? (
        <div
          className="purchased-ticket__preview-overlay"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="purchased-ticket__preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="purchased-ticket__preview-title">{booking.eventName}</h3>
            <p className="purchased-ticket__preview-sub">
              {quantityLabel}&nbsp;·&nbsp;#{orderId}
            </p>

            <div className="purchased-ticket__preview-qrs">
              {qrSrcs.map((src, i) => (
                <div key={i} className="purchased-ticket__preview-qr-item">
                  {qrSrcs.length > 1 && (
                    <p className="purchased-ticket__preview-qr-label">Ticket #{i + 1}</p>
                  )}
                  <div className="purchased-ticket__preview-qr-wrap">
                    <img
                      src={src}
                      alt={`QR code ${i + 1}`}
                      className="purchased-ticket__preview-qr"
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="purchased-ticket__preview-ref">Present at the door</p>

            <div className="purchased-ticket__preview-actions">
              <button
                type="button"
                className="purchased-ticket__util-btn"
                style={{ flexDirection: 'row', gap: 8, padding: '10px 16px' }}
                onClick={() => setPreviewOpen(false)}
              >
                <X size={16} />
                Close
              </button>
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary"
                style={{ fontSize: '0.875rem', padding: '10px 20px' }}
                onClick={() => void handleDownloadPdf()}
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LovableFooter />
    </div>
  )
}
