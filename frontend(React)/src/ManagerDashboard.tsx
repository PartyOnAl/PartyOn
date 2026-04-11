import './ManagerDashboard.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

const WEEKLY_BARS = [
  { day: 'Mon', value: 38 },
  { day: 'Tue', value: 52 },
  { day: 'Wed', value: 48 },
  { day: 'Thu', value: 68 },
  { day: 'Fri', value: 92 },
  { day: 'Sat', value: 132 },
  { day: 'Sun', value: 36 },
] as const

const CHART_MAX = 140

const UPCOMING_EVENTS = [
  {
    id: '1',
    title: 'Saturday Night Fever',
    meta: '3/30/2026 • 22:00',
    sold: 423,
    cap: 500,
    thumb: 'violet',
  },
  {
    id: '2',
    title: 'Neon Nights',
    meta: '4/5/2026 • 21:00',
    sold: 280,
    cap: 400,
    thumb: 'cyan',
  },
  {
    id: '3',
    title: 'Rooftop Sessions',
    meta: '4/12/2026 • 20:00',
    sold: 156,
    cap: 250,
    thumb: 'amber',
  },
] as const

const RECENT_RESERVATIONS = [
  {
    id: '1',
    guest: 'Alexander Smith',
    detail: 'VIP Table • Saturday Night Fever',
    price: '€850',
    status: 'confirmed' as const,
  },
  {
    id: '2',
    guest: 'Maria Garcia',
    detail: 'Standard Table • Neon Nights',
    price: '€320',
    status: 'pending' as const,
  },
  {
    id: '3',
    guest: 'James Wilson',
    detail: 'Booth • Rooftop Sessions',
    price: '€1,200',
    status: 'confirmed' as const,
  },
] as const

function IconCalendar() {
  return (
    <svg className="manager-dash__nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconTicket() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5M8 8.5v7M12 8.5v7M16 8.5v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconTableSmall() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16v10H4V7Zm0 5h16M9 7v10M15 7v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEuro() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 10h12M6 14h9M8 6c-2 2-2 10 0 12M16 6c2 2 2 10 0 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconCalendarSmall() {
  return (
    <svg className="manager-dash__metric-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconTrendUp() {
  return (
    <svg className="manager-dash__trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m18 8-6 6-4-4-6 6M14 8h4v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg className="manager-dash__qa-chev" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg className="manager-dash__qa-chev" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3h7v7M10 14 21 3M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconDollar() {
  return (
    <svg className="manager-dash__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSeats() {
  return (
    <svg className="manager-dash__qa-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 12h3v6H6v-6Zm9 0h3v6h-3v-6ZM4 10h5M15 10h5M9 6h6v4H9V6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function navIconForMetric(index: number) {
  const icons = [IconTicket, IconTableSmall, IconEuro, IconCalendarSmall]
  const C = icons[index] ?? IconTicket
  return <C />
}

export default function ManagerDashboard() {
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="dashboard" />

        <div className="manager-dash__main">
          <ManagerTopBar />

          <div className="manager-dash__page-head">
            <h1 className="manager-dash__page-title">Dashboard Overview</h1>
            <p className="manager-dash__page-sub">
              Track your club&apos;s performance and operations.
            </p>
          </div>

          <section className="manager-dash__metrics" aria-label="Key metrics">
            <article className="manager-dash__metric">
              <div className="manager-dash__metric-head">
                <span className="manager-dash__metric-ic-wrap" aria-hidden>
                  {navIconForMetric(0)}
                </span>
                <p className="manager-dash__metric-trend manager-dash__metric-trend--up">
                  <IconTrendUp />
                  +12%
                </p>
              </div>
              <p className="manager-dash__metric-value">487</p>
              <p className="manager-dash__metric-label">Tickets Sold</p>
            </article>
            <article className="manager-dash__metric">
              <div className="manager-dash__metric-head">
                <span className="manager-dash__metric-ic-wrap" aria-hidden>
                  {navIconForMetric(1)}
                </span>
                <p className="manager-dash__metric-trend manager-dash__metric-trend--up">
                  <IconTrendUp />
                  +8%
                </p>
              </div>
              <p className="manager-dash__metric-value">23</p>
              <p className="manager-dash__metric-label">Table Reservations</p>
            </article>
            <article className="manager-dash__metric">
              <div className="manager-dash__metric-head">
                <span className="manager-dash__metric-ic-wrap" aria-hidden>
                  {navIconForMetric(2)}
                </span>
                <p className="manager-dash__metric-trend manager-dash__metric-trend--up">
                  <IconTrendUp />
                  +24%
                </p>
              </div>
              <p className="manager-dash__metric-value">€45,670</p>
              <p className="manager-dash__metric-label">Total Revenue</p>
            </article>
            <article className="manager-dash__metric">
              <div className="manager-dash__metric-head manager-dash__metric-head--solo">
                <span className="manager-dash__metric-ic-wrap" aria-hidden>
                  {navIconForMetric(3)}
                </span>
              </div>
              <p className="manager-dash__metric-value">8</p>
              <p className="manager-dash__metric-label">Upcoming Events</p>
            </article>
          </section>

          <section className="manager-dash__row manager-dash__row--charts">
            <div className="manager-dash__card manager-dash__card--chart">
              <div className="manager-dash__card-head">
                <div>
                  <h2 className="manager-dash__card-title">Weekly Revenue</h2>
                  <p className="manager-dash__card-sub">Ticket sales by day.</p>
                </div>
                <a className="manager-dash__link-all" href="#weekly">
                  View All
                </a>
              </div>
              <div className="manager-dash__chart">
                <div className="manager-dash__chart-y" aria-hidden>
                  <span>140</span>
                  <span>105</span>
                  <span>70</span>
                  <span>35</span>
                  <span>0</span>
                </div>
                <div className="manager-dash__chart-plot">
                  <div className="manager-dash__chart-grid" aria-hidden />
                  <div className="manager-dash__chart-bars">
                    {WEEKLY_BARS.map((b) => (
                      <div key={b.day} className="manager-dash__bar-col">
                        <div
                          className="manager-dash__bar"
                          style={{ height: `${(b.value / CHART_MAX) * 100}%` }}
                        />
                        <span className="manager-dash__bar-label">{b.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="manager-dash__card manager-dash__card--qa">
              <h2 className="manager-dash__qa-title">Quick Actions</h2>
              <div className="manager-dash__qa-list">
                <button type="button" className="manager-dash__qa-btn">
                  <span className="manager-dash__qa-icon-wrap">
                    <IconCalendar />
                  </span>
                  <span className="manager-dash__qa-label">Create Event</span>
                  <IconPlus />
                </button>
                <button type="button" className="manager-dash__qa-btn">
                  <span className="manager-dash__qa-icon-wrap">
                    <IconDollar />
                  </span>
                  <span className="manager-dash__qa-label">Add Promotion</span>
                  <IconPlus />
                </button>
                <button type="button" className="manager-dash__qa-btn">
                  <span className="manager-dash__qa-icon-wrap">
                    <IconSeats />
                  </span>
                  <span className="manager-dash__qa-label">Manage Tables</span>
                  <IconExternal />
                </button>
              </div>
            </div>
          </section>

          <section className="manager-dash__row manager-dash__row--lists">
            <div className="manager-dash__card manager-dash__card--list">
              <div className="manager-dash__card-head">
                <h2 className="manager-dash__card-title">Upcoming Events</h2>
                <a className="manager-dash__link-all" href="#events">
                  View All
                </a>
              </div>
              <ul className="manager-dash__event-list">
                {UPCOMING_EVENTS.map((ev) => (
                  <li key={ev.id} className="manager-dash__event-row">
                    <div
                      className={`manager-dash__event-thumb manager-dash__event-thumb--${ev.thumb}`}
                      aria-hidden
                    />
                    <div className="manager-dash__event-body">
                      <p className="manager-dash__event-title">{ev.title}</p>
                      <p className="manager-dash__event-meta">{ev.meta}</p>
                      <div className="manager-dash__progress">
                        <div
                          className="manager-dash__progress-fill"
                          style={{ width: `${Math.min(100, (ev.sold / ev.cap) * 100)}%` }}
                        />
                      </div>
                      <p className="manager-dash__progress-label">
                        {ev.sold}/{ev.cap}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="manager-dash__card manager-dash__card--list">
              <div className="manager-dash__card-head">
                <h2 className="manager-dash__card-title">Recent Reservations</h2>
                <a className="manager-dash__link-all" href="#reservations">
                  View All
                </a>
              </div>
              <ul className="manager-dash__res-list">
                {RECENT_RESERVATIONS.map((r) => (
                  <li key={r.id} className="manager-dash__res-row">
                    <div>
                      <p className="manager-dash__res-guest">{r.guest}</p>
                      <p className="manager-dash__res-detail">{r.detail}</p>
                    </div>
                    <div className="manager-dash__res-right">
                      <p className="manager-dash__res-price">{r.price}</p>
                      <span
                        className={
                          r.status === 'confirmed'
                            ? 'manager-dash__badge manager-dash__badge--ok'
                            : 'manager-dash__badge manager-dash__badge--pending'
                        }
                      >
                        {r.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
