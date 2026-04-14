import { useParams , useNavigate } from 'react-router-dom'
import './EventClicked.css'
import { useEffect} from 'react';
import { useMemo, useState } from 'react'
import Stripe from 'stripe';
import type { Club, Event } from '@/types'
import { loadStripe } from '@stripe/stripe-js';


function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.65-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
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
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
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

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M9 18V5l12-2v13M9 13l12-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M14 3h7v7M10 14L21 3M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function TicketSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 17.5h16l-1.2-7.5-4.6 3.2L12 7.5l-2.2 5.7L5.2 10 4 17.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 20h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="8.5" r="1" fill="currentColor" />
      <circle cx="12" cy="5.5" r="1" fill="currentColor" />
      <circle cx="18" cy="8.5" r="1" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M7 12.5 10.2 15.7 17 8.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M16.36 3.2c-.35.4-1.22 1.35-2.3 1.33-.12-1.12.58-2.23.98-2.65.48-.52 1.88-1.1 2.62-.92-.1.85-.52 1.67-1.3 2.24zm1.6 2.55c-1.45-.09-2.68.82-3.37.82-.72 0-1.82-.78-3-.76-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.42 6.9 1.15 9.17.76 1.1 1.67 2.34 2.87 2.3 1.15-.05 1.58-.74 2.96-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.02-1.12 2.78-2.24.88-1.28 1.24-2.52 1.26-2.58-.02-.02-2.42-.93-2.44-3.68-.02-2.35 1.88-3.48 1.97-3.54-1.08-1.58-2.75-1.76-3.35-1.8z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M3 3v18l15-9L3 3z" />
    </svg>
  )
}

function formatEventDate(dateString: string) {
  const date = new Date(dateString)

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${formattedDate} • ${time}`
}

export default function EventClicked() {
  const {id} = useParams()
  const navigate =useNavigate();
  const [events, setEvents] = useState<any>(null);
  const payment = () =>{
    navigate(`/payment/${id}`)
  };
  useEffect(() => {
    if (!id) return

    fetch(`http://localhost:3000/event/${id}`)
      .then(res => res.json())
      .then(data => setEvents(data))
  }, [id])  

  
  const handleBuy= async () => {
    const res=await fetch('http://localhost:3000/event/pay',{
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
      },
      body: JSON.stringify({
         amount: events?.final_ticket_price*100,
      }),
    });
    const data=await res.json();
    window.location.href = data.url;
  };
  return (
    <div className="event-clicked">
      <div className="event-clicked__layout">
      <aside className="event-clicked__media" aria-label="Event image">
  <div className="event-clicked__hero">
    {events?.event_image && (
      <img
        src={events.event_image}
        alt="Event"
        className="w-full h-full object-cover"
      />
    )}
  </div>

  <div className="event-clicked__hero-actions">
    <button type="button" className="event-clicked__icon-btn" aria-label="Save event">
      <HeartIcon />
    </button>
    <button type="button" className="event-clicked__icon-btn" aria-label="Share">
      <ShareIcon />
    </button>
  </div>
</aside>
        <div className="event-clicked__main">
          <h1 className="event-clicked__title">{events?.event_name}</h1>

          <ul className="event-clicked__quick">
            <li>
              <CalendarIcon />
              <span>{events?.event_starting_date
    ? formatEventDate(events.event_starting_date)
    : ''}</span>
            </li>
            <li>
              <PinIcon />
              <span>{events?.club_address}</span>
            </li>
            <li>
              <MusicIcon />
              <span>{events?.event_type}</span>
            </li>
          </ul>

          <div className="event-clicked__ticket">
            <p className="event-clicked__price">FROM {events?.final_ticket_price}€</p>
            <p className="event-clicked__price-note">
              No hidden fees. Final price shown upfront.
            </p>
            <button type="button" onClick={payment} className="event-clicked__buy">
              Buy Now
            </button>
            <div className="event-clicked__ticket-divider" aria-hidden={true}>
              <span>OR</span>
            </div>
            <div className="event-clicked__reserve">
              <div className="event-clicked__reserve-badge">
                <FlameIcon />
                <span>Most popular choice</span>
              </div>
              <div className="event-clicked__reserve-head">
                <div>
                  <p className="event-clicked__reserve-title">
                    <CrownIcon />
                    <span>Table Reservation</span>
                  </p>
                  <p className="event-clicked__reserve-note">VIP table with bottle service</p>
                </div>
                <span className="event-clicked__reserve-price">{'\u20AC'}300+</span>
              </div>
              <p className="event-clicked__reserve-perk">
                <CheckIcon />
                <span>Includes entry for all guests</span>
              </p>
              <button type="button" className="event-clicked__reserve-btn">
                Reserve Table
              </button>
              <p className="event-clicked__reserve-footnote">Min spend {'\u20AC'}300</p>
            </div>
          </div>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="event-clicked__section-title">
              About
            </h2>
            <p className="event-clicked__about-text">
             {events?.event_description}
            </p>
            <button type="button" className="event-clicked__read-more">
              Read more
              <ChevronDownIcon />
            </button>

            <div className="event-clicked__chips">
              <div className="event-clicked__chip">
                <UserIcon />
                <div className="event-clicked__chip-label">18+</div>
              </div>
              <div className="event-clicked__chip">
                <MusicIcon />
                <div className="event-clicked__chip-label">{events?.event_type}</div>
              </div>
              <div className="event-clicked__chip">
                <UsersIcon />
                <div className="event-clicked__chip-label">PartyOn Events</div>
              </div>
            </div>
          </section>

          <section aria-labelledby="venue-heading">
            <h2 id="venue-heading" className="event-clicked__section-title">
              Venue
            </h2>
            <div className="event-clicked__venue-card">
              <h3 className="event-clicked__venue-name">{events?.club}</h3>
              <p className="event-clicked__venue-address">
                {events?.club_address}
              </p>
              <button type="button" className="event-clicked__maps-btn">
                Open in Maps
                <ExternalIcon />
              </button>
              <hr className="event-clicked__venue-rule" />
              <div className="event-clicked__doors">
                <ClockIcon />
                <span>Doors open: {events?.event_hours}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="event-clicked__app" aria-labelledby="app-heading">
        <h2 id="app-heading" className="event-clicked__app-title">
          Get the PartyOn app
        </h2>
        <p className="event-clicked__app-sub">
          Discover the best nights, manage your tickets, and reserve tables seamlessly.
        </p>

        <div className="event-clicked__features">
          <div className="event-clicked__feature">
            <HeartIcon />
            <div>
              <h4>Save events</h4>
              <p>Save and track your events in one place.</p>
            </div>
          </div>
          <div className="event-clicked__feature">
            <ShareIcon />
            <div>
              <h4>Share instantly</h4>
              <p>Send lineups and tickets to your crew in seconds.</p>
            </div>
          </div>
          <div className="event-clicked__feature">
            <TicketSmallIcon />
            <div>
              <h4>Easy tickets</h4>
              <p>Easy ticket access at the door with QR check-in.</p>
            </div>
          </div>
          <div className="event-clicked__feature">
            <UsersIcon />
            <div>
              <h4>Go together</h4>
              <p>Coordinate plans and table bookings with friends.</p>
            </div>
          </div>
        </div>

        <div className="event-clicked__downloads">
          <button type="button" className="event-clicked__store-btn">
            <AppleIcon />
            Download on iOS
          </button>
          <button type="button" className="event-clicked__store-btn">
            <PlayIcon />
            Download on Android
          </button>
        </div>
      </section>
    </div>
  )
}
