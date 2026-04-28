import { useMemo, useState } from 'react'
import './ManagerDashboard.css'
import './ReservationManagement.css'
import { ManagerSidebar, ManagerTopBar } from './manager/ManagerNav.tsx'

type FilterTab = 'all' | 'tickets' | 'tables'

type RowType = 'vip_table' | 'ticket' | 'standard_table'

type ReservationRow = {
  id: string
  customer: string
  bookingDate: string
  event: string
  type: RowType
  guests: number
  amount: string
  status: 'confirmed' | 'pending'
  payment: 'paid' | 'pending'
}

const STATS = [
  { label: 'Total Reservations', value: '3' },
  { label: 'Confirmed', value: '2' },
  { label: 'Pending', value: '1' },
  { label: 'Total Revenue', value: '€1,335' },
] as const

const ROWS: ReservationRow[] = [
  {
    id: '1',
    customer: 'Alexander Smith',
    bookingDate: '3/30/2026',
    event: 'Saturday Night Fever',
    type: 'vip_table',
    guests: 6,
    amount: '€850',
    status: 'confirmed',
    payment: 'paid',
  },
  {
    id: '2',
    customer: 'Maria Garcia',
    bookingDate: '4/1/2026',
    event: 'Neon Nights',
    type: 'ticket',
    guests: 2,
    amount: '€50',
    status: 'pending',
    payment: 'pending',
  },
  {
    id: '3',
    customer: 'James Wilson',
    bookingDate: '3/28/2026',
    event: 'Saturday Night Fever',
    type: 'standard_table',
    guests: 4,
    amount: '€320',
    status: 'confirmed',
    payment: 'paid',
  },
]

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'tables', label: 'Tables' },
]

function typeLabel(t: RowType) {
  switch (t) {
    case 'vip_table':
      return 'VIP Table'
    case 'ticket':
      return 'Ticket'
    case 'standard_table':
      return 'Standard Table'
    default:
      return ''
  }
}

function IconUser() {
  return (
    <svg className="res-mgmt__guest-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 0c-3.3 0-6 2-6 5v1h12v-1c0-3-2.7-5-6-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEye() {
  return (
    <svg className="res-mgmt__action-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconApprove() {
  return (
    <svg className="res-mgmt__action-ic res-mgmt__action-ic--approve" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconDecline() {
  return (
    <svg className="res-mgmt__action-ic res-mgmt__action-ic--decline" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function matchesFilter(row: ReservationRow, tab: FilterTab) {
  if (tab === 'all') return true
  if (tab === 'tickets') return row.type === 'ticket'
  return row.type === 'vip_table' || row.type === 'standard_table'
}

export default function ReservationManagement() {
  const [filter, setFilter] = useState<FilterTab>('all')

  const visibleRows = useMemo(() => ROWS.filter((r) => matchesFilter(r, filter)), [filter])

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar activeId="reservations" />

        <div className="manager-dash__main manager-dash__main--res-mgmt">
          <ManagerTopBar />

          <div className="res-mgmt__bound">
            <header className="res-mgmt__head">
              <h1 className="manager-dash__page-title">Reservation Management</h1>
              <p className="manager-dash__page-sub">Manage all bookings and ticket sales</p>
            </header>

            <section className="res-mgmt__stats" aria-label="Reservation statistics">
              {STATS.map((s) => (
                <article key={s.label} className="res-mgmt__stat">
                  <p className="res-mgmt__stat-value">{s.value}</p>
                  <p className="res-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            <div className="res-mgmt__tabs" role="tablist" aria-label="Reservation type filter">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  className={
                    filter === t.id ? 'res-mgmt__tab res-mgmt__tab--active' : 'res-mgmt__tab'
                  }
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="res-mgmt__table-wrap">
              <table className="res-mgmt__table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Event</th>
                    <th scope="col">Type</th>
                    <th scope="col">Guests</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="res-mgmt__customer">
                          <span className="res-mgmt__customer-name">{row.customer}</span>
                          <span className="res-mgmt__customer-date">{row.bookingDate}</span>
                        </div>
                      </td>
                      <td className="res-mgmt__cell-event">{row.event}</td>
                      <td>
                        <span className={`res-mgmt__type res-mgmt__type--${row.type}`}>
                          {typeLabel(row.type)}
                        </span>
                      </td>
                      <td>
                        <span className="res-mgmt__guests">
                          <IconUser />
                          {row.guests}
                        </span>
                      </td>
                      <td className="res-mgmt__cell-amount">{row.amount}</td>
                      <td>
                        <span
                          className={
                            row.status === 'confirmed'
                              ? 'res-mgmt__pill res-mgmt__pill--ok'
                              : 'res-mgmt__pill res-mgmt__pill--pending'
                          }
                        >
                          {row.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            row.payment === 'paid'
                              ? 'res-mgmt__pill res-mgmt__pill--ok'
                              : 'res-mgmt__pill res-mgmt__pill--pending'
                          }
                        >
                          {row.payment === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div className="res-mgmt__actions">
                          <button type="button" className="res-mgmt__icon-btn" aria-label={`View ${row.customer}`}>
                            <IconEye />
                          </button>
                          {row.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="res-mgmt__icon-btn res-mgmt__icon-btn--approve"
                                aria-label={`Approve ${row.customer}`}
                              >
                                <IconApprove />
                              </button>
                              <button
                                type="button"
                                className="res-mgmt__icon-btn res-mgmt__icon-btn--decline"
                                aria-label={`Decline ${row.customer}`}
                              >
                                <IconDecline />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
