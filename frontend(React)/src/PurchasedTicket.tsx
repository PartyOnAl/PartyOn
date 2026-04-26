import './PurchasedTicket.css'
import { useParams } from 'react-router-dom'
import { useState , useEffect } from 'react'

const ORDER_ID = 'PO-2026-0329-8472'
const QR_DATA = encodeURIComponent(`PartyOn:${ORDER_ID}:ECHOES`)

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M6 12l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarSmallIcon() {
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

function AppleWalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm4 3h8v2H8V9zm0 4h5v2H8v-2z" />
    </svg>
  )
}

function GoogleWalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3h-4a3 3 0 0 0 0 6h4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm14 5h3v2h-3a1 1 0 1 1 0-2z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M4 6h16v12H4V6zm0 0l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M12 4v10m0 0l-3-3m3 3l3-3M5 18h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M5 12h12m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

export default function PurchasedTicket() {
  const {id} = useParams()
  const {quantity} = useParams()
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&bgcolor=ffffff&color=000000&data=${QR_DATA}`
  const [events, setEvents] = useState<any>(null);
  useEffect(() => {
    if (!id || id === 'undefined') return
       fetch(`http://localhost:3000/event/${id}`)
      .then(res => res.json())
      .then(data => setEvents(data))
  }, [id])  
  return (
    <div className="purchased-ticket">
      <div className="purchased-ticket__glow" aria-hidden={true} />
      <div className="purchased-ticket__inner">
        <header className="purchased-ticket__success">
          <div className="purchased-ticket__check">
            <CheckIcon />
          </div>
          <h1 className="purchased-ticket__headline">You&apos;re in</h1>
          <p className="purchased-ticket__sub">Your ticket is confirmed</p>
        </header>

        <div className="purchased-ticket__summary">
        <div
  className="payment-page__event-thumb"
  style={{
    backgroundImage: `url(${events?.event_image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
/>

          <div>
            <p className="purchased-ticket__summary-title">{events?.event_name}</p>
            <p className="purchased-ticket__summary-meta">
              <CalendarSmallIcon />
              <span>{events?.event_starting_date
    ? formatEventDate(events.event_starting_date)
    : ''}</span>
            </p>
          </div>
        </div>

        <div className="purchased-ticket__card">
          <div className="purchased-ticket__card-grid">
            <div className="purchased-ticket__qr">
              <img src={qrSrc} alt="Ticket QR code" width={220} height={220} loading="lazy" />
            </div>
            <div className="purchased-ticket__details">
              <h2 className="purchased-ticket__event-title">{events?.event_name}</h2>
              <p className="purchased-ticket__tier">General Admission</p>
              <div className="purchased-ticket__detail-line">
                <CalendarSmallIcon />
                <div>
                  <div>{events?.event_starting_date
    ? formatEventDate(events.event_starting_date)
    : ''}</div>
                  <div>• Doors open at {events?.event_hours}</div>
                </div>
              </div>
              <div className="purchased-ticket__detail-line">
                <PinIcon />
                <div>
                  <div>{events?.club}</div>
                  <div>{events?.club_address}</div>
                </div>
              </div>
              <div className="purchased-ticket__label-row">
                <div className="purchased-ticket__meta-label">Quantity</div>
                <div className="purchased-ticket__meta-value">{quantity} ticket</div>
              </div>
              <div className="purchased-ticket__label-row">
                <div className="purchased-ticket__meta-label">Order number</div>
                <div className="purchased-ticket__meta-value">#{ORDER_ID}</div>
              </div>
            </div>
          </div>

          <button type="button" className="purchased-ticket__wallet-btn">
            <AppleWalletIcon />
            Add to Apple Wallet
          </button>
          <button type="button" className="purchased-ticket__wallet-btn">
            <GoogleWalletIcon />
            Add to Google Wallet
          </button>

          <div className="purchased-ticket__util-row">
            <button type="button" className="purchased-ticket__util-btn">
              <EyeIcon />
              View
            </button>
            <button type="button" className="purchased-ticket__util-btn">
              <MailIcon />
              Email
            </button>
            <button type="button" className="purchased-ticket__util-btn">
              <DownloadIcon />
              Download
            </button>
          </div>

          <button type="button" className="purchased-ticket__calendar-btn">
            <PlusIcon />
            Add to Calendar
          </button>
        </div>

        <p className="purchased-ticket__secure">
          Your ticket is securely stored in your account
        </p>

        <nav className="purchased-ticket__nav" aria-label="Next steps">
          <button type="button" className="purchased-ticket__nav-btn purchased-ticket__nav-btn--ghost">
            View more events
            <ChevronRightIcon />
          </button>
          <button type="button" className="purchased-ticket__nav-btn purchased-ticket__nav-btn--primary">
            Go to My Plans
            <ArrowRightIcon />
          </button>
        </nav>
      </div>
    </div>
  )
}
