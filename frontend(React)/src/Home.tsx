import { useEffect, useRef, useState } from 'react'
import './Home.css'
import HomeTopMenu from './HomeTopMenu'

type EventCard = {
  event_id: number
  event_name: string
  event_description: string
  event_starting_date: string
  event_ending_date: string
  event_type: string
  event_status: string
  ticket_price: number
  ticket_discount: number
  final_ticket_price: number
  event_image: string
  event_capacity: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

export default function Home() {
  const [events, setEvents] = useState<EventCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  function scrollCarousel(direction: 'left' | 'right') {
    const carouselElement = carouselRef.current
    if (!carouselElement) return

    const scrollAmount = direction === 'left' ? -240 : 240
    carouselElement.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadEvents() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE_URL}/event`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const data: unknown = await response.json()
        setEvents(Array.isArray(data) ? (data as EventCard[]) : [])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }

        console.error('Failed to fetch events', err)
        setEvents([])
        setError('We could not load events right now.')
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()

    return () => controller.abort()
  }, [])

  function formatEventDate(dateValue: string) {
    const parsedDate = new Date(dateValue)

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Date to be announced'
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parsedDate)
  }

  function formatPrice(price: number) {
    if (!Number.isFinite(price) || price <= 0) {
      return 'Free entry'
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  return (
    <div className="home">
      <HomeTopMenu />
      <header className="home__top-menu" />

      <main className="home__main">
        <h1 className="home__section-title">Upcoming events</h1>

        <div className="home__carousel-wrap">
          {isLoading ? <p className="home__status">Loading events...</p> : null}
          {!isLoading && error ? <p className="home__status home__status--error">{error}</p> : null}
          {!isLoading && !error && events.length === 0 ? (
            <p className="home__status">No events are available yet.</p>
          ) : null}

          <div
            ref={carouselRef}
            className="home__carousel"
            role="region"
            aria-label="Upcoming events"
            tabIndex={0}
          >
            {events.map((ev) => (
              <button
                type="button"
                key={ev.event_id}
                className="home-event-card"
                aria-label={`Open ${ev.event_name}`}
              >
                <div
                  className="home-event-card__poster home-event-card__poster--fallback"
                  style={ev.event_image ? { backgroundImage: `url(${ev.event_image})` } : undefined}
                />
                <div className="home-event-card__body">
                  <h3 className="home-event-card__title">{ev.event_name || 'Untitled event'}</h3>
                  <p className="home-event-card__meta home-event-card__meta--price">
                    {formatPrice(ev.final_ticket_price)}
                  </p>
                  <p className="home-event-card__meta">{formatEventDate(ev.event_starting_date)}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="home__carousel-controls" aria-hidden={events.length === 0}>
            <button
              type="button"
              className="home__carousel-arrow"
              aria-label="Previous events"
              onClick={() => scrollCarousel('left')}
              disabled={events.length === 0}
            >
              &larr;
            </button>
            <button
              type="button"
              className="home__carousel-arrow"
              aria-label="Next events"
              onClick={() => scrollCarousel('right')}
              disabled={events.length === 0}
            >
              &rarr;
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
