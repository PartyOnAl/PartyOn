import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QRCode } from 'react-qr-code'
import { AlertTriangle, CalendarDays, ChevronRight, Copy, Gift, MapPin, ReceiptText, ScanLine, Share2, Star, Ticket, Trash2, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase'

type ClaimedOffer = {
  id: string
  redemption_code: string | null
  status: string
  claimed_at: string
  rating: number | null
  review_comment: string | null
  promotion: {
    promotion_id: string
    title: string
    image_url: string | null
    description: string | null
    valid_until: string | null
    original_price: number | null
    discount_value: number | null
    club_id: string | null
    clubs: { club_name: string | null; club_address: string | null } | null
  } | null
}

type BookingItem = {
  bookingId: string
  eventId: string
  eventName: string
  eventDate: string | null
  eventImage: string | null
  venue: string | null
  ticketTypeName: string | null
  quantity: number
  status: string | null
  kind: 'ticket' | 'reservation'
  createdAt: string | null
  reservationKey: string | null
  clubId: string | null
}

type FilterKind = 'upcoming' | 'past'
type OfferFilter = 'active' | 'used'

type ReservationRowLegacy = {
  reservation_id: string
  reservation_date: string | null
  nr_of_people: number | null
  type: string | null
  status: string | null
  created_at: string | null
  event: {
    event_id: string
    event_name: string
    event_starting_date: string | null
    event_image: string | null
    club_id?: string | null
    club: {
      club_name: string | null
    } | null
  } | null
  ticket_type: { name: string | null } | null
  payments: { status: string | null }[] | null
}

type ReservationRowModern = {
  id: string
  number_of_people: number | null
  time_slot: string | null
  status: string | null
  created_at: string | null
  event: {
    id: string
    event_name: string
    event_starting_date: string | null
    event_image: string | null
    club_id?: string | null
    club: { club_name: string | null } | null
  } | null
}

type TicketRow = {
  id: string
  quantity: number | null
  status: string | null
  created_at: string | null
  event: {
    id: string
    event_name: string
    event_starting_date: string | null
    event_image: string | null
    club_id?: string | null
    club: { club_name: string | null } | null
  } | null
  ticket_type: { name: string | null } | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function claimedPromotionCheckoutPrice(promotion: ClaimedOffer['promotion']): number {
  const originalPrice = promotion?.original_price
  const discountValue = promotion?.discount_value
  if (!originalPrice || originalPrice <= 0 || !discountValue || discountValue <= 0) return 0
  return Math.max(0, originalPrice * (1 - discountValue / 100))
}

function normalizeClaimedOffer(row: unknown): ClaimedOffer | null {
  const source = asRecord(row)
  if (!source) return null
  const id = nullableString(source.id)
  if (!id) return null

  const rawPromotion = one(source.promotion as unknown[] | Record<string, unknown> | null | undefined)
  const promotionSource = asRecord(rawPromotion)
  const rawClub = one(promotionSource?.clubs as unknown[] | Record<string, unknown> | null | undefined)
  const clubSource = asRecord(rawClub)

  return {
    id,
    redemption_code: nullableString(source.redemption_code),
    status: nullableString(source.status) ?? 'claimed',
    claimed_at: nullableString(source.claimed_at) ?? '',
    rating: typeof source.rating === 'number' ? source.rating : source.rating == null ? null : Number(source.rating) || null,
    review_comment: nullableString(source.review_comment),
    promotion: promotionSource
      ? {
          promotion_id: nullableString(promotionSource.promotion_id) ?? '',
          title: nullableString(promotionSource.title) ?? 'Promotion',
          image_url: nullableString(promotionSource.image_url),
          description: nullableString(promotionSource.description),
          valid_until: nullableString(promotionSource.valid_until),
          original_price: nullableNumber(promotionSource.original_price),
          discount_value: nullableNumber(promotionSource.discount_value),
          club_id: nullableString(promotionSource.club_id),
          clubs: clubSource
            ? {
                club_name: nullableString(clubSource.club_name),
                club_address: nullableString(clubSource.club_address),
              }
            : null,
        }
      : null,
  }
}

function formatDateLine(value: string | null): string {
  if (!value) return 'Date not available'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Date not available'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function normalizeStatus(status: string | null): 'confirmed' | 'pending' | 'cancelled' {
  const s = String(status ?? '').toLowerCase()
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('confirm') || s.includes('paid') || s.includes('success') || s.includes('complet')) return 'confirmed'
  return 'pending'
}

function normalizeKind(type: string | null | undefined): 'ticket' | 'reservation' {
  const t = String(type ?? '').toLowerCase()
  return t.includes('reservation') || t.includes('table') ? 'reservation' : 'ticket'
}

function isPastBooking(booking: Pick<BookingItem, 'eventDate'>): boolean {
  const bookingDate = booking.eventDate ? new Date(booking.eventDate) : null
  return !!bookingDate && !Number.isNaN(bookingDate.getTime()) && bookingDate < new Date()
}

function canCancelReservation(booking: Pick<BookingItem, 'eventDate'>): boolean {
  if (!booking.eventDate) return false
  const eventDate = new Date(booking.eventDate)
  if (Number.isNaN(eventDate.getTime())) return false
  return eventDate.getTime() - Date.now() >= 24 * 60 * 60 * 1000
}

function getClaimCode(offer: Pick<ClaimedOffer, 'id' | 'redemption_code'>): string {
  return String(offer.redemption_code || offer.id || 'PARTYON').toUpperCase()
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'party-on-promotion'
}

async function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render QR code.'))
    })
    image.src = url
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 720
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare QR code.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

type ExistingRating = { id: string; rating: number; comment: string | null }
type ReviewModal = { bookingId: string; eventId: string; eventName: string }

class MyBookingsErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : 'Something went wrong while loading this section.' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="min-h-screen bg-background text-foreground">
          <Navbar />
          <main className="po-container px-4 pb-16 pt-24 md:px-0">
            <section className="mx-auto max-w-3xl rounded-2xl border border-red-500/35 bg-red-500/10 p-6 text-red-100">
              <h1 className="text-xl font-bold text-white">My Bookings could not load</h1>
              <p className="mt-2 text-sm">{this.state.message}</p>
              <button
                type="button"
                onClick={() => this.setState({ message: null })}
                className="mt-4 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/12"
              >
                Try again
              </button>
            </section>
          </main>
          <LovableFooter />
        </div>
      )
    }
    return this.props.children
  }
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
        >
          <Star
            className={`h-7 w-7 transition-colors ${n <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-white/20'}`}
          />
        </button>
      ))}
    </div>
  )
}

function MyBookingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKind>('upcoming')
  const [activeTab, setActiveTab] = useState<'bookings' | 'offers'>(
    searchParams.get('tab') === 'offers' ? 'offers' : 'bookings',
  )
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [claimedOffers, setClaimedOffers] = useState<ClaimedOffer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [clearing, setClearing] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null)
  const [existingRatings, setExistingRatings] = useState<Record<string, ExistingRating>>({})
  const [reviewDraft, setReviewDraft] = useState<{ rating: number; comment: string }>({ rating: 0, comment: '' })
  const [reviewBusy, setReviewBusy] = useState(false)
  const [disputeTarget, setDisputeTarget] = useState<BookingItem | null>(null)
  const [disputeSubject, setDisputeSubject] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputePriority, setDisputePriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [disputeBusy, setDisputeBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [qrModalOffer, setQrModalOffer] = useState<ClaimedOffer | null>(null)
  const qrModalQrRef = useRef<HTMLDivElement | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('active')
  const [cancelTarget, setCancelTarget] = useState<{ type: 'promotion'; id: string } | { type: 'reservation'; booking: BookingItem } | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [promoReviewModal, setPromoReviewModal] = useState<{ offerId: string; promoTitle: string; existingRating: number | null } | null>(null)
  const [promoDisputeTarget, setPromoDisputeTarget] = useState<ClaimedOffer | null>(null)
  const [promoDisputeSubject, setPromoDisputeSubject] = useState('')
  const [promoDisputeDescription, setPromoDisputeDescription] = useState('')
  const [promoDisputePriority, setPromoDisputePriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [promoDisputeBusy, setPromoDisputeBusy] = useState(false)

  async function buildClaimedOfferPdf(offer: ClaimedOffer) {
    const title = offer.promotion?.title ?? 'Claimed promotion'
    const venue = offer.promotion?.clubs?.club_name
    const address = offer.promotion?.clubs?.club_address
    const code = getClaimCode(offer)
    const validUntil = offer.promotion?.valid_until
      ? new Date(offer.promotion.valid_until).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
    const qrSvg = qrModalQrRef.current?.querySelector('svg')
    const qrDataUrl = qrSvg ? await svgToPngDataUrl(qrSvg) : null
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    doc.setFillColor(5, 5, 10)
    doc.rect(0, 0, 210, 297, 'F')
    doc.setTextColor(236, 72, 153)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('PARTYON CLAIMED PROMOTION', 18, 24)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.text(title, 18, 38, { maxWidth: 174 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(190, 190, 205)
    if (venue) doc.text(venue, 18, 49, { maxWidth: 174 })

    if (qrDataUrl) {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(50, 62, 110, 110, 6, 6, 'F')
      doc.addImage(qrDataUrl, 'PNG', 56, 68, 98, 98)
    }

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Show this QR code to venue staff to redeem your offer.', 18, 190, { maxWidth: 174 })

    doc.setTextColor(190, 190, 205)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    let y = 205
    if (offer.promotion?.description) {
      doc.text(offer.promotion.description, 18, y, { maxWidth: 174 })
      y += 14
    }
    if (address) {
      doc.text(`Location: ${address}`, 18, y, { maxWidth: 174 })
      y += 8
    }
    if (validUntil) {
      doc.text(`Valid until: ${validUntil}`, 18, y)
      y += 8
    }

    doc.setTextColor(236, 72, 153)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('REDEMPTION CODE', 18, y + 8)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.text(code, 18, y + 19)

    doc.setTextColor(150, 150, 165)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Generated by PartyOn', 18, 282)

    return {
      blob: doc.output('blob'),
      filename: `${sanitizeFileName(title)}-${code}.pdf`,
      title,
      venue,
      code,
    }
  }

  async function shareClaimedOffer(offer: ClaimedOffer) {
    const { blob, filename, title, venue, code } = await buildClaimedOfferPdf(offer)
    const file = new File([blob], filename, { type: 'application/pdf' })
    const url = `${window.location.origin}/my-bookings?tab=offers`
    const text = [
      `${title}${venue ? ` at ${venue}` : ''}`,
      `Redemption code: ${code}`,
      'QR code attached as a PDF.',
    ].join('\n')

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ title, text, url, files: [file] })
        return
      } catch {
        return
      }
    }

    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(downloadUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  async function deleteBookingFromDb(booking: BookingItem) {
    if (!supabase || !isSupabaseConfigured) return
    if (booking.kind === 'ticket') {
      await supabase.from('tickets').delete().eq('id', booking.bookingId)
    } else {
      const { error: modernErr } = await supabase.from('reservations').delete().eq('id', booking.bookingId)
      if (modernErr) {
        await supabase.from('reservations').delete().eq('reservation_id', booking.bookingId)
      }
    }
  }

  async function clearBooking(booking: BookingItem, e: React.MouseEvent) {
    e.stopPropagation()
    if (clearing || clearingAll) return
    setClearing(booking.bookingId)
    try {
      await deleteBookingFromDb(booking)
    } finally {
      setClearing(null)
      setBookings((prev) => prev.filter((b) => b.bookingId !== booking.bookingId))
    }
  }

  async function clearAllPast(e: React.MouseEvent) {
    e.stopPropagation()
    if (clearingAll || clearing) return
    setClearingAll(true)
    const now = new Date()
    const pastIds = bookings
      .filter((b) => {
        const d = b.eventDate ? new Date(b.eventDate) : null
        return d && !Number.isNaN(d.getTime()) && d < now
      })
      .map((b) => b.bookingId)
    try {
      const pastBookings = bookings.filter((b) => pastIds.includes(b.bookingId))
      for (const booking of pastBookings) {
        await deleteBookingFromDb(booking)
      }
    } finally {
      setClearingAll(false)
      setBookings((prev) => {
        const now2 = new Date()
        return prev.filter((b) => {
          const d = b.eventDate ? new Date(b.eventDate) : null
          return !d || Number.isNaN(d.getTime()) || d >= now2
        })
      })
    }
  }

  useEffect(() => {
    let active = true

    async function loadBookings() {
      setLoading(true)
      setError(null)

      if (!supabase || !isSupabaseConfigured) {
        if (!active) return
        setLoading(false)
        setError(
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend .env.',
        )
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
      if (active) setUserId(user.id)

      const merged: BookingItem[] = []

      // 1) Reservations (legacy schema shape)
      const { data: legacyReservations, error: legacyErr } = await supabase
        .from('reservations')
        .select(
          `reservation_id,reservation_date,nr_of_people,type,status,created_at,
           event:events(event_id,event_name,event_starting_date,event_image,club_id,club:clubs(club_name)),
           ticket_type:ticket_types(name),
           payments(status)`,
        )
        .eq('user_id', user.id)

      if (!active) return
      if (!legacyErr && Array.isArray(legacyReservations)) {
        for (const row of legacyReservations as unknown as ReservationRowLegacy[]) {
          const event = one(row.event)
          const club = one(event?.club ?? null)
          const ticketType = one(row.ticket_type)
          const firstPayment = one(row.payments)
          merged.push({
            bookingId: row.reservation_id,
            eventId: event?.event_id || '',
            eventName: event?.event_name || 'Untitled event',
            eventDate: event?.event_starting_date || row.reservation_date,
            eventImage: event?.event_image || null,
            venue: club?.club_name || null,
            ticketTypeName: ticketType?.name || null,
            quantity: Math.max(1, Number(row.nr_of_people || 1)),
            status: firstPayment?.status || row.status || 'pending',
            kind: normalizeKind(row.type),
            createdAt: row.created_at,
            reservationKey: row.reservation_id,
            clubId: event?.club_id ?? null,
          })
        }
      }

      // 2) Reservations (newer schema shape requested in project prompt)
      const { data: modernReservations, error: modernErr } = await supabase
        .from('reservations')
        .select(
          `id,number_of_people,time_slot,status,created_at,
           event:events(id,event_name,event_starting_date,event_image,club_id,club:clubs(club_name))`,
        )
        .eq('user_id', user.id)

      if (!active) return
      if (!modernErr && Array.isArray(modernReservations)) {
        for (const row of modernReservations as unknown as ReservationRowModern[]) {
          const event = one(row.event)
          const club = one(event?.club ?? null)
          const already = merged.some((b) => b.bookingId === row.id)
          if (already) continue
          merged.push({
            bookingId: row.id,
            eventId: event?.id || '',
            eventName: event?.event_name || 'Untitled event',
            eventDate: event?.event_starting_date || row.time_slot || row.created_at,
            eventImage: event?.event_image || null,
            venue: club?.club_name || null,
            ticketTypeName: 'Reservation',
            quantity: Math.max(1, Number(row.number_of_people || 1)),
            status: row.status || 'confirmed',
            kind: 'reservation',
            createdAt: row.created_at,
            reservationKey: row.id,
            clubId: event?.club_id ?? null,
          })
        }
      }

      // 3) Tickets table (if project has it) and merge
      const { data: ticketRows, error: ticketErr } = await supabase
        .from('tickets')
        .select(
          `id,quantity,status,created_at,
           event:events(id,event_name,event_starting_date,event_image,club_id,club:clubs(club_name)),
           ticket_type:ticket_types(name)`,
        )
        .eq('user_id', user.id)

      if (!active) return
      if (!ticketErr && Array.isArray(ticketRows)) {
        for (const row of ticketRows as unknown as TicketRow[]) {
          const event = one(row.event)
          const club = one(event?.club ?? null)
          const ticketType = one(row.ticket_type)
          merged.push({
            bookingId: row.id,
            eventId: event?.id || '',
            eventName: event?.event_name || 'Untitled event',
            eventDate: event?.event_starting_date || row.created_at,
            eventImage: event?.event_image || null,
            venue: club?.club_name || null,
            ticketTypeName: ticketType?.name || 'General Admission',
            quantity: Math.max(1, Number(row.quantity || 1)),
            status: row.status || 'confirmed',
            kind: 'ticket',
            createdAt: row.created_at,
            reservationKey: null,
            clubId: event?.club_id ?? null,
          })
        }
      }

      if (legacyErr && modernErr && ticketErr) {
        setLoading(false)
        setError(legacyErr.message)
        return
      }

      merged.sort((a, b) => {
        const ad = new Date(a.eventDate || a.createdAt || 0).getTime()
        const bd = new Date(b.eventDate || b.createdAt || 0).getTime()
        return bd - ad
      })
      setBookings(merged)
      setLoading(false)
    }

    void loadBookings()
    return () => {
      active = false
    }
  }, [navigate])

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (booking.kind === 'reservation' && normalizeStatus(booking.status) === 'cancelled') return false
      const bookingDate = booking.eventDate ? new Date(booking.eventDate) : null
      if (!bookingDate || Number.isNaN(bookingDate.getTime())) return filter === 'upcoming'
      return filter === 'upcoming' ? !isPastBooking(booking) : isPastBooking(booking)
    })
  }, [bookings, filter])

  const filteredOffers = useMemo(() => {
    return claimedOffers.filter((offer) => {
      const s = String(offer.status ?? '').toLowerCase()
      if (offerFilter === 'active') return s !== 'redeemed' && s !== 'used' && s !== 'expired'
      return s === 'redeemed' || s === 'used'
    })
  }, [claimedOffers, offerFilter])

  useEffect(() => {
    if (filter !== 'past' || !userId || !supabase || !isSupabaseConfigured) return
    const now = new Date()
    const pastEventIds = bookings
      .filter((b) => {
        const d = b.eventDate ? new Date(b.eventDate) : null
        return d && !Number.isNaN(d.getTime()) && d < now && b.eventId
      })
      .map((b) => b.eventId)
    if (pastEventIds.length === 0) return

    void supabase
      .from('event_ratings')
      .select('id, event_id, rating, comment')
      .in('event_id', pastEventIds)
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, ExistingRating> = {}
        for (const row of data as { id: string; event_id: string; rating: number; comment: string | null }[]) {
          map[row.event_id] = { id: row.id, rating: row.rating, comment: row.comment }
        }
        setExistingRatings(map)
      })
  }, [filter, userId, bookings])

  // Load claimed offers when the user switches to the Offers tab
  useEffect(() => {
    if (activeTab !== 'offers' || !supabase || !isSupabaseConfigured) return
    const sb = supabase
    let active = true
    setOffersLoading(true)
    void sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        if (!active) return
        setClaimedOffers([])
        setOffersLoading(false)
        return
      }
      const claimedResult = await sb
        .from('claimed_promotions')
        .select('id, redemption_code, status, claimed_at, rating, review_comment, promotion:promotions(promotion_id, title, image_url, description, valid_until, original_price, discount_value, club_id, clubs(club_name, club_address))')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .order('claimed_at', { ascending: false })
      let data = claimedResult.data as unknown[] | null
      let error = claimedResult.error
      if (error && /rating|review_comment/i.test(error.message)) {
        const fallback = await sb
          .from('claimed_promotions')
          .select('id, redemption_code, status, claimed_at, promotion:promotions(promotion_id, title, image_url, description, valid_until, original_price, discount_value, club_id, clubs(club_name, club_address))')
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .order('claimed_at', { ascending: false })
        data = fallback.data as unknown[] | null
        error = fallback.error
      }
      if (!active) return
      if (error) {
        setActionMsg(error.message)
        setClaimedOffers([])
        setOffersLoading(false)
        return
      }
      setClaimedOffers((data ?? []).map(normalizeClaimedOffer).filter((offer): offer is ClaimedOffer => !!offer))
      setOffersLoading(false)
    }).catch((err: unknown) => {
      if (!active) return
      setActionMsg(err instanceof Error ? err.message : 'Could not load claimed promotions.')
      setClaimedOffers([])
      setOffersLoading(false)
    })
    return () => {
      active = false
    }
  }, [activeTab])

  function openReviewModal(booking: BookingItem) {
    const existing = existingRatings[booking.eventId]
    setReviewDraft({ rating: existing?.rating ?? 0, comment: existing?.comment ?? '' })
    setReviewModal({ bookingId: booking.bookingId, eventId: booking.eventId, eventName: booking.eventName })
  }

  async function handleReviewSubmit() {
    if (!reviewModal || !userId || !supabase || !isSupabaseConfigured || reviewDraft.rating === 0) return
    setReviewBusy(true)
    const existing = existingRatings[reviewModal.eventId]
    const payload = { rating: reviewDraft.rating, comment: reviewDraft.comment.trim() || null }
    if (existing) {
      await supabase.from('event_ratings').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('event_ratings').insert({
        user_id: userId,
        event_id: reviewModal.eventId,
        reservation_id: reviewModal.bookingId,
        ...payload,
      })
    }
    setExistingRatings((prev) => ({
      ...prev,
      [reviewModal.eventId]: { id: existing?.id ?? '', rating: reviewDraft.rating, comment: payload.comment },
    }))
    setReviewBusy(false)
    setReviewModal(null)
  }

  async function submitDispute() {
    if (!supabase || !isSupabaseConfigured || !disputeTarget?.clubId) return
    if (!isPastBooking(disputeTarget)) {
      setActionMsg('Disputes can only be filed after the event has happened.')
      setDisputeTarget(null)
      return
    }
    if (!disputeSubject.trim() || !disputeDescription.trim()) {
      setActionMsg('Please add subject and description.')
      return
    }
    setDisputeBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setDisputeBusy(false)
      return
    }
    const { error } = await supabase.from('disputes').insert({
      user_id: user.id,
      reservation_id: disputeTarget.reservationKey,
      event_id: disputeTarget.eventId || null,
      club_id: disputeTarget.clubId,
      subject: disputeSubject.trim(),
      description: disputeDescription.trim(),
      priority: disputePriority,
    })
    setDisputeBusy(false)
    if (error) {
      setActionMsg(error.message)
      return
    }
    setDisputeTarget(null)
    setDisputeSubject('')
    setDisputeDescription('')
    setDisputePriority('medium')
    setActionMsg('Dispute submitted — the venue manager will review it.')
  }

  async function cancelPromotion(offerId: string) {
    if (!supabase || !isSupabaseConfigured) return
    setCancelBusy(true)
    await supabase.from('claimed_promotions').update({ status: 'cancelled' }).eq('id', offerId)
    setClaimedOffers((prev) => prev.filter((o) => o.id !== offerId))
    setCancelBusy(false)
    setCancelTarget(null)
    setActionMsg('Promotion claim cancelled.')
  }

  async function cancelFreeReservation(booking: BookingItem) {
    if (!supabase || !isSupabaseConfigured || !booking.reservationKey) return
    if (!canCancelReservation(booking)) {
      setCancelTarget(null)
      setActionMsg('Reservations can only be cancelled up to 24 hours before the event.')
      return
    }
    setCancelBusy(true)
    const { error } = await supabase.from('reservations').delete().eq('id', booking.reservationKey)
    if (error) {
      await supabase.from('reservations').delete().eq('reservation_id', booking.reservationKey)
    }
    setBookings((prev) => prev.filter((b) => b.bookingId !== booking.bookingId))
    setCancelBusy(false)
    setCancelTarget(null)
    setActionMsg('Reservation cancelled and removed from your bookings.')
  }

  async function handlePromoReviewSubmit() {
    if (!promoReviewModal || !userId || !supabase || !isSupabaseConfigured || reviewDraft.rating === 0) return
    setReviewBusy(true)
    const { error } = await supabase
      .from('claimed_promotions')
      .update({ rating: reviewDraft.rating, review_comment: reviewDraft.comment.trim() || null, reviewed_at: new Date().toISOString() })
      .eq('id', promoReviewModal.offerId)
    if (error) {
      setReviewBusy(false)
      setActionMsg(error.message)
      return
    }
    setClaimedOffers((prev) => prev.map((offer) => (
      offer.id === promoReviewModal.offerId
        ? { ...offer, rating: reviewDraft.rating, review_comment: reviewDraft.comment.trim() || null }
        : offer
    )))
    setReviewBusy(false)
    setActionMsg('Review saved. Thank you!')
    setPromoReviewModal(null)
    return
    setActionMsg(error ? 'Thank you for your feedback!' : 'Review saved — thank you!')
    setPromoReviewModal(null)
  }

  async function submitPromoDispute() {
    if (!supabase || !isSupabaseConfigured) return
    if (!promoDisputeSubject.trim() || !promoDisputeDescription.trim()) {
      setActionMsg('Please add subject and description.')
      return
    }
    setPromoDisputeBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPromoDisputeBusy(false); return }
    const clubId = promoDisputeTarget?.promotion?.club_id ?? null
    const promotionTitle = promoDisputeTarget?.promotion?.title ?? 'Promotion'
    const claimCode = promoDisputeTarget ? getClaimCode(promoDisputeTarget) : null
    const { error } = await supabase.from('disputes').insert({
      user_id: user.id,
      club_id: clubId,
      reservation_id: null,
      event_id: null,
      subject: `Promotion: ${promoDisputeSubject.trim()}`,
      description: [
        `Promotion: ${promotionTitle}`,
        claimCode ? `Redemption code: ${claimCode}` : null,
        promoDisputeDescription.trim(),
      ].filter(Boolean).join('\n\n'),
      priority: promoDisputePriority,
    })
    setPromoDisputeBusy(false)
    if (error) { setActionMsg(error.message); return }
    setPromoDisputeTarget(null)
    setPromoDisputeSubject('')
    setPromoDisputeDescription('')
    setPromoDisputePriority('medium')
    setActionMsg('Dispute submitted — the venue manager will review it.')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">My Bookings</h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Your tickets, reservations, and offers in one place
            </p>
            {actionMsg ? (
              <p className="mt-2 text-sm font-semibold text-emerald-300">{actionMsg}</p>
            ) : null}

            <div className="mt-5 flex items-end justify-between border-b border-white/10">
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('bookings')}
                  className={`relative pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'bookings' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Bookings
                  {activeTab === 'bookings' ? (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('offers')}
                  className={`relative pb-3 text-sm font-semibold transition-colors ${
                    activeTab === 'offers' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Claimed Promotions
                  {activeTab === 'offers' ? (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500" />
                  ) : null}
                </button>
              </div>
              {activeTab === 'bookings' && filter === 'past' && filteredBookings.length > 0 && (
                <button
                  type="button"
                  disabled={clearingAll || !!clearing}
                  onClick={(e) => void clearAllPast(e)}
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs font-medium text-white/45 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" />
                  {clearingAll ? 'Clearing…' : 'Clear all'}
                </button>
              )}
            </div>

            {/* Active / Used sub-tabs for Claimed Promotions */}
            {activeTab === 'offers' && (
              <div className="mt-4 flex gap-5 border-b border-white/8 pb-0">
                {(['active', 'used'] as OfferFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setOfferFilter(f)}
                    className={`relative pb-3 text-xs font-medium capitalize transition-colors ${
                      offerFilter === f ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                    {offerFilter === f && (
                      <span className="absolute inset-x-0 -bottom-px h-px bg-white/40" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Upcoming / Past sub-tabs only for Bookings */}
            {activeTab === 'bookings' && (
              <div className="mt-4 flex gap-5 border-b border-white/8 pb-0">
                {(['upcoming', 'past'] as FilterKind[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`relative pb-3 text-xs font-medium capitalize transition-colors ${
                      filter === f ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {f}
                    {filter === f && (
                      <span className="absolute inset-x-0 -bottom-px h-px bg-white/40" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </header>

          {activeTab === 'offers' ? (
            /* ── Claimed Promotions ─────────────────────────────────────── */
            offersLoading ? (
              <section className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-[#111118]/80" />
                ))}
              </section>
            ) : filteredOffers.length === 0 ? (
              <section className="rounded-2xl border border-white/10 bg-[#101016]/80 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  {offerFilter === 'active' ? 'No active promotions' : 'No used promotions'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {offerFilter === 'active'
                    ? 'Browse promotions and claim one to see it here'
                    : 'Promotions you redeem will appear here'}
                </p>
                {offerFilter === 'active' && (
                  <button
                    type="button"
                    onClick={() => navigate('/promotions')}
                    className="mt-5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
                  >
                    Explore Promotions
                  </button>
                )}
              </section>
            ) : (
              <section className="space-y-3">
                {filteredOffers.map((offer) => {
                  const promo = offer.promotion
                  const claimCode = getClaimCode(offer)
                  const offerStatus = String(offer.status ?? '').toLowerCase()
                  const isUsed = offerStatus === 'redeemed' || offerStatus === 'used'
                  const canCancelClaim = !isUsed && claimedPromotionCheckoutPrice(promo) === 0
                  const statusColor = isUsed
                    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                    : 'border-primary/30 bg-primary/10 text-primary'
                  return (
                    <article
                      key={offer.id}
                      className="grid cursor-pointer gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 hover:shadow-[0_0_28px_-8px_rgba(168,85,247,0.2)] md:min-h-[168px] md:grid-cols-[96px_1fr_auto] md:items-center"
                      onClick={() => setQrModalOffer(offer)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setQrModalOffer(offer)
                        }
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {promo?.image_url ? (
                          <img src={promo.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Gift className="h-8 w-8 text-white/20" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="truncate font-semibold text-white">{promo?.title ?? 'Promotion'}</h3>
                        {promo?.clubs?.club_name && (
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0 text-primary/70" />
                            {promo.clubs.club_name}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusColor}`}>
                            {isUsed ? 'Redeemed' : 'Active'}
                          </span>
                          {promo?.valid_until && !isUsed && (
                            <span className="text-xs text-muted-foreground">
                              Valid until {new Date(promo.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right actions */}
                      {isUsed ? (
                        /* Used: rate & dispute */
                        <div className="flex flex-col items-end gap-2 self-stretch py-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setReviewDraft({ rating: offer.rating ?? 0, comment: offer.review_comment ?? '' }); setPromoReviewModal({ offerId: offer.id, promoTitle: promo?.title ?? 'Promotion', existingRating: offer.rating }) }}
                            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/40 transition-all duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          >
                            <Star className="h-3 w-3" />
                            {offer.rating ? `${offer.rating}/5` : 'Rate'}
                          </button>
                          {promo?.club_id && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActionMsg(null); setPromoDisputeTarget(offer) }}
                              className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/8 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/18"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              File dispute
                            </button>
                          )}
                        </div>
                      ) : (
                        /* Active: QR preview + cancel */
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="rounded-lg border border-white/15 bg-white p-1.5 shadow-sm"
                            onClick={() => setQrModalOffer(offer)}
                          >
                            <QRCode
                              value={claimCode}
                              size={56}
                              bgColor="#ffffff"
                              fgColor="#0a0a0f"
                              level="M"
                            />
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-white/40">
                            <ScanLine className="h-2.5 w-2.5" />
                            Tap to scan
                          </span>
                          {canCancelClaim && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setCancelTarget({ type: 'promotion', id: offer.id }) }}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-white/35 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <X className="h-2.5 w-2.5" />
                              Cancel claim
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </section>
            )
          ) : loading ? (
            <section className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-36 animate-pulse rounded-2xl border border-white/10 bg-[#111118]/80"
                />
              ))}
            </section>
          ) : error ? (
            <section className="rounded-2xl border border-red-500/35 bg-red-500/10 p-5 text-sm text-red-200">
              {error}
            </section>
          ) : filteredBookings.length === 0 ? (
            <section className="rounded-2xl border border-white/10 bg-[#101016]/80 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <ReceiptText className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-white">No bookings yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Explore events and make your first booking
              </p>
              <button
                type="button"
                onClick={() => navigate({ pathname: '/', hash: 'events' })}
                className="mt-5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
              >
                Explore Events
              </button>
            </section>
          ) : (
            <section className="space-y-3">
              {filteredBookings.map((booking) => {
                const status = normalizeStatus(booking.status)
                const statusClass =
                  status === 'confirmed'
                    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                    : status === 'cancelled'
                      ? 'border-red-400/35 bg-red-400/10 text-red-300'
                      : 'border-amber-400/35 bg-amber-400/10 text-amber-300'
                const typeClass =
                  booking.kind === 'reservation'
                    ? 'border-blue-400/30 bg-blue-400/10 text-blue-300'
                    : 'border-primary/30 bg-primary/10 text-primary'
                const canFileDispute = isPastBooking(booking) && !!booking.clubId
                const isActiveReservation = booking.kind === 'reservation' && status !== 'cancelled'
                const canCancelCurrentReservation = isActiveReservation && canCancelReservation(booking)

                return (
                  <article
                    key={booking.bookingId}
                    className="grid cursor-pointer gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 hover:shadow-[0_0_28px_-8px_rgba(236,72,153,0.22)] md:min-h-[168px] md:grid-cols-[96px_1fr_auto] md:items-center"
                    onClick={() => navigate(`/my-bookings/${booking.bookingId}`)}
                  >
                    {/* Thumbnail */}
                    <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      {booking.eventImage ? (
                        <img
                          src={booking.eventImage}
                          alt={booking.eventName || 'Event image'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/25 via-fuchsia-500/20 to-purple-500/20">
                          <Ticket className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-white">{booking.eventName}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {formatDateLine(booking.eventDate)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {booking.venue || 'Venue not set'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeClass}`}>
                          {booking.kind === 'reservation' ? 'TABLE' : 'TICKET'}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {booking.ticketTypeName || (booking.kind === 'reservation' ? 'Reservation' : 'General Admission')}
                          {booking.quantity > 1 ? ` × ${booking.quantity}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Right: status + action */}
                    <div className="flex flex-col items-end gap-3 self-stretch py-0.5">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </span>
                      {canFileDispute ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActionMsg(null); setDisputeTarget(booking) }}
                          className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/8 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:border-red-500/50 hover:bg-red-500/18"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          File dispute
                        </button>
                      ) : null}
                      {filter === 'past' ? (
                        <div className="mt-auto flex items-center gap-2">
                          {(() => {
                            const existing = existingRatings[booking.eventId]
                            return (
                              <button
                                type="button"
                                title={existing ? 'Edit your review' : 'Rate this event'}
                                onClick={(e) => { e.stopPropagation(); openReviewModal(booking) }}
                                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                                  existing
                                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                                    : 'border-white/10 bg-white/5 text-white/40 hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                                }`}
                              >
                                <Star className={`h-3 w-3 ${existing ? 'fill-amber-400 text-amber-400' : ''}`} />
                                {existing ? `${existing.rating}/5` : 'Rate'}
                              </button>
                            )
                          })()}
                          <button
                            type="button"
                            title="Remove booking"
                            disabled={clearing === booking.bookingId || clearingAll}
                            onClick={(e) => void clearBooking(booking, e)}
                            className="group flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/30 transition-all duration-150 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30"
                          >
                            {clearing === booking.bookingId
                              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <ChevronRight className="h-4 w-4 text-white/25" />
                          {isActiveReservation && (
                            <button
                              type="button"
                              disabled={!canCancelCurrentReservation}
                              title={
                                canCancelCurrentReservation
                                  ? 'Cancel this reservation'
                                  : 'Reservations can only be cancelled up to 24 hours before the event'
                              }
                              onClick={(e) => { e.stopPropagation(); setCancelTarget({ type: 'reservation', booking }) }}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                                canCancelCurrentReservation
                                  ? 'border-red-400/25 bg-red-500/10 text-red-200 shadow-[0_0_18px_-10px_rgba(248,113,113,0.9)] hover:border-red-300/45 hover:bg-red-500/18 hover:text-white'
                                  : 'cursor-not-allowed border-white/10 bg-white/5 text-white/30'
                              }`}
                            >
                              <X className="h-3 w-3" />
                              {canCancelCurrentReservation ? 'Cancel reservation' : 'Cancellation closed'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </div>
      </main>

      {/* ── QR Code modal ────────────────────────────────────────────────── */}
      {qrModalOffer ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => { setQrModalOffer(null); setCodeCopied(false); setShareCopied(false) }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-[#0e0e14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar for mobile */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-5 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70">Claimed Promotion</p>
                <h2 className="mt-0.5 truncate text-base font-bold text-white">
                  {qrModalOffer.promotion?.title ?? 'Promotion'}
                </h2>
                {qrModalOffer.promotion?.clubs?.club_name && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                    {qrModalOffer.promotion.clubs.club_name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setQrModalOffer(null); setCodeCopied(false); setShareCopied(false) }}
                className="ml-2 shrink-0 rounded-full border border-white/10 p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-4 px-5 pb-6">
              <div ref={qrModalQrRef} className="rounded-2xl border-4 border-white bg-white p-4 shadow-[0_0_40px_rgba(168,85,247,0.25)]">
                <QRCode
                  value={getClaimCode(qrModalOffer)}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#05050a"
                  level="M"
                />
              </div>

              {/* Instruction */}
              <p className="text-center text-sm text-muted-foreground">
                Show this QR code to venue staff to redeem your offer
              </p>

              <div className="grid w-full gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <div className="flex items-start gap-3">
                  <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{qrModalOffer.promotion?.title ?? 'Promotion'}</p>
                    {qrModalOffer.promotion?.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {qrModalOffer.promotion.description}
                      </p>
                    )}
                  </div>
                </div>
                {qrModalOffer.promotion?.clubs?.club_address && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="min-w-0 truncate">{qrModalOffer.promotion.clubs.club_address}</span>
                  </div>
                )}
                {qrModalOffer.promotion?.valid_until && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary/70" />
                    <span>
                      Valid until{' '}
                      {new Date(qrModalOffer.promotion.valid_until).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Code text + copy */}
              <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="flex-1 text-center font-mono text-lg font-bold tracking-[0.2em] text-white">
                  {getClaimCode(qrModalOffer)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(getClaimCode(qrModalOffer))
                      .then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) })
                  }}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/8 p-2 text-white/50 transition hover:border-primary/40 hover:bg-primary/15 hover:text-primary"
                  aria-label="Copy code"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {codeCopied && (
                <p className="-mt-2 text-xs font-semibold text-emerald-400">Copied to clipboard!</p>
              )}

              <div className="w-full">
                <button
                  type="button"
                  onClick={() => void shareClaimedOffer(qrModalOffer)}
                  className="inline-flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-3 text-sm font-semibold text-white/85 transition hover:border-primary/40 hover:bg-primary/15 hover:text-white"
                >
                  <Share2 className="h-5 w-5" />
                  Share PDF
                </button>
              </div>
              {shareCopied && (
                <p className="-mt-2 text-xs font-semibold text-emerald-400">PDF ready to share or downloaded.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Review modal ─────────────────────────────────────────────────── */}
      {reviewModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setReviewModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e14] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Rate your experience</p>
                <h2 className="mt-0.5 text-lg font-bold text-white leading-snug">{reviewModal.eventName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="shrink-0 rounded-full border border-white/10 p-1.5 text-white/40 hover:text-white/70"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stars */}
            <div className="mb-5">
              <p className="mb-2 text-sm text-muted-foreground">Your rating</p>
              <StarPicker value={reviewDraft.rating} onChange={(n) => setReviewDraft((d) => ({ ...d, rating: n }))} />
              {reviewDraft.rating > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][reviewDraft.rating]}
                </p>
              )}
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label htmlFor="review-comment" className="mb-1.5 block text-sm text-muted-foreground">
                Share more (optional)
              </label>
              <textarea
                id="review-comment"
                rows={3}
                placeholder="What did you think of the event?"
                value={reviewDraft.comment}
                onChange={(e) => setReviewDraft((d) => ({ ...d, comment: e.target.value }))}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewDraft.rating === 0 || reviewBusy}
                onClick={() => void handleReviewSubmit()}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {reviewBusy ? 'Saving…' : existingRatings[reviewModal.eventId] ? 'Update review' : 'Submit review'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {disputeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setDisputeTarget(null)}
        >
          <div
            role="dialog"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">File a dispute</h2>
            <p className="mt-1 text-sm text-muted-foreground">{disputeTarget.eventName}</p>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Priority</p>
            <div className="mt-1 flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDisputePriority(p)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-bold capitalize ${
                    disputePriority === p ? 'border-primary/50 bg-primary/20 text-white' : 'border-white/10 text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Subject</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={disputeSubject}
              onChange={e => setDisputeSubject(e.target.value)}
              placeholder="e.g. Wrong table assigned"
            />
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={disputeDescription}
              onChange={e => setDisputeDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
            />
            {actionMsg ? (
              <p className="mt-2 text-xs text-red-300">{actionMsg}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={disputeBusy}
                onClick={() => void submitDispute()}
                className="flex-1 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {disputeBusy ? 'Submitting…' : 'Submit dispute'}
              </button>
              <button
                type="button"
                onClick={() => setDisputeTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Cancel confirmation modal ──────────────────────────────────── */}
      {cancelTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e0e14] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">
              {cancelTarget.type === 'promotion' ? 'Cancel this claim?' : 'Cancel this reservation?'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {cancelTarget.type === 'promotion'
                ? 'This will remove the claimed promotion from your account. This action cannot be undone.'
                : 'This will permanently remove the reservation from your bookings and the database. You can cancel up to 24 hours before the event.'}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
              >
                Keep it
              </button>
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => {
                  if (cancelTarget.type === 'promotion') {
                    void cancelPromotion(cancelTarget.id)
                  } else {
                    void cancelFreeReservation(cancelTarget.booking)
                  }
                }}
                className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/25 disabled:opacity-40"
              >
                {cancelBusy ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Promo review modal ─────────────────────────────────────────── */}
      {promoReviewModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setPromoReviewModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e14] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Rate your experience</p>
                <h2 className="mt-0.5 text-lg font-bold text-white leading-snug">{promoReviewModal.promoTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPromoReviewModal(null)}
                className="shrink-0 rounded-full border border-white/10 p-1.5 text-white/40 hover:text-white/70"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-5">
              <p className="mb-2 text-sm text-muted-foreground">Your rating</p>
              <StarPicker value={reviewDraft.rating} onChange={(n) => setReviewDraft((d) => ({ ...d, rating: n }))} />
              {reviewDraft.rating > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {['', 'Poor', 'Below average', 'Average', 'Good', 'Excellent'][reviewDraft.rating]}
                </p>
              )}
            </div>
            <div className="mb-6">
              <label htmlFor="promo-review-comment" className="mb-1.5 block text-sm text-muted-foreground">
                Share more (optional)
              </label>
              <textarea
                id="promo-review-comment"
                rows={3}
                placeholder="How was your experience with this offer?"
                value={reviewDraft.comment}
                onChange={(e) => setReviewDraft((d) => ({ ...d, comment: e.target.value }))}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPromoReviewModal(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewDraft.rating === 0 || reviewBusy}
                onClick={() => void handlePromoReviewSubmit()}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {reviewBusy ? 'Saving…' : promoReviewModal.existingRating ? 'Update review' : 'Submit review'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Promo dispute modal ────────────────────────────────────────── */}
      {promoDisputeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setPromoDisputeTarget(null)}
        >
          <div
            role="dialog"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">File a dispute</h2>
            <p className="mt-1 text-sm text-muted-foreground">{promoDisputeTarget.promotion?.title ?? 'Promotion'}</p>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Priority</p>
            <div className="mt-1 flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPromoDisputePriority(p)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-bold capitalize ${
                    promoDisputePriority === p ? 'border-primary/50 bg-primary/20 text-white' : 'border-white/10 text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Subject</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={promoDisputeSubject}
              onChange={(e) => setPromoDisputeSubject(e.target.value)}
              placeholder="e.g. Offer was not honoured"
            />
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={promoDisputeDescription}
              onChange={(e) => setPromoDisputeDescription(e.target.value)}
              placeholder="Describe the issue in detail…"
            />
            {actionMsg ? <p className="mt-2 text-xs text-red-300">{actionMsg}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={promoDisputeBusy}
                onClick={() => void submitPromoDispute()}
                className="flex-1 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {promoDisputeBusy ? 'Submitting…' : 'Submit dispute'}
              </button>
              <button
                type="button"
                onClick={() => setPromoDisputeTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LovableFooter />
    </div>
  )
}

export default function MyBookings() {
  return (
    <MyBookingsErrorBoundary>
      <MyBookingsPage />
    </MyBookingsErrorBoundary>
  )
}
