import './ManagerDashboard.css'
import './EventManagement.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

type EventCardData = {
  id: string
  title: string
  genre: string
  dateLine: string
  ticketsSold: number
  ticketsCap: number
  priceLabel: string
  capacityPct: number
  image: 'violet' | 'cyan' | 'placeholder'
}

const STATS = [
  { label: 'Total Events', value: '3' },
  { label: 'Upcoming', value: '3' },
  { label: 'Total Tickets Sold', value: '766' },
  { label: 'Total Revenue', value: '€34,920' },
] as const

const EVENTS: EventCardData[] = [
  {
    id: '1',
    title: 'Saturday Night Fever',
    genre: 'House / Techno',
    dateLine: '3/30/2026 • 22:00',
    ticketsSold: 423,
    ticketsCap: 500,
    priceLabel: '€35 per ticket',
    capacityPct: 85,
    image: 'violet',
  },
  {
    id: '2',
    title: 'Neon Nights',
    genre: 'Electronic',
    dateLine: '4/5/2026 • 21:00',
    ticketsSold: 280,
    ticketsCap: 400,
    priceLabel: '€25 per ticket',
    capacityPct: 70,
    image: 'cyan',
  },
  {
    id: '3',
    title: 'Rooftop Sessions',
    genre: 'Deep House',
    dateLine: '5/1/2026 • 20:00',
    ticketsSold: 63,
    ticketsCap: 250,
    priceLabel: '€30 per ticket',
    capacityPct: 25,
    image: 'placeholder',
  },
]

function IconPlus() {
  return (
    <svg className="event-mgmt__btn-plus" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconDollar() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEye() {
  return (
    <svg className="event-mgmt__action-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg className="event-mgmt__action-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrash({ compact }: { compact?: boolean }) {
  return (
    <svg
      className={
        compact
          ? 'event-mgmt__action-ic event-mgmt__action-ic--compact'
          : 'event-mgmt__action-ic'
      }
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7h16M10 11v8M14 11v8M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 14a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EventCard({ ev }: { ev: EventCardData }) {
  const imgClass =
    ev.image === 'placeholder'
      ? 'event-mgmt__card-img event-mgmt__card-img--placeholder'
      : `event-mgmt__card-img event-mgmt__card-img--${ev.image}`

  return (
    <article className="event-mgmt__card">
      <div className={imgClass} aria-hidden />
      <div className="event-mgmt__card-body">
        <h2 className="event-mgmt__card-title">{ev.title}</h2>
        <div className="event-mgmt__badges">
          <span className="event-mgmt__badge event-mgmt__badge--status">upcoming</span>
          <span className="event-mgmt__badge event-mgmt__badge--genre">{ev.genre}</span>
        </div>
        <ul className="event-mgmt__meta">
          <li className="event-mgmt__meta-row">
            <IconCalendar />
            <span>{ev.dateLine}</span>
          </li>
          <li className="event-mgmt__meta-row">
            <IconUsers />
            <span>
              {ev.ticketsSold} / {ev.ticketsCap} tickets sold
            </span>
          </li>
          <li className="event-mgmt__meta-row">
            <IconDollar />
            <span>{ev.priceLabel}</span>
          </li>
        </ul>
        <div className="event-mgmt__progress-wrap">
          <div className="event-mgmt__progress">
            <div className="event-mgmt__progress-fill" style={{ width: `${ev.capacityPct}%` }} />
          </div>
          <p className="event-mgmt__progress-label">{ev.capacityPct}% capacity</p>
        </div>
        <div className="event-mgmt__card-actions">
          <div className="event-mgmt__card-actions-main">
            <button type="button" className="event-mgmt__action event-mgmt__action--secondary event-mgmt__action--split">
              <IconEye />
              View
            </button>
            <button type="button" className="event-mgmt__action event-mgmt__action--secondary event-mgmt__action--split">
              <IconPencil />
              Edit
            </button>
          </div>
          <button
            type="button"
            className="event-mgmt__action event-mgmt__action--danger-icon"
            aria-label={`Delete ${ev.title}`}
          >
            <IconTrash compact />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function EventManagement() {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="events" />

        <div className="manager-dash__main manager-dash__main--event-mgmt">
          <ManagerTopBar />

          <div className="event-mgmt__bound">
            <header className="event-mgmt__head">
              <div className="event-mgmt__head-text">
                <h1 className="manager-dash__page-title">Event Management</h1>
                <p className="manager-dash__page-sub">Create and manage your club events</p>
              </div>
              <button type="button" className="event-mgmt__create">
                <IconPlus />
                Create Event
              </button>
            </header>

            <section className="event-mgmt__stats" aria-label="Event statistics">
              {STATS.map((s) => (
                <article key={s.label} className="event-mgmt__stat">
                  <p className="event-mgmt__stat-value">{s.value}</p>
                  <p className="event-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            <section className="event-mgmt__grid" aria-label="Events list">
              {EVENTS.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
