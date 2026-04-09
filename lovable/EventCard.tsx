import { Event } from "@/types";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

// Event poster images
import event1 from "@/assets/event-1.jpg";
import event2 from "@/assets/event-2.jpg";
import event3 from "@/assets/event-3.jpg";
import event4 from "@/assets/event-4.jpg";
import event5 from "@/assets/event-5.jpg";
import event6 from "@/assets/event-6.jpg";

const eventImages: Record<string, string> = {
  "1": event1,
  "2": event2,
  "3": event3,
  "4": event4,
  "5": event5,
  "6": event6,
};

interface EventCardProps {
  event: Event;
  index?: number;
}

export function EventCard({ event, index = 0 }: EventCardProps) {
  const image = eventImages[event.id] || event1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link to={`/event/${event.id}`} className="group block">
        {/* Poster image - tall aspect ratio like the reference */}
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
          <img
            src={image}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        {/* Info below the image */}
        <div className="space-y-1">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {event.currency}{event.price.toFixed(2)} {event.currency === "€" ? "EUR" : ""}
          </p>
          <p className="text-xs text-muted-foreground">{event.date}</p>
          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {event.club}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
