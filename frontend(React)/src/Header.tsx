import './Header.css'

type Testimonial = {
  id: string
  name: string
  handle: string
  initial: string
  quote: string
}

const REVIEWS: Testimonial[] = [
  {
    id: '1',
    name: 'Jack',
    handle: '@jack',
    initial: 'J',
    quote: 'Booking tables has never been this easy. Walked in like VIP.',
  },
  {
    id: '2',
    name: 'Laura',
    handle: '@laura',
    initial: 'L',
    quote: "Best nights I've had in Tirana. Everything is in one app.",
  },
  {
    id: '3',
    name: 'Mark',
    handle: '@mark',
    initial: 'M',
    quote: 'No more calling clubs. Just book and go.',
  },
  {
    id: '4',
    name: 'Sarah',
    handle: '@sarah',
    initial: 'S',
    quote: 'The QR entry is so smooth. No waiting.',
  },
]

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M14 14V6l-4 2H7v4h3l4 2zm4 2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2v8zM6 18h1a2 2 0 0 0 2-2v-1H6v3z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M12 2l2.9 7.4h7.6l-6 4.6 2.3 7.4L12 16.9 5.2 21.4 7.5 14l-6-4.6h7.6L12 2z" />
    </svg>
  )
}

function ReviewCard({ item }: { item: Testimonial }) {
  return (
    <article className="header-card">
      <div className="header-card__head">
        <div className="header-card__avatar" aria-hidden={true}>
          {item.initial}
        </div>
        <div className="header-card__meta">
          <span className="header-card__name">{item.name}</span>
          <span className="header-card__handle">{item.handle}</span>
        </div>
      </div>
      <p className="header-card__quote">{item.quote}</p>
      <div className="header-card__stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="header-card__star-wrap">
            <StarIcon />
          </span>
        ))}
      </div>
    </article>
  )
}

export default function Header() {
  return (
    <div className="header">
      <div className="header__inner">
        <header>
          <h1 className="header__title">Loved by partygoers worldwide</h1>
          <p className="header__subtitle">
            Discover why people choose PartyOn for their nights out
          </p>
        </header>

        <div className="header__stats">
          <div className="header__stats-row">
            <span className="header__stat">
              <TicketIcon />
              120K+ tickets sold
            </span>
            <span className="header__stat-divider" aria-hidden={true} />
            <span className="header__stat">
              <MegaphoneIcon />
              15K+ tables booked
            </span>
          </div>
          <div className="header__stats-row">
            <span className="header__stat">
              <GlobeIcon />
              20+ cities
            </span>
          </div>
        </div>

        <div className="header__grid">
          {REVIEWS.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>

        <div className="header__cta">
          <button type="button" className="header__btn">
            Explore Events
          </button>
        </div>
      </div>
    </div>
  )
}
