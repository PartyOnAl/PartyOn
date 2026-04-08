import { useRef, type ReactNode } from 'react'
import './Home.css'
import HomeTopMenu from './HomeTopMenu'

type EventItem = {
  id: string
  poster: 'party' | 'summer' | 'neon' | 'blackout' | 'more'
  posterLabel: ReactNode
  title: string
  price?: string
  date?: string
  location?: string
  template?: boolean
}

const EVENTS: EventItem[] = [
  {
    id: '1',
    poster: 'party',
    posterLabel: 'PARTY',
    title: 'Title',
    price: 'Price',
    date: 'Date',
    location: 'Location',
    template: true,
  },
  {
    id: '2',
    poster: 'summer',
    posterLabel: (
      <>
        <span>Retro</span>
        <span>SUMMER BASH</span>
      </>
    ),
    title: 'SUMMER BASH',
    price: '€20,00 EUR',
  },
  {
    id: '3',
    poster: 'neon',
    posterLabel: 'Neon',
    title: 'NEON NIGHT',
    price: '€25,00 EUR',
  },
  {
    id: '4',
    poster: 'blackout',
    posterLabel: (
      <>
        <span>Live</span>
        <strong>BLACKOUT FESTIVAL</strong>
      </>
    ),
    title: 'BLACKOUT FEST',
    price: '€30,00 EUR',
  },
  {
    id: '5',
    poster: 'more',
    posterLabel: '···',
    title: 'More events',
    price: 'See all',
  },
]

function EventCard({ item }: { item: EventItem }) {
  const posterClass = `home-event-card__poster home-event-card__poster--${item.poster}`

  return (
    <article className="home-event-card">
      <div className={posterClass}>
        <div className="home-event-card__poster-inner">{item.posterLabel}</div>
      </div>
      <div className="home-event-card__body">
        <h3 className="home-event-card__title">{item.title}</h3>
        {item.template ? (
          <>
            <p className="home-event-card__meta">{item.price}</p>
            <p className="home-event-card__meta">{item.date}</p>
            <p className="home-event-card__location">{item.location}</p>
          </>
        ) : (
          item.price && (
            <p className="home-event-card__meta home-event-card__meta--price">
              {item.price}
            </p>
          )
        )}
      </div>
    </article>
  )
}

export default function Home() {
  const carouselRef = useRef<HTMLDivElement>(null)

  function scrollCarousel(dir: 'left' | 'right') {
    const el = carouselRef.current
    if (!el) return
    const delta = dir === 'left' ? -240 : 240
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="home">
      <HomeTopMenu />

      <main className="home__main">
        <h1 className="home__section-title">Upcoming events</h1>

        <div className="home__carousel-wrap">
          <div
            ref={carouselRef}
            className="home__carousel"
            role="region"
            aria-label="Upcoming events"
            tabIndex={0}
          >
            {EVENTS.map((item) => (
              <EventCard key={item.id} item={item} />
            ))}
          </div>

          <div className="home__carousel-controls">
            <button
              type="button"
              className="home__carousel-arrow"
              aria-label="Previous events"
              onClick={() => scrollCarousel('left')}
            >
              ←
            </button>
            <button
              type="button"
              className="home__carousel-arrow"
              aria-label="Next events"
              onClick={() => scrollCarousel('right')}
            >
              →
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
