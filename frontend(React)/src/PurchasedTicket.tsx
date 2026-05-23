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

/*type PaymentItem = {
  payment_id: string | null
  reservation_id: string | null
  user_id: string | null
  amount: number | null
  payment_date: string | null
  status: string | null
}*/

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

export default function PurchasedTicket() {
  const navigate = useNavigate()
  const { bookingId, id, quantity, payment_id } = useParams<{
    bookingId: string;
    id: string;
    quantity: string;
    payment_id: string;
  }>();
  const [paymentIds, setPaymentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [event, setEvent] = useState<any>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [qrIndexMain, setQrIndexMain] = useState(0)
  const [qrIndexModal, setQrIndexModal] = useState(0)
  const modalViewportRef = useRef<HTMLDivElement>(null)
  const [modalSlideWidth, setModalSlideWidth] = useState(178)

  useEffect(() => {
    const fetchPaymentIds = async () => {
      const { data, error } = await getJson<string[]>(
        `/payment/ids?batch_id=${encodeURIComponent(payment_id ?? '')}`
      )

      if (error || !data) {
        console.error(error ?? 'Failed to fetch payment ids')
        setPaymentIds([])
        setError('Failed to load payment IDs')
        return
      }

      setPaymentIds(data);
    };
  
    if (payment_id) {
      fetchPaymentIds();
    }
  }, [payment_id]);


  const qrSrcs = useMemo(() => {
    if (Array.isArray(paymentIds) && paymentIds.length > 0) {
      return paymentIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map(
          (id) =>
            `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(id)}`
        )
    }
  
    if (booking) {
      const raw = booking.qrValue || booking.reservationId
      return [
        `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(raw)}`,
      ]
    }
  
    return [
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=PartyOn`,
    ]
  }, [paymentIds, booking])

  const orderId = booking
    ? booking.bookingType === 'reservation'
      ? booking.reservationReference
      : orderIdFrom(booking.reservationId)
    : 'PO-UNKNOWN'

  const quantityLabel = booking
    ? `${booking.quantity} ${booking.bookingType}${booking.quantity > 1 ? 's' : ''}`
    : ''

  /* ── EVENT FETCH (simple mode) ── */
  useEffect(() => {
    if (!id || id === 'undefined') return

    let active = true

    async function loadEvent() {
      const { data, error } = await getJson<any>(`/event/${id}`)
      if (!active) return

      if (error || !data) {
        console.error(error ?? 'Failed to fetch event')
        setEvent(null)
        // In simple mode (no bookingId) the event IS the only data source
        if (!bookingId) {
          setLoading(false)
          setError('Could not load event details')
        }
        return
      }

      setEvent(data)
    }

    loadEvent()

    return () => {
      active = false
    }
  }, [id, bookingId])

  /* ── PAYMENT FETCH (GET /payment/:id) — runs in parallel with event fetch ── */

  /* ── BOOKING FETCH (Supabase logic) ── */
  useEffect(() => {
    if (!bookingId) {
      if (!id || id === 'undefined') {
        setLoading(false)
        setError('Missing booking ID')
      }
      // else: id present — synthetic booking built once event loads below
      return
    }

    let active = true

    async function loadDetail() {
      setLoading(true)
      setError(null)

      if (!supabase || !isSupabaseConfigured) {
        setError('Supabase not configured')
        setLoading(false)
        return
      }

      const {
        data: { user },
      } = await getAuthUser('user')

      if (!active) return

      if (!user) {
        navigate('/login', { replace: true })
        return
      }

      // ---------------- LEGACY ----------------
      const firstLegacy = await supabase
        .from('reservations')
        .select(
          `reservation_id,nr_of_people,type,status,qr_code,expected_arrival_time,reservation_reference,
           event:events(event_id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
        )
        .eq('reservation_id', bookingId)
        .eq('user_id', user.id)
        .single()

      let data: any = firstLegacy.data
      let err = firstLegacy.error

      if (!active) return

      if (!err && data) {
        const row = data
        const event = one(row.event)
        const club = one(event?.club)

        setBooking({
          reservationId: row.reservation_id,
          reservationReference:
            row.reservation_reference || row.qr_code || row.reservation_id,
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

      // ---------------- MODERN ----------------
      const modern = await supabase
        .from('reservations')
        .select(
          `id,number_of_people,time_slot,status,reservation_reference,
           event:events(id,event_name,event_starting_date,event_hours,event_image,club:clubs(club_name,club_address))`,
        )
        .eq('id', bookingId)
        .eq('user_id', user.id)
        .single()

      if (!active) return

      if (modern.data) {
        const row = modern.data
        const event = one(row.event)
        const club = one(event?.club)

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

      setError(err?.message ?? 'Could not load booking')
      setLoading(false)
    }

    loadDetail()

    return () => {
      active = false
    }
  }, [bookingId, id, navigate])

  /* ── SYNTHETIC BOOKING (no bookingId → build from id + quantity + event data) ── */
  useEffect(() => {
    if (bookingId || !id || id === 'undefined' || !event) return

    const qty = Math.max(1, Number(quantity ?? 1))
    const syntheticRef = `PO-${id.slice(0, 8).toUpperCase()}`

    setBooking({
      reservationId: id,
      reservationReference: syntheticRef,
      eventId: String(event.id ?? event.event_id ?? id),
      eventName: event.event_name ?? event.title ?? 'Event',
      eventImage: event.event_image ?? event.imageUrl ?? null,
      eventStartingDate: event.event_starting_date ?? event.date ?? null,
      eventHours: event.event_hours ?? null,
      clubName: event.club && event.club !== '—' ? event.club : null,
      clubAddress: event.address ?? null,
      quantity: qty,
      bookingType: 'ticket',
      status: 'confirmed',
      qrValue: `${id}-${qty}`,
    })
    setLoading(false)
    setError(null)
  }, [bookingId, id, quantity, event])

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

  /* ── RENDER ── */
  return (
    <div className="purchased-ticket">
      <div className="purchased-ticket__glow" aria-hidden />
      <Navbar />

      <div className="purchased-ticket__inner" style={{ paddingTop: 88 }}>
        <Link to="/my-bookings" className="purchased-ticket__back-link">
          <ChevronLeft size={14} />
          Back to bookings
        </Link>

        {/* ── Loading skeleton ── */}
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
          /* ── Error / not found ── */
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
            {/* ── Success header ── */}
            <div className="purchased-ticket__success">
              <div className="purchased-ticket__check">
                <Check strokeWidth={2.5} />
              </div>
              <h1 className="purchased-ticket__headline">You&apos;re going!</h1>
              <p className="purchased-ticket__sub">
                Your {booking.bookingType} is confirmed
              </p>
            </div>

            {/* ── Event summary strip ── */}
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

            {/* ── Main ticket card ── */}
            <div className="purchased-ticket__card">
              <div className="purchased-ticket__card-grid">
                {/* QR code slider */}
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
                          onClick={() => setQrIndexMain(p => Math.max(0, p - 1))}
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
                          onClick={() => setQrIndexMain(p => Math.min(qrSrcs.length - 1, p + 1))}
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

                {/* Detail panel */}
                <div className="purchased-ticket__details">
                  <p className="purchased-ticket__event-title">{booking.eventName}</p>
                  <p className="purchased-ticket__tier">{quantityLabel}</p>

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

              {/* Utility row */}
              <div className="purchased-ticket__util-row">
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={() => setPreviewOpen(true)}
                >
                  <QrCode />
                  Full QR
                </button>
                <button
  type="button"
  className="purchased-ticket__util-btn"
  onClick={() => {
    qrSrcs.forEach((src, index) => {
      const a = document.createElement('a');
      a.href = src;
      a.download = `ticket-${orderId}-${index + 1}.png`;
      a.click();
    });
  }}
>
  <Download />
  Save all
</button>
                <button
                  type="button"
                  className="purchased-ticket__util-btn"
                  onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({
                          title: booking.eventName,
                          url: window.location.href,
                        })
                      } else {
                        await navigator.clipboard.writeText(window.location.href)
                      }
                    } catch {
                      // dismissed or unavailable
                    }
                  }}
                >
                  <Share2 />
                  Share
                </button>
              </div>

              {/* Add to calendar */}
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

      {/* ── QR full-screen preview modal ── */}
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

            {/* Modal QR slider — 2 visible at a time */}
            <div className="purchased-ticket__modal-qr-container">
              {showModalNav && (
                <button
                  type="button"
                  className="purchased-ticket__modal-qr-arrow purchased-ticket__modal-qr-arrow--prev"
                  onClick={() => setQrIndexModal(p => Math.max(0, p - 1))}
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
                  onClick={() => setQrIndexModal(p => Math.min(maxModalIndex, p + 1))}
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

            <p className="purchased-ticket__preview-ref">
              Present this code at the door
            </p>
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
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        title: booking.eventName,
                        url: window.location.href,
                      })
                    } else {
                      await navigator.clipboard.writeText(window.location.href)
                    }
                  } catch {
                    // dismissed or unavailable
                  }
                }}
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      <LovableFooter />
    </div>
  )
}
