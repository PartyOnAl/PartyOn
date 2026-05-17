import { useState , useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './Payment.css'
import { getJson, postJson } from '@/api'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'


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

export default function Payment() {
  const navigate = useNavigate()
  const {id} = useParams()
  const [quantity, setQuantity] = useState(1);
  const [organizerUpdates, setOrganizerUpdates] = useState(true);
  const [events, setEvents] = useState<any>(null);
  useEffect(() => {
    if (!id || id === 'undefined') return

    getJson<any>(`/event/${id}`)
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          return
        }
        setEvents(data)
      })
  }, [id])  
  const handleBuy= async () => {
    if (!events?.event_id || events.event_id === 'undefined') {
      return;
    }
    const { data, error } = await postJson<{ url?: string }>('/event/pay', {
      amount: events?.final_ticket_price*100,
      quantity: quantity,
      events: events,
    });

    if (error || !data?.url) {
      console.error(error ?? 'Checkout did not return a Stripe URL')
      return
    }

    window.location.href = data.url;
  };

  return (
    <div className="payment-page">
      <Navbar />
      <div className="payment-page__bg" aria-hidden={true} />
      <div className="payment-page__shell" style={{ paddingTop: '88px' }}>
        <header className="payment-page__top">
          <button
            type="button"
            className="payment-page__back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <span aria-hidden={true}>←</span> Back
          </button>
          <nav className="payment-page__crumbs" aria-label="Checkout progress">
            <span className="payment-page__crumb payment-page__crumb--current">
              Ticket
            </span>
            <span className="payment-page__crumb-sep" aria-hidden={true}>
              &gt;
            </span>
            <span className="payment-page__crumb">Payment</span>
            <span className="payment-page__crumb-sep" aria-hidden={true}>
              &gt;
            </span>
            <span className="payment-page__crumb">Confirmation</span>
          </nav>
          <span aria-hidden={true} />
        </header>

        <div className="payment-page__event">
        <div
  className="payment-page__event-thumb"
  style={{
    backgroundImage: `url(${events?.event_image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
/>
          <div>
            <h2 className="payment-page__event-title">{events?.event_name}</h2>
            <p className="payment-page__event-meta">
            {events?.event_starting_date
    ? formatEventDate(events.event_starting_date)
    : ''}
            </p>
          </div>
        </div>

        <div className="payment-page__card">
          <h3 className="payment-page__tier-title">General Admission</h3>
          <p className="payment-page__tier-sub">
            Access to main floor and all areas.
          </p>

          <div className="payment-page__price-row">
            <span className="payment-page__price">€{events?.final_ticket_price}</span>
            <span className="payment-page__price-unit">per ticket</span>
          </div>

          <label className="payment-page__qty-label" htmlFor="payment-qty">
            Quantity
          </label>
          <div className="payment-page__qty">
            <button
              type="button"
              className="payment-page__qty-btn"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((quantity) => Math.max(1, quantity - 1))}
            >
              −
            </button>
            <span className="payment-page__qty-value" id="payment-qty">
              {quantity}
            </span>
            <button
              type="button"
              className="payment-page__qty-btn"
              aria-label="Increase quantity"
              onClick={() => setQuantity((quantity) => quantity + 1)}
            >
              +
            </button>
          </div>

          <hr className="payment-page__divider" />

          <div className="payment-page__total-row">
            <span className="payment-page__total-label">Total</span>
            <span className="payment-page__total-amount">€{quantity * (events?.final_ticket_price || 0)}</span>
          </div>
          <p className="payment-page__total-note">No booking fees • Final price</p>

          <label className="payment-page__optin">
            <input
              type="checkbox"
              checked={organizerUpdates}
              onChange={(e) => setOrganizerUpdates(e.target.checked)}
            />
            <span>Get updates from this organizer about future events.</span>
          </label>

          <button
            type="button"
            onClick={handleBuy}
            className="payment-page__cta"
            disabled={!events?.event_id || events.event_id === 'undefined'}
          >
            Continue to Payment
          </button>

          <p className="payment-page__legal">
            By continuing, you agree to our{' '}
            <a href="#terms">Terms of Service</a> and{' '}
            <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>

        <p className="payment-page__foot">Secure checkout powered by PartyOn</p>
      </div>
      <LovableFooter />
    </div>
  )
}
