import { useCallback, useEffect, useMemo, useState } from 'react'
import './ManagerDashboard.css'
import './ManagerDisputes.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase } from '@/lib/supabase'

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled'

type Dispute = {
  id: string
  subject: string
  description: string
  priority: string
  status: DisputeStatus
  manager_notes: string | null
  created_at: string
  updated_at: string | null
  reservation_id: string | null
  event_name: string | null
  user_name: string | null
  user_email: string | null
  user_phone: string | null
}

function statusUiClass(status: DisputeStatus): 'pending' | 'investigating' | 'resolved' | 'rejected' {
  if (status === 'open') return 'pending'
  if (status === 'in_progress') return 'investigating'
  if (status === 'resolved') return 'resolved'
  return 'rejected'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_ORDER: Record<DisputeStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  rejected: 3,
  cancelled: 4,
}

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const CUSTOMER_MESSAGE_BY_STATUS: Record<DisputeStatus, string> = {
  open: 'Thanks for raising this. We have received your dispute and will review it shortly.',
  in_progress: 'We are reviewing your dispute now. A manager will contact you soon if we need anything else.',
  resolved: 'Your dispute has been reviewed and marked as resolved. Thank you for your patience.',
  rejected: 'Your dispute has been reviewed and closed. The venue was not able to approve this claim.',
  cancelled: 'This dispute was cancelled by the customer before review.',
}

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

type Toast = { message: string; variant: 'resolved' | 'rejected' | 'default' }

export default function ManagerDisputes() {
  const { club } = useManagerClub()
  const { profile } = useAuth()
  const client = managerSupabase
  const clubId = profile?.club_id ?? null

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [detailDispute, setDetailDispute] = useState<Dispute | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState<DisputeStatus>('open')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    setEditNotes(detailDispute?.manager_notes ?? '')
    setEditStatus(detailDispute?.status ?? 'open')
  }, [detailDispute?.id, detailDispute?.manager_notes, detailDispute?.status])

  const loadDisputes = useCallback(async () => {
    if (!client || !isSupabaseConfigured || !clubId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadErr(null)
    const { data, error } = await client
      .from('disputes')
      .select(
        `
        id, subject, description, priority, status, manager_notes, created_at, updated_at, reservation_id,
        events:event_id ( event_name ),
        profiles:user_id ( name, surname, email, phone_number )
      `,
      )
      .eq('club_id', clubId)
      .is('manager_deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      setLoadErr(error.message)
      setDisputes([])
      setLoading(false)
      return
    }

    const items: Dispute[] = ((data ?? []) as Record<string, unknown>[]).map(d => {
      const ev = Array.isArray(d.events) ? d.events[0] : d.events
      const usr = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles
      const u = usr as { name?: string; surname?: string; email?: string; phone_number?: string } | undefined
      const evObj = ev as { event_name?: string } | undefined
      return {
        id: d.id as string,
        subject: d.subject as string,
        description: d.description as string,
        priority: String(d.priority ?? 'medium'),
        status: d.status as DisputeStatus,
        manager_notes: (d.manager_notes as string) ?? null,
        created_at: d.created_at as string,
        updated_at: (d.updated_at as string) ?? (d.created_at as string),
        reservation_id: (d.reservation_id as string) ?? null,
        event_name: evObj?.event_name ?? null,
        user_name: [u?.name, u?.surname].filter(Boolean).join(' ') || null,
        user_email: u?.email ?? null,
        user_phone: u?.phone_number ?? null,
      }
    })

    items.sort((a, b) => {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (sd !== 0) return sd
      return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
    })

    setDisputes(items)
    setLoading(false)
  }, [client, clubId])

  useEffect(() => {
    void loadDisputes()
  }, [loadDisputes])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const stats = useMemo(() => {
    const open = disputes.filter(d => d.status === 'open').length
    const inProgress = disputes.filter(d => d.status === 'in_progress').length
    const resolved = disputes.filter(d => d.status === 'resolved').length
    const active = open + inProgress
    return { pending: open, investigating: inProgress, resolved, atRisk: active }
  }, [disputes])

  async function quickResolve(dispute: Dispute) {
    if (!client || !confirm('Mark this dispute as resolved?')) return
    const updatedAt = new Date().toISOString()
    const { error } = await client.from('disputes').update({ status: 'resolved', updated_at: updatedAt }).eq('id', dispute.id)
    if (error) {
      setToast({ variant: 'default', message: error.message })
      return
    }
    setDisputes(prev => prev.map(d => (d.id === dispute.id ? { ...d, status: 'resolved', updated_at: updatedAt } : d)))
    setToast({ variant: 'resolved', message: 'Marked as resolved.' })
    setDetailDispute(null)
  }

  async function quickStartProgress(dispute: Dispute) {
    if (!client) return
    const updatedAt = new Date().toISOString()
    const { error } = await client.from('disputes').update({ status: 'in_progress', updated_at: updatedAt }).eq('id', dispute.id)
    if (error) {
      setToast({ variant: 'default', message: error.message })
      return
    }
    setDisputes(prev => prev.map(d => (d.id === dispute.id ? { ...d, status: 'in_progress', updated_at: updatedAt } : d)))
    setDetailDispute(prev => (prev?.id === dispute.id ? { ...prev, status: 'in_progress', updated_at: updatedAt } : prev))
  }

  async function saveDetail() {
    if (!client || !detailDispute) return
    setEditSaving(true)
    const updatedAt = new Date().toISOString()
    const newNotes = editNotes.trim() || null
    const payload: Record<string, unknown> = { status: editStatus, updated_at: updatedAt }
    if (newNotes !== null) payload.manager_notes = newNotes
    const { error } = await client.from('disputes').update(payload).eq('id', detailDispute.id)
    setEditSaving(false)
    if (error) {
      setToast({ variant: 'default', message: error.message })
      return
    }
    setDisputes(prev =>
      prev.map(d =>
        d.id === detailDispute.id
          ? { ...d, status: editStatus, manager_notes: newNotes ?? d.manager_notes, updated_at: updatedAt }
          : d,
      ),
    )
    setDetailDispute(null)
    setToast({ variant: 'default', message: 'Dispute updated.' })
  }

  async function archiveDispute(dispute: Dispute) {
    if (!client || !confirm(`Archive this dispute? It will be hidden from your list.`)) return
    const { error } = await client.from('disputes').update({ manager_deleted_at: new Date().toISOString() }).eq('id', dispute.id)
    if (error) {
      setToast({ variant: 'default', message: error.message })
      return
    }
    setDisputes(prev => prev.filter(d => d.id !== dispute.id))
    setDetailDispute(null)
  }

  const STATUSES: DisputeStatus[] = ['open', 'in_progress', 'resolved', 'rejected', 'cancelled']

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-disputes__main">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="manager-disputes__bound">
            <div className="manager-disputes__head">
              <h1 className="manager-dash__page-title">Disputes &amp; Complaints</h1>
              <p className="manager-dash__page-sub">Live disputes from your venue customers</p>
              <button
                type="button"
                onClick={() => void loadDisputes()}
                className="mt-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            {loadErr ? (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{loadErr}</div>
            ) : null}

            {!isSupabaseConfigured || !client ? (
              <p className="text-sm text-muted-foreground">Supabase is not configured.</p>
            ) : !clubId ? (
              <p className="text-sm text-muted-foreground">No club assigned to this manager profile.</p>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Loading disputes…</p>
            ) : (
              <>
                <section className="manager-disputes__stats" aria-label="Dispute statistics">
                  <article className="manager-disputes__stat manager-disputes__stat--pending">
                    <span className="manager-disputes__stat-icon">
                      <IconInfo />
                    </span>
                    <div className="manager-disputes__stat-body">
                      <strong>{stats.pending}</strong>
                      <p>Open</p>
                    </div>
                  </article>

                  <article className="manager-disputes__stat manager-disputes__stat--investigating">
                    <span className="manager-disputes__stat-icon">
                      <IconInfo />
                    </span>
                    <div className="manager-disputes__stat-body">
                      <strong>{stats.investigating}</strong>
                      <p>In progress</p>
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
                      <strong>{stats.atRisk}</strong>
                      <p>Active (open + in progress)</p>
                    </div>
                  </article>
                </section>

                <section className="manager-disputes__list" aria-label="Disputes list">
                  {disputes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8">No disputes for this venue.</p>
                  ) : (
                    disputes.map(dispute => {
                      const ui = statusUiClass(dispute.status)
                      return (
                        <article key={dispute.id} className="manager-disputes__card">
                          <div className="manager-disputes__card-top">
                            <div className="manager-disputes__card-left">
                              <span className="manager-disputes__card-icon" aria-hidden>
                                <IconAlert />
                              </span>
                              <div>
                                <div className="manager-disputes__card-title-row">
                                  <h2 className="manager-disputes__card-title">{dispute.subject}</h2>
                                  <span className={`manager-disputes__status manager-disputes__status--${ui}`}>
                                    {STATUS_LABELS[dispute.status]}
                                  </span>
                                  <span className="manager-disputes__ticket">
                                    {dispute.reservation_id ? dispute.reservation_id.slice(0, 10) : dispute.id.slice(0, 8)}
                                  </span>
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
                                Update
                              </button>
                              {dispute.status === 'open' ? (
                                <button
                                  type="button"
                                  className="manager-disputes__btn manager-disputes__btn--resolve"
                                  onClick={() => void quickStartProgress(dispute)}
                                >
                                  Start review
                                </button>
                              ) : null}
                              {dispute.status !== 'resolved' &&
                              dispute.status !== 'rejected' &&
                              dispute.status !== 'cancelled' ? (
                                <button
                                  type="button"
                                  className="manager-disputes__btn manager-disputes__btn--resolve"
                                  onClick={() => void quickResolve(dispute)}
                                >
                                  Resolve
                                </button>
                              ) : null}
                              {dispute.status === 'resolved' ||
                              dispute.status === 'rejected' ||
                              dispute.status === 'cancelled' ? (
                                <button
                                  type="button"
                                  className="manager-disputes__btn manager-disputes__btn--reject"
                                  onClick={() => void archiveDispute(dispute)}
                                >
                                  Archive
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <p className="manager-disputes__desc">{dispute.description}</p>

                          <div className="manager-disputes__meta">
                            <div className="manager-disputes__meta-cell">
                              <p>Customer</p>
                              <strong>{dispute.user_name ?? dispute.user_email ?? '—'}</strong>
                            </div>
                            <div className="manager-disputes__meta-cell">
                              <p>Event</p>
                              <strong>{dispute.event_name ?? '—'}</strong>
                            </div>
                            <div className="manager-disputes__meta-cell">
                              <p>Priority</p>
                              <strong>{dispute.priority}</strong>
                            </div>
                            <div className="manager-disputes__meta-cell">
                              <p>Filed</p>
                              <strong>{formatDate(dispute.created_at)}</strong>
                            </div>
                          </div>
                          {dispute.user_email ? (
                            <p className="text-xs text-muted-foreground mt-2">
                              <a className="text-primary underline" href={`mailto:${dispute.user_email}`}>
                                {dispute.user_email}
                              </a>
                              {dispute.user_phone ? (
                                <>
                                  {' · '}
                                  <a className="text-primary underline" href={`tel:${dispute.user_phone}`}>
                                    {dispute.user_phone}
                                  </a>
                                </>
                              ) : null}
                            </p>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

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
            aria-label="Update dispute"
            onClick={e => e.stopPropagation()}
          >
            <div className="manager-disputes__modal-head">
              <div>
                <h2>{detailDispute.subject}</h2>
                <p>
                  <span className={`manager-disputes__status manager-disputes__status--${statusUiClass(editStatus)}`}>
                    {STATUS_LABELS[editStatus]}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="manager-disputes__modal-close"
                onClick={() => setDetailDispute(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="manager-disputes__modal-body">
              <p className="text-xs text-muted-foreground mb-2">Status</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUSES.map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEditStatus(st)}
                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                      editStatus === st ? 'border-primary bg-primary/20 text-white' : 'border-white/15 text-muted-foreground'
                    }`}
                  >
                    {STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{CUSTOMER_MESSAGE_BY_STATUS[editStatus]}</p>
              <label className="text-xs font-semibold text-muted-foreground">Message to customer</label>
              <textarea
                className="mt-1 w-full min-h-[100px] rounded-lg border border-white/10 bg-black/20 p-2 text-sm text-white"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder={CUSTOMER_MESSAGE_BY_STATUS[editStatus]}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => setEditNotes(CUSTOMER_MESSAGE_BY_STATUS[editStatus])}
                >
                  Use suggested message
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 mb-2">
                Visible to the customer in their disputes list.
              </p>
              <p className="text-sm text-white/90 mt-3">{detailDispute.description}</p>
            </div>

            <div className="manager-disputes__modal-footer">
              <button
                type="button"
                className="manager-disputes__modal-dismiss"
                disabled={editSaving}
                onClick={() => void saveDetail()}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="manager-disputes__modal-dismiss" onClick={() => setDetailDispute(null)}>
                Close
              </button>
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div className={`manager-disputes__toast manager-disputes__toast--${toast.variant}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
