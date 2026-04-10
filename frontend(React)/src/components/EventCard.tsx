import type { Event } from '@/types'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

type EventCardProps = {
  event: Event
  index?: number
}

export function EventCard({ event, index = 0 }: EventCardProps) {
  return (
    <motion.div
      className="h-full min-h-0 w-full flex"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link
        to={`/event/${event.id}`}
        className="group flex h-full min-h-[26rem] sm:min-h-[28rem] w-full flex-col"
      >
        <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-lg">
          <img
            src={event.imageUrl}
            alt={event.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="mt-3 flex min-h-[6.25rem] flex-1 flex-col gap-1">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {event.currency}
            {event.price.toFixed(2)}{' '}
            {event.currency === '€' ? 'EUR' : ''}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1">{event.date}</p>
          <p className="mt-auto text-xs text-muted-foreground font-semibold flex items-center gap-1 line-clamp-1">
            <MapPin className="h-3 w-3 shrink-0" /> {event.club}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}
