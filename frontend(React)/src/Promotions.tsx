import './Promotions.css'

type Promotion = {
  id: string
  title: string
  description: string
  tag: string
  clubName: string
  rating: string
}

const PROMOTIONS: Promotion[] = [
  {
    id: '1',
    title: '2-FOR-1',
    description: 'Get two VIP entries for the price of one.',
    tag: 'VIP PACKAGE',
    clubName: 'Club Luxe',
    rating: '4.8',
  },
  {
    id: '2',
    title: '50% OFF',
    description: 'Enjoy half-price on bottle service all night.',
    tag: 'BOTTLE SERVICE',
    clubName: 'Club Mirage',
    rating: '4.9',
  },
  {
    id: '3',
    title: '20% OFF',
    description: 'Get 20% off on all drinks before 10 PM.',
    tag: 'DISCOUNT NIGHT',
    clubName: 'Club Zen',
    rating: '4.6',
  },
  {
    id: '4',
    title: 'FREE ENTRY',
    description: 'Enjoy free entry to the after party.',
    tag: 'AFTER PARTY',
    clubName: 'Club Vibe',
    rating: '4.4',
  },
]

function StarIcon() {
  return (
    <svg
      className="promo-card__star"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={true}
    >
      <path d="M12 2l2.9 7.4h7.6l-6 4.6 2.3 7.4L12 16.9 5.2 21.4 7.5 14l-6-4.6h7.6L12 2z" />
    </svg>
  )
}

function PromotionCard({ item }: { item: Promotion }) {
  return (
    <li>
      <article className="promo-card">
        <div className="promo-card__top">
          <h2 className="promo-card__title">{item.title}</h2>
          <div className="promo-card__rating">
            <StarIcon />
            <span>{item.rating}</span>
          </div>
        </div>
        <p className="promo-card__desc">{item.description}</p>
        <p className="promo-card__tag">{item.tag}</p>
        <div className="promo-card__actions">
          <button type="button" className="promo-card__btn">
            View Details
          </button>
          <button type="button" className="promo-card__btn">
            {item.clubName}
          </button>
          <button type="button" className="promo-card__btn">
            Location Icon
          </button>
          <button
            type="button"
            className="promo-card__btn promo-card__btn--more"
            aria-label="More options"
          >
            ...
          </button>
        </div>
      </article>
    </li>
  )
}

export default function Promotions() {
  return (
    <div className="promotions">
      <header className="promotions__heading-block">
        <h1 className="promotions__title">Exclusive Offers</h1>
        <p className="promotions__subtitle">Promotions</p>
      </header>

      <ul className="promotions__list">
        {PROMOTIONS.map((item) => (
          <PromotionCard key={item.id} item={item} />
        ))}
      </ul>

      <nav className="promotions__pagination" aria-label="Pagination">
        <button
          type="button"
          className="promotions__page promotions__page--active"
          aria-current="page"
        >
          1
        </button>
        <button type="button" className="promotions__page">
          2
        </button>
        <button type="button" className="promotions__page">
          3
        </button>
        <button type="button" className="promotions__page">
          4
        </button>
        <button type="button" className="promotions__page">
          5
        </button>
        <button
          type="button"
          className="promotions__page promotions__page--arrow"
          aria-label="Next page"
        >
          &gt;
        </button>
      </nav>
    </div>
  )
}
