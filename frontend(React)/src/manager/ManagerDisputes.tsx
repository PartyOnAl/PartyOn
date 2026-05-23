import { useMemo, useState, useEffect } from 'react'
import './ManagerDashboard.css'
import './ManagerDisputes.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'

type DisputeStatus = 'pending' | 'investigating' | 'resolved' | 'rejected'

type Dispute = {
  id: string
  type: string
  status: DisputeStatus
  ticketNumber: string
  description: string
  customer: string
  club: string
  amount: number
  filedAt: string
}

const INITIAL_DISPUTES: Dispute[] = [
  {
    id: '1',
    type: 'Entry Denied',
    status: 'pending',
    ticketNumber: 'TKT-8472',
    description:
      'Paid for VIP table but was denied entry at the door. Staff said reservation was not found.',
    customer: 'Isabella Johnson',
    club: 'Folie Terrace',
    amount: 850,
    filedAt: '3/28/2026',
  },
  {
    id: '2',
    type: 'Refund Request',
    status: 'investigating',
    ticketNumber: 'TKT-0213',
    description: 'Event was cancelled but I was not notified. Requesting full refund.',
    customer: 'David Wilson',
    club: 'Cirque Le Soir',
    amount: 120,
    filedAt: '3/27/2026',
  },
]

type Toast = { message: string; variant: 'resolved' | 'rejected' | 'default' }

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 9v4m0 4h.01M10.3 3.2 3.1 17a2 2 0 0 0 1.8 2.8h14.2a2 2 0 0 0 1.8-2.8L13.7 3.2a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v1m0 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v2m0 16v2M8.5 8c0-1.1.9-2 2-2h3a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h3a2 2 0 0 0 2-2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12C2 12 5 5 12 5s10 7 10 7-3 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export default function ManagerDisputes() {
  const { club } = useManagerClub()
  const [disputes, setDisputes] = useState<Dispute[]>(INITIAL_DISPUTES)
  const [detailDispute, setDetailDispute] = useState<Dispute | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const stats = useMemo(() => {
    const pending = disputes.filter((d) => d.status === 'pending').length
    const investigating = disputes.filter((d) => d.status === 'investigating').length
    const resolved = disputes.filter((d) => d.status === 'resolved').length
    const atRisk = disputes
      .filter((d) => d.status === 'pending' || d.status === 'investigating')
      .reduce((sum, d) => sum + d.amount, 0)
    return { pending, investigating, resolved, atRisk }
  }, [disputes])

  function handleResolve(dispute: Dispute) {
    setDisputes((current) =>
      current.map((d) => (d.id === dispute.id ? { ...d, status: 'resolved' } : d)),
    )
    setToast({ variant: 'resolved', message: `"${dispute.type}" marked as resolved.` })
  }

  function handleReject(dispute: Dispute) {
    setDisputes((current) =>
      current.map((d) => (d.id === dispute.id ? { ...d, status: 'rejected' } : d)),
    )
    setToast({ variant: 'rejected', message: `"${dispute.type}" was rejected.` })
  }

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-disputes__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-disputes__bound">
            {/* Header */}
            <div className="manager-disputes__head">
              <h1 className="manager-dash__page-title">Disputes &amp; Complaints</h1>
              <p className="manager-dash__page-sub">Handle user complaints and refund requests</p>
            </div>

            {/* Stats */}
            <section className="manager-disputes__stats" aria-label="Dispute statistics">
              <article className="manager-disputes__stat manager-disputes__stat--pending">
                <span className="manager-disputes__stat-icon">
                  <IconInfo />
                </span>
                <div className="manager-disputes__stat-body">
                  <strong>{stats.pending}</strong>
                  <p>Pending</p>
                </div>
              </article>

              <article className="manager-disputes__stat manager-disputes__stat--investigating">
                <span className="manager-disputes__stat-icon">
                  <IconInfo />
                </span>
                <div className="manager-disputes__stat-body">
                  <strong>{stats.investigating}</strong>
                  <p>Investigating</p>
                </div>
              </article>

              <article className="manager-disputes__stat manager-disputes__stat--resolved">
                <span className="manager-disputes__stat-icon">
                  <IconCheck />
                </span>
                <div className="manager-disputes__stat-body">
                  <strong>{stats.resolved}</strong>
                  <p>Resolved</p>
                </div>
              </article>

              <article className="manager-disputes__stat manager-disputes__stat--risk">
                <span className="manager-disputes__stat-icon">
                  <IconDollar />
                </span>
                <div className="manager-disputes__stat-body">
                  <strong>€{stats.atRisk.toLocaleString()}</strong>
                  <p>Total at Risk</p>
                </div>
              </article>
            </section>

            {/* Disputes list */}
            <section className="manager-disputes__list" aria-label="Disputes list">
              {disputes.map((dispute) => (
                <article key={dispute.id} className="manager-disputes__card">
                  <div className="manager-disputes__card-top">
                    <div className="manager-disputes__card-left">
                      <span className="manager-disputes__card-icon" aria-hidden>
                        <IconAlert />
                      </span>
                      <div>
                        <div className="manager-disputes__card-title-row">
                          <h2 className="manager-disputes__card-title">{dispute.type}</h2>
                          <span
                            className={`manager-disputes__status manager-disputes__status--${dispute.status}`}
                          >
                            {dispute.status}
                          </span>
                          <span className="manager-disputes__ticket">{dispute.ticketNumber}</span>
                        </div>
                      </div>
                    </div>

                    <div className="manager-disputes__actions">
                      <button
                        type="button"
                        className="manager-disputes__btn manager-disputes__btn--details"
                        onClick={() => setDetailDispute(dispute)}
                      >
                        <IconEye />
                        Details
                      </button>
                      {dispute.status !== 'resolved' && dispute.status !== 'rejected' && (
                        <>
                          <button
                            type="button"
                            className="manager-disputes__btn manager-disputes__btn--resolve"
                            onClick={() => handleResolve(dispute)}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="manager-disputes__btn manager-disputes__btn--reject"
                            onClick={() => handleReject(dispute)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="manager-disputes__desc">{dispute.description}</p>

                  <div className="manager-disputes__meta">
                    <div className="manager-disputes__meta-cell">
                      <p>Customer</p>
                      <strong>{dispute.customer}</strong>
                    </div>
                    <div className="manager-disputes__meta-cell">
                      <p>Club</p>
                      <strong>{dispute.club}</strong>
                    </div>
                    <div className="manager-disputes__meta-cell">
                      <p>Amount</p>
                      <strong>€{dispute.amount.toLocaleString()}</strong>
                    </div>
                    <div className="manager-disputes__meta-cell">
                      <p>Filed</p>
                      <strong>{dispute.filedAt}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </div>
        </div>
      </div>

      {/* Details modal */}
      {detailDispute && (
        <div
          className="manager-disputes__modal-overlay"
          role="presentation"
          onClick={() => setDetailDispute(null)}
        >
          <aside
            className="manager-disputes__modal"
            role="dialog"
            aria-modal="true"
            aria-label="Dispute details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="manager-disputes__modal-head">
              <div>
                <h2>{detailDispute.type}</h2>
                <p>
                  <span
                    className={`manager-disputes__status manager-disputes__status--${detailDispute.status}`}
                  >
                    {detailDispute.status}
                  </span>
                  {' '}
                  <span style={{ color: '#5f5f5f', marginLeft: 6 }}>{detailDispute.ticketNumber}</span>
                </p>
              </div>
              <button
                type="button"
                className="manager-disputes__modal-close"
                onClick={() => setDetailDispute(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="manager-disputes__modal-body">
              <div className="manager-disputes__modal-row">
                <div className="manager-disputes__modal-field">
                  <p>Customer</p>
                  <strong>{detailDispute.customer}</strong>
                </div>
                <div className="manager-disputes__modal-field">
                  <p>Club</p>
                  <strong>{detailDispute.club}</strong>
                </div>
              </div>
              <div className="manager-disputes__modal-row">
                <div className="manager-disputes__modal-field">
                  <p>Amount</p>
                  <strong>€{detailDispute.amount.toLocaleString()}</strong>
                </div>
                <div className="manager-disputes__modal-field">
                  <p>Filed</p>
                  <strong>{detailDispute.filedAt}</strong>
                </div>
              </div>
              <div className="manager-disputes__modal-desc">
                <p>Description</p>
                <span>{detailDispute.description}</span>
              </div>
            </div>

            <div className="manager-disputes__modal-footer">
              <button
                type="button"
                className="manager-disputes__modal-dismiss"
                onClick={() => setDetailDispute(null)}
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`manager-disputes__toast manager-disputes__toast--${toast.variant}`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
