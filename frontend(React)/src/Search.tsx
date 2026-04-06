import { useState, type ReactNode } from 'react'
import './Search.css'

type EventResult = {
  id: string
  title: string
  date: string
  location: string
  price: string
  thumb: string
}

type ClubResult = {
  id: string
  title: string
  hours: string
  location: string
  thumb: string
}

const EVENTS: EventResult[] = [
  {
    id: '1',
    title: 'Electric Nights Festival',
    date: 'Mar 29, 2026',
    location: 'Downtown Arena',
    price: '45',
    thumb: 'linear-gradient(135deg, #6366f1, #a855f7)',
  },
  {
    id: '2',
    title: 'Underground House Party',
    date: 'Mar 30, 2026',
    location: 'Secret Location',
    price: '25',
    thumb: 'linear-gradient(135deg, #0ea5e9, #7c3aed)',
  },
  {
    id: '3',
    title: 'Live Jazz & Cocktails',
    date: 'Apr 2, 2026',
    location: 'The Blue Note',
    price: '35',
    thumb: 'linear-gradient(135deg, #f59e0b, #dc2626)',
  },
  {
    id: '4',
    title: 'Techno Warehouse Rave',
    date: 'Apr 8, 2026',
    location: 'Industrial District',
    price: '30',
    thumb: 'linear-gradient(135deg, #ec4899, #581c87)',
  },
]

const CLUBS: ClubResult[] = [
  {
    id: '1',
    title: 'Bass Factory',
    hours: 'Open Fri-Sat',
    location: 'Industrial District',
    thumb: 'linear-gradient(135deg, #1e293b, #7c2d12)',
  },
]

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 9h16M8 5V3M16 5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 3v18M16 8.5a3 3 0 0 0-4-2.65M8 15.5a3 3 0 0 0 4 2.65"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ResultRow({
  title,
  thumb,
  children,
}: {
  title: string
  thumb: string
  children: ReactNode
}) {
  return (
    <div className="search-page__row" role="button" tabIndex={0}>
      <div
        className="search-page__thumb"
        style={{ background: thumb }}
        aria-hidden={true}
      />
      <div className="search-page__body">
        <h3 className="search-page__title">{title}</h3>
        <div className="search-page__meta">{children}</div>
      </div>
    </div>
  )
}

export default function Search() {
  const [query, setQuery] = useState('c')

  return (
    <div className="search-page">
      <div className="search-page__blur-layer" aria-hidden={true} />
      <div className="search-page__dim-layer" aria-hidden={true} />
      <div className="search-page__content">
        <div className="search-page__bar-wrap">
          <div className="search-page__bar">
            <SearchIcon />
            <input
              className="search-page__input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
              autoComplete="off"
            />
            {query.length > 0 ? (
              <button
                type="button"
                className="search-page__clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <ClearIcon />
              </button>
            ) : null}
          </div>
        </div>

        <div className="search-page__results">
          <h2 className="search-page__category">Events</h2>
          {EVENTS.map((ev) => (
            <ResultRow key={ev.id} title={ev.title} thumb={ev.thumb}>
              <span className="search-page__meta-item">
                <CalendarIcon />
                {ev.date}
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <PinIcon />
                {ev.location}
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <DollarIcon />
                <span>{`$${ev.price}`}</span>
              </span>
            </ResultRow>
          ))}

          <h2 className="search-page__category">Clubs</h2>
          {CLUBS.map((club) => (
            <ResultRow key={club.id} title={club.title} thumb={club.thumb}>
              <span className="search-page__meta-item">
                <CalendarIcon />
                {club.hours}
              </span>
              <span className="search-page__meta-sep" aria-hidden={true}>
                |
              </span>
              <span className="search-page__meta-item">
                <PinIcon />
                {club.location}
              </span>
            </ResultRow>
          ))}
        </div>
      </div>
    </div>
  )
}
