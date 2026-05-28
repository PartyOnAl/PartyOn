
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  Heart,
  MapPin,
  Music,
  Share2,
  Star,
  User,
  Users,
} from 'lucide-react'
import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'
import { useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import { getJson } from '@/api'
import { eventNeedsTicket, isReservationFlow } from '@/lib/eventCheckout'
import type { Event, EventDetail } from '@/types'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'

function EventBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group -ml-1 mb-4 inline-flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-0 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
      <span>Back</span>
    </button>
  )
}

function EventPageSkeleton() {
  return (
    <main className="pb-16 pt-20">
      <div className="po-container animate-pulse">
      <div className="mb-4 h-5 w-14 rounded bg-muted" />
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
    </main>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.65-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 10.5 15 7.5M8.5 13.5 15 16.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ExternalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M14 3h7v7M10 14L21 3M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TicketSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M16.36 3.2c-.35.4-1.22 1.35-2.3 1.33-.12-1.12.58-2.23.98-2.65.48-.52 1.88-1.1 2.62-.92-.1.85-.52 1.67-1.3 2.24zm1.6 2.55c-1.45-.09-2.68.82-3.37.82-.72 0-1.82-.78-3-.76-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.42 6.9 1.15 9.17.76 1.1 1.67 2.34 2.87 2.3 1.15-.05 1.58-.74 2.96-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.02-1.12 2.78-2.24.88-1.28 1.24-2.52 1.26-2.58-.02-.02-2.42-.93-2.44-3.68-.02-2.35 1.88-3.48 1.97-3.54-1.08-1.58-2.75-1.76-3.35-1.8z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M3 3v18l15-9L3 3z" />
    </svg>
  )
}

function formatEventDate(dateString?: string | null) {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

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

export default function EventClicked() {
  const { id, eventId } = useParams<{ id?: string; eventId?: string }>()
  const navigate = useNavigate()

  const { events: catalogEvents = [], loading: catalogLoading = false } = useCatalog() as {
    events?: Event[]
    loading?: boolean
  }

  const { user } = useAuth()
  const { isSaved, saveEvent, removeEvent } = useSavedEvents()

  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const resolvedId = (id ?? eventId ?? '').trim()

  const fromCatalog = useMemo(
    () => (resolvedId ? catalogEvents.find((e) => String(e.id) === resolvedId) : undefined),
    [catalogEvents, resolvedId],
  )

  useEffect(() => {
    if (!resolvedId) return

    setDetailLoading(true)
    getJson<EventDetail>(`/catalog/events/${resolvedId}`)
      .then(({ data }) => {
        if (data) setDetail(data)
      })
      .finally(() => setDetailLoading(false))
  }, [resolvedId])

  const ev = (detail ?? fromCatalog) as EventDetail | undefined
  const loading = detailLoading && !ev && catalogLoading
  const ticketTypes = detail?.ticketTypes ?? []

  const saved = user && ev ? isSaved(ev.id) : false

  async function toggleSave() {
    if (!ev) return
    if (!user) {
      navigate('/login')
      return
    }
    if (saved) await removeEvent(ev.id)
    else await saveEvent(ev.id)
  }

  async function share() {
    if (!ev) return

    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.title, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {
      // dismissed or unavailable
    }
  }

  function primaryAction() {
    if (!ev) return

    const eid = String(ev.id ?? '').trim()
    if (!eid || eid === 'undefined') return

    if (!user) {
      navigate(`/login?from=${encodeURIComponent(`/event/${eid}`)}`)
      return
    }

    if (isReservationFlow(ev)) {
      navigate(`/reserve/${encodeURIComponent(eid)}`, { state: { event: ev } })
      return
    }

    navigate(`/payment/${encodeURIComponent(eid)}`, {
      state: { event: ev, ticketTypes },
    })
  }

  function openMaps(address: string) {
    const q = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
  }

  if (!resolvedId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="po-container py-20 pt-20 text-center text-muted-foreground">
          Redirecting…
        </main>
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
        <main className="po-container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 pt-20 text-center">
          <p className="text-muted-foreground">We couldn&apos;t find that event.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Home
          </Button>
        </main>
        <LovableFooter />
      </div>
    )
  }

  const needsTicket = eventNeedsTicket(ev)

  const venueLine = [ev.club && ev.club !== '—' ? ev.club : '', ev.city]
    .filter(Boolean)
    .join(' · ')

  const venueAddress =
    detail?.clubFullAddress?.trim() ||
    ev.address?.trim() ||
    [ev.city, ev.club && ev.club !== '—' ? ev.club : ''].filter(Boolean).join(', ')

  const musicLine = ev.musicType && ev.musicType !== '—' ? ev.musicType : 'Live event'

  const priceLabel =
    needsTicket && ev.price > 0
      ? `From ${ev.currency ?? '€'}${ev.price.toFixed(2)}`
      : needsTicket
        ? 'Free entry'
        : 'Free reservation'

  const chipAge = ev.ageRestriction?.trim() || '—'
  const chipHost = ev.organizer?.trim() || 'PartyOn'

  const doorsText =
    ev.doorsOpen != null && String(ev.doorsOpen).trim()
      ? `Doors open: ${String(ev.doorsOpen).trim()}`
      : null

  const about =
    ev.description?.trim() ||
    'Details for this night will appear here when the organizer adds a full description.'

  const aboutLong = about.length > 220

  const imgSrc = ev.imageUrl?.trim() || FALLBACK_IMG
  const dateLine = formatEventDate(ev.rawDate ?? ev.date)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pb-16 pt-20">
        <div className="po-container">
          <EventBackButton onClick={() => navigate(-1)} />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start lg:gap-12">
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="aspect-[4/3] w-full sm:aspect-[16/10] lg:aspect-square">
                <img
                  src={imgSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).src = FALLBACK_IMG
                  }}
                />
              </div>
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                aria-hidden
              />
              {ev.isFeatured ? (
                <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-md backdrop-blur-sm">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Featured
                </div>
              ) : null}
              <div className="absolute right-3 top-3 flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={cn(
                    'h-10 w-10 rounded-full border-0 bg-black/50 text-white backdrop-blur-md hover:bg-black/65',
                    saved && 'text-pink-400',
                  )}
                  aria-label={saved ? 'Remove from saved' : 'Save event'}
                  onClick={() => void toggleSave()}
                >
                  <Heart
                    className={cn('h-4 w-4', saved && 'fill-current')}
                    strokeWidth={1.75}
                  />
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

            <div className="flex min-w-0 flex-col gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {ev.title}
                  </h1>
                  {ev.isFeatured ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                      <Star className="h-3 w-3 fill-current" />
                      Featured
                    </span>
                  ) : null}
                </div>
                <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground md:text-base">
                  {dateLine ? (
                    <li className="flex gap-3">
                      <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">{dateLine}</span>
                    </li>
                  ) : null}
                  {venueLine ? (
                    <li className="flex gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary/80" />
                      <span className="text-foreground/90">{venueLine}</span>
                    </li>
                  ) : null}
                  <li className="flex gap-3">
                    <Music className="mt-0.5 h-5 w-5 shrink-0 text-primary/80" />
                    <span className="text-foreground/90">{musicLine}</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-sm backdrop-blur-sm md:p-6">
                <p className="text-lg font-bold text-foreground md:text-xl">{priceLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {needsTicket
                    ? 'No hidden fees. Final price shown upfront.'
                    : 'No ticket purchase on PartyOn for this event — reserve with the venue.'}
                </p>
                <Button
                  type="button"
                  className="mt-5 w-full rounded-full gradient-primary py-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95"
                  onClick={primaryAction}
                >
                  {needsTicket ? 'Buy now' : 'Reserve a table'}
                </Button>
              </div>

              <section>
                <h2 className="text-lg font-semibold text-foreground">About</h2>
                <p
                  className={cn(
                    'mt-3 text-sm leading-relaxed text-muted-foreground md:text-base',
                    !aboutExpanded && aboutLong && 'line-clamp-3',
                  )}
                >
                  {about}
                </p>
                {aboutLong ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    onClick={() => setAboutExpanded((o) => !o)}
                  >
                    {aboutExpanded ? 'Show less' : 'Read more'}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        aboutExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                ) : null}

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-4 text-center">
                    <User className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{chipAge}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-4 text-center">
                    <Music className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{musicLine}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/30 px-4 py-4 text-center">
                    <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{chipHost}</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-foreground">Venue</h2>
                <div className="mt-4 rounded-2xl border border-border/50 bg-card/30 p-5 md:p-6">
                  <h3 className="text-base font-bold text-foreground">
                    {ev.club && ev.club !== '—' ? ev.club : 'Venue'}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {venueAddress || 'Address coming soon.'}
                  </p>
                  {venueAddress ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-2 rounded-full border-border/60"
                      onClick={() => openMaps(venueAddress)}
                    >
                      Open in Maps
                      <ExternalIcon className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {doorsText ? (
                    <>
                      <hr className="my-4 border-border/40" />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>{doorsText}</span>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <section
        className="relative overflow-hidden border-t border-border/30 bg-[#07070f] py-20 md:py-28"
        aria-labelledby="app-heading"
      >
        <div
          className="pointer-events-none absolute -left-60 top-1/4 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[140px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-60 bottom-0 h-[600px] w-[600px] rounded-full bg-accent/10 blur-[140px]"
          aria-hidden
        />

        <div className="po-container relative z-10 flex flex-col items-center text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            PartyOn App
          </span>

          <h2
            id="app-heading"
            className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-[3.25rem]"
          >
            Your nightlife,{' '}
            <span className="gradient-text">always in your pocket</span>
          </h2>

          <p className="mx-auto mt-5 max-w-[440px] text-base leading-relaxed text-muted-foreground">
            Discover the best nights, manage your tickets, and reserve tables — all in one place.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 active:scale-[0.98] [&_svg]:h-[18px] [&_svg]:w-[18px]"
            >
              <AppleIcon />
              Download on iOS
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10 active:scale-[0.98] [&_svg]:h-[18px] [&_svg]:w-[18px]"
            >
              <PlayIcon />
              Get it on Android
            </button>
          </div>

          <div className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white [&_svg]:h-5 [&_svg]:w-5">
                <HeartIcon />
              </div>
              <p className="text-sm font-semibold text-white">Save events</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Track your favourite nights all in one place.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white [&_svg]:h-5 [&_svg]:w-5">
                <ShareIcon />
              </div>
              <p className="text-sm font-semibold text-white">Share instantly</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Send lineups and tickets to your crew in seconds.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white [&_svg]:h-5 [&_svg]:w-5">
                <TicketSmallIcon />
              </div>
              <p className="text-sm font-semibold text-white">Easy tickets</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                QR check-in at the door — zero hassle.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white [&_svg]:h-5 [&_svg]:w-5">
                <UsersIcon />
              </div>
              <p className="text-sm font-semibold text-white">Go together</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Coordinate plans and table bookings with friends.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LovableFooter />
    </div>
  )
}
