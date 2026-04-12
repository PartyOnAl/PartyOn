import type { Event } from '@/types'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bookmark, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'

const FALLBACK_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80'

function formatEventDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type EventCardProps = {
  event: Event
  index?: number
}

export function EventCard({ event, index = 0 }: EventCardProps) {
  const { user } = useAuth()
  const { isSaved, saveEvent, removeEvent } = useSavedEvents()
  const saved = isSaved(event.id)
  const [imgSrc, setImgSrc] = useState(event.imageUrl)
  const [saveHint, setSaveHint] = useState<string | null>(null)

  useEffect(() => {
    setImgSrc(event.imageUrl)
  }, [event.imageUrl])

  useEffect(() => {
    if (!saveHint) return
    const t = window.setTimeout(() => setSaveHint(null), 4500)
    return () => window.clearTimeout(t)
  }, [saveHint])
  return (
    <motion.div
      className="relative flex h-full min-h-0 w-full flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <div className="group/card mx-auto flex h-full min-h-[20.5rem] sm:min-h-[22rem] w-full max-w-[18rem] flex-col">
        <div className="relative aspect-[4/5] max-h-[18.5rem] w-full shrink-0 overflow-hidden rounded-lg">
          <Link
            to={`/event/${event.id}`}
            className="absolute inset-0 z-0 block pointer-events-none"
            aria-label={`View ${event.title}`}
          >
            <img
              src={imgSrc}
              alt=""
              loading="lazy"
              onError={() => setImgSrc(FALLBACK_EVENT_IMAGE)}
              className="h-full w-full cursor-pointer object-cover transition-transform duration-500 group-hover/card:scale-105 pointer-events-auto"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </Link>
          {user ? (
            <button
              type="button"
              className="absolute right-2 top-2 z-[50] cursor-pointer touch-manipulation rounded-full bg-black/55 p-2 text-primary ring-1 ring-white/15 transition-colors hover:bg-black/75"
              aria-label={saved ? 'Remove from saved' : 'Save event'}
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                const fn = saved ? removeEvent : saveEvent
                const res = await fn(event.id)
                if (!res.ok && res.error) {
                  setSaveHint(res.error)
                }
              }}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
            </button>
          ) : null}
          {saveHint ? (
            <p
              className="absolute bottom-2 left-2 right-2 z-[50] rounded-md bg-destructive/90 px-2 py-1 text-center text-[10px] font-medium leading-tight text-destructive-foreground"
              role="status"
            >
              {saveHint}
            </p>
          ) : null}
        </div>

        <Link
          to={`/event/${event.id}`}
          className="mt-3 flex min-h-[6.25rem] flex-1 flex-col gap-1"
        >
          <h3 className="font-display line-clamp-2 text-sm font-bold uppercase tracking-wide text-foreground transition-colors group-hover/card:text-primary">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {event.currency}
            {event.price.toFixed(2)}{' '}
            {event.currency === '€' ? 'EUR' : ''}
          </p>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {event.date ? formatEventDate(event.date) : ''}
          </p>
          <p className="mt-auto flex items-center gap-1 line-clamp-1 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" /> {event.club}
          </p>
        </Link>
      </div>
    </motion.div>
  )
}
