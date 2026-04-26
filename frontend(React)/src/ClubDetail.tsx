import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Bookmark,
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
} from 'lucide-react'
import { getJson } from '@/api'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { ClubDetailVenueMap } from '@/components/ClubDetailVenueMap'
import { ClubCoverImage } from '@/components/ClubCoverImage'
import { cn } from '@/lib/utils'
import type { Club, ClubPagePayload, Event, Promotion } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { clubVenueDetailPath } from '@/components/ClubsSection'

const SAVED_CLUBS_KEY = 'partyon_saved_club_ids_v1'

const FALLBACK_CLUB_HERO =
  'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef8?w=1600&q=80'

const FALLBACK_PROMO_IMAGE =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80'

const FALLBACK_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80'

const MOSAIC_OVERLAY =
  'linear-gradient(180deg, transparent 0%, transparent 60%, rgba(0,0,0,0.6) 100%)'

const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/35 bg-black/35 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 ease-in-out hover:border-transparent hover:bg-gradient-to-r hover:from-[hsl(var(--primary))] hover:to-[hsl(var(--accent))] hover:text-white hover:shadow-[0_0_20px_hsl(var(--primary)/0.25)]'

const btnPrimaryGradient =
  'inline-flex items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-300 ease-in-out hover:opacity-95'

function readSavedClubIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_CLUBS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.map(String))
  } catch {
    return new Set()
  }
}

function writeSavedClubIds(ids: Set<string>) {
  try {
    localStorage.setItem(SAVED_CLUBS_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

function googleMapsVenueUrl(
  lat: number | undefined,
  lng: number | undefined,
  address?: string,
  city?: string,
): string {
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  const q = [address, city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'Venue')}`
}

function formatValidUntilShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function PromoGridImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState(src)
  useEffect(() => {
    setUrl(src)
  }, [src])
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setUrl(FALLBACK_PROMO_IMAGE)}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  )
}

function ClubDetailEventCard({ event }: { event: Event }) {
  const [imgSrc, setImgSrc] = useState(event.imageUrl)
  useEffect(() => {
    setImgSrc(event.imageUrl)
  }, [event.imageUrl])

  const dateBadge =
    event.dateShort?.trim() ||
    (event.date.includes('·') ? event.date.split('·')[0]?.trim() : event.date) ||
    event.date

  return (
    <div className="flex h-[460px] w-full flex-col overflow-hidden rounded-xl border border-border/30 bg-card transition-all duration-300 ease-in-out hover:border-primary/30">
      <div className="relative h-[210px] w-full shrink-0 overflow-hidden bg-muted/20">
        <Link to={`/event/${event.id}`} className="relative block h-full w-full">
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            onError={() => setImgSrc(FALLBACK_EVENT_IMAGE)}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <span className="absolute left-3 top-3 z-10 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {dateBadge}
          </span>
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Link to={`/event/${event.id}`} className="text-inherit no-underline">
          <h3 className="font-display line-clamp-2 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:text-primary">
            {event.title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {event.currency}
            {event.price.toFixed(2)}
            {event.currency === '€' ? ' EUR' : ''}
          </p>
          {event.club && event.club !== '—' ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.club}</p>
          ) : null}
        </Link>
        <div className="mt-auto pt-4">
          <Link
            to={`/event/${event.id}`}
            className="flex w-full items-center justify-center rounded-full border border-primary/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary transition-all duration-300 ease-in-out hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]"
          >
            View Event
          </Link>
        </div>
      </div>
    </div>
  )
}

type ChipDef = {
  key: string
  icon: typeof MapPin
  label: string
  value: string
  href?: string
}

function quickChipActionLabel(key: string): string {
  if (key === 'addr') return 'Open in Google Maps'
  if (key === 'phone') return 'Call this number'
  if (key === 'email') return 'Send email'
  if (key === 'web') return 'Open website'
  return 'Open link'
}

function QuickChipRow({ chip }: { chip: ChipDef }) {
  const Icon = chip.icon
  const isHttp = Boolean(chip.href?.startsWith('http'))

  const innerClass =
    'flex min-h-[4.5rem] w-full min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-3 text-inherit transition-colors duration-300 ease-in-out hover:bg-white/[0.06]'

  return (
    <div className={innerClass}>
      <Icon className="h-4 w-4 shrink-0 text-primary/85" aria-hidden />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {chip.label}
        </p>
        <p className="mt-0.5 cursor-text select-text break-words text-sm font-semibold text-white">
          {chip.value}
        </p>
      </div>
      {chip.href ? (
        <a
          href={chip.href}
          {...(isHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-primary"
          aria-label={quickChipActionLabel(chip.key)}
        >
          {chip.key === 'web' && isHttp ? (
            <ExternalLink className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </a>
      ) : null}
    </div>
  )
}

export default function ClubDetail() {
  const { club_id: clubIdParam } = useParams<{ club_id: string }>()
  const clubId = clubIdParam?.trim() ?? ''
  const navigate = useNavigate()
  const { user } = useAuth()
  const { clubs: catalogClubs } = useCatalog()

  const [page, setPage] = useState<ClubPagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [heroSrc, setHeroSrc] = useState(FALLBACK_CLUB_HERO)
  const [savedClubIds, setSavedClubIds] = useState<Set<string>>(readSavedClubIds)

  const load = useCallback(async () => {
    if (!clubId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await getJson<ClubPagePayload>(
      `/catalog/clubs/${encodeURIComponent(clubId)}`,
    )
    if (err) {
      setPage(null)
      setError(err)
    } else if (data) {
      setPage(data)
      setHeroSrc(data.club.imageUrl?.trim() || FALLBACK_CLUB_HERO)
    }
    setLoading(false)
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load])

  const club: Club | undefined = page?.club

  const similarClubs = useMemo((): Club[] => {
    if (!club) return []
    const others = catalogClubs.filter((c) => c.id !== club.id)
    const sameCity = club.city?.trim()
      ? others.filter(
          (c) =>
            c.city?.trim().toLowerCase() === club.city?.trim().toLowerCase(),
        )
      : []
    const pool = sameCity.length >= 3 ? sameCity : others
    return pool.slice(0, 3)
  }, [catalogClubs, club])

  const latN = club != null ? Number(club.club_lat) : NaN
  const lngN = club != null ? Number(club.club_lng) : NaN
  const hasCoords =
    club != null && Number.isFinite(latN) && Number.isFinite(lngN)

  const mapsUrl = useMemo(
    () =>
      club
        ? googleMapsVenueUrl(
            hasCoords ? latN : undefined,
            hasCoords ? lngN : undefined,
            club.address,
            club.city,
          )
        : '#',
    [club, hasCoords, latN, lngN],
  )

  const chips: ChipDef[] = []
  if (club?.address?.trim()) {
    chips.push({
      key: 'addr',
      icon: MapPin,
      label: 'Address',
      value: club.address.trim(),
      href: googleMapsVenueUrl(
        hasCoords ? latN : undefined,
        hasCoords ? lngN : undefined,
        club.address,
        club.city,
      ),
    })
  }
  if (club?.openingHours?.trim()) {
    chips.push({
      key: 'hours',
      icon: Clock,
      label: 'Opening hours',
      value: club.openingHours.trim(),
    })
  }
  if (club?.phone?.trim()) {
    const p = club.phone.trim()
    chips.push({
      key: 'phone',
      icon: Phone,
      label: 'Phone',
      value: p,
      href: `tel:${p.replace(/\s+/g, '')}`,
    })
  }
  if (club?.email?.trim()) {
    const em = club.email.trim()
    chips.push({
      key: 'email',
      icon: Mail,
      label: 'Email',
      value: em,
      href: `mailto:${em}`,
    })
  }
  if (club?.website?.trim()) {
    const w = club.website.trim()
    chips.push({
      key: 'web',
      icon: Globe,
      label: 'Website',
      value: w.replace(/^https?:\/\//i, ''),
      href: w.startsWith('http') ? w : `https://${w}`,
    })
  }

  const events: Event[] = page?.events ?? []
  const promotions: Promotion[] = page?.promotions ?? []

  const venueLine = [club?.city, club?.address].filter((s) => s?.trim()).join(' · ')

  const showRating =
    club != null &&
    typeof club.rating === 'number' &&
    Number.isFinite(club.rating)

  const showCategory = Boolean(club?.venueType?.trim())

  const toggleSaveClub = () => {
    if (!club) return
    if (!user) {
      const returnPath = `/clubs/${clubId}`
      navigate(`/login?from=${encodeURIComponent(returnPath)}`)
      return
    }
    setSavedClubIds((prev) => {
      const next = new Set(prev)
      if (next.has(club.id)) next.delete(club.id)
      else next.add(club.id)
      writeSavedClubIds(next)
      return next
    })
  }
  const clubSaved = Boolean(user && club && savedClubIds.has(club.id))

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground">
      <Navbar />

      {loading && !club ? (
        <main className="po-container py-24 text-center text-muted-foreground">
          Loading venue…
        </main>
      ) : null}

      {!loading && error ? (
        <main className="po-container py-24 text-center">
          <p className="text-destructive">{error}</p>
          <button type="button" className={cn(btnGhost, 'mt-6')} onClick={() => navigate('/')}>
            Back to home
          </button>
        </main>
      ) : null}

      {!loading && !error && !club ? (
        <main className="po-container py-24 text-center text-muted-foreground">
          <p>We couldn&apos;t find that venue.</p>
          <button type="button" className={cn(btnGhost, 'mt-6')} onClick={() => navigate('/')}>
            Back to home
          </button>
        </main>
      ) : null}

      {club ? (
        <main>
          {/* Hero */}
          <section className="relative h-[500px] w-full overflow-hidden bg-black">
            <img
              src={heroSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              onError={() => setHeroSrc(FALLBACK_CLUB_HERO)}
            />
            <div
              className="pointer-events-none absolute inset-0 z-[0] bg-gradient-to-t from-black via-black/55 to-transparent"
              aria-hidden
            />
            <div className="relative z-[1] flex h-full flex-col pt-20">
              <div className="po-container flex flex-1 flex-col pb-10">
                <div className="flex shrink-0 items-start justify-between gap-4">
                  <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => navigate(-1)}>
                    ← Back
                  </button>
                  <button
                    type="button"
                    className={cn(btnGhost, 'shrink-0')}
                    aria-label={clubSaved ? 'Remove saved venue' : 'Save venue'}
                    title="Sign in to save this venue to your list."
                    onClick={toggleSaveClub}
                  >
                    <Bookmark className={cn('h-4 w-4', clubSaved && 'fill-current text-primary')} />
                    <span className="hidden sm:inline">{clubSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
                <div className="mt-auto max-w-2xl space-y-3">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                    {club.name}
                  </h1>
                  {venueLine ? (
                    <p className="text-sm text-neutral-400 md:text-base">{venueLine}</p>
                  ) : null}
                  {(showRating || showCategory) && (
                    <div className="flex flex-wrap items-center gap-3">
                      {showRating ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {club.rating!.toFixed(1)}
                        </span>
                      ) : null}
                      {showCategory ? (
                        <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                          {club.venueType!.trim()}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {chips.length > 0 ? (
            <section className="border-t border-primary/20 bg-[#0d0d0f]">
              <div className="po-container py-6 md:py-8">
                <div className="flex flex-col divide-y divide-white/10 sm:flex-row sm:divide-y-0 sm:divide-x sm:divide-white/10">
                  {chips.map((c) => (
                    <div key={c.key} className="min-w-0 flex-1 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                      <QuickChipRow chip={c} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className="po-container border-t border-primary/20">
            <div className="flex flex-col divide-y divide-primary/20">
              {club.description?.trim() ? (
                <section className="py-10">
                  <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                    About This Venue
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    {club.description.trim()}
                  </p>
                </section>
              ) : null}

              <section className="py-10">
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                  Upcoming Events
                </h2>
                {events.length === 0 ? (
                  <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-muted-foreground">
                    <Calendar className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.25} />
                    <p>No upcoming events right now.</p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
                      events.length === 1 && 'sm:justify-items-start',
                    )}
                  >
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className={cn('w-full', events.length === 1 && 'max-w-sm')}
                      >
                        <ClubDetailEventCard event={event} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {promotions.length > 0 ? (
                <section className="py-10">
                  <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                    Current Promotions
                  </h2>
                  <div
                    className={cn(
                      'mt-6 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3',
                      promotions.length === 1 && 'sm:justify-items-start',
                    )}
                  >
                    {promotions.map((promo) => (
                      <div
                        key={promo.id}
                        className={cn('w-full', promotions.length === 1 && 'max-w-sm')}
                      >
                        <Link
                          to={`/promotions/offer/${encodeURIComponent(promo.id)}`}
                          className="group flex w-full flex-col overflow-hidden rounded-xl border border-border/30 bg-card text-inherit no-underline transition-all duration-300 ease-in-out hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
                            <PromoGridImage src={promo.image} alt={promo.title} />
                            {promo.badge?.trim() ? (
                              <span
                                className={`absolute left-3 top-3 z-10 ${promo.badgeColor} rounded-full px-3 py-1 text-xs font-bold text-white`}
                              >
                                {promo.badge.trim()}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-col p-4">
                            <div>
                              <h3 className="font-display line-clamp-2 font-bold text-foreground">
                                {promo.title}
                              </h3>
                              {promo.description?.trim() ? (
                                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                  {promo.description.trim()}
                                </p>
                              ) : null}
                            </div>
                            <div className="mt-3 flex shrink-0 items-center justify-between gap-2 text-sm">
                              {(() => {
                                const v = promo.venue?.trim()
                                const hasVenue = Boolean(v && v !== '—')
                                const hasCity = Boolean(promo.city?.trim())
                                if (!hasVenue && !hasCity) {
                                  return <span className="min-w-0 flex-1" />
                                }
                                return (
                                  <span className="truncate pr-2 text-muted-foreground">
                                    {hasVenue ? v : ''}
                                    {hasVenue && hasCity ? ' • ' : ''}
                                    {hasCity ? promo.city : ''}
                                  </span>
                                )
                              })()}
                              <span className="flex shrink-0 items-center gap-1 text-yellow-400">
                                <Star className="h-3.5 w-3.5 fill-current" />
                                {promo.rating.toFixed(1)}
                              </span>
                            </div>
                            {promo.validUntil ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Valid until{' '}
                                <span className="font-medium text-foreground/90">
                                  {formatValidUntilShort(promo.validUntil)}
                                </span>
                              </p>
                            ) : null}
                            <div className="mt-auto pt-4">
                              <span className="flex w-full items-center justify-center rounded-full border border-primary/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]">
                                View Offer
                              </span>
                            </div>
                          </div>
                        </Link>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {(hasCoords ||
              club.address?.trim() ||
              club.city?.trim()) && (
              <section className="py-10">
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Find Us</h2>
                <div
                  className={cn(
                    'mt-6 grid gap-6',
                    hasCoords && 'lg:grid-cols-[1.1fr_0.9fr] lg:items-start',
                  )}
                >
                  {hasCoords ? (
                    <div className="min-w-0">
                      <ClubDetailVenueMap
                        club_lat={latN}
                        club_lng={lngN}
                        name={club.name}
                      />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      'flex flex-col gap-5 rounded-xl border border-border/30 bg-card/40 p-6',
                      !hasCoords && 'max-w-xl',
                    )}
                  >
                    {club.address?.trim() || club.city?.trim() ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Address
                        </p>
                        <p className="mt-1 cursor-text select-text text-lg font-semibold text-white">
                          {[club.address, club.city].filter((s) => s?.trim()).join(', ')}
                        </p>
                      </div>
                    ) : null}
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btnPrimaryGradient}
                    >
                      Open in Google Maps
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </section>
            )}

            {similarClubs.length > 0 ? (
              <section className="py-10">
                <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                  More Venues You Might Like
                </h2>
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {similarClubs.map((c) => (
                    <Link
                      key={c.id}
                      to={clubVenueDetailPath(c.id)}
                      className={cn(
                        'group relative isolate flex h-[200px] w-full overflow-hidden rounded-[10px]',
                        'bg-black outline-none transition-[box-shadow,transform] duration-300 ease-in-out',
                        'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_20px_-4px_rgba(255,255,255,0.12)]',
                        'focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                      )}
                    >
                      <ClubCoverImage
                        src={c.imageUrl}
                        alt={c.name}
                        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-in-out group-hover:scale-[1.03]"
                      />
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: MOSAIC_OVERLAY }}
                        aria-hidden
                      />
                      <div className="relative z-[1] mt-auto flex flex-col gap-0.5 p-2.5">
                        <h3 className="text-left text-[13px] font-bold leading-snug text-white">
                          {c.name}
                        </h3>
                        {c.city?.trim() ? (
                          <span className="text-left text-[11px] text-neutral-400">{c.city}</span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            </div>
          </div>
        </main>
      ) : null}

      <LovableFooter />
    </div>
  )
}
