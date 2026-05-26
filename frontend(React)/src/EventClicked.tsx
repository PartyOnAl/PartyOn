import { useEffect, useState } from 'react'
import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Music,
  Phone,
  Share2,
  Star,
  Users,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import { getJson } from '@/api'
import type { EventDetail } from '@/types'
import { cn } from '@/lib/utils'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'

function formatFullDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string | undefined, hoursText?: string): string {
  if (hoursText?.trim()) return hoursText.trim()
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function EventPageSkeleton() {
  return (
    <div className="po-container animate-pulse py-8 md:py-12">
      <div className="mb-8 h-10 w-10 rounded-full bg-muted" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
        <div className="aspect-[4/3] rounded-2xl bg-muted lg:aspect-square" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded-lg bg-muted" />
          <div className="h-4 w-full rounded bg-muted/80" />
          <div className="h-4 w-2/3 rounded bg-muted/80" />
          <div className="mt-8 h-40 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

export default function EventClicked() {
  const { id, eventId } = useParams<{ id?: string; eventId?: string }>()
  const navigate = useNavigate()
  const { events, loading: catalogLoading } = useCatalog()
  const { user } = useAuth()
  const { isSaved, saveEvent, removeEvent } = useSavedEvents()

  const resolvedId = (id ?? eventId ?? '').trim()

  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  // Catalog entry for quick display while detail loads
  const fromCatalog = resolvedId
    ? events.find((e) => e.id === resolvedId)
    : undefined

  useEffect(() => {
    if (!resolvedId) {
      navigate('/', { replace: true })
      return
    }
    setDetailLoading(true)
    getJson<EventDetail>(`/catalog/events/${resolvedId}`).then(({ data }) => {
      if (data) setDetail(data)
      setDetailLoading(false)
    })
  }, [resolvedId, navigate])

  const ev = detail ?? (fromCatalog as EventDetail | undefined)
  const loading = detailLoading && !ev && catalogLoading

  const saved = user && ev ? isSaved(ev.id) : false

  async function toggleSave() {
    if (!ev) return
    if (!user) { navigate('/login'); return }
    if (saved) await removeEvent(ev.id)
    else await saveEvent(ev.id)
  }

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: ev?.title, url }) } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  function primaryAction() {
    if (!ev) return
    const isReservation = ev.reservationOnly === true || ev.ticketRequired === false
    const eid = ev.id?.trim()
    if (!eid || eid === 'undefined') return
    if (!user) {
      navigate(`/login?from=${encodeURIComponent(`/event/${ev.id}`)}`)
      return
    }
    if (isReservation) {
      navigate(`/reserve/${encodeURIComponent(eid)}`, { state: { event: ev } })
    } else {
      navigate(`/payment/${encodeURIComponent(eid)}`, {
        state: { event: ev, ticketTypes },
      })
    }
  }

  function openMaps(address: string) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      '_blank',
    )
  }

  if (!resolvedId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="po-container py-20 text-center text-muted-foreground">Redirecting…</div>
        <LovableFooter />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <EventPageSkeleton />
        <LovableFooter />
      </div>
    )
  }

  if (!ev) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="po-container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-muted-foreground">We couldn&apos;t find that event.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
        </div>
        <LovableFooter />
      </div>
    )
  }

  const isReservation = ev.reservationOnly === true || ev.ticketRequired === false
  const ticketTypes = detail?.ticketTypes ?? []
  const priceLabel = isReservation
    ? 'Free reservation'
    : ev.price > 0
      ? `${ev.currency ?? '€'}${ev.price.toFixed(2)}`
      : 'Free entry'
  const ctaLabel = isReservation ? 'Reserve a table' : 'Buy ticket'

  const rawDate = ev.rawDate ?? ev.date
  const fullDate = formatFullDate(rawDate)
  const timeStr = formatTime(ev.rawDate, ev.doorsOpen)

  const venueAddress = detail?.clubFullAddress ?? ev.address ?? ev.city ?? ''
  const venueName = ev.club && ev.club !== '—' ? ev.club : 'Venue'
  const clubPhone = detail?.clubPhone

  const specialGuests =
    Array.isArray(ev.specialGuests) && ev.specialGuests.length > 0
      ? ev.specialGuests.join(', ')
      : typeof ev.specialGuests === 'string' && (ev.specialGuests as string).trim()
        ? (ev.specialGuests as string).trim()
        : null

  const about = ev.description?.trim() || null
  const aboutLong = (about?.length ?? 0) > 220
  const imgSrc = ev.imageUrl?.trim() || FALLBACK_IMG

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pb-16 pt-20">
        <div className="po-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start lg:gap-12">
            {/* Image */}
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-square">
                <img
                  src={imgSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG }}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden />
              {/* Back button — top-left overlay */}
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border-0 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              {ev.isFeatured ? (
                <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-md backdrop-blur-sm">
                  <Star className="h-3 w-3 fill-current" />
                  Featured
                </div>
              ) : null}
              <div className="absolute right-3 top-3 flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={cn('h-10 w-10 rounded-full border-0 bg-black/50 text-white backdrop-blur-md hover:bg-black/65', saved && 'text-pink-400')}
                  aria-label={saved ? 'Remove from saved' : 'Save event'}
                  onClick={() => void toggleSave()}
                >
                  <Heart className={cn('h-4 w-4', saved && 'fill-current')} strokeWidth={1.75} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full border-0 bg-black/50 text-white backdrop-blur-md hover:bg-black/65"
                  aria-label="Share"
                  onClick={() => void share()}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>
            </div>

            {/* Details */}
            <div className="flex min-w-0 flex-col gap-6">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {ev.title}
                </h1>
                {isReservation && (
                  <span className="mt-2 inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                    Reservation only
                  </span>
                )}
              </div>

              {/* Info block */}
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 md:p-5">
                <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                  {fullDate ? (
                    <li className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">{fullDate}</span>
                    </li>
                  ) : null}
                  {timeStr ? (
                    <li className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">{timeStr}</span>
                    </li>
                  ) : null}
                  {venueAddress || venueName ? (
                    <li className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">
                        {venueName !== 'Venue' ? `${venueName}` : ''}
                        {venueName !== 'Venue' && venueAddress ? ' · ' : ''}
                        {venueAddress}
                      </span>
                    </li>
                  ) : null}
                  {ev.musicType && ev.musicType !== '—' ? (
                    <li className="flex items-start gap-3">
                      <Music className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">{ev.musicType}</span>
                    </li>
                  ) : null}
                  {ev.capacity ? (
                    <li className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">Capacity: {ev.capacity.toLocaleString()}</span>
                    </li>
                  ) : null}
                  {specialGuests ? (
                    <li className="flex items-start gap-3">
                      <Star className="mt-0.5 h-4 w-4 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">Special guests: {specialGuests}</span>
                    </li>
                  ) : null}
                </ul>
              </div>


              {/* Price + CTA */}
              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-sm md:p-6">
                <p className="text-lg font-bold text-foreground md:text-xl">{priceLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isReservation
                    ? 'No payment required — reserve your spot with the venue.'
                    : 'No hidden fees. Final price shown upfront.'}
                </p>
                <Button
                  type="button"
                  className="mt-5 w-full rounded-full gradient-primary py-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95"
                  onClick={primaryAction}
                >
                  {ctaLabel}
                </Button>
              </div>

              {/* About */}
              {about ? (
                <section className="rounded-2xl border border-border/50 bg-card/30 p-5 md:p-6">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-foreground md:text-xl">
                    <AlignLeft className="h-4 w-4 shrink-0 text-primary/80" />
                    About
                  </h2>
                  <p
                    className={cn(
                      'mt-3 text-base leading-relaxed text-muted-foreground',
                      !aboutExpanded && aboutLong && 'line-clamp-3',
                    )}
                  >
                    {about}
                  </p>
                  {aboutLong ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      onClick={() => setAboutExpanded((o) => !o)}
                    >
                      {aboutExpanded ? 'Show less' : 'Read more'}
                    </button>
                  ) : null}
                </section>
              ) : null}

              {/* Venue */}
              <section className="rounded-2xl border border-border/50 bg-card/30 p-5 md:p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground md:text-xl">
                  <MapPin className="h-4 w-4 shrink-0 text-primary/80" />
                  Venue Information
                </h2>
                <h3 className="mt-3 text-lg font-bold text-foreground">{venueName}</h3>
                {venueAddress ? (
                  <p className="mt-1.5 text-[15px] text-muted-foreground">{venueAddress}</p>
                ) : null}
                {clubPhone ? (
                  <div className="mt-2 flex items-center gap-2 text-[15px] text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <span>{clubPhone}</span>
                  </div>
                ) : null}
                {venueAddress ? (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4 gap-2 rounded-full gradient-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95"
                    onClick={() => openMaps(venueAddress)}
                  >
                    Open in Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </main>

      <LovableFooter />
    </div>
  )
}
