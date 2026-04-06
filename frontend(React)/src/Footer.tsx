import { useState, type FormEvent } from 'react'
import './Footer.css'

const PARTNERS = [
  'Spotify',
  'Red Bull',
  'Heineken',
  'Absolut',
  'Beats',
  'Uber',
] as const

const NAV_COLS: { label: string; href: string }[][] = [
  [
    { label: 'Events', href: '#events' },
    { label: 'Clubs', href: '#clubs' },
    { label: 'Promotions', href: '#promotions' },
  ],
  [
    { label: 'Help', href: '#help' },
    { label: 'Contact', href: '#contact' },
    { label: 'FAQ', href: '#faq' },
  ],
  [
    { label: 'Refund Policy', href: '#refund' },
    { label: 'Privacy Policy', href: '#privacy' },
    { label: 'Terms & Conditions', href: '#terms' },
  ],
]

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden={true}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 4v9.5a3.5 3.5 0 1 1-3-3.45M14 4c0 2 1.5 3.5 3.5 3.5V4"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden={true}>
      <path
        d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3.2l.3-3H13v-2c0-.8.7-1.5 1.5-1.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Footer() {
  const [email, setEmail] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
  }

  return (
    <footer className="footer-page">
      <div className="footer-page__inner">
        <p className="footer-page__partners-label">Official partners</p>
        <div className="footer-page__partners-row">
          {PARTNERS.map((name) => (
            <span key={name} className="footer-page__partner">
              {name}
            </span>
          ))}
        </div>

        <div className="footer-page__powered">
          <p className="footer-page__powered-label">Powered by</p>
          <p className="footer-page__powered-brand">Party on</p>
          <hr className="footer-page__powered-line" />
        </div>

        <section aria-labelledby="footer-join-heading">
          <h2 id="footer-join-heading" className="footer-page__join-title">
            Join the party
          </h2>
          <p className="footer-page__join-sub">
            Get early access to the best events in your city
          </p>
          <form className="footer-page__form" onSubmit={handleSubmit}>
            <input
              className="footer-page__input"
              type="email"
              name="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button type="submit" className="footer-page__submit">
              Join <span aria-hidden={true}>→</span>
            </button>
          </form>
        </section>

        <nav className="footer-page__nav" aria-label="Footer">
          {NAV_COLS.map((col, i) => (
            <div key={i} className="footer-page__nav-col">
              {col.map((link) => (
                <a
                  key={link.href}
                  className="footer-page__nav-link"
                  href={link.href}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="footer-page__social">
          <a
            className="footer-page__social-btn"
            href="https://instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>
          <a
            className="footer-page__social-btn"
            href="https://tiktok.com"
            target="_blank"
            rel="noreferrer"
            aria-label="TikTok"
          >
            <TikTokIcon />
          </a>
          <a
            className="footer-page__social-btn"
            href="https://facebook.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
          >
            <FacebookIcon />
          </a>
        </div>

        <hr className="footer-page__rule" />

        <div className="footer-page__payments" aria-hidden={true}>
          <span className="footer-page__payment">PayPal</span>
          <span className="footer-page__payment">VISA</span>
          <span className="footer-page__payment">Mastercard</span>
        </div>

        <p className="footer-page__copy">
          © 2026 Nightlife. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
