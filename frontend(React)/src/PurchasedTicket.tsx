import './PurchasedTicket.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJson } from '@/api'
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  QrCode,
  Share2,
  Ticket,
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
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}`
}

function buildCalendarUrl(booking: BookingDetail): string {
  const title = encodeURIComponent(booking.eventName)
  const location = encodeURIComponent(
    [booking.clubName, booking.clubAddress].filter(Boolean).join(', '),
  )
  const start = booking.eventStartingDate
    ? new Date(booking.eventStartingDate)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('.000', '')
    : ''
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${start}&location=${location}`
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
  const { bookingId, id, quantity, payment_id } = useParams<{
    bookingId?: string
    id?: string
    quantity?: string
    payment_id?: string
  }>()

  const checkoutSessionId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('checkout_session_id')
      : null

  const [paymentIds, setPaymentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [event, setEvent] = useState<Record<string, unknown> | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [qrIndexMain, setQrIndexMain] = useState(0)
  const [qrIndexModal, setQrIndexModal] = useState(0)
  const modalViewportRef = useRef<HTMLDivElement>(null)
  const [modalSlideWidth, setModalSlideWidth] = useState(178)

  useEffect(() => {
    if (!payment_id) return

    getJson<string[]>(`/payment/ids?batch_id=${encodeURIComponent(payment_id)}`).then(
      ({ data, error: fetchError }) => {
        if (fetchError || !data) {
          console.error(fetchError ?? 'Failed to fetch payment ids')
          setPaymentIds([])
          return
        }
        setPaymentIds(data)
      },
    )
  }, [payment_id])

  const qrSrcs = useMemo(() => {
    if (paymentIds.length > 0) {
      return paymentIds
        .filter((pid): pid is string => typeof pid === 'string' && pid.trim().length > 0)
        .map((pid) => makeQrUrl(`tickets:${pid}`))
    }

    if (booking) {
      if (booking.bookingType === 'ticket' && !booking.qrValue?.startsWith('tickets:')) {
        if (booking.quantity > 1) {
          const base = booking.qrValue || booking.reservationId
          return Array.from({ length: booking.quantity }, (_, i) => makeQrUrl(`${base}-T${i + 1}`))
        }
        return [makeQrUrl('PartyOn')]
      }

      const raw =
        booking.bookingType === 'reservation'
          ? `reservation:${booking.reservationId}`
          : booking.qrValue?.startsWith('tickets:') || booking.qrValue?.startsWith('reservation:')
            ? booking.qrValue
            : `tickets:${booking.qrValue || booking.reservationId}`

      return [makeQrUrl(raw)]
    }

    return [makeQrUrl('PartyOn')]
  }, [paymentIds, booking])

  const orderId = booking
    ? booking.bookingType === 'reservation'
      ? booking.reservationReference
      : orderIdFrom(booking.reservationId)
    : 'PO-UNKNOWN'

  const quantityLabel = booking
    ? `${booking.quantity} ${booking.bookingType}${booking.quantity > 1 ? 's' : ''}`
    : ''

  const isSharedReservation = booking?.bookingType === 'reservation' && booking.quantity > 1

  const tierLabel =
    booking?.ticketTypeName ||
    (booking?.bookingType === 'reservation' ? 'Table Reservation' : quantityLabel)

  async function persistTicketBookingIfNeeded(payload: {
    eventId: string
    quantity: number
    qrValueSeed: string
  }) {
    if (!supabase || !isSupabaseConfigured) return
    const {
      data: { user },
    } = await getAuthUser('user')
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

      if (booking!.bookingType === 'reservation' && booking!.quantity > 1) {
        doc.setTextColor(147, 51, 234)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text(`Shared reservation QR for ${booking!.quantity} guests`, 14, 76)
      } else if (qrSrcs.length > 1) {
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
      if (navigator.share) {
        await navigator.share({
          title: booking.eventName,
          url: window.location.href,
        })
        return
      }
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      try {
        const { blob, filename } = await buildPdfBlob()
        const file = new File([blob], filename, { type: 'application/pdf' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: booking.eventName,
            text: `Booking confirmation · #${orderId}`,
            files: [file],
          })
        }
      } catch {
        // dismissed or unavailable
      }
    }
  }

  useEffect(() => {
    if (!id || id === 'undefined' || bookingId) return

    let active = true

    async function loadEvent() {
      const { data, error: fetchError } = await getJson<Record<string, unknown>>(`/event/${id}`)
      if (!active) return

      if (fetchError || !data) {
        console.error(fetchError ?? 'Failed to fetch event')
        setEvent(null)
        setLoading(false)
        setError('Could not load event details')
        return
      }

      setEvent(data)
    }

    void loadEvent()
    return () => {
      active = false
    }
  }, [id, bookingId])

  useEffect(() => {
    if (!bookingId) {
      if (!id || id === 'undefined') {
        setLoading(false)
        setError('Missing booking ID')
      }
      return
    }

    let active = true

    async function loadDetail() {
      setLoading(true)
      setError(null)

      if (!supabase || !isSupabaseConfigured) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }

      const {
        data: { user },
        error: userError,
      } = await getAuthUser('user')

      if (!active) return

      if (userError || !user) {
        navigate('/login', { replace: true })
        return
      }

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
        detailError = retry.error as { message?: string } | null
      }

      if (!active) return

      if (!detailError && data) {
        const row = data as {
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
        const ev = one(row.event)
        const club = one(ev?.club ?? null)
        const ticketType = one(row.ticket_type)

        setBooking({
          reservationId: row.reservation_id,
          reservationReference: row.reservation_reference || row.qr_code || row.reservation_id,
          eventId: ev?.event_id ?? '',
          eventName: ev?.event_name ?? 'Event',
          eventImage: ev?.event_image ?? null,
          eventStartingDate: ev?.event_starting_date ?? null,
          eventHours: ev?.event_hours ?? row.expected_arrival_time ?? null,
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
        modernError = retryModern.error as { message?: string } | null
      }

      if (!active) return

      if (!modernError && modernData) {
        const row = modernData as {
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
        const ev = one(row.event)
        const club = one(ev?.club ?? null)

        setBooking({
          reservationId: row.id,
          reservationReference: row.reservation_reference || row.id,
          eventId: ev?.id ?? '',
          eventName: ev?.event_name ?? 'Event',
          eventImage: ev?.event_image ?? null,
          eventStartingDate: ev?.event_starting_date ?? null,
          eventHours: ev?.event_hours ?? row.time_slot ?? null,
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
        const ev = one(row.event)
        const club = one(ev?.club ?? null)
        const ticketType = one(row.ticket_type)

        setBooking({
          reservationId: row.id,
          reservationReference: orderIdFrom(row.id),
          eventId: ev?.id ?? '',
          eventName: ev?.event_name ?? 'Event',
          eventImage: ev?.event_image ?? null,
          eventStartingDate: ev?.event_starting_date ?? null,
          eventHours: ev?.event_hours ?? null,
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
        detailError?.message ??
          modernError?.message ??
          ticketError?.message ??
          'Could not load booking details.',
      )
      setLoading(false)
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [bookingId, id, navigate])

  useEffect(() => {
    if (bookingId || !id || id === 'undefined' || !event) return

    const qty = Math.max(1, Number(quantity ?? 1))
    const syntheticRef = `PO-${id.slice(0, 8).toUpperCase()}`
    const eventId = String(event.event_id ?? event.id ?? id)

    setBooking({
      reservationId: id,
      reservationReference: syntheticRef,
      eventId,
      eventName: String(event.event_name ?? event.title ?? 'Event'),
      eventImage: (event.event_image ?? event.imageUrl ?? null) as string | null,
      eventStartingDate: (event.event_starting_date ?? event.date ?? null) as string | null,
      eventHours: (event.event_hours ?? null) as string | null,
      clubName:
        event.club && event.club !== '—' ? String(event.club) : null,
      clubAddress: (event.address ?? event.club_address ?? null) as string | null,
      quantity: qty,
      bookingType: 'ticket',
      status: 'confirmed',
      qrValue: '',
      ticketTypeName: null,
    })
    setLoading(false)
    setError(null)

    void persistTicketBookingIfNeeded({
      eventId,
      quantity: qty,
      qrValueSeed: checkoutSessionId || payment_id || 'legacy',
    })
  }, [bookingId, id, quantity, event, checkoutSessionId, payment_id])

  useEffect(() => {
    setQrIndexMain(0)
    setQrIndexModal(0)
  }, [qrSrcs])

  useEffect(() => {
    if (!previewOpen || !modalViewportRef.current) return
    const measure = () => {
      if (modalViewportRef.current) {
        const w = modalViewportRef.current.offsetWidth
        setModalSlideWidth(Math.floor((w - 12) / 2))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(modalViewportRef.current)
    return () => ro.disconnect()
  }, [previewOpen])

  const MODAL_VISIBLE = 2
  const maxModalIndex = Math.max(0, qrSrcs.length - MODAL_VISIBLE)
  const showModalNav = qrSrcs.length > MODAL_VISIBLE

  return (
    <div className="purchased-ticket">
      <div className="purchased-ticket__glow" aria-hidden />
      <Navbar />

      <div className="purchased-ticket__inner" style={{ paddingTop: 88 }}>
        <Link to="/my-bookings" className="purchased-ticket__back-link">
          <ChevronLeft size={14} />
          Back to bookings
        </Link>

        {loading ? (
          <div className="animate-pulse" style={{ paddingTop: 32 }}>
            {[80, 260, 100].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  marginBottom: 14,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                }}
              />
            ))}
          </div>
        ) : error || !booking ? (
          <div style={{ textAlign: 'center', paddingTop: 56 }}>
            <p style={{ color: '#a3a3a3', marginBottom: 24, fontSize: '0.9375rem' }}>
              {error ?? 'Booking not found'}
            </p>
            <Link to="/my-bookings" className="purchased-ticket__back-link">
              <ChevronLeft size={14} /> Back to bookings
            </Link>
          </div>
        ) : (
          <>
            <div className="purchased-ticket__success">
              <div className="purchased-ticket__check">
                <Check strokeWidth={2.5} />
              </div>
              <h1 className="purchased-ticket__headline">You&apos;re going!</h1>
              <p className="purchased-ticket__sub">
                Your {booking.bookingType} is confirmed
              </p>
              {isSharedReservation ? (
                <p className="purchased-ticket__share-hint">
                  Share the group QR with your friends so everyone has the reservation code.
                </p>
              ) : null}
            </div>

            <div className="purchased-ticket__summary">
              <div
                className="purchased-ticket__summary-thumb"
                style={
                  booking.eventImage
                    ? {
                        backgroundImage: `url(${booking.eventImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              />
              <div style={{ minWidth: 0 }}>
                <p className="purchased-ticket__summary-title">{booking.eventName}</p>
                {booking.eventStartingDate && (
                  <p className="purchased-ticket__summary-meta">
                    <Clock />
                    {formatEventDate(booking.eventStartingDate)}
                  </p>
                )}
              </div>
            </div>

            <div className="purchased-ticket__card">
              <div className="purchased-ticket__card-grid">
                <div className="purchased-ticket__qr-slider">
                  <div className="purchased-ticket__qr-viewport">
                    <div
                      className="purchased-ticket__qr-track"
                      style={{ transform: `translateX(-${qrIndexMain * 100}%)` }}
                    >
                      {qrSrcs.map((src, i) => (
                        <div key={i} className="purchased-ticket__qr-item">
                          {qrSrcs.length > 1 && (
                            <span className="purchased-ticket__qr-badge">{i + 1}</span>
                          )}
                          <img src={src} alt={`Ticket QR code ${i + 1}`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {qrSrcs.length > 1 && (
                    <div className="purchased-ticket__qr-controls">
                      <div className="purchased-ticket__qr-nav-row">
                        <button
                          type="button"
                          className="purchased-ticket__qr-arrow"
                          onClick={() => setQrIndexMain((p) => Math.max(0, p - 1))}
                          disabled={qrIndexMain === 0}
                          aria-label="Previous QR"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <span className="purchased-ticket__qr-counter">
                          {qrIndexMain + 1}&thinsp;/&thinsp;{qrSrcs.length}
                        </span>
                        <button
                          type="button"
                          className="purchased-ticket__qr-arrow"
                          onClick={() =>
                            setQrIndexMain((p) => Math.min(qrSrcs.length - 1, p + 1))
                          }
                          disabled={qrIndexMain === qrSrcs.length - 1}
                          aria-label="Next QR"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                      <div className="purchased-ticket__qr-dots">
                        {qrSrcs.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`purchased-ticket__qr-dot${i === qrIndexMain ? ' purchased-ticket__qr-dot--active' : ''}`}
                            onClick={() => setQrIndexMain(i)}
                            aria-label={`QR ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="purchased-ticket__details">
                  <p className="purchased-ticket__event-title">{booking.eventName}</p>
                  <p className="purchased-ticket__tier">{tierLabel}</p>

                  {booking.eventStartingDate && (
                    <div className="purchased-ticket__detail-line">
                      <Calendar />
                      <span>{formatEventDate(booking.eventStartingDate)}</span>
                    </div>
                  )}

                  {booking.clubName && (
                    <div className="purchased-ticket__detail-line">
                      <MapPin />
                      <span>{booking.clubName}</span>
                    </div>
                  )}

                  {booking.clubAddress && (
                    <div className="purchased-ticket__detail-line">
                      <MapPin />
                      <span>{booking.clubAddress}</span>
                    </div>
                  )}

                  <div className="purchased-ticket__label-row">
                    <span className="purchased-ticket__meta-label">Order</span>
                    <p className="purchased-ticket__meta-value">#{orderId}</p>
                  </div>

                  <div className="purchased-ticket__label-row">
                    <span className="purchased-ticket__meta-label">Status</span>
                    <p
                      className="purchased-ticket__meta-value"
                      style={{ textTransform: 'capitalize' }}
                    >
                      {booking.status}
                    </p>
                  </div>
                </div>
              </div>

              <div className="purchased-ticket__util-row">
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => setPreviewOpen(true)}
                >
                  <QrCode />
                  {isSharedReservation ? 'Group QR' : 'Full QR'}
                </button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => void handleDownloadPdf()}
                >
                  <Download />
                  Download
                </button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => {
                    qrSrcs.forEach((src, index) => {
                      const a = document.createElement('a')
                      a.href = src
                      a.download = `ticket-${orderId}-${index + 1}.png`
                      a.click()
                    })
                  }}
                >
                  <Download />
                  Save all
                </button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => void handleShare()}
                >
                  <Share2 />
                  Share
                </button>
              </div>

              <a
                href={buildCalendarUrl(booking)}
                target="_blank"
                rel="noopener noreferrer"
                className="purchased-ticket__calendar-btn"
                style={{ textDecoration: 'none' }}
              >
                <Calendar size={14} />
                Add to calendar
              </a>
            </div>

            <p className="purchased-ticket__secure">
              🔒 Secured by PartyOn · Verified booking
            </p>

            <nav className="purchased-ticket__nav">
              <Link
                to="/my-bookings"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--ghost"
                style={{ textDecoration: 'none' }}
              >
                <Ticket />
                My bookings
              </Link>
              <Link
                to="/"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary"
                style={{ textDecoration: 'none' }}
              >
                Explore events
              </Link>
            </nav>
          </>
        )}
      </div>

      {previewOpen && booking && (
        <div
          className="purchased-ticket__preview-overlay"
          role="dialog"
          aria-modal
          aria-label="QR code preview"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="purchased-ticket__preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="purchased-ticket__preview-title">{booking.eventName}</p>
            <p className="purchased-ticket__preview-sub">
              {quantityLabel} · #{orderId}
            </p>

            <div className="purchased-ticket__modal-qr-container">
              {showModalNav && (
                <button
                  type="button"
                  className="purchased-ticket__modal-qr-arrow purchased-ticket__modal-qr-arrow--prev"
                  onClick={() => setQrIndexModal((p) => Math.max(0, p - 1))}
                  disabled={qrIndexModal === 0}
                  aria-label="Previous"
                >
                  <ChevronLeft size={16} />
                </button>
              )}

              <div className="purchased-ticket__modal-qr-viewport" ref={modalViewportRef}>
                <div
                  className="purchased-ticket__modal-qr-track"
                  style={{
                    transform: `translateX(-${qrIndexModal * (modalSlideWidth + 12)}px)`,
                  }}
                >
                  {qrSrcs.map((src, i) => (
                    <div
                      key={i}
                      className="purchased-ticket__modal-qr-item"
                      style={{ width: modalSlideWidth, minWidth: modalSlideWidth }}
                    >
                      {qrSrcs.length > 1 && (
                        <span className="purchased-ticket__modal-qr-badge">#{i + 1}</span>
                      )}
                      <img src={src} alt={`QR code ${i + 1}`} />
                    </div>
                  ))}
                </div>
              </div>

              {showModalNav && (
                <button
                  type="button"
                  className="purchased-ticket__modal-qr-arrow purchased-ticket__modal-qr-arrow--next"
                  onClick={() => setQrIndexModal((p) => Math.min(maxModalIndex, p + 1))}
                  disabled={qrIndexModal === maxModalIndex}
                  aria-label="Next"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>

            {showModalNav && (
              <div className="purchased-ticket__modal-qr-dots">
                {Array.from({ length: maxModalIndex + 1 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`purchased-ticket__modal-qr-dot${i === qrIndexModal ? ' purchased-ticket__modal-qr-dot--active' : ''}`}
                    onClick={() => setQrIndexModal(i)}
                    aria-label={`View QR ${i + 1}–${Math.min(i + MODAL_VISIBLE, qrSrcs.length)}`}
                  />
                ))}
              </div>
            )}

            <p className="purchased-ticket__preview-ref">Present this code at the door</p>
            <div className="purchased-ticket__preview-actions">
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--ghost"
                style={{ fontSize: '0.875rem', padding: '10px 16px' }}
                onClick={() => setPreviewOpen(false)}
              >
                <X size={16} />
                Close
              </button>
              <button
                type="button"
                className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary"
                style={{ fontSize: '0.875rem', padding: '10px 16px' }}
                onClick={() => void handleDownloadPdf()}
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <LovableFooter />
    </div>
  )
}
