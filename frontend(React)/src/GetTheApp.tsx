import type { ReactNode } from 'react'
import './GetTheApp.css'

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 4v11m0 0l-4-4m4 4l4-4M6 20h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M12 2l1.2 6.2L19 10l-5.8 1.8L12 18l-1.2-6.2L5 10l5.8-1.8L12 2z" />
    </svg>
  )
}

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

function DrinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M8 3h8l-1 14a3 3 0 0 1-6 0L8 3zm0 0h8M9 21h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FeatureCard({
  className,
  icon,
  text,
}: {
  className: string
  icon: ReactNode
  text: string
}) {
  return (
    <div className={`get-app-feature ${className}`}>
      <div className="get-app-feature__icon">{icon}</div>
      <p className="get-app-feature__text">{text}</p>
    </div>
  )
}

export default function GetTheApp() {
  return (
    <div className="get-app">
      <div className="get-app__stars" aria-hidden={true} />
      <div className="get-app__inner">
        <header>
          <h1 className="get-app__headline">Your Night Starts Here</h1>
          <p className="get-app__sub">
            Find events, book tickets, and reserve tables in seconds
          </p>
          <div className="get-app__ctas">
            <button type="button" className="get-app__btn get-app__btn--primary">
              <DownloadIcon />
              Download App
            </button>
            <button type="button" className="get-app__btn get-app__btn--outline">
              <SparkleIcon />
              Explore Events
            </button>
          </div>
        </header>

        <div className="get-app__showcase">
          <FeatureCard
            className="get-app__card--tl"
            icon={<TicketIcon />}
            text="Book Tickets Instantly"
          />
          <FeatureCard
            className="get-app__card--tr"
            icon={<SearchIcon />}
            text="Discover Top Clubs"
          />
          <div className="get-app__phone-wrap">
            <div className="get-app__phone" aria-hidden={true}>
              <div className="get-app__phone-notch" />
              <div className="get-app__phone-screen" />
            </div>
          </div>
          <FeatureCard
            className="get-app__card--bl"
            icon={<DrinkIcon />}
            text="Reserve VIP Tables"
          />
          <FeatureCard
            className="get-app__card--br"
            icon={<BellIcon />}
            text="Get Event Alerts"
          />
        </div>
      </div>
    </div>
  )
}
