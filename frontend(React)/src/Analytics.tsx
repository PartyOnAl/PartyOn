import './Analytics.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

const SUMMARY_CARDS = [
  { value: '€256K', label: 'Total Revenue', trend: '+18%', icon: 'money' },
  { value: '1,247', label: 'Total Customers', trend: '+12%', icon: 'users' },
  { value: '24', label: 'Events Hosted', trend: '', icon: 'calendar' },
  { value: '€205', label: 'Avg. Ticket Price', trend: '+8%', icon: 'trend' },
] as const

const WEEKLY_SALES = [
  { day: 'Mon', value: 42 },
  { day: 'Tue', value: 35 },
  { day: 'Wed', value: 50 },
  { day: 'Thu', value: 66 },
  { day: 'Fri', value: 84 },
  { day: 'Sat', value: 118 },
  { day: 'Sun', value: 92 },
] as const

const TOP_EVENTS = [
  { rank: '#1', name: 'Saturday Night Fever', sold: '487 tickets sold', revenue: '€18,500' },
  { rank: '#2', name: 'Rooftop Sessions', sold: '356 tickets sold', revenue: '€14,200' },
  { rank: '#3', name: 'VIP Experience Night', sold: '234 tickets sold', revenue: '€12,800' },
] as const

function IconCard({ kind }: { kind: 'money' | 'users' | 'calendar' | 'trend' }) {
  if (kind === 'money') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 4v16M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'users') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M16 19v-1.2a3.8 3.8 0 0 0-3.8-3.8h-4.4A3.8 3.8 0 0 0 4 17.8V19M9.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 8.5v-1a3 3 0 0 0-2.3-2.9M15.5 5a3 3 0 0 1 0 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 16 5-5 3 3 7-7M15 7h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTrendUp() {
  return (
    <svg className="analytics-page__trend-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m4 16 5-5 3 3 7-7M15 7h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Analytics() {
  return (
    <div className="analytics-page">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="analytics" />

        <div className="manager-dash__main">
          <ManagerTopBar />

          <div className="analytics-page__head">
            <h1 className="analytics-page__title">Analytics</h1>
            <p className="analytics-page__sub">Track performance and insights</p>
          </div>

          <section className="analytics-page__metrics" aria-label="Analytics metrics">
            {SUMMARY_CARDS.map((card) => (
              <article key={card.label} className="analytics-page__metric-card">
                <div className="analytics-page__metric-top">
                  <span className="analytics-page__metric-icon-wrap" aria-hidden>
                    <IconCard kind={card.icon} />
                  </span>
                  {card.trend ? (
                    <p className="analytics-page__trend">
                      <IconTrendUp />
                      {card.trend}
                    </p>
                  ) : null}
                </div>
                <p className="analytics-page__metric-value">{card.value}</p>
                <p className="analytics-page__metric-label">{card.label}</p>
              </article>
            ))}
          </section>

          <section className="analytics-page__charts">
            <article className="analytics-page__panel">
              <h2 className="analytics-page__panel-title">Monthly Revenue</h2>
              <div className="analytics-page__line-chart">
                <svg viewBox="0 0 540 198" preserveAspectRatio="none" aria-label="Monthly revenue line chart">
                  <text x="22" y="16" className="analytics-page__axis-label">80000</text>
                  <text x="22" y="55" className="analytics-page__axis-label">60000</text>
                  <text x="22" y="94" className="analytics-page__axis-label">40000</text>
                  <text x="22" y="133" className="analytics-page__axis-label">20000</text>
                  <text x="40" y="172" className="analytics-page__axis-label">0</text>

                  <polyline points="70,106 150,112 230,76 310,88 390,62 470,46" fill="none" className="analytics-page__line-path" />

                  <g className="analytics-page__line-points">
                    <circle cx="70" cy="106" r="3.5" />
                    <circle cx="150" cy="112" r="3.5" />
                    <circle cx="230" cy="76" r="3.5" />
                    <circle cx="310" cy="88" r="3.5" />
                    <circle cx="390" cy="62" r="3.5" />
                    <circle cx="470" cy="46" r="3.5" />
                  </g>

                  <text x="60" y="190" className="analytics-page__axis-month">Jan</text>
                  <text x="140" y="190" className="analytics-page__axis-month">Feb</text>
                  <text x="220" y="190" className="analytics-page__axis-month">Mar</text>
                  <text x="300" y="190" className="analytics-page__axis-month">Apr</text>
                  <text x="380" y="190" className="analytics-page__axis-month">May</text>
                  <text x="460" y="190" className="analytics-page__axis-month">Jun</text>
                </svg>
              </div>
            </article>

            <article className="analytics-page__panel">
              <h2 className="analytics-page__panel-title">Weekly Ticket Sales</h2>
              <div className="analytics-page__bar-chart">
                <div className="analytics-page__bar-y-axis" aria-hidden>
                  <span>140</span>
                  <span>105</span>
                  <span>70</span>
                  <span>35</span>
                  <span>0</span>
                </div>
                <div className="analytics-page__bar-grid" />
                <div className="analytics-page__bars">
                  {WEEKLY_SALES.map((item) => (
                    <div className="analytics-page__bar-col" key={item.day}>
                      <div className="analytics-page__bar" style={{ height: `${(item.value / 140) * 100}%` }} />
                      <span className="analytics-page__bar-label">{item.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className="analytics-page__events-panel">
            <h2 className="analytics-page__panel-title">Top Performing Events</h2>
            <ul className="analytics-page__event-list">
              {TOP_EVENTS.map((eventItem) => (
                <li className="analytics-page__event-row" key={eventItem.rank}>
                  <div className="analytics-page__event-left">
                    <span className="analytics-page__event-rank">{eventItem.rank}</span>
                    <div>
                      <p className="analytics-page__event-name">{eventItem.name}</p>
                      <p className="analytics-page__event-sold">{eventItem.sold}</p>
                    </div>
                  </div>
                  <div className="analytics-page__event-right">
                    <p className="analytics-page__event-revenue">{eventItem.revenue}</p>
                    <p className="analytics-page__event-revenue-label">Revenue</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
