import './HomeTopMenu.css'

function SearchIcon() {
  return (
    <svg className="home-top-menu__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16 16l4.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h15l-1.5 14H7.5L6 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HomeTopMenu() {
  return (
    <header className="home-top-menu">
      <div className="home-top-menu__content">
        <a className="home-top-menu__brand" href="/" aria-label="PartyON home">
          <span className="home-top-menu__brand-mark" aria-hidden />
          <span className="home-top-menu__brand-text">
            <span className="home-top-menu__brand-party">Party</span>
            <span className="home-top-menu__brand-on">ON</span>
          </span>
        </a>

        <div className="home-top-menu__search-wrap">
          <SearchIcon />
          <input
            className="home-top-menu__search"
            type="search"
            name="search"
            placeholder="Search"
            aria-label="Search"
          />
        </div>

        <nav className="home-top-menu__nav" aria-label="Main">
          <a className="home-top-menu__nav-link" href="#events">
            Events
          </a>
          <a className="home-top-menu__nav-link" href="#clubs">
            Clubs
          </a>
          <a className="home-top-menu__nav-link" href="#promotions">
            Promotions
          </a>
        </nav>

        <div className="home-top-menu__actions">
          <button type="button" className="home-top-menu__icon-btn" aria-label="Account">
            <UserIcon />
          </button>
          <button type="button" className="home-top-menu__icon-btn" aria-label="Cart">
            <BagIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
