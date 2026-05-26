import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  Gift,
  MapPin,
  Share2,
  Shield,
  Star,
  Tag,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { OfferVenueMap } from '@/components/OfferVenueMap'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import {
  buildPromotionOfferDetail,
  relatedOfferCards,
} from '@/lib/promotionOfferDetail'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&q=80'

const FALLBACK_TERMS =
  'Offer subject to availability, venue rules, and age restrictions. Non-transferable unless stated.\n\nPartyOn acts as a marketing and booking platform only. The venue is solely responsible for fulfilment, service quality, and compliance with local laws.\n\nCancellations follow the venue\'s policy. Abuse, resale, or fraudulent redemption may void the offer without refund.'

/** Clears fixed `Navbar` (h-16). */
const MAIN_TOP = 'pt-16'

function Separator() {
  return <div className="h-px w-full bg-border/30" role="separator" aria-hidden />
}

/** Pink pill label like %-off badges; normalizes “Free” → “FREE”. */
function promoDiscountPillLabel(badge: string) {
  const s = badge.trim()
  if (/^free$/i.test(s)) return 'FREE'
  return s
}

function stripLeadingEmoji(text: string) {
  return text.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim()
}

const heroGlassBtn =
  'rounded-full border border-white/15 bg-background/35 text-foreground shadow-sm backdrop-blur-md hover:border-primary hover:bg-primary hover:text-primary-foreground'

/** Outline Save/Share: dark pill by default; hover = thin pink border + soft glow (pill “corners”). */
const saveShareOutlineHoverGlow =
  'group h-11 flex-1 gap-2 rounded-full border border-border/50 bg-background/95 text-sm font-semibold text-foreground shadow-sm transition-[border-color,box-shadow,background-color,color] duration-200 hover:border-primary/35 hover:!bg-background hover:text-foreground hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]'

export default function PromotionOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { promotions, terms: globalTerms, loading } = useCatalog()
  const [saved, setSaved] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [claimedCode, setClaimedCode] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  const resolvedId = (offerId ?? '').trim()

  const offer = useMemo(
    () => (resolvedId ? buildPromotionOfferDetail(resolvedId, promotions) : null),
    [resolvedId, promotions],
  )

  const related = useMemo(
    () => (offer ? relatedOfferCards(offer.id, promotions, 3) : []),
    [offer, promotions],
  )

  // Load saved + claimed state from Supabase on mount / user change
  useEffect(() => {
    if (!user || !resolvedId || !supabase || !isSupabaseConfigured) return
    void supabase
      .from('saved_promotions')
      .select('promotion_id')
      .eq('user_id', user.id)
      .eq('promotion_id', resolvedId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
    void supabase
      .from('claimed_promotions')
      .select('redemption_code')
      .eq('user_id', user.id)
      .eq('promotion_id', resolvedId)
      .neq('status', 'cancelled')
      .maybeSingle()
      .then(({ data }) => setClaimedCode((data as { redemption_code: string } | null)?.redemption_code ?? null))
  }, [user, resolvedId])

  function requireAuthThen(go: () => void) {
    if (!user) {
      const from = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?from=${from}`, { state: { from: location.pathname + location.search } })
      return
    }
    go()
  }

  async function handleToggleSave() {
    if (!user) {
      const from = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?from=${from}`, { state: { from: location.pathname + location.search } })
      return
    }
    if (!supabase || !isSupabaseConfigured || !resolvedId) return
    setSavedLoading(true)
    if (saved) {
      await supabase.from('saved_promotions').delete()
        .eq('user_id', user.id).eq('promotion_id', resolvedId)
      setSaved(false)
    } else {
      await supabase.from('saved_promotions').insert({ user_id: user.id, promotion_id: resolvedId })
      setSaved(true)
    }
    setSavedLoading(false)
  }

  async function handleClaimOffer() {
    if (!offer) return
    if (!user) {
      const from = encodeURIComponent(location.pathname + location.search)
      navigate(`/login?from=${from}`, { state: { from: location.pathname + location.search } })
      return
    }
    // Already claimed — navigate to the offers tab in bookings
    if (claimedCode) {
      navigate('/my-bookings?tab=offers')
      return
    }
    if (!supabase || !isSupabaseConfigured) return
    setClaiming(true)
    const { data, error } = await supabase
      .from('claimed_promotions')
      .insert({ user_id: user.id, promotion_id: resolvedId })
      .select('redemption_code')
      .single()
    setClaiming(false)
    if (error) {
      // Unique violation = already claimed by this user; reload the existing code
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('claimed_promotions')
          .select('redemption_code')
          .eq('user_id', user.id)
          .eq('promotion_id', resolvedId)
          .neq('status', 'cancelled')
          .maybeSingle()
        if (existing) setClaimedCode((existing as { redemption_code: string }).redemption_code)
      }
      return
    }
    if (data) setClaimedCode((data as { redemption_code: string }).redemption_code)
  }

  async function shareOffer() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: offer?.title, url })
      } catch {
        /* dismissed */
      }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  if (!resolvedId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className={cn(MAIN_TOP, 'pb-20')}>
          <div className="po-container space-y-4 pt-20 text-center">
            <h1 className="text-3xl font-bold text-foreground">Invalid link</h1>
            <Button asChild variant="outline" className="rounded-full border-border/50">
              <Link to="/home#promotions">Browse offers</Link>
            </Button>
          </div>
        </main>
        <LovableFooter />
      </div>
    )
  }

  if (loading && !offer) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className={MAIN_TOP}>
          <div className="po-container animate-pulse pt-6">
            <div className="h-64 rounded-none bg-muted sm:h-80 md:h-96" />
          </div>
        </main>
        <LovableFooter />
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className={cn(MAIN_TOP, 'pb-20')}>
          <div className="po-container space-y-4 pt-20 text-center">
            <h1 className="text-3xl font-bold text-foreground">Offer not found</h1>
            <Button asChild variant="outline" className="rounded-full border-border/50">
              <Link to="/home#promotions">Browse All Offers</Link>
            </Button>
          </div>
        </main>
        <LovableFooter />
      </div>
    )
  }

  const savings = offer.savingsAmount
  const discountPct =
    offer.showPriceInSidebar && offer.originalPrice > 0
      ? Math.round((savings / offer.originalPrice) * 100)
      : 100

  const sidebarPriceLabel =
    offer.checkoutPrice === 0 && offer.originalPrice > 0
      ? 'Free Entry'
      : offer.checkoutPrice === 0
        ? 'FREE'
        : `${offer.currency}${offer.checkoutPrice}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className={MAIN_TOP}>
        <div className="po-container">
          {/* Hero — matches Lovable PromotionDetail (image + gradient + actions only) */}
          <section className="relative pt-5 md:pt-6">
            <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
              <img
                src={offer.image}
                alt={offer.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).src = FALLBACK_IMG
                }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
                aria-hidden
              />
              <div className="absolute left-6 top-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('gap-1', heroGlassBtn)}
                  onClick={() => navigate('/home#promotions')}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back
                </Button>
              </div>
              <div className="absolute right-6 top-6 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={heroGlassBtn}
                  aria-label={saved ? 'Saved' : 'Save offer'}
                  onClick={() => void handleToggleSave()}
                >
                  <Bookmark
                    className={cn(
                      'h-4 w-4',
                      saved && user && 'fill-primary text-primary',
                    )}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={heroGlassBtn}
                  aria-label="Share"
                  onClick={() => void shareOffer()}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          {/* Discount pills — keep above title; no negative margin on content below (avoids title overlapping badges). */}
          <div className="relative z-20 flex flex-wrap items-center gap-3 bg-background px-1 py-4 md:px-0">
            <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
              {promoDiscountPillLabel(offer.badge)}
            </span>
            <span className="rounded-full border border-border/50 bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground">
              {offer.category}
            </span>
          </div>

          <section className="relative z-10 pb-20 pt-2">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Main column */}
              <div className="space-y-8 lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
                    {offer.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                      {offer.venue} • {offer.city}
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star className="h-4 w-4 fill-current" aria-hidden />
                      {offer.rating.toFixed(1)}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-4 rounded-2xl border border-border/30 bg-card p-6"
                >
                  <h2 className="font-display text-xl font-bold text-foreground">
                    About This Offer
                  </h2>
                  <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                    {offer.description}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col gap-4 sm:flex-row sm:items-stretch"
                >
                  {/* What's Included */}
                  <div className="flex flex-1 flex-col rounded-2xl border border-border/30 bg-card p-5">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Gift className="h-4 w-4" aria-hidden />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">What&apos;s Included</p>
                    </div>
                    <div className="mt-4 h-px bg-[#ec4899]/20" aria-hidden />
                    <div className="min-w-0 pt-4">
                      <ul className="flex flex-col gap-2">
                        {offer.included.map((item, i) => (
                          <li key={i}>
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#ec4899]" aria-hidden />
                              <span className="whitespace-nowrap text-sm font-normal leading-5 text-white">
                                {stripLeadingEmoji(item)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Valid Until */}
                  <div className="flex flex-1 flex-col rounded-2xl border border-border/30 bg-card p-5">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Tag className="h-4 w-4" aria-hidden />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
                    </div>
                    <div className="mt-4 h-px bg-[#ec4899]/20" aria-hidden />
                    <div className="flex min-w-0 flex-1 items-center pt-4">
                      <p className="text-sm font-semibold leading-6 text-foreground">{offer.validUntilShort}</p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex flex-1 flex-col rounded-2xl border border-border/30 bg-card p-5">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <MapPin className="h-4 w-4" aria-hidden />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">Location</p>
                    </div>
                    <div className="mt-4 h-px bg-[#ec4899]/20" aria-hidden />
                    <div className="flex min-w-0 flex-1 items-center pt-4">
                      <p className="text-sm font-semibold leading-6 text-foreground">{offer.address}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="space-y-4 rounded-2xl border border-border/30 bg-card p-6"
                >
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
                    <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
                    Terms &amp; Conditions
                  </h2>
                  <ul className="space-y-2">
                    {(globalTerms ?? FALLBACK_TERMS)
                      .split(/\n+/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((term, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                            aria-hidden
                          />
                          {term}
                        </li>
                      ))}
                  </ul>
                </motion.div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="sticky top-24 space-y-6"
                >
                  <div className="space-y-5 rounded-2xl border border-border/30 bg-card p-6">
                    {offer.showPriceInSidebar ? (
                      <>
                        <div className="space-y-2 text-center">
                          {offer.checkoutPrice < offer.originalPrice ? (
                            <p className="text-lg text-muted-foreground line-through">
                              {offer.currency}
                              {offer.originalPrice}
                            </p>
                          ) : null}
                          <p className="text-4xl font-bold text-primary">
                            {sidebarPriceLabel}
                          </p>
                          {savings > 0 ? (
                            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                              You save {offer.currency}
                              {savings} ({discountPct}% off)
                            </span>
                          ) : null}
                        </div>

                        <Separator />
                      </>
                    ) : null}

                    {claimedCode && (
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-emerald-400">Offer Claimed</p>
                          <p className="font-mono text-sm font-bold tracking-widest text-white">
                            {claimedCode.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant={claimedCode ? 'outline' : 'gradient'}
                      className={cn(
                        'h-12 w-full rounded-full text-base font-semibold',
                        claimedCode && 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10',
                      )}
                      onClick={() => void handleClaimOffer()}
                      disabled={claiming}
                    >
                      {claiming ? 'Claiming…' : claimedCode ? 'View in Your Offers' : offer.ctaLabel}
                    </Button>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className={saveShareOutlineHoverGlow}
                        onClick={() => void handleToggleSave()}
                        disabled={savedLoading}
                      >
                        <Bookmark
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            saved && user && 'fill-primary text-primary',
                            'group-hover:fill-primary/70 group-hover:text-primary/80',
                          )}
                        />
                        {saved ? 'Saved' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={saveShareOutlineHoverGlow}
                        onClick={() => void shareOffer()}
                      >
                        <Share2 className="h-4 w-4 shrink-0 transition-colors group-hover:text-primary/80" />
                        Share
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/30 bg-card p-6">
                    <h3 className="font-display font-bold text-foreground">Venue</h3>
                    <p className="font-medium text-foreground">{offer.venue}</p>
                    <p className="text-sm text-muted-foreground">{offer.address}</p>
                    <div className="flex items-center gap-1 text-sm text-yellow-400">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                      {offer.rating.toFixed(1)} rating
                    </div>
                <div className="mt-2">
                  <OfferVenueMap
                    lat={offer.lat}
                    lng={offer.lng}
                    venueName={offer.venue}
                    address={offer.address}
                  />
                </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {related.length > 0 ? (
              <div className="mt-16 space-y-8">
                <Separator />
                <h2 className="font-display text-2xl font-bold text-foreground">
                  You Might Also Like
                </h2>
                <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="h-full min-h-0"
                    >
                      <Link
                        to={`/promotions/offer/${encodeURIComponent(r.id)}`}
                        className="group flex h-full min-h-0 flex-col"
                      >
                        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/30 bg-card transition-all hover:border-primary/30">
                          <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
                            <img
                              src={r.image}
                              alt={r.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).src = FALLBACK_IMG
                              }}
                            />
                            <span
                              className={cn(
                                'absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white',
                                r.badgeColor || 'bg-primary',
                              )}
                            >
                              {r.badge}
                            </span>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                            <h3 className="line-clamp-2 font-display font-bold leading-snug text-foreground">
                              {r.title}
                            </h3>
                            <p className="line-clamp-2 min-h-[2.75rem] text-sm leading-snug text-muted-foreground">
                              {r.description}
                            </p>
                            <div className="mt-auto flex flex-col gap-3">
                              <div className="flex shrink-0 items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-muted-foreground">
                                  {r.venue} • {r.city}
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-yellow-400">
                                  <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                                  {r.rating.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex h-10 w-full shrink-0 items-center justify-center rounded-full border border-primary/50 bg-transparent text-sm font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]">
                                View Offer
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <LovableFooter />
    </div>
  )
}
