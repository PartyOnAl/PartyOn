import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Payment.css'

type PaymentEventState = {
  id: string
  title: string
  date: string
  club: string
  city: string
  price: number
  currency: string
  imageUrl?: string
}

export default function Payment() {
  const navigate = useNavigate()
  const location = useLocation()
  const eventFromNav = (location.state as { event?: PaymentEventState } | null)
    ?.event

  const unitPrice = useMemo(() => {
    if (eventFromNav) {
      return Math.max(0, eventFromNav.price)
    }
    return 20
  }, [eventFromNav])

  const [quantity, setQuantity] = useState(1)
  const [organizerUpdates, setOrganizerUpdates] = useState(false)

  const total = quantity * unitPrice

  const eventTitle = eventFromNav?.title ?? 'ECHOES: Underground Techno Night'
  const eventMeta =
    eventFromNav != null
      ? [eventFromNav.date, eventFromNav.club, eventFromNav.city]
          .filter(Boolean)
          .join(' · ')
      : 'Sat, Mar 29 • 23:00 • Warehouse Roma'
  const currency = eventFromNav?.currency?.trim() || '€'
  const thumbUrl = eventFromNav?.imageUrl?.trim()

  return (
    <div className="payment-page">
      <div className="payment-page__bg" aria-hidden={true} />
      <div className="payment-page__shell">
        <button
          type="button"
          className="payment-page__back"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <header className="payment-page__top">
          <p className="payment-page__label">payment</p>
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
            style={
              thumbUrl
                ? {
                    backgroundImage: `url(${thumbUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
            aria-hidden={true}
          />
          <div>
            <h2 className="payment-page__event-title">{eventTitle}</h2>
            <p className="payment-page__event-meta">{eventMeta}</p>
          </div>
        </div>

        <div className="payment-page__card">
          <h3 className="payment-page__tier-title">General Admission</h3>
          <p className="payment-page__tier-sub">
            Access to main floor and all areas.
          </p>

          <div className="payment-page__price-row">
            <span className="payment-page__price">
              {currency}
              {unitPrice}
            </span>
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
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
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
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </button>
          </div>

          <hr className="payment-page__divider" />

          <div className="payment-page__total-row">
            <span className="payment-page__total-label">Total</span>
            <span className="payment-page__total-amount">
              {currency}
              {total}
            </span>
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

          <button type="button" className="payment-page__cta">
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
    </div>
  )
}
