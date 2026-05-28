import { motion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
  type WheelEvent,
} from 'react'
import type { Promotion } from '@/types'

const FALLBACK_PROMO_IMAGE =
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80'

/** Fallback badge colors when API rows omit `badgeColor` (from new_dev). */
function badgeColorClass(badge: string): string {
  if (badge === 'Free Entry' || badge === 'free_entry') return 'bg-primary'
  if (badge === 'VIP') return 'bg-accent'
  if (badge === 'discount') return 'bg-emerald-500'
  return 'bg-gray-500'
}

function PromoImage({ src, alt }: { src: string; alt: string }) {
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

type PromotionsSectionProps = {
  promotions: Promotion[]
  loading?: boolean
}

export function PromotionsSection({ promotions, loading = false }: PromotionsSectionProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: false,
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
    /** Custom touch + wheel + keyboard match Events carousel; avoids drag/click conflicts on cards. */
    watchDrag: false,
  })
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const wheelLockUntilRef = useRef(0)

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return
    if (emblaApi.canScrollPrev()) {
      emblaApi.scrollPrev()
      return
    }
    const snapCount = emblaApi.scrollSnapList().length
    if (snapCount > 1) emblaApi.scrollTo(snapCount - 1)
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (!emblaApi) return
    if (emblaApi.canScrollNext()) {
      emblaApi.scrollNext()
      return
    }
    if (emblaApi.scrollSnapList().length > 1) emblaApi.scrollTo(0)
  }, [emblaApi])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null)
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return
    const endX = event.changedTouches[0]?.clientX ?? touchStartX
    const deltaX = touchStartX - endX
    if (deltaX > 50) {
      scrollNext()
    } else if (deltaX < -50) {
      scrollPrev()
    }
    setTouchStartX(null)
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const horizontalIntent =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0
    if (Math.abs(horizontalIntent) <= 8) return
    if (Date.now() < wheelLockUntilRef.current) return
    wheelLockUntilRef.current = Date.now() + 300
    event.preventDefault()
    if (horizontalIntent > 0) {
      scrollNext()
    } else {
      scrollPrev()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollNext()
    }
  }

  return (
    <section id="promotions" className="py-12 md:py-20 border-t border-border/30">
      <div className="po-container space-y-5 md:space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-y-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold">
              Exclusive offers
            </h2>
          </motion.div>
          <Link
            to="/promotions"
            className="section-more-link"
          >
            More offers
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="min-w-0 shrink-0 grow-0 basis-[80%] sm:basis-[45%] md:basis-[30%] lg:basis-[24%] min-h-[22rem] sm:min-h-[28rem] md:min-h-[30rem] rounded-xl bg-card border border-border/30 animate-pulse"
              />
            ))}
          </div>
        ) : promotions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10 rounded-xl border border-border/30 bg-card/40">
            Exclusive offers coming soon. Check back for deals and special access.
          </p>
        ) : (
          <>
            <div className="relative">
              <button
                type="button"
                onClick={scrollPrev}
                disabled={promotions.length <= 1}
                aria-label="Previous promotion"
                className="absolute -left-5 top-1/2 z-20 hidden sm:flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:border-[#E91E8C] hover:bg-[#E91E8C] disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-black/70"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={scrollNext}
                disabled={promotions.length <= 1}
                aria-label="Next promotion"
                className="absolute -right-5 top-1/2 z-20 hidden sm:flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-sm transition-all hover:border-[#E91E8C] hover:bg-[#E91E8C] disabled:opacity-30 disabled:hover:border-white/15 disabled:hover:bg-black/70"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            <div
              ref={emblaRef}
              className="overflow-hidden rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              tabIndex={0}
              role="region"
              aria-label="Promotion offers carousel. Use arrow keys, swipe, or horizontal scroll to move between offers."
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              onKeyDown={handleKeyDown}
            >
              <div className="flex gap-4 items-stretch">
                {promotions.map((promo, i) => (
                  <motion.div
                    key={promo.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="min-w-0 shrink-0 grow-0 basis-[80%] sm:basis-[45%] md:basis-[30%] lg:basis-[24%] flex h-auto"
                  >
                    <Link
                      to={`/promotions/offer/${encodeURIComponent(promo.id)}`}
                      className="group flex h-full min-h-[22rem] sm:min-h-[26rem] md:min-h-[30rem] w-full flex-col rounded-xl overflow-hidden bg-card border border-border/30 text-inherit no-underline transition-all hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
                        <PromoImage src={promo.image} alt={promo.title} />
                        <span
                          className={`absolute top-3 left-3 z-10 ${
                            promo.badgeColor?.trim()
                              ? promo.badgeColor
                              : badgeColorClass(promo.badge)
                          } text-white text-xs font-bold px-3 py-1 rounded-full`}
                        >
                          {promo.badge}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-4 min-h-0">
                        <div className="min-h-[4.5rem]">
                          <h3 className="font-display font-bold text-foreground line-clamp-1">
                            {promo.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {promo.description}
                          </p>
                        </div>
                        <div className="mt-3 flex shrink-0 items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate pr-2">
                            {promo.venue}
                            {promo.city ? ` • ${promo.city}` : ''}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-yellow-400">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {promo.rating.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-auto pt-4">
                          <span className="flex w-full items-center justify-center rounded-full border border-primary/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.12),0_0_22px_hsl(var(--primary)/0.06)]">
                            View Offer
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
