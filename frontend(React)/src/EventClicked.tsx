import './EventClicked.css'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useCatalog } from '@/contexts/CatalogContext'
import { useSavedEvents } from '@/contexts/SavedEventsContext'
import { cn } from '@/lib/utils'
import type { Event } from '@/types'

import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Music,
  Share2,
  User,
  Users,
  ChevronDown,
} from 'lucide-react'

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80'

/* ---------------- ICONS (UNCHANGED UI) ---------------- */

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.65-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 10.5 15 7.5M8.5 13.5 15 16.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9h16M8 5V3M16 5V3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5l12-2v13M9 13l12-2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/* ---------------- SAFE DATE ---------------- */

function formatEventDate(dateString?: string | null) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

/* ---------------- MAIN COMPONENT ---------------- */

export default function EventClicked() {
  const { id, eventId } = useParams()
  const navigate = useNavigate()

  const { events: catalogEvents = [], loading } = useCatalog() as {
    events: Event[]
    loading: boolean
  }

  const { user } = useAuth()
  const { isSaved, saveEvent, removeEvent } = useSavedEvents()

  const [fetchedEvent, setFetchedEvent] = useState<any>(null)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const resolvedId = (id ?? eventId ?? '').trim()

  /* ---------------- catalog + db merge ---------------- */

  const fromCatalog = useMemo(
    () => catalogEvents.find((e) => String(e.id) === resolvedId),
    [catalogEvents, resolvedId],
  )

  useEffect(() => {
    if (!resolvedId || fromCatalog) return

    fetch(`http://localhost:3000/event/${resolvedId}`)
      .then((res) => res.json())
      .then((data) => setFetchedEvent(data))
      .catch(() => setFetchedEvent(null))
  }, [resolvedId, fromCatalog])

  const events = fromCatalog || fetchedEvent

  /* ---------------- guards ---------------- */

  if (!resolvedId) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="po-container py-20 text-center">Redirecting...</div>
        <LovableFooter />
      </div>
    )
  }

  if (loading && !events) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="po-container animate-pulse py-10">Loading...</div>
        <LovableFooter />
      </div>
    )
  }

  if (!events) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="po-container py-20 text-center">
          Event not found
        </div>
        <LovableFooter />
      </div>
    )
  }

  const ev = events
  const saved = user ? isSaved(ev.id) : false

  /* ---------------- actions ---------------- */

  async function toggleSave() {
    if (!user) return navigate('/login')
    if (saved) await removeEvent(ev.id)
    else await saveEvent(ev.id)
  }

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: ev.title, url })
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  function openMaps(address: string) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      '_blank',
    )
  }

  function primaryAction() {
    navigate(`/payment/${ev.id}`)
  }

  const venueLine = [ev.club, ev.city].filter(Boolean).join(' · ')
  const about =
    ev.description || ev.event_description || 'No description available.'

  const imgSrc = ev.imageUrl || ev.event_image || FALLBACK_IMG

  /* ---------------- UI (UNCHANGED STRUCTURE) ---------------- */

  return (
    <div className="event-clicked">
      <Navbar />

      <main className="po-container">
        <h1 className="text-3xl font-bold">{ev.event_name || ev.title}</h1>

        <ul className="mt-4 space-y-2">
          <li className="flex gap-2">
            <CalendarIcon />
            {formatEventDate(ev.event_starting_date || ev.date)}
          </li>
          <li className="flex gap-2">
            <PinIcon />
            {ev.club_address}
          </li>
          <li className="flex gap-2">
            <MusicIcon />
            {ev.event_type}
          </li>
        </ul>

        <img src={imgSrc} className="mt-6 rounded-xl" />

        <button onClick={primaryAction} className="mt-6">
          Buy Now
        </button>

        <section className="mt-10">
          <h2>About</h2>
          <p className={cn(!aboutExpanded && 'line-clamp-3')}>{about}</p>

          <button onClick={() => setAboutExpanded(!aboutExpanded)}>
            Read more <ChevronDownIcon />
          </button>
        </section>

        <section className="mt-10">
          <h2>Venue</h2>
          <p>{venueLine}</p>

          <button onClick={() => openMaps(ev.club_address)}>
            Open in Maps
          </button>
        </section>
      </main>

      <LovableFooter />
    </div>
  )
}