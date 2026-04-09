import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/EventCard";
import { mockEvents } from "@/data/mockData";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";

export function EventsSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 2 },
      "(min-width: 1024px)": { slidesToScroll: 3 },
    },
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useState(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
  });

  // Re-register on api change
  useMemo(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  const scrollSnaps = emblaApi?.scrollSnapList() || [];

  return (
    <section className="py-20">
      <div className="container space-y-8">
        {/* Header with arrows */}
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-2">What's Coming</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wider">
              Upcoming Events
            </h2>
          </motion.div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-border/50 bg-secondary/50 hover:bg-primary/20 hover:border-primary/50 transition-all"
              disabled={!canScrollPrev}
              onClick={() => emblaApi?.scrollPrev()}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-border/50 bg-secondary/50 hover:bg-primary/20 hover:border-primary/50 transition-all"
              disabled={!canScrollNext}
              onClick={() => emblaApi?.scrollNext()}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Carousel */}
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex -ml-4">
            {mockEvents.map((event, i) => (
              <div
                key={event.id}
                className="min-w-0 shrink-0 grow-0 basis-[85%] sm:basis-[45%] md:basis-[30%] lg:basis-[23%] pl-4"
              >
                <EventCard event={event} index={i} />
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        {scrollSnaps.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === selectedIndex
                    ? "w-8 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
