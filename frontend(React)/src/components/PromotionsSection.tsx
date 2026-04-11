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
}

export function PromotionsSection({ promotions }: PromotionsSectionProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: false,
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
    /** Custom touch + wheel + keyboard match Events carousel; avoids drag/click conflicts on cards. */
    watchDrag: false,
  })
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const wheelLockUntilRef = useRef(0)

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext()
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    }
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
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
    <section id="promotions" className="py-20 border-t border-border/30">
      <div className="po-container space-y-10">
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Exclusive offers
            </h2>
          </motion.div>
          <Link
            to="/promotions"
            className="hidden md:inline-flex h-10 items-center justify-center rounded-full border border-border/50 px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:border-foreground/30"
          >
            More offers
          </Link>
        </div>

        {promotions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8 rounded-xl border border-border/30 bg-card/40">
            No active promotions right now. Add rows in{' '}
            <code className="rounded bg-muted px-1 text-xs">promotions</code> with{' '}
            <code className="rounded bg-muted px-1 text-xs">status = active</code> and a future{' '}
            <code className="rounded bg-muted px-1 text-xs">valid_until</code>.
          </p>
        ) : (
          <>
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
                    className="min-w-0 shrink-0 grow-0 basis-[75%] sm:basis-[45%] md:basis-[30%] lg:basis-[24%] flex h-auto"
                  >
                    <Link
                      to={`/promotions/offer/${encodeURIComponent(promo.id)}`}
                      className="group flex h-full min-h-[28rem] sm:min-h-[30rem] w-full flex-col rounded-xl overflow-hidden bg-card border border-border/30 text-inherit no-underline transition-all hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden">
                        <PromoImage src={promo.image} alt={promo.title} />
                        <span
                          className={`absolute top-3 left-3 z-10 ${promo.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}
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

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
