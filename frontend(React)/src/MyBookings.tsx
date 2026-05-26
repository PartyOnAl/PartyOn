import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Gift, MapPin, ReceiptText, Star, Ticket, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type ClaimedOffer = {
  id: string
  redemption_code: string
  status: string
  claimed_at: string
  promotion: {
    promotion_id: string
    title: string
    image_url: string | null
    description: string | null
    valid_until: string | null
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

type ExistingRating = { id: string; rating: number; comment: string | null }
type ReviewModal = { bookingId: string; eventId: string; eventName: string }

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

export default function MyBookings() {
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
      } = await supabase.auth.getUser()
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
      const bookingDate = booking.eventDate ? new Date(booking.eventDate) : null
      if (!bookingDate || Number.isNaN(bookingDate.getTime())) return filter === 'upcoming'
      return filter === 'upcoming' ? !isPastBooking(booking) : isPastBooking(booking)
    })
  }, [bookings, filter])

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
    setOffersLoading(true)
    void sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb
        .from('claimed_promotions')
        .select('id, redemption_code, status, claimed_at, promotion:promotions(promotion_id, title, image_url, description, valid_until, clubs(club_name, club_address))')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .order('claimed_at', { ascending: false })
      setClaimedOffers((data ?? []) as unknown as ClaimedOffer[])
      setOffersLoading(false)
    })
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">My Bookings</h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              Your tickets and reservations in one place
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
                  Offers
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
            /* ── Claimed Offers ─────────────────────────────────────────── */
            offersLoading ? (
              <section className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-[#111118]/80" />
                ))}
              </section>
            ) : claimedOffers.length === 0 ? (
              <section className="rounded-2xl border border-white/10 bg-[#101016]/80 px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white">No claimed offers yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">Browse promotions and claim an offer to see it here</p>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="mt-5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-95"
                >
                  Explore Offers
                </button>
              </section>
            ) : (
              <section className="space-y-3">
                {claimedOffers.map((offer) => {
                  const promo = offer.promotion
                  const isRedeemed = offer.status === 'redeemed'
                  const isExpired = offer.status === 'expired'
                  const statusColor = isRedeemed
                    ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                    : isExpired
                      ? 'border-white/20 bg-white/5 text-white/40'
                      : 'border-primary/30 bg-primary/10 text-primary'
                  return (
                    <article
                      key={offer.id}
                      className="grid gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 md:grid-cols-[96px_1fr_auto] md:items-center"
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
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate font-semibold text-white">{promo?.title ?? 'Promotion'}</h3>
                        {promo?.clubs?.club_name && (
                          <p className="text-sm text-muted-foreground">{promo.clubs.club_name}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor}`}>
                            {offer.status}
                          </span>
                          {promo?.valid_until && (
                            <span className="text-xs text-muted-foreground">
                              Valid until {new Date(promo.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Code */}
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          <div>
                            <p className="text-[10px] font-medium text-emerald-400">Redemption Code</p>
                            <p className="font-mono text-sm font-bold tracking-widest text-white">
                              {offer.redemption_code.toUpperCase()}
                            </p>
                          </div>
                        </div>
                        {promo && (
                          <Link
                            to={`/promotions/offer/${encodeURIComponent(promo.promotion_id)}`}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                          >
                            View offer
                          </Link>
                        )}
                      </div>
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

                return (
                  <article
                    key={booking.bookingId}
                    className="grid cursor-pointer gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 hover:shadow-[0_0_28px_-8px_rgba(236,72,153,0.22)] md:grid-cols-[96px_1fr_auto] md:items-center"
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
                        <ChevronRight className="h-4 w-4 text-white/25" />
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </div>
      </main>

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

      <LovableFooter />
    </div>
  )
}
