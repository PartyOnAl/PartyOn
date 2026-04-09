import { motion } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

import promo1 from "@/assets/promo-1.jpg";
import promo2 from "@/assets/promo-2.jpg";
import promo3 from "@/assets/promo-3.jpg";
import promo4 from "@/assets/promo-4.jpg";

const promos = [
  {
    id: 1,
    badge: "30% OFF",
    badgeColor: "bg-primary",
    image: promo1,
    title: "VIP Table Package",
    description: "Premium table with bottle service and priority entry",
    venue: "Folie Terrace",
    city: "Tirana",
    rating: 4.9,
  },
  {
    id: 2,
    badge: "2 for 1",
    badgeColor: "bg-accent",
    image: promo2,
    title: "Happy Hour Special",
    description: "Buy one get one free on all signature cocktails",
    venue: "Dua Club",
    city: "Tirana",
    rating: 4.7,
  },
  {
    id: 3,
    badge: "Free",
    badgeColor: "bg-emerald-500",
    image: promo3,
    title: "Ladies Night",
    description: "Free entry and welcome drink for ladies before midnight",
    venue: "Radio Bar",
    city: "Tirana",
    rating: 4.8,
  },
  {
    id: 4,
    badge: "30% OFF",
    badgeColor: "bg-primary",
    image: promo4,
    title: "Student Night",
    description: "30% off entry with valid student ID every Wednesday",
    venue: "Blok Tirana",
    city: "Tirana",
    rating: 4.5,
  },
];

export function PromotionsSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    slidesToScroll: 1,
    containScroll: "trimSnaps",
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  return (
    <section className="py-20 border-t border-border/30">
      <div className="container space-y-10">
        {/* Header */}
        <div className="flex items-end justify-between">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Don't Miss Tonight
            </h2>
          </motion.div>
          <Button
            variant="outline"
            className="hidden md:flex border-border/50 rounded-full px-6"
          >
            More offers
          </Button>
        </div>

        {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {promos.map((promo, i) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="min-w-0 shrink-0 grow-0 basis-[75%] sm:basis-[45%] md:basis-[30%] lg:basis-[24%]"
              >
                <div className="group rounded-xl overflow-hidden bg-card border border-border/30 hover:border-primary/30 transition-all">
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className={`absolute top-3 left-3 ${promo.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      {promo.badge}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-display font-bold text-foreground">{promo.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{promo.description}</p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{promo.venue} • {promo.city}</span>
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {promo.rating}
                      </span>
                    </div>
                    <Button variant="outline" className="w-full rounded-full border-border/50 text-sm">
                      View Offer
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Arrows */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-30 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
