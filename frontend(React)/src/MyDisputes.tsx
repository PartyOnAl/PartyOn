import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
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

const STATUS_META: Record<DisputeStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#f87171' },
  in_progress: { label: 'In progress', color: '#fbbf24' },
  resolved: { label: 'Resolved', color: '#4ade80' },
  rejected: { label: 'Rejected', color: '#a1a1aa' },
  cancelled: { label: 'Cancelled', color: '#a1a1aa' },
}

const PRIORITY_META: Record<DisputePriority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#4ade80' },
  medium: { label: 'Medium', color: '#fbbf24' },
  high: { label: 'High', color: '#f87171' },
}

const STATUS_HELP: Record<DisputeStatus, string> = {
  open: 'Your dispute has been sent to the venue team.',
  in_progress: 'A manager is reviewing this and should update you soon.',
  resolved: 'The venue marked this dispute as resolved.',
  rejected: 'The venue closed this dispute without accepting the claim.',
  cancelled: 'You cancelled this dispute before the venue started reviewing it.',
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disputes', filter: `user_id=eq.${user.id}` },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
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
    const payload = {
      subject: editSubject.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      updated_at: updatedAt,
    }
    const { error } = await client.from('disputes').update(payload).eq('id', editing.id).eq('user_id', user.id).eq('status', 'open')
    setEditSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setDisputes(prev => prev.map(d => (d.id === editing.id ? { ...d, ...payload } : d)))
    setEditing(null)
  }

  function cancelDispute(dispute: Dispute) {
    if (!user?.id || !client || dispute.status !== 'open') return
    if (!confirm('Cancel this open dispute? The venue will see that it was cancelled.')) return
    void (async () => {
      const updatedAt = new Date().toISOString()
      const { error } = await client
        .from('disputes')
        .update({ status: 'cancelled', updated_at: updatedAt })
        .eq('id', dispute.id)
        .eq('user_id', user.id)
        .eq('status', 'open')
      if (error) {
        setErr(error.message)
        return
      }
      setDisputes(prev => prev.map(d => (d.id === dispute.id ? { ...d, status: 'cancelled', updated_at: updatedAt } : d)))
    })()
  }

  function clearDispute(dispute: Dispute) {
    if (!user?.id || !client) return
    if (dispute.status !== 'resolved' && dispute.status !== 'rejected' && dispute.status !== 'cancelled') return
    if (!confirm('Remove this finished dispute from your list?')) return
    void (async () => {
      const { error } = await client
        .from('disputes')
        .update({ user_cleared_at: new Date().toISOString() })
        .eq('id', dispute.id)
        .eq('user_id', user.id)
        .in('status', ['resolved', 'rejected', 'cancelled'])
      if (error) {
        setErr(error.message)
        return
      }
      setDisputes(prev => prev.filter(d => d.id !== dispute.id))
    })()
  }

  const filtered = filterStatus === 'all' ? disputes : disputes.filter(d => d.status === filterStatus)
  const counts = disputes.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const FILTER_TABS: { key: DisputeFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: disputes.length },
    { key: 'open', label: 'Open', count: counts.open ?? 0 },
    { key: 'in_progress', label: 'In progress', count: counts.in_progress ?? 0 },
    { key: 'resolved', label: 'Resolved', count: counts.resolved ?? 0 },
    { key: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled ?? 0 },
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
      <main className="po-container px-4 pb-16 pt-24 md:px-0">
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <header className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">My disputes</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track submissions and manager replies. File new disputes from{' '}
              <Link to="/my-bookings" className="text-primary underline-offset-2 hover:underline">
                past bookings
              </Link>
              .
            </p>
          </header>

          {err ? (
            <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilterStatus(t.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filterStatus === t.key
                    ? 'border-primary/50 bg-primary/20 text-white'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : disputes.length === 0 ? (
            <section className="rounded-2xl border border-white/10 bg-[#101016]/80 px-6 py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-bold text-white">No disputes yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Use Past bookings to rate an event or file a dispute.</p>
            </section>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">No disputes in this filter.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map(d => {
                const sm = STATUS_META[d.status]
                const pm = PRIORITY_META[d.priority]
                const canEdit = d.status === 'open'
                const canCancel = d.status === 'open'
                const canClear = d.status === 'resolved' || d.status === 'rejected' || d.status === 'cancelled'
                return (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-white/10 bg-[#101016]/80 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-white">{d.subject}</h2>
                        {d.event_name ? <p className="text-xs text-muted-foreground">{d.event_name}</p> : null}
                      </div>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                        style={{ borderColor: sm.color, color: sm.color }}
                      >
                        {sm.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/80">{d.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{STATUS_HELP[d.status]}</p>
                    {d.manager_notes ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                        <span className="text-xs font-bold text-primary">Manager response</span>
                        <p className="mt-1 text-white/90">{d.manager_notes}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Awaiting manager response</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: pm.color }}>
                        {pm.label} priority
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Updated {formatDate(d.updated_at ?? d.created_at)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canEdit ? (
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          onClick={() => setEditing(d)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canCancel ? (
                        <button
                          type="button"
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          onClick={() => cancelDispute(d)}
                        >
                          Cancel dispute
                        </button>
                      ) : null}
                      {canClear ? (
                        <button
                          type="button"
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/5"
                          onClick={() => clearDispute(d)}
                        >
                          Clear from list
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#14141c] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Edit dispute</h2>
            <p className="mt-1 text-xs text-muted-foreground">Editable until a manager changes status from Open.</p>
            <div className="mt-4 flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setEditPriority(p)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-bold ${
                    editPriority === p ? 'border-primary/50 bg-primary/20 text-white' : 'border-white/10 text-muted-foreground'
                  }`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">Subject</label>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
            />
            <label className="mt-3 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEdit()}
                className="flex-1 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LovableFooter />
    </div>
  )
}
