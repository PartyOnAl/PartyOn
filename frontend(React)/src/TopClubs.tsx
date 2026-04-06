import './TopClubs.css'

type Venue = {
  id: string
  slug: string
  label: string
  areaClass: string
  lanterns?: boolean
}

const VENUES: Venue[] = [
  {
    id: '1',
    slug: 'hacienda',
    label: 'HACIENDA',
    areaClass: 'venue-card--hacienda',
  },
  {
    id: '2',
    slug: 'club-mirage',
    label: 'CLUB MIRAGE',
    areaClass: 'venue-card--mirage',
  },
  {
    id: '3',
    slug: 'eden',
    label: 'EDEN',
    areaClass: 'venue-card--eden',
  },
  {
    id: '4',
    slug: 'sky-lounge',
    label: 'SKY LOUNGE',
    areaClass: 'venue-card--skylounge',
    lanterns: true,
  },
  {
    id: '5',
    slug: 'noir',
    label: 'NOIR',
    areaClass: 'venue-card--noir',
  },
]

export default function TopClubs() {
  return (
    <div className="top-clubs">
      <section className="top-clubs__frame" aria-labelledby="hot-venues-heading">
        <h1 id="hot-venues-heading" className="top-clubs__title">
          Hot Venues
        </h1>
        <div className="top-clubs__grid">
          {VENUES.map((venue) => (
            <a
              key={venue.id}
              href={`#club-${venue.slug}`}
              className={`venue-card ${venue.areaClass}`}
            >
              <span className="venue-card__shade" aria-hidden={true} />
              {venue.lanterns ? (
                <span className="venue-card__lanterns" aria-hidden={true} />
              ) : null}
              <span className="venue-card__label">{venue.label}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
