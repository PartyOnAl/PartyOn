import { useState } from 'react'
import './PaymentMethod.css'

const TOTAL = '45.00'

function CardBrandIcon() {
  return (
    <svg
      className="payment-method__card-icon"
      viewBox="0 0 34 24"
      fill="none"
      aria-hidden={true}
    >
      <rect
        x="1"
        y="3"
        width="32"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M1 9h32" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function PaymentMethod() {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')
  const [saveCard, setSaveCard] = useState(false)

  return (
    <div className="payment-method">
      <div className="payment-method__inner">
        <p className="payment-method__logo" aria-label="PartyOn">
          <span className="payment-method__logo-party">Party</span>
          <span className="payment-method__logo-on">On</span>
        </p>

        <h1 className="payment-method__title">Payment</h1>

        <div className="payment-method__grid">
          <div>
            <div className="payment-method__panel">
              <div className="payment-method__rule-text">
                <span>pay with card</span>
              </div>

              <div className="payment-method__field">
                <label className="payment-method__label" htmlFor="pm-card">
                  Card number
                </label>
                <div className="payment-method__input-wrap">
                  <input
                    id="pm-card"
                    className="payment-method__input payment-method__input--card"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3458"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                  <CardBrandIcon />
                </div>
              </div>

              <div className="payment-method__field payment-method__field--row">
                <div>
                  <label className="payment-method__label" htmlFor="pm-exp">
                    Expiry date
                  </label>
                  <input
                    id="pm-exp"
                    className="payment-method__input"
                    type="text"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="payment-method__label" htmlFor="pm-cvc">
                    CVC
                  </label>
                  <input
                    id="pm-cvc"
                    className="payment-method__input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                  />
                </div>
              </div>

              <div className="payment-method__field">
                <label className="payment-method__label" htmlFor="pm-name">
                  Name on card
                </label>
                <input
                  id="pm-name"
                  className="payment-method__input"
                  type="text"
                  autoComplete="cc-name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <label className="payment-method__save">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={(e) => setSaveCard(e.target.checked)}
                />
                <span>Save card for future purchases</span>
              </label>
            </div>

            <div className="payment-method__stripe">
              <LockIcon />
              <span>Secure payment powered by Stripe</span>
            </div>
          </div>

          <aside className="payment-method__panel" aria-label="Order summary">
            <h2 className="payment-method__summary-title">Order Summary</h2>
            <p className="payment-method__event-title">ECHOES: Underground Techno Night</p>
            <p className="payment-method__event-meta">Saturday, March 29 • 23:00</p>
            <p className="payment-method__event-meta">Warehouse Albania, Tirana</p>

            <hr className="payment-method__hr" />

            <div className="payment-method__row">
              <span className="payment-method__row-label">Ticket Type</span>
              <span className="payment-method__row-value">General Admission</span>
            </div>
            <div className="payment-method__row">
              <span className="payment-method__row-label">Quantity</span>
              <span className="payment-method__row-value">2x</span>
            </div>

            <hr className="payment-method__hr" />

            <div className="payment-method__line-item">
              <span>Tickets (2x €20)</span>
              <span>€40.00</span>
            </div>
            <div className="payment-method__line-item">
              <span>Service Fee</span>
              <span>€5.00</span>
            </div>

            <hr className="payment-method__hr" />

            <div className="payment-method__total">
              <span>Total</span>
              <span>€{TOTAL}</span>
            </div>

            <button type="button" className="payment-method__pay">
              Pay €{TOTAL}
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
