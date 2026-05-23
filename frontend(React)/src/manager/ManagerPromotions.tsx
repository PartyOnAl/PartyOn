import { type FormEvent, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import './ManagerDashboard.css'
import './EventManagement.css'
import { TimePickerField } from './EventManagement'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type PromotionRow = {
  promotion_id: string
  title: string
  description: string | null
  category: string | null
  discount_value: string | null
  original_price: number | string | null
  valid_from: string | null
  valid_until: string | null
  status: string | null
  image_url: string | null
  created_at: string | null
}

type PromotionFormState = {
  title: string
  description: string
  category: string
  discount_value: string
  original_price: string
  valid_from: string
  valid_until: string
  image_url: string
  status: 'active' | 'pending'
}

type FormErrors = Partial<Record<'title' | 'valid_until', string>>

type ToastState = { type: 'success' | 'error'; message: string } | null

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateLocalPart(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Value is datetime-local shaped: YYYY-MM-DDTHH:mm */
function toDateTimeLocalValue(d: Date): string {
  return `${toDateLocalPart(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDateTimeLocal(s: string): Date | null {
  if (!s?.trim() || !s.includes('T')) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function splitDateTimeLocal(v: string): { date: string; time: string } {
  if (!v?.includes('T')) return { date: '', time: '12:00' }
  const [d, tRaw] = v.split('T')
  const t = (tRaw || '12:00').slice(0, 5)
  return { date: d ?? '', time: t.length === 5 ? t : '12:00' }
}

function formatDateTimeReadable(s: string): string {
  const d = parseDateTimeLocal(s)
  if (!d) return 'Select date & time'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function humanRangeSummary(fromStr: string, untilStr: string): string | null {
  const a = parseDateTimeLocal(fromStr)
  const b = parseDateTimeLocal(untilStr)
  if (!a || !b || b.getTime() <= a.getTime()) return null
  const ms = b.getTime() - a.getTime()
  const totalMinutes = Math.floor(ms / 60000)
  const totalHours = Math.floor(ms / 3600000)
  const totalDays = Math.floor(ms / 86400000)
  if (totalDays >= 1) {
    const remH = Math.floor((ms % 86400000) / 3600000)
    if (totalDays === 1 && remH === 0) return 'This promotion runs for 1 day.'
    if (remH > 0)
      return `This promotion runs for ${totalDays} day${totalDays === 1 ? '' : 's'} and ${remH} hour${remH === 1 ? '' : 's'}.`
    return `This promotion runs for ${totalDays} day${totalDays === 1 ? '' : 's'}.`
  }
  if (totalHours >= 1) {
    const remM = Math.floor((ms % 3600000) / 60000)
    if (totalHours === 1 && remM === 0) return 'This promotion runs for 1 hour.'
    if (remM > 0)
      return `This promotion runs for ${totalHours} hour${totalHours === 1 ? '' : 's'} and ${remM} minute${remM === 1 ? '' : 's'}.`
    return `This promotion runs for ${totalHours} hour${totalHours === 1 ? '' : 's'}.`
  }
  if (totalMinutes >= 1) return `This promotion runs for ${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}.`
  return 'This promotion runs for less than a minute.'
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0)
  return x
}

function promotionRowToFormState(promo: PromotionRow): PromotionFormState {
  const statusRaw = (promo.status ?? 'pending').toLowerCase()
  const status: PromotionFormState['status'] =
    statusRaw === 'active' || statusRaw === 'pending' ? statusRaw : 'pending'

  let valid_from = ''
  if (promo.valid_from) {
    const d = new Date(promo.valid_from)
    if (!Number.isNaN(d.getTime())) valid_from = toDateTimeLocalValue(d)
  }
  let valid_until = ''
  if (promo.valid_until) {
    const d = new Date(promo.valid_until)
    if (!Number.isNaN(d.getTime())) valid_until = toDateTimeLocalValue(d)
  }

  const dv = promo.discount_value
  let discount_value = ''
  if (dv != null && String(dv).trim() !== '') {
    const n = Number(dv)
    if (Number.isFinite(n)) discount_value = String(n)
  }

  const op = promo.original_price
  let original_price = ''
  if (op != null && String(op).trim() !== '') {
    const n = Number(op)
    original_price = Number.isFinite(n) ? String(n) : ''
  }

  return {
    title: promo.title ?? '',
    description: promo.description ?? '',
    category: promo.category ?? '',
    discount_value,
    original_price,
    valid_from,
    valid_until,
    image_url: promo.image_url ?? '',
    status,
  }
}

function presetThisWeekendRange(): { from: Date; until: Date } {
  const now = new Date()
  const day = now.getDay()
  if (day === 0) {
    return { from: now, until: endOfLocalDay(now) }
  }
  if (day === 6) {
    const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return { from: now, until: endOfLocalDay(sun) }
  }
  const daysUntilSat = (6 - day + 7) % 7
  const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSat, 0, 0, 0, 0)
  const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1)
  return { from: sat, until: endOfLocalDay(sun) }
}

// ─── DateTimePickerField (promotion modal) ───────────────────────────────────

function DateTimePickerField({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string
  onChange: (dateTimeLocal: string) => void
}) {
  const { date: datePart, time: timePart } = splitDateTimeLocal(value)
  const initialMonth = datePart
    ? new Date(`${datePart}T12:00`)
    : new Date()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )

  useEffect(() => {
    if (!datePart) return
    const d = new Date(`${datePart}T12:00`)
    if (Number.isNaN(d.getTime())) return
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [datePart])
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const currentDateStr = datePart || toDateLocalPart(new Date())

  return (
    <div className="event-mgmt__field event-mgmt__picker-field">
      <label>{label}</label>
      <button
        type="button"
        className={error ? 'event-mgmt__picker-trigger event-mgmt__input--error' : 'event-mgmt__picker-trigger'}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>{formatDateTimeReadable(value)}</span>
        <span className="event-mgmt__picker-icon" aria-hidden>
          ▾
        </span>
      </button>
      {isOpen && (
        <div className="event-time-picker__popover">
          <div className="event-mgmt__calendar-head">
            <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <strong>
              {MONTH_NAMES[month]} {year}
            </strong>
            <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          <div className="event-mgmt__calendar-weekdays">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="event-mgmt__calendar-grid">
            {cells.map((day, idx) => {
              if (day === null) return <span key={`blank-${idx}`} />
              const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={
                    datePart === dateValue
                      ? 'event-mgmt__calendar-day event-mgmt__calendar-day--active'
                      : 'event-mgmt__calendar-day'
                  }
                  onClick={() => {
                    onChange(`${dateValue}T${timePart}`)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="event-time-picker__time-embed">
            <TimePickerField
              label="Time"
              value={timePart}
              onChange={(t) => onChange(`${currentDateStr}T${t}`)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function IconPlus() {
  return (
    <svg className="event-mgmt__btn-plus" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function IconTag() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconDollar() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg className="event-mgmt__action-ic event-mgmt__action-ic--compact" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M10 11v8M14 11v8M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 14a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Promotion Card ───────────────────────────────────────────────────────────

function PromotionCard({
  promo,
  onEdit,
  onDelete,
}: {
  promo: PromotionRow
  onEdit: (promo: PromotionRow) => void
  onDelete: (id: string) => void
}) {
  const imgVariants = ['violet', 'cyan', 'placeholder'] as const
  const imgKey = Math.abs([...promo.promotion_id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 3
  const imgClass = imgVariants[imgKey] === 'placeholder'
    ? 'event-mgmt__card-img event-mgmt__card-img--placeholder'
    : `event-mgmt__card-img event-mgmt__card-img--${imgVariants[imgKey]}`

  const statusKey = (promo.status ?? 'pending').toLowerCase()
  const badgeClass =
    statusKey === 'active'
      ? 'event-mgmt__badge event-mgmt__badge--status'
      : statusKey === 'pending'
        ? 'event-mgmt__badge event-mgmt__badge--status-pending'
        : 'event-mgmt__badge event-mgmt__badge--genre'

  const validFrom = promo.valid_from
    ? new Date(promo.valid_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const validUntil = promo.valid_until
    ? new Date(promo.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <article className="event-mgmt__card">
      {promo.image_url
        ? <img className="event-mgmt__card-img" src={promo.image_url} alt={promo.title} style={{ objectFit: 'cover' }} />
        : <div className={imgClass} aria-hidden />}
      <div className="event-mgmt__card-body">
        <h2 className="event-mgmt__card-title">{promo.title}</h2>
        <div className="event-mgmt__badges">
          <span className={badgeClass}>{promo.status ?? 'pending'}</span>
          {promo.category && (
            <span className="event-mgmt__badge event-mgmt__badge--genre">{promo.category}</span>
          )}
        </div>
        <ul className="event-mgmt__meta">
          {promo.discount_value && (
            <li className="event-mgmt__meta-row">
              <IconDollar />
              <span>{promo.discount_value}% discount</span>
            </li>
          )}
          {(validFrom || validUntil) && (
            <li className="event-mgmt__meta-row">
              <IconCalendar />
              <span>
                {validFrom && validUntil
                  ? `${validFrom} – ${validUntil}`
                  : validFrom
                  ? `From ${validFrom}`
                  : `Until ${validUntil}`}
              </span>
            </li>
          )}
          {promo.description && (
            <li className="event-mgmt__meta-row">
              <IconTag />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {promo.description}
              </span>
            </li>
          )}
        </ul>
        <div className="event-mgmt__card-actions">
          <div className="event-mgmt__card-actions-main" />
          <button
            type="button"
            className="event-mgmt__action event-mgmt__action--edit-icon"
            aria-label={`Edit ${promo.title}`}
            onClick={() => onEdit(promo)}
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="event-mgmt__action event-mgmt__action--danger-icon"
            aria-label={`Delete ${promo.title}`}
            onClick={() => onDelete(promo.promotion_id)}
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM: PromotionFormState = {
  title: '',
  description: '',
  category: '',
  discount_value: '',
  original_price: '',
  valid_from: '',
  valid_until: '',
  image_url: '',
  status: 'pending',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerPromotions() {
  const { club, clubId } = useManagerClub()
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [toast, setToast] = useState<ToastState>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<PromotionFormState>(EMPTY_FORM)
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null)

  function resetForm() {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setEditingPromotionId(null)
  }

  function closeModal() {
    setShowForm(false)
    resetForm()
  }

  function openAddModal() {
    setFormErrors({})
    setEditingPromotionId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEditModal(promo: PromotionRow) {
    setFormErrors({})
    setForm(promotionRowToFormState(promo))
    setEditingPromotionId(promo.promotion_id)
    setShowForm(true)
  }

  // ── Fetch promotions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    setError(null)
    const now = new Date().toISOString()
    void supabase
      .from('promotions')
      .select('promotion_id, title, description, category, discount_value, original_price, valid_from, valid_until, status, image_url, created_at')
      .eq('club_id', clubId)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .order('valid_until', { ascending: true, nullsFirst: false })
      .order('promotion_id', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setPromotions((data ?? []) as PromotionRow[])
        setLoading(false)
      })
  }, [clubId, refreshKey])

  // ── Auto-dismiss toast ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Promotions', value: String(promotions.length) },
    { label: 'Active',           value: String(promotions.filter((p) => p.status === 'active').length) },
    { label: 'Pending',          value: String(promotions.filter((p) => p.status === 'pending').length) },
    {
      label: 'Expired',
      value: String(
        promotions.filter((p) => {
          if (!p.valid_until) return false
          const t = new Date(p.valid_until).getTime()
          return Number.isFinite(t) && t < Date.now()
        }).length,
      ),
    },
  ]

  const promotionRangeSummary = humanRangeSummary(form.valid_from, form.valid_until)

  function applyPromotionDatePreset(preset: 'today' | 'weekend' | 'week' | 'month') {
    setFormErrors((prev) => {
      if (!prev.valid_until) return prev
      const { valid_until: _omit, ...rest } = prev
      return rest
    })
    const now = new Date()
    if (preset === 'today') {
      setForm((f) => ({
        ...f,
        valid_from: toDateTimeLocalValue(now),
        valid_until: toDateTimeLocalValue(endOfLocalDay(now)),
      }))
      return
    }
    if (preset === 'weekend') {
      const { from, until } = presetThisWeekendRange()
      setForm((f) => ({
        ...f,
        valid_from: toDateTimeLocalValue(from),
        valid_until: toDateTimeLocalValue(until),
      }))
      return
    }
    if (preset === 'week') {
      const until = new Date(now.getTime() + 7 * 86400000)
      setForm((f) => ({
        ...f,
        valid_from: toDateTimeLocalValue(now),
        valid_until: toDateTimeLocalValue(until),
      }))
      return
    }
    const until = new Date(now.getTime() + 30 * 86400000)
    setForm((f) => ({
      ...f,
      valid_from: toDateTimeLocalValue(now),
      valid_until: toDateTimeLocalValue(until),
    }))
  }

  // ── Submit handler ────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const nextErrors: FormErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Title is required.'
    const validFromDt = parseDateTimeLocal(form.valid_from)
    const validUntilDt = parseDateTimeLocal(form.valid_until)
    if (
      validFromDt && validUntilDt &&
      validUntilDt.getTime() <= validFromDt.getTime()
    ) {
      nextErrors.valid_until = '"Valid until" must be after "Valid from".'
    }
    if (Object.keys(nextErrors).length > 0) { setFormErrors(nextErrors); return }
    setFormErrors({})

    if (!supabase || !isSupabaseConfigured) {
      setToast({ type: 'error', message: 'Supabase is not configured.' })
      return
    }
    if (!clubId) {
      setToast({ type: 'error', message: 'No club found for your account.' })
      return
    }

    setIsSubmitting(true)
    setToast(null)

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        original_price: form.original_price.trim() ? Number(form.original_price) : null,
        valid_from: form.valid_from.trim() ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until.trim() ? new Date(form.valid_until).toISOString() : null,
        image_url: form.image_url.trim() || null,
        status: form.status,
      }

      if (editingPromotionId) {
        const { error: updateErr } = await supabase
          .from('promotions')
          .update(payload)
          .eq('promotion_id', editingPromotionId)
          .eq('club_id', clubId)
        if (updateErr) throw new Error(updateErr.message)
        setToast({ type: 'success', message: 'Promotion updated successfully!' })
      } else {
        const { error: insertErr } = await supabase
          .from('promotions')
          .insert({ ...payload, club_id: clubId })
        if (insertErr) throw new Error(insertErr.message)
        setToast({ type: 'success', message: 'Promotion created successfully!' })
      }

      closeModal()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────────
  async function handleDelete(promotionId: string) {
    if (!supabase || !isSupabaseConfigured) return
    const { error: delErr } = await supabase
      .from('promotions')
      .delete()
      .eq('promotion_id', promotionId)
    if (delErr) {
      setToast({ type: 'error', message: delErr.message })
    } else {
      setToast({ type: 'success', message: 'Promotion deleted.' })
      setRefreshKey((k) => k + 1)
    }
  }

  // ── Loading / Error shells ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--event-mgmt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#8a8a8a' }}>Loading promotions…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--event-mgmt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#f87171' }}>Error: {error}</span>
          </div>
        </div>
      </div>
    )
  }

  const isEditMode = editingPromotionId != null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-dash__main--event-mgmt">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="event-mgmt__bound">
            <header className="event-mgmt__head">
              <div className="event-mgmt__head-text">
                <h1 className="manager-dash__page-title">Promotions</h1>
                <p className="manager-dash__page-sub">Create and manage your club promotions</p>
              </div>
              <button
                type="button"
                className="event-mgmt__create"
                onClick={openAddModal}
              >
                <IconPlus />
                Add Promotion
              </button>
            </header>

            {toast && (
              <div className={`event-mgmt__toast event-mgmt__toast--${toast.type}`}>
                {toast.message}
              </div>
            )}

            {/* ── Add / Edit Promotion Modal ────────────────────────────────── */}
            {showForm && (
              <div className="event-mgmt__modal-overlay" onClick={closeModal} role="presentation">
                <aside
                  className="event-mgmt__modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={isEditMode ? 'Edit Promotion' : 'Add Promotion'}
                >
                  <div className="event-mgmt__modal-header">
                    <h2>{isEditMode ? 'Edit Promotion' : 'Add Promotion'}</h2>
                    <button
                      type="button"
                      className="event-mgmt__modal-close"
                      onClick={closeModal}
                      aria-label={isEditMode ? 'Close edit promotion modal' : 'Close add promotion modal'}
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="event-mgmt__modal-form">
                    <div className="event-mgmt__modal-body">
                      {/* Title */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Promotion Title</label>
                        <input
                          className={formErrors.title ? 'event-mgmt__input event-mgmt__input--error' : 'event-mgmt__input'}
                          type="text"
                          placeholder="e.g. Free entry before midnight"
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        />
                        {formErrors.title && <p className="event-mgmt__field-error">{formErrors.title}</p>}
                      </div>

                      {/* Category */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Category</label>
                        <select
                          className="event-mgmt__input event-mgmt__select"
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        >
                          <option value="">Select category</option>
                          <option value="Entry">Entry</option>
                          <option value="Drinks">Drinks</option>
                          <option value="VIP">VIP</option>
                          <option value="Tables">Tables</option>
                          <option value="Food">Food</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Original Price + Discount % */}
                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Original Price</label>
                          <div className="event-mgmt__currency-input">
                            <span aria-hidden>€</span>
                            <input
                              className="event-mgmt__currency-input-field"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Optional"
                              value={form.original_price}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, original_price: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <div className="event-mgmt__field">
                          <label>Discount %</label>
                          <input
                            className="event-mgmt__input"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            placeholder="e.g. 20"
                            value={form.discount_value}
                            onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Valid from + until */}
                      <div className="event-mgmt__field-grid">
                        <DateTimePickerField
                          label="Valid From"
                          value={form.valid_from}
                          onChange={(v) => setForm((f) => ({ ...f, valid_from: v }))}
                        />
                        <DateTimePickerField
                          label="Valid Until"
                          value={form.valid_until}
                          error={formErrors.valid_until}
                          onChange={(v) => setForm((f) => ({ ...f, valid_until: v }))}
                        />
                      </div>
                      <div className="event-time-picker__presets" role="group" aria-label="Quick date range presets">
                        <button
                          type="button"
                          className="event-time-picker__preset-chip"
                          onClick={() => applyPromotionDatePreset('today')}
                        >
                          Today only
                        </button>
                        <button
                          type="button"
                          className="event-time-picker__preset-chip"
                          onClick={() => applyPromotionDatePreset('weekend')}
                        >
                          This weekend
                        </button>
                        <button
                          type="button"
                          className="event-time-picker__preset-chip"
                          onClick={() => applyPromotionDatePreset('week')}
                        >
                          1 week
                        </button>
                        <button
                          type="button"
                          className="event-time-picker__preset-chip"
                          onClick={() => applyPromotionDatePreset('month')}
                        >
                          1 month
                        </button>
                      </div>
                      {promotionRangeSummary && (
                        <p className="event-time-picker__range-summary">{promotionRangeSummary}</p>
                      )}
                      {formErrors.valid_until && (
                        <p className="event-mgmt__field-error">{formErrors.valid_until}</p>
                      )}

                      {/* Image URL */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Image URL</label>
                        <input
                          className="event-mgmt__input"
                          type="text"
                          placeholder="https://..."
                          value={form.image_url}
                          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                        />
                      </div>
                      {form.image_url.trim() && (
                        <img
                          src={form.image_url}
                          alt="Promotion preview"
                          className="event-mgmt__image-preview"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        />
                      )}

                      {/* Description */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Description</label>
                        <textarea
                          className="event-mgmt__input event-mgmt__input--textarea"
                          rows={3}
                          placeholder="Describe this promotion..."
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </div>

                      {/* Status */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Status</label>
                        <div className="event-mgmt__status-toggle">
                          {(['active', 'pending'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={
                                form.status === s
                                  ? 'event-mgmt__status-pill event-mgmt__status-pill--active'
                                  : 'event-mgmt__status-pill'
                              }
                              onClick={() => setForm((f) => ({ ...f, status: s }))}
                            >
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="event-mgmt__modal-footer">
                      <button
                        type="button"
                        className="event-mgmt__modal-btn event-mgmt__modal-btn--cancel"
                        onClick={closeModal}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="event-mgmt__modal-btn event-mgmt__modal-btn--create"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <span className="event-mgmt__spinner-wrap">
                            <span className="event-mgmt__spinner" />
                            Saving...
                          </span>
                        ) : isEditMode ? 'Save Changes' : 'Add Promotion'}
                      </button>
                    </div>
                  </form>
                </aside>
              </div>
            )}

            {/* ── Stats ─────────────────────────────────────────────────────── */}
            <section className="event-mgmt__stats" aria-label="Promotions statistics">
              {stats.map((s) => (
                <article key={s.label} className="event-mgmt__stat">
                  <p className="event-mgmt__stat-value">{s.value}</p>
                  <p className="event-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            {/* ── Grid ──────────────────────────────────────────────────────── */}
            {promotions.length === 0 ? (
              <p style={{ color: '#8a8a8a', fontSize: '0.9375rem', paddingTop: '8px' }}>
                No promotions yet. Add your first promotion!
              </p>
            ) : (
              <section className="event-mgmt__grid" aria-label="Promotions list">
                {promotions.map((promo) => (
                  <PromotionCard
                    key={promo.promotion_id}
                    promo={promo}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                  />
                ))}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
