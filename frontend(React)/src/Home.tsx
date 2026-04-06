import { useRef, type ReactNode } from 'react'
import './Home.css'

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

function SearchIcon() {
  return (
    <svg className="home__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h15l-1.5 14H7.5L6 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

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
      <header className="home__header">
        <a className="home__brand" href="/" aria-label="PartyON home">
          <span className="home__brand-mark" aria-hidden />
          <span className="home__brand-text">
            <span className="home__brand-party">Party</span>
            <span className="home__brand-on">ON</span>
          </span>
        </a>

        <div className="home__search-wrap">
          <SearchIcon />
          <input
            className="home__search"
            type="search"
            name="search"
            placeholder="Search"
            aria-label="Search"
          />
        </div>

        <nav className="home__nav" aria-label="Main">
          <a className="home__nav-link" href="#events">
            Events
          </a>
          <a className="home__nav-link" href="#clubs">
            Clubs
          </a>
          <a className="home__nav-link" href="#promotions">
            Promotions
          </a>
        </nav>

        <div className="home__actions">
          <button type="button" className="home__icon-btn" aria-label="Account">
            <UserIcon />
          </button>
          <button type="button" className="home__icon-btn" aria-label="Cart">
            <BagIcon />
          </button>
        </div>
      </header>

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
