import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Music,
  Share2,
  User,
  Users,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import type { Event } from '@/types'
import { cn } from '@/lib/utils'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'

function eventNeedsTicket(ev: Event): boolean {
  if (ev.ticketRequired === false) return false
  if (ev.ticketRequired === true) return true
  return ev.price > 0
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
  const { events, loading } = useCatalog()
  const { user } = useAuth()
  const { isSaved, saveEvent, removeEvent } = useSavedEvents()
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const resolvedId = (id ?? eventId ?? '').trim()
  const fromCatalog = useMemo(
    () => (resolvedId ? events.find((e) => e.id === resolvedId) : undefined),
    [events, resolvedId],
  )

  useEffect(() => {
    if (!id && !eventId) {
      navigate('/', { replace: true })
    }
  }, [id, eventId, navigate])

  const saved =
    user && fromCatalog ? isSaved(fromCatalog.id) : false

  async function toggleSave() {
    if (!fromCatalog) return
    if (!user) {
      navigate('/login')
      return
    }
    if (saved) await removeEvent(fromCatalog.id)
    else await saveEvent(fromCatalog.id)
  }

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: fromCatalog?.title, url })
      } catch {
        /* dismissed */
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  function primaryAction() {
    if (!fromCatalog) return
    if (eventNeedsTicket(fromCatalog)) {
      navigate('/payment', { state: { event: fromCatalog } })
    } else if (fromCatalog.clubId) {
      navigate(`/club/${encodeURIComponent(fromCatalog.clubId)}`)
    } else {
      navigate('/search')
    }
  }

  function openMaps(address: string) {
    const q = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
  }

  if (!resolvedId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="po-container py-20 text-center text-muted-foreground">
          Redirecting…
        </div>
        <LovableFooter />
      </div>
    )
  }

  if (loading && !fromCatalog) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <EventPageSkeleton />
        <LovableFooter />
      </div>
    )
  }

  if (!fromCatalog) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="po-container flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-muted-foreground">We couldn&apos;t find that event.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
        <LovableFooter />
      </div>
    )
  }

  const ev = fromCatalog
  const needsTicket = eventNeedsTicket(ev)
  const venueLine = [ev.club && ev.club !== '—' ? ev.club : '', ev.city]
    .filter(Boolean)
    .join(' · ')
  const venueAddress =
    ev.address?.trim() ||
    [ev.city, ev.club && ev.club !== '—' ? ev.club : ''].filter(Boolean).join(', ')
  const musicLine =
    ev.musicType && ev.musicType !== '—' ? ev.musicType : 'Live event'
  const priceLabel =
    ev.price > 0
      ? `From ${ev.currency ?? '€'}${ev.price}`
      : 'Free entry'
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pb-16 pt-4 md:pt-8">
        <div className="po-container">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-6 h-10 w-10 rounded-full border border-border/50 text-muted-foreground hover:text-foreground"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start lg:gap-12">
            {/* Image */}
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

            {/* Details */}
            <div className="flex min-w-0 flex-col gap-8">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {ev.title}
                </h1>
                <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground md:text-base">
                  <li className="flex gap-3">
                    <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary/80" />
                    <span className="text-foreground/90">{ev.date}</span>
                  </li>
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
                <p className="text-lg font-bold text-foreground md:text-xl">
                  {priceLabel}
                </p>
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
                      <ExternalLink className="h-3.5 w-3.5" />
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

      <LovableFooter />
    </div>
  )
}
