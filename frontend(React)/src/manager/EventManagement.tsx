import { type FormEvent, useEffect, useState } from 'react'
import './ManagerDashboard.css'
import './EventManagement.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

type ReservationMini = {
  reservation_id: string
  type: string | null
  status: string | null
}

type EventRow = {
  event_id: string
  event_name: string
  event_description: string | null
  event_type: string | null
  event_starting_date: string
  event_ending_date: string | null
  event_hours: string | null
  event_capacity: number | null
  ticket_price: string | null
  final_ticket_price: string | null
  event_image: string | null
  event_status: string | null
  reservations: ReservationMini[]
}

type EventFormState = {
  event_name: string
  event_description: string
  event_type: string
  event_starting_date: string
  event_ending_date: string
  event_capacity: string   
  ticket_price: string
  final_ticket_price: string
  event_image: string
  event_status: 'draft' | 'published'
}

type FormErrors = Partial<Record<'event_name' | 'event_starting_date' | 'event_ending_date', string>>

type ToastState = {
  type: 'success' | 'error'
  message: string
} | null

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const HOUR_SELECT_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const
const MINUTE_SELECT_OPTIONS = ['00', '30'] as const

function datePart(dateTime: string) {
  return dateTime ? dateTime.slice(0, 10) : ''
}

function timePart(dateTime: string) {
  if (!dateTime || !dateTime.includes('T')) return ''
  return dateTime.split('T')[1]?.slice(0, 5) ?? ''
}

function formatDateLabel(date: string) {
  if (!date) return 'Select date'
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return 'Select date'
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimeLabel(value: string) {
  if (!value || !value.includes(':')) return 'Select time'
  const [hRaw, mRaw] = value.split(':')
  const hour24 = Number(hRaw)
  const minute = (mRaw ?? '00').padStart(2, '0').slice(0, 2)
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return 'Select time'
  const period = hour24 < 12 ? 'AM' : 'PM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${minute} ${period}`
}

function buildDateTime(date: string, time: string) {
  if (!date) return ''
  return `${date}T${time || '00:00'}`
}

function DatePickerField({
  label,
  value,
  defaultDate,
  error,
  onChange,
}: {
  label: string
  value: string
  defaultDate?: string
  error?: string
  onChange: (date: string) => void
}) {
  const selectedDate = datePart(value)
  const fallbackDate = defaultDate ? datePart(defaultDate) : ''
  const focusedDate = selectedDate || fallbackDate
  const initialMonth = focusedDate ? new Date(`${focusedDate}T00:00`) : new Date()
  const [isOpen, setIsOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )

  useEffect(() => {
    if (!isOpen) return
    const nextMonth = focusedDate ? new Date(`${focusedDate}T00:00`) : new Date()
    setViewMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1))
  }, [isOpen, focusedDate])

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="event-mgmt__field event-mgmt__picker-field">
      <label>{label}</label>
      <button
        type="button"
        className={error ? 'event-mgmt__picker-trigger event-mgmt__input--error' : 'event-mgmt__picker-trigger'}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>{formatDateLabel(selectedDate)}</span>
        <span className="event-mgmt__picker-icon">▾</span>
      </button>

      {isOpen && (
        <div className="event-mgmt__calendar-popover">
          <div className="event-mgmt__calendar-head">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <strong>{MONTH_NAMES[month]} {year}</strong>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="event-mgmt__calendar-weekdays">
            {WEEKDAY_LABELS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="event-mgmt__calendar-grid">
            {cells.map((day, idx) => {
              if (day === null) return <span key={`blank-${idx}`} />
              const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={selectedDate === dateValue ? 'event-mgmt__calendar-day event-mgmt__calendar-day--active' : 'event-mgmt__calendar-day'}
                  onClick={() => {
                    onChange(dateValue)
                    setIsOpen(false)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TimePickerField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  onChange: (time: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const current = value || '00:00'
  const [hourRaw, minuteRaw] = current.split(':')
  const hour24 = Number(hourRaw || 0)
  const minute = minuteRaw || '00'
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const [draftHour, setDraftHour] = useState(String(hour12))
  const [draftMinute, setDraftMinute] = useState(minute.padStart(2, '0'))
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>(period)
  const [openSubmenu, setOpenSubmenu] = useState<null | 'hour' | 'minute'>(null)

  useEffect(() => {
    if (!isOpen) return
    setDraftHour(String(hour12))
    setDraftMinute(minute.padStart(2, '0'))
    setDraftPeriod(period)
  }, [isOpen, hour12, minute, period])

  useEffect(() => {
    if (!isOpen) setOpenSubmenu(null)
  }, [isOpen])

  useEffect(() => {
    if (!openSubmenu) return
    function onDocMouseDown(e: MouseEvent) {
      const el = e.target as HTMLElement
      if (el.closest('.event-mgmt__time-menu')) return
      setOpenSubmenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [openSubmenu])

  function commitTime() {
    const h12 = Math.min(12, Math.max(1, Number(draftHour) || 12))
    const safeMinute = draftMinute === '30' ? '30' : '00'
    let hour24 = h12 % 12
    if (draftPeriod === 'PM') hour24 += 12
    onChange(`${String(hour24).padStart(2, '0')}:${safeMinute}`)
    setIsOpen(false)
  }

  return (
    <div className="event-mgmt__field event-mgmt__picker-field">
      <label>{label}</label>
      <button
        type="button"
        className="event-mgmt__picker-trigger"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span>{disabled ? 'Select date first' : formatTimeLabel(value)}</span>
        <span className="event-mgmt__picker-icon">▾</span>
      </button>

      {isOpen && !disabled && (
        <div className="event-mgmt__time-popover">
          <p className="event-mgmt__time-title">ENTER TIME</p>
          <div className="event-mgmt__time-editor">
            <div className="event-mgmt__time-menu">
              <button
                type="button"
                className="event-mgmt__time-menu-trigger"
                aria-haspopup="listbox"
                aria-expanded={openSubmenu === 'hour'}
                aria-label="Hour"
                onClick={() => setOpenSubmenu((s) => (s === 'hour' ? null : 'hour'))}
              >
                {String(Math.min(12, Math.max(1, Number(draftHour) || 12)))}
              </button>
              {openSubmenu === 'hour' && (
                <ul className="event-mgmt__time-menu-list" role="listbox" aria-label="Hours">
                  {HOUR_SELECT_OPTIONS.map((h) => {
                    const selected =
                      String(Math.min(12, Math.max(1, Number(draftHour) || 12))) === h
                    return (
                      <li key={h} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={
                            selected
                              ? 'event-mgmt__time-menu-option event-mgmt__time-menu-option--selected'
                              : 'event-mgmt__time-menu-option'
                          }
                          onClick={() => {
                            setDraftHour(h)
                            setOpenSubmenu(null)
                          }}
                        >
                          {h}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <span className="event-mgmt__time-colon">:</span>
            <div className="event-mgmt__time-menu">
              <button
                type="button"
                className="event-mgmt__time-menu-trigger"
                aria-haspopup="listbox"
                aria-expanded={openSubmenu === 'minute'}
                aria-label="Minute"
                onClick={() => setOpenSubmenu((s) => (s === 'minute' ? null : 'minute'))}
              >
                {draftMinute === '30' ? '30' : '00'}
              </button>
              {openSubmenu === 'minute' && (
                <ul className="event-mgmt__time-menu-list" role="listbox" aria-label="Minutes">
                  {MINUTE_SELECT_OPTIONS.map((m) => {
                    const selected = (draftMinute === '30' ? '30' : '00') === m
                    return (
                      <li key={m} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={
                            selected
                              ? 'event-mgmt__time-menu-option event-mgmt__time-menu-option--selected'
                              : 'event-mgmt__time-menu-option'
                          }
                          onClick={() => {
                            setDraftMinute(m)
                            setOpenSubmenu(null)
                          }}
                        >
                          {m}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="event-mgmt__ampm-toggle">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={draftPeriod === p ? 'event-mgmt__ampm-btn event-mgmt__ampm-btn--active' : 'event-mgmt__ampm-btn'}
                  onClick={() => setDraftPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="event-mgmt__time-actions">
            <span className="event-mgmt__time-clock" aria-hidden>◷</span>
            <div className="event-mgmt__time-action-buttons">
              <button type="button" onClick={() => setIsOpen(false)}>CANCEL</button>
              <button type="button" onClick={commitTime}>OK</button>
            </div>
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
function IconCalendar() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg className="event-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
function IconEye() {
  return (
    <svg className="event-mgmt__action-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
function IconPencil() {
  return (
    <svg className="event-mgmt__action-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTrash({ compact }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? 'event-mgmt__action-ic event-mgmt__action-ic--compact' : 'event-mgmt__action-ic'}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M4 7h16M10 11v8M14 11v8M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 14a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EventCard({
  ev,
  onView,
  onEdit,
  onDelete,
}: {
  ev: EventRow
  onView: (event: EventRow) => void
  onEdit: (event: EventRow) => void
  onDelete: (event: EventRow) => void
}) {
  const ticketsSold = ev.reservations.filter((r) => r.type === 'ticket').length
  const cap = ev.event_capacity ?? 0
  const capacityPct = cap > 0 ? Math.round(Math.min(100, (ticketsSold / cap) * 100)) : 0
  const priceRaw = ev.final_ticket_price ?? ev.ticket_price
  const priceLabel = priceRaw ? `€${parseFloat(priceRaw).toFixed(0)} per ticket` : 'Free entry'

  const eventDate = new Date(ev.event_starting_date)
  const dateStr = eventDate.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = ev.event_hours ?? eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateLine = `${dateStr} • ${timeStr}`

  const imgVariants = ['violet', 'cyan', 'placeholder'] as const
  const imgKey = Math.abs([...ev.event_id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 3
  const imgClass = imgVariants[imgKey] === 'placeholder'
    ? 'event-mgmt__card-img event-mgmt__card-img--placeholder'
    : `event-mgmt__card-img event-mgmt__card-img--${imgVariants[imgKey]}`

  return (
    <article className="event-mgmt__card">
      {ev.event_image
        ? <img className="event-mgmt__card-img" src={ev.event_image} alt={ev.event_name} style={{ objectFit: 'cover' }} />
        : <div className={imgClass} aria-hidden />}
      <div className="event-mgmt__card-body">
        <h2 className="event-mgmt__card-title">{ev.event_name}</h2>
        <div className="event-mgmt__badges">
          <span className="event-mgmt__badge event-mgmt__badge--status">
            {ev.event_status ?? 'upcoming'}
          </span>
          {ev.event_type && (
            <span className="event-mgmt__badge event-mgmt__badge--genre">{ev.event_type}</span>
          )}
        </div>
        <ul className="event-mgmt__meta">
          <li className="event-mgmt__meta-row">
            <IconCalendar />
            <span>{dateLine}</span>
          </li>
          <li className="event-mgmt__meta-row">
            <IconUsers />
            <span>{ticketsSold} / {cap > 0 ? cap : '∞'} tickets sold</span>
          </li>
          <li className="event-mgmt__meta-row">
            <IconDollar />
            <span>{priceLabel}</span>
          </li>
        </ul>
        {cap > 0 && (
          <div className="event-mgmt__progress-wrap">
            <div className="event-mgmt__progress">
              <div className="event-mgmt__progress-fill" style={{ width: `${capacityPct}%` }} />
            </div>
            <p className="event-mgmt__progress-label">{capacityPct}% capacity</p>
          </div>
        )}
        <div className="event-mgmt__card-actions">
          <div className="event-mgmt__card-actions-main">
            <button
              type="button"
              className="event-mgmt__action event-mgmt__action--secondary event-mgmt__action--split"
              onClick={() => onView(ev)}
            >
              <IconEye />
              View
            </button>
            <button
              type="button"
              className="event-mgmt__action event-mgmt__action--secondary event-mgmt__action--split"
              onClick={() => onEdit(ev)}
            >
              <IconPencil />
              Edit
            </button>
          </div>
          <button
            type="button"
            className="event-mgmt__action event-mgmt__action--danger-icon"
            aria-label={`Delete ${ev.event_name}`}
            onClick={() => onDelete(ev)}
          >
            <IconTrash compact />
          </button>
        </div>
      </div>
    </article>
  )
}

export default function EventManagement() {
  const { user } = useAuth()
  const { club, clubId } = useManagerClub()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [viewingEvent, setViewingEvent] = useState<EventRow | null>(null)
  const [deletingEvent, setDeletingEvent] = useState<EventRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [toast, setToast] = useState<ToastState>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<EventFormState>({
    event_name: '',
    event_description: '',
    event_type: '',
    event_starting_date: '',
    event_ending_date: '',
    event_capacity: '',
    ticket_price: '',
    final_ticket_price: '',
    event_image: '',
    event_status: 'published',
  })

  function resetForm() {
    setForm({
      event_name: '',
      event_description: '',
      event_type: '',
      event_starting_date: '',
      event_ending_date: '',
      event_capacity: '',
      ticket_price: '',
      final_ticket_price: '',
      event_image: '',
      event_status: 'published',
    })
    setFormErrors({})
  }

  function closeCreateModal() {
    setShowCreateForm(false)
    setEditingEventId(null)
    setFormErrors({})
  }

  function openCreateModal() {
    resetForm()
    setEditingEventId(null)
    setShowCreateForm(true)
  }

  function openEditModal(ev: EventRow) {
    setForm({
      event_name: ev.event_name,
      event_description: ev.event_description ?? '',
      event_type: ev.event_type ?? '',
      event_starting_date: ev.event_starting_date,
      event_ending_date: ev.event_ending_date ?? '',
      event_capacity: ev.event_capacity === null ? '' : String(ev.event_capacity),
      ticket_price: ev.ticket_price ?? '',
      final_ticket_price: ev.final_ticket_price ?? '',
      event_image: ev.event_image ?? '',
      event_status: ev.event_status === 'draft' ? 'draft' : 'published',
    })
    setFormErrors({})
    setEditingEventId(ev.event_id)
    setShowCreateForm(true)
  }

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    setError(null)

    void supabase!
      .from('events')
      .select(`
        event_id, event_name, event_description, event_type, event_starting_date,
        event_ending_date, event_hours,
        event_capacity, ticket_price, final_ticket_price, event_image, event_status,
        reservations(reservation_id, type, status)
      `)
      .eq('club_id', clubId)
      .order('event_starting_date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setEvents((data ?? []) as EventRow[])
        setLoading(false)
      })
  }, [clubId, refreshKey])

  const now = new Date()
  const totalRevenue = events
    .flatMap((e) => e.reservations)
    .filter((r) => r.status === 'confirmed')
    .length

  const stats = [
    { label: 'Total Events', value: String(events.length) },
    { label: 'Upcoming', value: String(events.filter((e) => new Date(e.event_starting_date) > now).length) },
    {
      label: 'Total Tickets Sold',
      value: String(events.flatMap((e) => e.reservations).filter((r) => r.type === 'ticket').length),
    },
    { label: 'Confirmed Reservations', value: String(totalRevenue) },
  ]

  async function handleCreateEventSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nextErrors: FormErrors = {}
    if (!form.event_name.trim()) {
      nextErrors.event_name = 'Event name is required.'
    }
    if (!form.event_starting_date) {
      nextErrors.event_starting_date = 'Start date is required.'
    }
    if (
      form.event_starting_date &&
      form.event_ending_date &&
      new Date(form.event_ending_date) <= new Date(form.event_starting_date)
    ) {
      nextErrors.event_ending_date = 'End date must be after start date.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }
    setFormErrors({})

    if (!supabase || !isSupabaseConfigured) {
      setToast({ type: 'error', message: 'Supabase is not configured.' })
      return
    }
    if (!clubId) {
      setToast({ type: 'error', message: 'No club found for your account.' })
      return
    }
    if (!editingEventId && !user?.id) {
      setToast({ type: 'error', message: 'You must be logged in as a manager to create events.' })
      return
    }

    setIsSubmitting(true)
    setToast(null)

    try {
      const nextStatus = form.event_status
      const eventPayload = {
        club_id: clubId,
        event_name: form.event_name.trim(),
        event_description: form.event_description.trim(),
        event_type: form.event_type.trim(),
        event_starting_date: form.event_starting_date,
        event_ending_date: form.event_ending_date || null,
        event_capacity: form.event_capacity ? Number(form.event_capacity) : null,
        ticket_price: form.ticket_price ? Number(form.ticket_price) : null,
        final_ticket_price: form.final_ticket_price
          ? Number(form.final_ticket_price)
          : (form.ticket_price ? Number(form.ticket_price) : null),
        event_status: nextStatus,
        event_image: form.event_image.trim() || null,
      }

      if (editingEventId) {
        const { error: updateErr } = await supabase
          .from('events')
          .update(eventPayload)
          .eq('event_id', editingEventId)
          .eq('club_id', clubId)

        if (updateErr) {
          throw new Error(updateErr.message)
        }
      } else {
        const { error: insertErr } = await supabase
          .from('events')
          .insert({ ...eventPayload, created_by: user!.id })

        if (insertErr) {
          throw new Error(insertErr.message)
        }
      }

      setToast({
        type: 'success',
        message: editingEventId ? 'Event updated successfully!' : 'Event created successfully!',
      })
      closeCreateModal()
      resetForm()
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteEvent(ev: EventRow) {
    setDeletingEvent(ev)
  }

  async function confirmDeleteEvent() {
    if (!deletingEvent) return
    if (!supabase || !isSupabaseConfigured) {
      setToast({ type: 'error', message: 'Supabase is not configured.' })
      return
    }
    if (!clubId) {
      setToast({ type: 'error', message: 'No club found for your account.' })
      return
    }

    setToast(null)
    const { error: deleteErr } = await supabase
      .from('events')
      .delete()
      .eq('event_id', deletingEvent.event_id)
      .eq('club_id', clubId)

    if (deleteErr) {
      setToast({ type: 'error', message: deleteErr.message })
      return
    }

    if (viewingEvent?.event_id === deletingEvent.event_id) {
      setViewingEvent(null)
    }
    setDeletingEvent(null)
    setToast({ type: 'success', message: 'Event deleted successfully.' })
    setRefreshKey((k) => k + 1)
  }

  if (loading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--event-mgmt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#8a8a8a' }}>Loading events…</span>
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

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-dash__main--event-mgmt">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="event-mgmt__bound">
            <header className="event-mgmt__head">
              <div className="event-mgmt__head-text">
                <h1 className="manager-dash__page-title">Event Management</h1>
                <p className="manager-dash__page-sub">Create and manage your club events</p>
              </div>
              <button
                type="button"
                className="event-mgmt__create"
                onClick={openCreateModal}
              >
                <IconPlus />
                Create Event
              </button>
            </header>

            {toast && (
              <div className={`event-mgmt__toast event-mgmt__toast--${toast.type}`}>
                {toast.message}
              </div>
            )}

            {deletingEvent && (
              <div className="event-mgmt__modal-overlay event-mgmt__modal-overlay--blur" onClick={() => setDeletingEvent(null)} role="presentation">
                <aside
                  className="event-mgmt__delete-modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Confirm delete event"
                >
                  <div className="event-mgmt__delete-icon" aria-hidden>
                    <IconTrash compact />
                  </div>
                  <div className="event-mgmt__delete-copy">
                    <h2>Delete Event?</h2>
                    <p className="event-mgmt__delete-subtitle">
                      This will permanently remove
                      <span className="event-mgmt__delete-event-name">{deletingEvent.event_name}</span>
                      from your event list. This action cannot be undone.
                    </p>
                  </div>
                  <div className="event-mgmt__delete-actions">
                    <button
                      type="button"
                      className="event-mgmt__delete-btn event-mgmt__delete-btn--cancel"
                      onClick={() => setDeletingEvent(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="event-mgmt__delete-btn event-mgmt__delete-btn--danger"
                      onClick={() => void confirmDeleteEvent()}
                    >
                      Delete Event
                    </button>
                  </div>
                </aside>
              </div>
            )}

            {viewingEvent && (
              <div className="event-mgmt__modal-overlay" onClick={() => setViewingEvent(null)} role="presentation">
                <aside
                  className="event-mgmt__modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Event details"
                >
                  <div className="event-mgmt__modal-header">
                    <h2>Event Details</h2>
                    <button
                      type="button"
                      className="event-mgmt__modal-close"
                      onClick={() => setViewingEvent(null)}
                      aria-label="Close event details modal"
                    >
                      ×
                    </button>
                  </div>

                  <div className="event-mgmt__modal-form">
                    <div className="event-mgmt__modal-body">
                      {viewingEvent.event_image && (
                        <img
                          src={viewingEvent.event_image}
                          alt={viewingEvent.event_name}
                          className="event-mgmt__image-preview"
                          style={{ maxHeight: 180 }}
                        />
                      )}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Event Name</label>
                        <p className="event-mgmt__card-title" style={{ margin: 0 }}>{viewingEvent.event_name}</p>
                      </div>
                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Type</label>
                          <p className="event-mgmt__meta-row" style={{ margin: 0 }}>{viewingEvent.event_type || '—'}</p>
                        </div>
                        <div className="event-mgmt__field">
                          <label>Status</label>
                          <span className="event-mgmt__badge event-mgmt__badge--status" style={{ width: 'fit-content' }}>
                            {viewingEvent.event_status ?? 'upcoming'}
                          </span>
                        </div>
                      </div>
                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Starts</label>
                          <p className="event-mgmt__meta-row" style={{ margin: 0 }}>
                            {new Date(viewingEvent.event_starting_date).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                        <div className="event-mgmt__field">
                          <label>Ends</label>
                          <p className="event-mgmt__meta-row" style={{ margin: 0 }}>
                            {viewingEvent.event_ending_date
                              ? new Date(viewingEvent.event_ending_date).toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Capacity</label>
                          <p className="event-mgmt__meta-row" style={{ margin: 0 }}>
                            {viewingEvent.reservations.filter((r) => r.type === 'ticket').length} / {viewingEvent.event_capacity ?? '∞'} tickets sold
                          </p>
                        </div>
                        <div className="event-mgmt__field">
                          <label>Ticket Price</label>
                          <p className="event-mgmt__meta-row" style={{ margin: 0 }}>
                            {viewingEvent.final_ticket_price ?? viewingEvent.ticket_price
                              ? `€${parseFloat(viewingEvent.final_ticket_price ?? viewingEvent.ticket_price ?? '0').toFixed(2)}`
                              : 'Free entry'}
                          </p>
                        </div>
                      </div>
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Description</label>
                        <p className="event-mgmt__meta-row" style={{ margin: 0, lineHeight: 1.6 }}>
                          {viewingEvent.event_description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    <div className="event-mgmt__modal-footer">
                      <button
                        type="button"
                        className="event-mgmt__modal-btn event-mgmt__modal-btn--cancel"
                        onClick={() => setViewingEvent(null)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="event-mgmt__modal-btn event-mgmt__modal-btn--create"
                        onClick={() => {
                          const eventToEdit = viewingEvent
                          setViewingEvent(null)
                          openEditModal(eventToEdit)
                        }}
                      >
                        Edit Event
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {showCreateForm && (
              <div className="event-mgmt__modal-overlay" onClick={closeCreateModal} role="presentation">
                <aside
                  className="event-mgmt__modal"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={editingEventId ? 'Edit Event' : 'Create Event'}
                >
                  <div className="event-mgmt__modal-header">
                    <h2>{editingEventId ? 'Edit Event' : 'Create Event'}</h2>
                    <button
                      type="button"
                      className="event-mgmt__modal-close"
                      onClick={closeCreateModal}
                      aria-label={editingEventId ? 'Close edit event modal' : 'Close create event modal'}
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleCreateEventSubmit} className="event-mgmt__modal-form">
                    <div className="event-mgmt__modal-body">
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Event Name</label>
                        <input
                          className={formErrors.event_name ? 'event-mgmt__input event-mgmt__input--error' : 'event-mgmt__input'}
                          type="text"
                          placeholder="Enter event name"
                          value={form.event_name}
                          onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
                        />
                        {formErrors.event_name && <p className="event-mgmt__field-error">{formErrors.event_name}</p>}
                      </div>

                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Event Type</label>
                        <select
                          className="event-mgmt__input event-mgmt__select"
                          value={form.event_type}
                          onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                        >
                          <option value="">Select event type</option>
                          <option value="Club Night">Club Night</option>
                          <option value="Live Music">Live Music</option>
                          <option value="Special Event">Special Event</option>
                          <option value="Private Party">Private Party</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="event-mgmt__field-grid">
                        <DatePickerField
                          label="Start Date"
                          value={form.event_starting_date}
                          error={formErrors.event_starting_date}
                          onChange={(date) =>
                            setForm((f) => ({
                              ...f,
                              event_starting_date: buildDateTime(date, timePart(f.event_starting_date) || '00:00'),
                            }))
                          }
                        />
                        <TimePickerField
                          label="Start Time"
                          value={timePart(form.event_starting_date)}
                          disabled={!datePart(form.event_starting_date)}
                          onChange={(time) =>
                            setForm((f) => ({
                              ...f,
                              event_starting_date: buildDateTime(datePart(f.event_starting_date), time),
                            }))
                          }
                        />
                      </div>
                      {formErrors.event_starting_date && <p className="event-mgmt__field-error">{formErrors.event_starting_date}</p>}

                      <div className="event-mgmt__field-grid">
                        <DatePickerField
                          label="End Date"
                          value={form.event_ending_date}
                          defaultDate={form.event_starting_date}
                          error={formErrors.event_ending_date}
                          onChange={(date) =>
                            setForm((f) => ({
                              ...f,
                              event_ending_date: buildDateTime(date, timePart(f.event_ending_date) || '00:00'),
                            }))
                          }
                        />
                        <TimePickerField
                          label="End Time"
                          value={timePart(form.event_ending_date)}
                          disabled={!datePart(form.event_ending_date)}
                          onChange={(time) =>
                            setForm((f) => ({
                              ...f,
                              event_ending_date: buildDateTime(datePart(f.event_ending_date), time),
                            }))
                          }
                        />
                      </div>
                      {formErrors.event_ending_date && <p className="event-mgmt__field-error">{formErrors.event_ending_date}</p>}

                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Capacity</label>
                          <input
                            className="event-mgmt__input"
                            type="number"
                            min="0"
                            placeholder="Enter capacity"
                            value={form.event_capacity}
                            onChange={(e) => setForm((f) => ({ ...f, event_capacity: e.target.value }))}
                          />
                        </div>
                        <div className="event-mgmt__field">
                          <label>Ticket Price €</label>
                          <input
                            className="event-mgmt__input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={form.ticket_price}
                            onChange={(e) => setForm((f) => ({ ...f, ticket_price: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="event-mgmt__field-grid">
                        <div className="event-mgmt__field">
                          <label>Final Ticket Price €</label>
                          <input
                            className="event-mgmt__input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={form.final_ticket_price}
                            onChange={(e) => setForm((f) => ({ ...f, final_ticket_price: e.target.value }))}
                          />
                        </div>
                        <div className="event-mgmt__field">
                          <label>Event Image URL</label>
                          <input
                            className="event-mgmt__input"
                            type="text"
                            placeholder="https://..."
                            value={form.event_image}
                            onChange={(e) => setForm((f) => ({ ...f, event_image: e.target.value }))}
                          />
                        </div>
                      </div>
                      {form.event_image.trim() && (
                        <img
                          src={form.event_image}
                          alt="Event preview"
                          className="event-mgmt__image-preview"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}

                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Description</label>
                        <textarea
                          className="event-mgmt__input event-mgmt__input--textarea"
                          rows={4}
                          placeholder="Describe your event..."
                          value={form.event_description}
                          onChange={(e) => setForm((f) => ({ ...f, event_description: e.target.value }))}
                        />
                      </div>

                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Status</label>
                        <div className="event-mgmt__status-toggle">
                          <button
                            type="button"
                            className={form.event_status === 'draft' ? 'event-mgmt__status-pill event-mgmt__status-pill--active' : 'event-mgmt__status-pill'}
                            onClick={() => setForm((f) => ({ ...f, event_status: 'draft' }))}
                          >
                            Draft
                          </button>
                          <button
                            type="button"
                            className={form.event_status === 'published' ? 'event-mgmt__status-pill event-mgmt__status-pill--active' : 'event-mgmt__status-pill'}
                            onClick={() => setForm((f) => ({ ...f, event_status: 'published' }))}
                          >
                            Published
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="event-mgmt__modal-footer">
                      <button
                        type="button"
                        className="event-mgmt__modal-btn event-mgmt__modal-btn--cancel"
                        onClick={closeCreateModal}
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
                        ) : editingEventId ? 'Save Changes' : 'Create Event'}
                      </button>
                    </div>
                  </form>
                </aside>
              </div>
            )}

            <section className="event-mgmt__stats" aria-label="Event statistics">
              {stats.map((s) => (
                <article key={s.label} className="event-mgmt__stat">
                  <p className="event-mgmt__stat-value">{s.value}</p>
                  <p className="event-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            {events.length === 0 ? (
              <p style={{ color: '#8a8a8a', fontSize: '0.9375rem', paddingTop: '8px' }}>
                No events yet. Create your first event!
              </p>
            ) : (
              <section className="event-mgmt__grid" aria-label="Events list">
                {events.map((ev) => (
                  <EventCard
                    key={ev.event_id}
                    ev={ev}
                    onView={setViewingEvent}
                    onEdit={openEditModal}
                    onDelete={handleDeleteEvent}
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
