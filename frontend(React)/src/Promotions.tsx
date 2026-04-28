import './Promotions.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

const PROMOTION_SUMMARY = [
  { value: '2', label: 'Total Promotions' },
  { value: '1', label: 'Active Now' },
  { value: '1', label: 'Featured' },
] as const

const PROMOTIONS = [
  {
    id: 'early-bird',
    title: 'Early Bird Special',
    status: 'active',
    secondary: 'Featured',
    date: '3/20/2026 - 3/28/2026',
    event: 'Event: Saturday Night Fever',
    discount: '20%',
  },
  {
    id: 'vip-weekend',
    title: 'VIP Weekend',
    status: 'scheduled',
    secondary: '',
    date: '4/10/2026 - 4/12/2026',
    event: 'Event: VIP Experience Night',
    discount: '15%',
  },
] as const

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 13 12 21 3 12V4h8l9 9Zm-12-6h.01"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconBin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 7V5h6v2m-9 0h12m-1 0v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7m4 4v6m4-6v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Promotions() {
  return (
    <div className="promotions-page">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="promotions" />

        <div className="manager-dash__main">
          <ManagerTopBar />

          <div className="promotions-page__head">
            <div>
              <h1 className="promotions-page__title">Promotions</h1>
              <p className="promotions-page__sub">Create and manage special offers and discounts</p>
            </div>
            <button type="button" className="promotions-page__create-btn">
              <IconPlus />
              Create Promotion
            </button>
          </div>

          <section className="promotions-page__summary" aria-label="Promotions summary">
            {PROMOTION_SUMMARY.map((item) => (
              <article className="promotions-page__summary-card" key={item.label}>
                <p className="promotions-page__summary-value">{item.value}</p>
                <p className="promotions-page__summary-label">{item.label}</p>
              </article>
            ))}
          </section>

          <section className="promotions-page__cards" aria-label="Promotions list">
            {PROMOTIONS.map((promotion) => (
              <article className="promotions-page__promo-card" key={promotion.id}>
                <div className="promotions-page__promo-top">
                  <div>
                    <h2 className="promotions-page__promo-title">{promotion.title}</h2>
                    <div className="promotions-page__badges">
                      <span className={`promotions-page__badge promotions-page__badge--${promotion.status}`}>
                        {promotion.status}
                      </span>
                      {promotion.secondary ? (
                        <span className="promotions-page__badge promotions-page__badge--secondary">
                          {promotion.secondary}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="promotions-page__discount">
                    <IconTag />
                    {promotion.discount}
                  </p>
                </div>

                <div className="promotions-page__meta">
                  <p className="promotions-page__meta-line">
                    <IconCalendar />
                    {promotion.date}
                  </p>
                  <p className="promotions-page__meta-line">
                    <IconCalendar />
                    {promotion.event}
                  </p>
                </div>

                <div className="promotions-page__actions">
                  <button type="button" className="promotions-page__edit-btn">
                    <IconCalendar />
                    Edit
                  </button>
                  <button type="button" className="promotions-page__delete-btn" aria-label="Delete promotion">
                    <IconBin />
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
