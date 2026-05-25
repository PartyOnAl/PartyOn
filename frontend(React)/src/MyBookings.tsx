import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, AlertTriangle, MapPin, ReceiptText, Star, Ticket, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { isEventPast } from '@/lib/eventDates'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

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
  /** `reservations.reservation_id` or modern `reservations.id` — required for `event_ratings` / `disputes` (mobile parity). */
  reservationKey: string | null
  clubId: string | null
  eventStartIso: string | null
  eventEndIso: string | null
  eventHours: string | null
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
    event_ending_date?: string | null
    event_hours?: string | null
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
    event_ending_date?: string | null
    event_hours?: string | null
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
    event_ending_date?: string | null
    event_hours?: string | null
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

function bookingIsPastForItem(b: BookingItem): boolean {
  if (!b.eventStartIso) {
    const d = b.eventDate ? new Date(b.eventDate) : null
    return !!(d && !Number.isNaN(d.getTime()) && d < new Date())
  }
  return isEventPast({
    event_starting_date: b.eventStartIso,
    event_ending_date: b.eventEndIso,
    event_hours: b.eventHours,
  })
}

export default function MyBookings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKind>('upcoming')
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [clearing, setClearing] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [rateTarget, setRateTarget] = useState<BookingItem | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<BookingItem | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [rateStars, setRateStars] = useState(0)
  const [rateComment, setRateComment] = useState('')
  const [rateBusy, setRateBusy] = useState(false)
  const [disputeSubject, setDisputeSubject] = useState('')
  const [disputeDescription, setDisputeDescription] = useState('')
  const [disputePriority, setDisputePriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [disputeBusy, setDisputeBusy] = useState(false)

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
    const pastIds = bookings.filter(b => bookingIsPastForItem(b)).map((b) => b.bookingId)
    try {
      const pastBookings = bookings.filter((b) => pastIds.includes(b.bookingId))
      for (const booking of pastBookings) {
        await deleteBookingFromDb(booking)
      }
    } finally {
      setClearingAll(false)
      setBookings((prev) => prev.filter((b) => !bookingIsPastForItem(b)))
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

      const merged: BookingItem[] = []

      // 1) Reservations (legacy schema shape)
      const { data: legacyReservations, error: legacyErr } = await supabase
        .from('reservations')
        .select(
          `reservation_id,reservation_date,nr_of_people,type,status,created_at,
           event:events(event_id,event_name,event_starting_date,event_ending_date,event_hours,event_image,club_id,club:clubs(club_name)),
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
            eventStartIso: event?.event_starting_date ?? null,
            eventEndIso: event?.event_ending_date ?? null,
            eventHours: event?.event_hours ?? null,
          })
        }
      }

      // 2) Reservations (newer schema shape requested in project prompt)
      const { data: modernReservations, error: modernErr } = await supabase
        .from('reservations')
        .select(
          `id,number_of_people,time_slot,status,created_at,
           event:events(id,event_name,event_starting_date,event_ending_date,event_hours,event_image,club_id,club:clubs(club_name))`,
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
            eventStartIso: event?.event_starting_date ?? null,
            eventEndIso: event?.event_ending_date ?? null,
            eventHours: event?.event_hours ?? null,
          })
        }
      }

      // 3) Tickets table (if project has it) and merge
      const { data: ticketRows, error: ticketErr } = await supabase
        .from('tickets')
        .select(
          `id,quantity,status,created_at,
           event:events(id,event_name,event_starting_date,event_ending_date,event_hours,event_image,club_id,club:clubs(club_name)),
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
            eventStartIso: event?.event_starting_date ?? null,
            eventEndIso: event?.event_ending_date ?? null,
            eventHours: event?.event_hours ?? null,
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

      const resKeys = merged.map(b => b.reservationKey).filter((k): k is string => Boolean(k))
      const ratingMap: Record<string, number> = {}
      if (resKeys.length > 0) {
        const { data: ratRows } = await supabase
          .from('event_ratings')
          .select('reservation_id, rating')
          .eq('user_id', user.id)
          .in('reservation_id', resKeys)
        for (const r of ratRows ?? []) {
          const row = r as { reservation_id: string; rating: number }
          if (row.reservation_id) ratingMap[row.reservation_id] = row.rating
        }
      }
      setRatings(ratingMap)
      setBookings(merged)
      setLoading(false)
    }

    void loadBookings()
    return () => {
      active = false
    }
  }, [navigate])

  useEffect(() => {
    if (rateTarget) {
      setRateStars(0)
      setRateComment('')
    }
  }, [rateTarget?.bookingId])

  useEffect(() => {
    if (disputeTarget) {
      setDisputeSubject('')
      setDisputeDescription('')
      setDisputePriority('medium')
    }
  }, [disputeTarget?.bookingId])

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const past = bookingIsPastForItem(booking)
      return filter === 'upcoming' ? !past : past
    })
  }, [bookings, filter])

  async function submitRating() {
    if (!supabase || !rateTarget?.reservationKey) return
    if (rateStars < 1) {
      setActionMsg('Please choose a star rating.')
      return
    }
    setRateBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRateBusy(false)
      return
    }
    const { error } = await supabase.from('event_ratings').upsert(
      {
        user_id: user.id,
        event_id: rateTarget.eventId,
        reservation_id: rateTarget.reservationKey,
        rating: rateStars,
        comment: rateComment.trim() || null,
      },
      { onConflict: 'user_id,reservation_id' },
    )
    setRateBusy(false)
    if (error) {
      setActionMsg(error.message)
      return
    }
    setRatings(prev => ({ ...prev, [rateTarget.reservationKey!]: rateStars }))
    setRateTarget(null)
    setActionMsg('Thanks — your rating was saved.')
  }

  async function submitDispute() {
    if (!supabase || !disputeTarget?.reservationKey || !disputeTarget.clubId) return
    if (!disputeSubject.trim() || !disputeDescription.trim()) {
      setActionMsg('Please add subject and description.')
      return
    }
    setDisputeBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setDisputeBusy(false)
      return
    }
    const { error } = await supabase.from('disputes').insert({
      user_id: user.id,
      reservation_id: disputeTarget.reservationKey,
      event_id: disputeTarget.eventId,
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
              Your tickets and reservations in one place.{' '}
              <Link to="/my-disputes" className="text-primary font-semibold hover:underline">
                My disputes
              </Link>
            </p>

            <div className="mt-5 flex items-end justify-between border-b border-white/10">
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => setFilter('upcoming')}
                  className={`relative pb-3 text-sm font-semibold transition-colors ${
                    filter === 'upcoming' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Upcoming
                  {filter === 'upcoming' ? (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('past')}
                  className={`relative pb-3 text-sm font-semibold transition-colors ${
                    filter === 'past' ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Past
                  {filter === 'past' ? (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500" />
                  ) : null}
                </button>
              </div>
              {filter === 'past' && filteredBookings.length > 0 && (
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
          </header>

          {loading ? (
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
            <>
              {actionMsg ? (
                <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {actionMsg}
                </div>
              ) : null}
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

                return (
                  <article
                    key={booking.bookingId}
                    className="flex cursor-pointer flex-wrap gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 hover:shadow-[0_0_28px_-8px_rgba(236,72,153,0.22)] md:items-start"
                    onClick={() => navigate(`/my-bookings/${booking.bookingId}`)}
                  >
                    {/* Thumbnail */}
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
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
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-white">{booking.eventName}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {formatDateLine(booking.eventDate)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {booking.venue || 'Venue not set'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
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
                    <div className="ml-auto flex shrink-0 flex-col items-end justify-between gap-3 self-stretch py-0.5 md:ml-0">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </span>
                      {filter === 'past' ? (
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
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/25" />
                      )}
                    </div>

                    {filter === 'past' && booking.reservationKey ? (
                      <div
                        className="w-full basis-full border-t border-white/10 pt-3"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {(() => {
                            const r = booking.reservationKey ? ratings[booking.reservationKey] ?? 0 : 0
                            if (r > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  You rated {r}/5
                                </span>
                              )
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMsg(null)
                                  setRateTarget(booking)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                              >
                                <Star className="h-3.5 w-3.5" />
                                Rate event
                              </button>
                            )
                          })()}
                          {booking.clubId ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActionMsg(null)
                                setDisputeTarget(booking)
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              File dispute
                            </button>
                          ) : null}
                        </div>
                        {!booking.clubId && booking.reservationKey ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Disputes need a venue on the event record.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </section>
            </>
          )}
        </div>
      </main>

      {rateTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setRateTarget(null)}
        >
          <div
            role="dialog"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14141c] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Rate this event</h2>
            <p className="mt-1 text-sm text-muted-foreground">{rateTarget.eventName}</p>
            <div className="mt-4 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRateStars(n)}
                  className={`rounded p-1 text-2xl ${n <= rateStars ? 'text-amber-400' : 'text-white/20'}`}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">Comment (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              rows={3}
              value={rateComment}
              onChange={e => setRateComment(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={rateBusy || rateStars < 1}
                onClick={() => void submitRating()}
                className="flex-1 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {rateBusy ? 'Saving…' : 'Submit rating'}
              </button>
              <button
                type="button"
                onClick={() => setRateTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-muted-foreground"
              >
                Cancel
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
            <p className="mt-2 text-xs font-semibold text-muted-foreground">Priority</p>
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
            />
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={disputeDescription}
              onChange={e => setDisputeDescription(e.target.value)}
            />
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
