import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, MapPin, ReceiptText, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { getAuthUser, isSupabaseConfigured, supabase } from '@/lib/supabase'

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
  if (s.includes('confirm') || s.includes('paid') || s.includes('success')) return 'confirmed'
  return 'pending'
}

function normalizeKind(type: string | null | undefined): 'ticket' | 'reservation' {
  const t = String(type ?? '').toLowerCase()
  return t.includes('reservation') || t.includes('table') ? 'reservation' : 'ticket'
}

export default function MyBookings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKind>('upcoming')
  const [bookings, setBookings] = useState<BookingItem[]>([])

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

      const merged: BookingItem[] = []

      // 1) Reservations (legacy schema shape)
      const { data: legacyReservations, error: legacyErr } = await supabase
        .from('reservations')
        .select(
          `reservation_id,reservation_date,nr_of_people,type,status,created_at,
           event:events(event_id,event_name,event_starting_date,event_image,club:clubs(club_name)),
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
          })
        }
      }

      // 2) Reservations (newer schema shape requested in project prompt)
      const { data: modernReservations, error: modernErr } = await supabase
        .from('reservations')
        .select(
          `id,number_of_people,time_slot,status,created_at,
           event:events(id,event_name,event_starting_date,event_image,club:clubs(club_name))`,
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
          })
        }
      }

      // 3) Tickets table (if project has it) and merge
      const { data: ticketRows, error: ticketErr } = await supabase
        .from('tickets')
        .select(
          `id,quantity,status,created_at,
           event:events(id,event_name,event_starting_date,event_image,club:clubs(club_name)),
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
    const now = new Date()
    return bookings.filter((booking) => {
      const bookingDate = booking.eventDate ? new Date(booking.eventDate) : null
      if (!bookingDate || Number.isNaN(bookingDate.getTime())) return filter === 'upcoming'
      return filter === 'upcoming' ? bookingDate >= now : bookingDate < now
    })
  }, [bookings, filter])

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

            <div className="mt-5 flex gap-6 border-b border-white/10">
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
                    className="grid cursor-pointer gap-4 rounded-2xl border border-white/10 bg-[#101016]/80 p-4 transition-[background-color,box-shadow,border-color] duration-200 hover:border-primary/25 hover:bg-[#15151c]/90 hover:shadow-[0_0_28px_-8px_rgba(236,72,153,0.22)] md:grid-cols-[112px_1fr_auto] md:items-center"
                    onClick={() => navigate(`/my-bookings/${booking.bookingId}`)}
                  >
                    <div className="h-24 w-28 overflow-hidden rounded-xl border border-white/10 bg-black/30">
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

                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-white">{booking.eventName}</h3>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {formatDateLine(booking.eventDate)}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="ml-1">{booking.venue || 'Venue not set'}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.ticketTypeName || (booking.kind === 'reservation' ? 'Reservation' : 'General Admission')}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                        {status[0].toUpperCase() + status.slice(1)}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClass}`}>
                        {booking.kind === 'reservation' ? 'RESERVATION' : 'TICKET'}
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-primary/45 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          )}
        </div>
      </main>
      <LovableFooter />
    </div>
  )
}
