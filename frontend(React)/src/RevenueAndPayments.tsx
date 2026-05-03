import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react'
import './RevenueAndPayments.css'

type NavId =
  | 'overview'
  | 'clubs'
  | 'users'
  | 'revenue'
  | 'featured'
  | 'analysis'
  | 'settings'

type NavItem = {
  id: NavId
  label: string
  href: string
  active?: boolean
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Platform Overview', href: 'admin-platform-analysis.html' },
  { id: 'clubs', label: 'Club Approvals', href: 'club-approving.html' },
  { id: 'users', label: 'User Management', href: 'user-management.html' },
  { id: 'revenue', label: 'Revenue & Payments', href: 'revenue-and-payments.html', active: true },
  { id: 'featured', label: 'Featured Events', href: '#' },
  { id: 'analysis', label: 'Platform Analytics', href: '#' },
  { id: 'settings', label: 'Settings', href: '#' },
]

const KPI_MAIN = {
  label: 'Total Revenue',
  value: '€124,580',
  trend: '+15%',
}

const KPI_SMALL: { label: string; value: string; icon: 'ticket' | 'table' | 'card' | 'tag' }[] = [
  { label: 'Ticket Commission', value: '€45,670', icon: 'ticket' },
  { label: 'Table Commission', value: '€38,920', icon: 'table' },
  { label: 'Subscriptions', value: '€28,400', icon: 'card' },
  { label: 'Advertisements', value: '€11,590', icon: 'tag' },
]

const BAR_DATA: { label: string; value: number }[] = [
  { label: 'Tickets', value: 45670 },
  { label: 'Tables', value: 38920 },
  { label: 'Subscriptions', value: 28400 },
  { label: 'Ads', value: 11590 },
]

const CHART_MAX = 60000

const TRANSACTIONS: {
  id: string
  date: string
  club: string
  type: 'ticket' | 'table' | 'subscription' | 'advertisement'
  amount: string
  commission: string
  status: string
}[] = [
  {
    id: 'txn-1',
    date: '3/29/2026',
    club: 'Folie Terrace',
    type: 'ticket',
    amount: '€850',
    commission: '+€127.5',
    status: 'completed',
  },
  {
    id: 'txn-2',
    date: '3/29/2026',
    club: 'Cirque Le Soir',
    type: 'table',
    amount: '€1,200',
    commission: '+€180',
    status: 'completed',
  },
  {
    id: 'txn-3',
    date: '3/28/2026',
    club: 'White Dubai',
    type: 'subscription',
    amount: '€299',
    commission: '+€299',
    status: 'completed',
  },
  {
    id: 'txn-4',
    date: '3/28/2026',
    club: 'Hakkasan',
    type: 'advertisement',
    amount: '€500',
    commission: '+€500',
    status: 'completed',
  },
]

const RATES: { title: string; value: string; hint: string }[] = [
  { title: 'Ticket Commission', value: '15%', hint: 'Per ticket sold' },
  { title: 'Table Commission', value: '15%', hint: 'Per table reservation' },
  { title: 'Monthly Subscription', value: '€299', hint: 'Per club per month' },
  { title: 'Featured Event', value: '€500', hint: 'Per event per week' },
]

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20V10M12 20V4M20 20v-6" strokeLinecap="round" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M6 12h12M10 12v10M14 12v10" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 5 2-7L2 9h7z" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18M7 16l4-4 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
    </svg>
  )
}

function IconTicket() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2M13 17v2M13 11v2" strokeLinecap="round" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18M12 6v12" strokeLinecap="round" />
    </svg>
  )
}

function IconCreditCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l6.59-6.59a1 1 0 0 0 0-1.41L12 2Z" />
      <path d="M7 7h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconTrendUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 14l3-3 3 3 5-5M17 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}

const NAV_ICONS: Record<NavId, ReactNode> = {
  overview: <IconOverview />,
  clubs: <IconBuilding />,
  users: <IconUsers />,
  revenue: <IconWallet />,
  featured: <IconStar />,
  analysis: <IconChart />,
  settings: <IconSettings />,
}

const KPI_SMALL_ICONS: Record<(typeof KPI_SMALL)[number]['icon'], ReactNode> = {
  ticket: <IconTicket />,
  table: <IconTable />,
  card: <IconCreditCard />,
  tag: <IconTag />,
}

function typeBadgeClass(t: (typeof TRANSACTIONS)[number]['type']): string {
  switch (t) {
    case 'ticket':
      return 'rp__badge-type--ticket'
    case 'table':
      return 'rp__badge-type--table'
    case 'subscription':
      return 'rp__badge-type--subscription'
    default:
      return 'rp__badge-type--ad'
  }
}

function typeLabel(t: (typeof TRANSACTIONS)[number]['type']): string {
  if (t === 'advertisement') return 'advertisement'
  return t
}

export default function RevenueAndPayments() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navId = useId()

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const yLabels = [60000, 45000, 30000, 15000, 0]

  return (
    <div className="rp">
      {sidebarOpen ? (
        <button
          type="button"
          className="rp__backdrop"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`rp__sidebar${sidebarOpen ? ' rp__sidebar--open' : ''}`}
        id={navId}
        aria-label="Admin navigation"
      >
        <div className="rp__brand">
          <span className="rp__brand-title">PartyOn</span>
          <span className="rp__brand-sub">Platform Admin</span>
        </div>

        <nav className="rp__nav">
          {NAV.map((item) => (
            <a
              key={item.id}
              className={`rp__nav-link${item.active ? ' rp__nav-link--active' : ''}`}
              href={item.href}
              onClick={closeSidebar}
            >
              <span className="rp__nav-icon" aria-hidden>
                {NAV_ICONS[item.id]}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="rp__user">
          <div className="rp__avatar" aria-hidden />
          <div className="rp__user-text">
            <span className="rp__user-name">Super Admin</span>
            <span className="rp__user-email">admin@partyon.com</span>
          </div>
        </div>
      </aside>

      <div className="rp__main">
        <header className="rp__topbar">
          <button
            type="button"
            className="rp__menu-btn"
            aria-expanded={sidebarOpen}
            aria-controls={navId}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
            <span className="rp__menu-btn-text">Menu</span>
          </button>
          <span className="rp__topbar-title">PartyOn Platform</span>
          <div className="rp__topbar-avatar" aria-hidden />
        </header>

        <main className="rp__content">
          <header className="rp__page-head">
            <h1 className="rp__h1">Revenue and Payments</h1>
            <p className="rp__sub">Track platform revenue, commissions, and transactions</p>
          </header>

          <section className="rp__kpi-row" aria-label="Revenue summary">
            <article className="rp__card rp__kpi rp__kpi--main">
              <div className="rp__kpi-head">
                <span className="rp__kpi-icon rp__kpi-icon--muted" aria-hidden>
                  <IconDollar />
                </span>
                <span className="rp__kpi-trend">
                  <IconTrendUp />
                  {KPI_MAIN.trend}
                </span>
              </div>
              <p className="rp__kpi-value">{KPI_MAIN.value}</p>
              <h2 className="rp__kpi-label">{KPI_MAIN.label}</h2>
            </article>
            {KPI_SMALL.map((k) => (
              <article key={k.label} className="rp__card rp__kpi rp__kpi--sm">
                <span className="rp__kpi-icon rp__kpi-icon--muted" aria-hidden>
                  {KPI_SMALL_ICONS[k.icon]}
                </span>
                <p className="rp__kpi-value">{k.value}</p>
                <h2 className="rp__kpi-label">{k.label}</h2>
              </article>
            ))}
          </section>

          <section className="rp__card rp__breakdown">
            <h2 className="rp__section-title">Revenue Breakdown</h2>
            <div className="rp__chart">
              <div className="rp__chart-y" aria-hidden>
                {yLabels.map((v) => (
                  <span key={v}>{v.toLocaleString('en-US')}</span>
                ))}
              </div>
              <div className="rp__chart-plot">
                <div className="rp__chart-bars" role="img" aria-label="Revenue by category">
                  {BAR_DATA.map((b) => (
                    <div key={b.label} className="rp__bar-wrap">
                      <div
                        className="rp__bar"
                        style={{
                          height: `${Math.min(100, Math.max(2, (b.value / CHART_MAX) * 100))}%`,
                        }}
                        title={`${b.label}: €${b.value.toLocaleString('en-US')}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="rp__chart-labels">
                  {BAR_DATA.map((b) => (
                    <span key={b.label} className="rp__bar-label">
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rp__card rp__tx-section">
            <div className="rp__tx-head">
              <h2 className="rp__section-title">Recent Transactions</h2>
              <a className="rp__link-all" href="#">
                View All
              </a>
            </div>
            <div className="rp__table-wrap">
              <table className="rp__table">
                <thead>
                  <tr>
                    <th scope="col">Transaction ID</th>
                    <th scope="col">Date</th>
                    <th scope="col">Club</th>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Commission</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSACTIONS.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.id}</td>
                      <td>{tx.date}</td>
                      <td>{tx.club}</td>
                      <td>
                        <span className={`rp__badge-type ${typeBadgeClass(tx.type)}`}>
                          {typeLabel(tx.type)}
                        </span>
                      </td>
                      <td>{tx.amount}</td>
                      <td className="rp__commission">{tx.commission}</td>
                      <td>
                        <span className="rp__badge-status">{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rp__rates" aria-label="Platform rates">
            {RATES.map((r) => (
              <article key={r.title} className="rp__card rp__rate-card">
                <h3 className="rp__rate-title">{r.title}</h3>
                <p className="rp__rate-value">{r.value}</p>
                <p className="rp__rate-hint">{r.hint}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  )
}
