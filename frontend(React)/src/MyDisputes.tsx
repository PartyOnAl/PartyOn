import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Loader2, MessageSquare, XCircle } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { LovableFooter } from '@/components/LovableFooter'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured, userSupabase } from '@/lib/supabase'

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled'
type DisputePriority = 'low' | 'medium' | 'high'
type DisputeFilter = DisputeStatus | 'all'

type Dispute = {
  id: string
  subject: string
  description: string
  priority: DisputePriority
  status: DisputeStatus
  manager_notes: string | null
  created_at: string
  updated_at: string
  event_name: string | null
}

const STATUS_CONFIG: Record<DisputeStatus, {
  label: string
  color: string
  bg: string
  border: string
  leftBar: string
  icon: React.ReactNode
  help: string
}> = {
  open: {
    label: 'Open',
    color: 'text-rose-300',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    leftBar: 'bg-rose-500',
    icon: <AlertCircle className="h-4 w-4" />,
    help: 'Your dispute has been sent to the venue team and is awaiting review.',
  },
  in_progress: {
    label: 'In Review',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    leftBar: 'bg-amber-400',
    icon: <Clock className="h-4 w-4" />,
    help: 'A manager is actively reviewing this — you should hear back soon.',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    leftBar: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-4 w-4" />,
    help: 'The venue has resolved this dispute. Thank you for your patience.',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    leftBar: 'bg-zinc-600',
    icon: <XCircle className="h-4 w-4" />,
    help: 'The venue reviewed and closed this dispute without accepting the claim.',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-zinc-500',
    bg: 'bg-zinc-500/8',
    border: 'border-zinc-500/15',
    leftBar: 'bg-zinc-700',
    icon: <XCircle className="h-4 w-4" />,
    help: 'You cancelled this dispute before the venue started reviewing it.',
  },
}

const PRIORITY_CONFIG: Record<DisputePriority, { label: string; dot: string }> = {
  low: { label: 'Low', dot: 'bg-emerald-400' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  high: { label: 'High', dot: 'bg-rose-400' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function mapDisputeRow(d: Record<string, unknown>): Dispute {
  const ev = Array.isArray(d.events) ? d.events[0] : d.events
  const evObj = ev as { event_name?: string } | undefined
  return {
    id: d.id as string,
    subject: d.subject as string,
    description: d.description as string,
    priority: d.priority as DisputePriority,
    status: d.status as DisputeStatus,
    manager_notes: (d.manager_notes as string) ?? null,
    created_at: d.created_at as string,
    updated_at: (d.updated_at as string) ?? (d.created_at as string),
    event_name: evObj?.event_name ?? null,
  }
}

export default function MyDisputes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const client = userSupabase
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<DisputeFilter>('all')
  const [editing, setEditing] = useState<Dispute | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority, setEditPriority] = useState<DisputePriority>('medium')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    setEditSubject(editing?.subject ?? '')
    setEditDescription(editing?.description ?? '')
    setEditPriority(editing?.priority ?? 'medium')
  }, [editing?.id, editing?.subject, editing?.description, editing?.priority])

  const load = useCallback(async () => {
    if (!client || !isSupabaseConfigured || !user?.id) {
      setLoading(false)
      return
    }

    const filtered = await client
      .from('disputes')
      .select('id,subject,description,priority,status,manager_notes,created_at,updated_at,user_cleared_at,events:event_id(event_name)')
      .eq('user_id', user.id)
      .is('user_cleared_at', null)
      .is('manager_deleted_at', null)
      .order('updated_at', { ascending: false, nullsFirst: false })

    const result = filtered.error
      ? await client
          .from('disputes')
          .select('id,subject,description,priority,status,manager_notes,created_at,updated_at,events:event_id(event_name)')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false, nullsFirst: false })
      : filtered

    if (result.error) {
      setErr(result.error.message)
      setLoading(false)
      return
    }
    setDisputes(((result.data ?? []) as Record<string, unknown>[]).map(mapDisputeRow))
    setLoading(false)
  }, [user?.id, client])

  useEffect(() => {
    if (!client || !isSupabaseConfigured) {
      setLoading(false)
      return
    }
    void (async () => {
      const { data: { user: u } } = await client.auth.getUser()
      if (!u) {
        navigate('/login', { replace: true })
        return
      }
      setLoading(true)
      await load()
    })()
  }, [client, navigate, load])

  useEffect(() => {
    if (!client || !user?.id) return
    const channelName = `disputes-web:${user.id}:${Date.now()}`
    const channel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes', filter: `user_id=eq.${user.id}` }, () => {
        void load()
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [client, load, user?.id])

  async function saveEdit() {
    if (!editing || !user?.id || !client) return
    if (editing.status !== 'open') {
      alert('This dispute can no longer be edited because the manager has started reviewing it.')
      setEditing(null)
      return
    }
    if (!editSubject.trim() || !editDescription.trim()) {
      setErr('Please add both a subject and a description.')
      return
    }
    setEditSaving(true)
    setErr(null)
    const updatedAt = new Date().toISOString()
    const payload = { subject: editSubject.trim(), description: editDescription.trim(), priority: editPriority, updated_at: updatedAt }
    const { error } = await client.from('disputes').update(payload).eq('id', editing.id).eq('user_id', user.id).eq('status', 'open')
    setEditSaving(false)
    if (error) { setErr(error.message); return }
    setDisputes(prev => prev.map(d => (d.id === editing.id ? { ...d, ...payload } : d)))
    setEditing(null)
  }

  function cancelDispute(dispute: Dispute) {
    if (!user?.id || !client || dispute.status !== 'open') return
    if (!confirm('Cancel this open dispute? The venue will see that it was cancelled.')) return
    void (async () => {
      const updatedAt = new Date().toISOString()
      const { error } = await client.from('disputes').update({ status: 'cancelled', updated_at: updatedAt }).eq('id', dispute.id).eq('user_id', user.id).eq('status', 'open')
      if (error) { setErr(error.message); return }
      setDisputes(prev => prev.map(d => (d.id === dispute.id ? { ...d, status: 'cancelled' as DisputeStatus, updated_at: updatedAt } : d)))
    })()
  }

  function clearDispute(dispute: Dispute) {
    if (!user?.id || !client) return
    if (dispute.status !== 'resolved' && dispute.status !== 'rejected' && dispute.status !== 'cancelled') return
    if (!confirm('Remove this finished dispute from your list?')) return
    void (async () => {
      const { error } = await client.from('disputes').update({ user_cleared_at: new Date().toISOString() }).eq('id', dispute.id).eq('user_id', user.id).in('status', ['resolved', 'rejected', 'cancelled'])
      if (error) { setErr(error.message); return }
      setDisputes(prev => prev.filter(d => d.id !== dispute.id))
    })()
  }

  const filtered = filterStatus === 'all' ? disputes : disputes.filter(d => d.status === filterStatus)

  const counts = {
    all: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    in_progress: disputes.filter(d => d.status === 'in_progress').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
    cancelled: disputes.filter(d => d.status === 'cancelled').length,
  }

  const FILTER_TABS: { key: DisputeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Review' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  if (!isSupabaseConfigured || !client) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="po-container px-4 pb-16 pt-24">
          <p className="text-red-300">Supabase is not configured.</p>
        </main>
        <LovableFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="po-container px-4 pb-20 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-3xl">

          {/* Back */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              My Disputes
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track your submissions and venue responses. File new disputes from{' '}
              <Link to="/my-bookings" className="font-semibold text-primary underline-offset-2 hover:underline">
                My Bookings
              </Link>
              .
            </p>
          </div>

          {/* Stats */}
          {disputes.length > 0 ? (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <p className="text-2xl font-extrabold text-white">{counts.all}</p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">Total</p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                <p className="text-2xl font-extrabold text-rose-300">{counts.open}</p>
                <p className="mt-0.5 text-xs font-medium text-rose-400/70">Open</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                <p className="text-2xl font-extrabold text-amber-300">{counts.in_progress}</p>
                <p className="mt-0.5 text-xs font-medium text-amber-400/70">In Review</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                <p className="text-2xl font-extrabold text-emerald-300">{counts.resolved}</p>
                <p className="mt-0.5 text-xs font-medium text-emerald-400/70">Resolved</p>
              </div>
            </div>
          ) : null}

          {err ? (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>
          ) : null}

          {/* Filter tabs */}
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTER_TABS.map(t => {
              const count = counts[t.key]
              const active = filterStatus === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterStatus(t.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'border-primary/50 bg-primary/15 text-white shadow-[0_0_12px_-4px_rgba(236,72,153,0.4)]'
                      : 'border-white/10 bg-white/4 text-muted-foreground hover:border-white/20 hover:text-white/70'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/15 text-white' : 'bg-white/8 text-muted-foreground'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            </div>
          ) : disputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/3 px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <MessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-bold text-white">No disputes yet</h2>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                If you had an issue at a venue, you can file a dispute from any booking.
              </p>
              <Link
                to="/my-bookings"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 px-5 py-2 text-sm font-bold text-white"
              >
                View my bookings
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No disputes with this status.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(d => {
                const cfg = STATUS_CONFIG[d.status]
                const pri = PRIORITY_CONFIG[d.priority]
                const canEdit = d.status === 'open'
                const canCancel = d.status === 'open'
                const canClear = d.status === 'resolved' || d.status === 'rejected' || d.status === 'cancelled'

                return (
                  <div
                    key={d.id}
                    className={`relative overflow-hidden rounded-2xl border bg-[#0e0e14] ${cfg.border} transition-shadow hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)]`}
                  >
                    {/* Left status bar */}
                    <div className={`absolute left-0 top-0 h-full w-1 ${cfg.leftBar}`} />

                    <div className="pl-5 pr-4 pt-4 pb-4">
                      {/* Top row */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${pri.dot}`} />
                              {pri.label} priority
                            </span>
                          </div>
                          <h2 className="mt-2 text-base font-bold text-white leading-snug">{d.subject}</h2>
                          {d.event_name ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{d.event_name}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground/60 mt-0.5">
                          {formatDate(d.updated_at ?? d.created_at)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="mt-3 text-sm leading-relaxed text-white/70">{d.description}</p>

                      {/* Status help */}
                      <p className="mt-2 text-xs italic text-muted-foreground/70">{cfg.help}</p>

                      {/* Manager response */}
                      {d.manager_notes ? (
                        <div className="mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-fuchsia-500/5 px-4 py-3">
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary/80">Venue response</p>
                          <p className="text-sm text-white/90 leading-relaxed">{d.manager_notes}</p>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/50">
                          <Clock className="h-3.5 w-3.5" />
                          Awaiting venue response
                        </div>
                      )}

                      {/* Actions */}
                      {(canEdit || canCancel || canClear) ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/6 pt-3">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => setEditing(d)}
                              className="rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                            >
                              Edit
                            </button>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              onClick={() => cancelDispute(d)}
                              className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15"
                            >
                              Cancel dispute
                            </button>
                          ) : null}
                          {canClear ? (
                            <button
                              type="button"
                              onClick={() => clearDispute(d)}
                              className="rounded-lg border border-white/8 px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 transition hover:bg-white/5 hover:text-muted-foreground"
                            >
                              Clear from list
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/12 bg-[#111118] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-base font-bold text-white">Edit dispute</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Only editable while status is Open.</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Priority</p>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold capitalize transition ${
                        editPriority === p
                          ? 'border-primary/50 bg-primary/15 text-white'
                          : 'border-white/10 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Subject</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-none"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  placeholder="Brief subject line"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  className="min-h-[110px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-primary/40 focus:outline-none"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Describe the issue…"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/8 px-5 py-4">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LovableFooter />
    </div>
  )
}
