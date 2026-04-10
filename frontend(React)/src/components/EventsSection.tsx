import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type WheelEvent,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EventCard } from '@/components/EventCard'
import { motion } from 'framer-motion'
import useEmblaCarousel from 'embla-carousel-react'
import type { Event } from '@/types'
import './EventsSection.css'

type EventsSectionProps = {
  events: Event[]
  /** While catalog is loading, show placeholders instead of an empty “no matches” state. */
  catalogLoading?: boolean
}

function EventsCarouselSkeleton() {
  return (
    <div className="events-track flex -ml-4 items-stretch">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="events-slide min-w-0 shrink-0 grow-0 basis-[72%] sm:basis-[46%] md:basis-[32%] lg:basis-[24%] pl-4 flex"
        >
          <div className="mx-auto flex w-full max-w-[18rem] flex-col gap-3">
            <div className="aspect-[4/5] max-h-[18.5rem] w-full animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-[85%] max-w-[14rem] animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EventsSection({
  events,
  catalogLoading = false,
}: EventsSectionProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    slidesToScroll: 1,
    /**
     * Embla’s drag handler adds a capture-phase `click` listener that can call
     * stopPropagation() when `preventClick` is set (after a swipe). That blocks
     * clicks on bookmark buttons inside slides. We disable built-in drag; this
     * section still scrolls via arrows, autoplay, wheel, and touch swipe handlers below.
     */
    watchDrag: false,
    breakpoints: {
      '(min-width: 768px)': { slidesToScroll: 2 },
      '(min-width: 1024px)': { slidesToScroll: 3 },
    },
  })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const autoPlayRef = useRef<number | null>(null)
  const wheelLockUntilRef = useRef(0)

  const restartAutoSlide = useCallback(() => {
    if (autoPlayRef.current !== null) {
      window.clearInterval(autoPlayRef.current)
      autoPlayRef.current = null
    }
    if (!emblaApi || isHovered || isDragging) return

    autoPlayRef.current = window.setInterval(() => {
      emblaApi.scrollNext()
    }, 5000)
  }, [emblaApi, isHovered, isDragging])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi) return
    const onPointerDown = () => setIsDragging(true)
    const onPointerUp = () => setIsDragging(false)
    emblaApi.on('pointerDown', onPointerDown)
    emblaApi.on('pointerUp', onPointerUp)
    return () => {
      emblaApi.off('pointerDown', onPointerDown)
      emblaApi.off('pointerUp', onPointerUp)
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

  useEffect(() => {
    restartAutoSlide()
    return () => {
      if (autoPlayRef.current !== null) {
        window.clearInterval(autoPlayRef.current)
      }
    }
  }, [restartAutoSlide])

  const scrollSnaps = emblaApi?.scrollSnapList() ?? []

  const scrollPrev = () => {
    emblaApi?.scrollPrev()
    restartAutoSlide()
  }

  const scrollNext = () => {
    emblaApi?.scrollNext()
    restartAutoSlide()
  }

  return (
    <section id="events" className="py-20 border-t border-border/30">
      <div className="po-container space-y-8">
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">
              What&apos;s Coming
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wider">
              Upcoming Events
            </h2>
          </motion.div>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false)
            restartAutoSlide()
          }}
        >
          <Button
            variant="outline"
            size="icon"
            className="events-side-arrow events-side-arrow-left hidden md:inline-flex"
            onClick={scrollPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="events-side-arrow events-side-arrow-right hidden md:inline-flex"
            onClick={scrollNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div
            ref={emblaRef}
            className="overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <div className="events-track flex -ml-4 items-stretch">
              {catalogLoading && events.length === 0 ? (
                <EventsCarouselSkeleton />
              ) : (
                events.map((event, i) => (
                  <div
                    key={event.id}
                    className="events-slide min-w-0 shrink-0 grow-0 basis-[72%] sm:basis-[46%] md:basis-[32%] lg:basis-[24%] pl-4 flex"
                  >
                    <div className="min-h-0 w-full flex">
                      <EventCard event={event} index={i} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {!catalogLoading && events.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-muted-foreground">
            No events match your filters.
          </div>
        ) : null}

        {scrollSnaps.length > 1 && events.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === selectedIndex
                    ? 'w-8 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
