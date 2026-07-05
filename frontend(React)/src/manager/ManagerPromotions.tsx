import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import './ManagerDashboard.css'
import './EventManagement.css'
import './ManagerPromotions.css'
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
  included_items: string | null
  terms_conditions: string | null
  created_at: string | null
  deleted_at: string | null
}

type PromotionFormState = {
  title: string
  description: string
  category: string
  discount_value: string
  original_price: string
  valid_from: string
  valid_until: string
  what_included: string
  terms_conditions: string
  status: 'active' | 'draft'
}

type FilterTab = 'all' | 'active' | 'draft' | 'passed'

type FormErrors = Partial<Record<'title' | 'valid_until', string>>

type ToastState = { type: 'success' | 'error'; message: string } | null

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const PROMO_MINUTE_OPTIONS = ['00', '30'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateLocalPart(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

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

function formatDateReadable(date: string): string {
  if (!date) return 'Select date'
  const d = new Date(`${date}T12:00`)
  if (Number.isNaN(d.getTime())) return 'Select date'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function splitTimeParts(time: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  const [hourRaw = '12', minuteRaw = '00'] = time.split(':')
  const hour24 = Number(hourRaw)
  const safeHour24 = Number.isFinite(hour24) ? hour24 : 12
  const period = safeHour24 >= 12 ? 'PM' : 'AM'
  const hour12 = safeHour24 % 12 === 0 ? 12 : safeHour24 % 12
  const minute = PROMO_MINUTE_OPTIONS.includes(minuteRaw as (typeof PROMO_MINUTE_OPTIONS)[number])
    ? minuteRaw
    : '00'
  return { hour: String(hour12), minute, period }
}

function toTimeValue(hour: string, minute: string, period: 'AM' | 'PM'): string {
  const h12 = Math.min(12, Math.max(1, Number(hour) || 12))
  let h24 = h12 % 12
  if (period === 'PM') h24 += 12
  return `${pad2(h24)}:${minute}`
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
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0)
}

function promoIsPassed(promo: PromotionRow): boolean {
  if (promo.status === 'expired') return true
  if (!promo.valid_until) return false
  return new Date(promo.valid_until).getTime() < Date.now()
}

function promotionRowToFormState(promo: PromotionRow): PromotionFormState {
  const statusRaw = (promo.status ?? 'draft').toLowerCase()
  const status: PromotionFormState['status'] = statusRaw === 'active' ? 'active' : 'draft'

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
    what_included: promo.included_items ?? '',
    terms_conditions: promo.terms_conditions ?? '',
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

// ─── DateTimePickerField ──────────────────────────────────────────────────────

function PromotionDatePickerField({
  label,
  value,
  error,
  onChange,
  isOpen,
  onOpen,
  onClose,
}: {
  label: string
  value: string
  error?: string
  onChange: (date: string) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const initialMonth = value ? new Date(`${value}T12:00`) : new Date()
  const [viewMonth, setViewMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  )
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!value) return
    const d = new Date(`${value}T12:00`)
    if (Number.isNaN(d.getTime())) return
    setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [value])

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  useEffect(() => {
    if (!isOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [isOpen, onClose])

  return (
    <div ref={wrapperRef} className="event-mgmt__field event-mgmt__picker-field">
      <label>{label}</label>
      <button
        type="button"
        className={
          error
            ? 'event-mgmt__picker-trigger event-mgmt__input--error'
            : 'event-mgmt__picker-trigger'
        }
        onClick={() => {
          if (isOpen) onClose()
          else onOpen()
        }}
        aria-expanded={isOpen}
      >
        <span>{formatDateReadable(value)}</span>
        <span className="event-mgmt__picker-icon" aria-hidden>
          ▾
        </span>
      </button>
      {isOpen && (
        <div className="event-time-picker__popover promo-date-picker">
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
                    value === dateValue
                      ? 'event-mgmt__calendar-day event-mgmt__calendar-day--active'
                      : 'event-mgmt__calendar-day'
                  }
                  onClick={() => {
                    onChange(dateValue)
                    onClose()
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

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function PromotionTimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (time: string) => void
}) {
  const parts = splitTimeParts(value)
  const [isOpen, setIsOpen] = useState(false)
  const [draftHour, setDraftHour] = useState(parts.hour)
  const [openSubmenu, setOpenSubmenu] = useState<null | 'minute'>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Keep draft in sync whenever the popover opens
  useEffect(() => {
    if (!isOpen) return
    setDraftHour(parts.hour)
  }, [isOpen, parts.hour])

  useEffect(() => {
    if (!isOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
      setOpenSubmenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setOpenSubmenu(null)
  }, [isOpen])

  function applyTime(next: { hour?: string; minute?: string; period?: 'AM' | 'PM' }) {
    const nextHour = next.hour ?? draftHour
    const hourNumber = Math.min(12, Math.max(1, Number(nextHour) || 12))
    setDraftHour(String(hourNumber))
    // toTimeValue handles AM/PM → 24h conversion: 1 PM → 13:00, 12 AM → 00:00, etc.
    onChange(toTimeValue(String(hourNumber), next.minute ?? parts.minute, next.period ?? parts.period))
  }

  function commitHour(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 0) { setDraftHour(''); return }

    const first = Number(digits[0])

    if (digits.length === 1) {
      setDraftHour(digits)
      // 2–9 can never form a valid two-digit hour (10–12) → apply immediately
      if (first >= 2 && first <= 9) {
        onChange(toTimeValue(digits, parts.minute, parts.period))
      }
      // 0 or 1 → wait for possible second digit (10 / 11 / 12)
      return
    }

    // Two digits received
    const n = Number(digits)
    if (n >= 10 && n <= 12) {
      setDraftHour(digits)
      onChange(toTimeValue(digits, parts.minute, parts.period))
    } else {
      // Invalid (e.g. 13, 96) → keep only the first digit
      const safe = String(Math.min(12, Math.max(1, first)))
      setDraftHour(safe)
      onChange(toTimeValue(safe, parts.minute, parts.period))
    }
  }

  function nudgeHour(direction: 1 | -1) {
    const current = Math.min(12, Math.max(1, Number(draftHour) || 12))
    const next = current + direction
    const wrapped = next > 12 ? 1 : next < 1 ? 12 : next
    setDraftHour(String(wrapped))
    onChange(toTimeValue(String(wrapped), parts.minute, parts.period))
  }

  return (
    <div ref={wrapperRef} className="event-mgmt__field event-mgmt__picker-field">
      <label>{label}</label>
      <button
        type="button"
        className="event-mgmt__picker-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span>{`${parts.hour}:${parts.minute} ${parts.period}`}</span>
        <span className="event-mgmt__picker-icon" aria-hidden>▾</span>
      </button>

      {isOpen && (
        <div className="event-mgmt__time-popover">
          <p className="event-mgmt__time-title">ENTER TIME</p>
          <div className="event-mgmt__time-editor">
            {/* Hour — typeable input (1–12). AM/PM toggle handles 13–24 conversion */}
            <div className="event-mgmt__time-menu">
              <input
                type="text"
                inputMode="numeric"
                value={draftHour}
                aria-label={`${label} hour`}
                className="event-mgmt__time-menu-trigger"
                onChange={(e) => commitHour(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp')   { e.preventDefault(); nudgeHour(1)  }
                  if (e.key === 'ArrowDown') { e.preventDefault(); nudgeHour(-1) }
                }}
                onBlur={() => {
                  const clamped = Math.min(12, Math.max(1, Number(draftHour) || Number(parts.hour) || 12))
                  applyTime({ hour: String(clamped) })
                }}
              />
            </div>
            <span className="event-mgmt__time-colon">:</span>
            {/* Minute — dropdown */}
            <div className="event-mgmt__time-menu">
              <button
                type="button"
                className="event-mgmt__time-menu-trigger"
                aria-haspopup="listbox"
                aria-expanded={openSubmenu === 'minute'}
                aria-label="Minute"
                onClick={() => setOpenSubmenu((s) => (s === 'minute' ? null : 'minute'))}
              >
                {parts.minute === '30' ? '30' : '00'}
              </button>
              {openSubmenu === 'minute' && (
                <ul className="event-mgmt__time-menu-list" role="listbox" aria-label={`${label} minutes`}>
                  {PROMO_MINUTE_OPTIONS.map((m) => {
                    const selected = (parts.minute === '30' ? '30' : '00') === m
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
                            applyTime({ minute: m })
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
            {/* AM / PM toggle */}
            <div className="event-mgmt__ampm-toggle">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={parts.period === p ? 'event-mgmt__ampm-btn event-mgmt__ampm-btn--active' : 'event-mgmt__ampm-btn'}
                  onClick={() => applyTime({ period: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="event-mgmt__time-actions">
            <span className="event-mgmt__time-clock" aria-hidden>◷</span>
            <div className="event-mgmt__time-action-buttons">
              <button type="button" onClick={() => { setIsOpen(false); setOpenSubmenu(null) }}>Close</button>
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

function IconUpload() {
  return (
    <svg className="promo-mgmt__upload-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconStatTag() {
  return (
    <svg className="promo-mgmt__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconStatCheck() {
  return (
    <svg className="promo-mgmt__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12.5l3 3 5-5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconStatPencil() {
  return (
    <svg className="promo-mgmt__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconStatHistory() {
  return (
    <svg className="promo-mgmt__stat-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3v5h5M12 7v5l4 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCalMeta() {
  return (
    <svg className="promo-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconDollarMeta() {
  return (
    <svg className="promo-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconListMeta() {
  return (
    <svg className="promo-mgmt__meta-ic" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTrashSm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden style={{ width: 14, height: 14 }}>
      <path
        d="M4 7h16M10 11v8M14 11v8M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 14a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Custom category dropdown ─────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '',        label: 'Select category' },
  { value: 'Entry',   label: 'Entry' },
  { value: 'Drinks',  label: 'Drinks' },
  { value: 'VIP',     label: 'VIP' },
  { value: 'Tables',  label: 'Tables' },
  { value: 'Food',    label: 'Food' },
  { value: 'Other',   label: 'Other' },
]

function CategorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const selectedLabel =
    CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? 'Select category'

  return (
    <div className="promo-mgmt__cat-select" ref={wrapRef}>
      <button
        type="button"
        className={`event-mgmt__input promo-mgmt__cat-trigger${isOpen ? ' promo-mgmt__cat-trigger--open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={value ? undefined : 'promo-mgmt__cat-placeholder'}>
          {selectedLabel}
        </span>
        <svg className="promo-mgmt__cat-chevron" viewBox="0 0 24 24" fill="none" aria-hidden>
          <polyline
            points="6 9 12 15 18 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <ul className="promo-mgmt__cat-list" role="listbox">
          {CATEGORY_OPTIONS.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`promo-mgmt__cat-option${value === opt.value ? ' promo-mgmt__cat-option--selected' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Helpers shared by card + view modal ────────────────────────────────────

function fmtDateShort(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtPrice(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

function buildStatusBadgeClass(isPassed: boolean, isActive: boolean, isDraft: boolean): string {
  if (isPassed) return 'promo-mgmt__badge promo-mgmt__badge--passed'
  if (isActive)  return 'promo-mgmt__badge promo-mgmt__badge--active'
  if (isDraft)   return 'promo-mgmt__badge promo-mgmt__badge--draft'
  return 'promo-mgmt__badge promo-mgmt__badge--pending'
}

// ─── Promotion view modal ─────────────────────────────────────────────────────

function PromotionViewModal({
  promo,
  onClose,
  onEdit,
}: {
  promo: PromotionRow
  onClose: () => void
  onEdit: (promo: PromotionRow) => void
}) {
  const isPassed = promoIsPassed(promo)
  const isDraft  = !isPassed && (promo.status === 'draft' || promo.status === 'pending')
  const isActive = !isPassed && promo.status === 'active'

  const statusLabel = isPassed ? 'passed' : (promo.status ?? 'draft')
  const badgeClass  = buildStatusBadgeClass(isPassed, isActive, isDraft)

  const validFrom  = fmtDateShort(promo.valid_from)
  const validUntil = fmtDateShort(promo.valid_until)

  const origNum    = promo.original_price  ? Number(promo.original_price)  : null
  const discountNum = promo.discount_value ? Number(promo.discount_value)  : null
  const finalPrice = (origNum != null && discountNum != null)
    ? origNum * (1 - discountNum / 100)
    : null

  return (
    <div
      className="event-mgmt__modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="promo-mgmt__view-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={promo.title}
      >
        {/* Close button */}
        <button
          type="button"
          className="promo-mgmt__view-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {/* Image */}
        {promo.image_url
          ? <img className="promo-mgmt__view-img" src={promo.image_url} alt={promo.title} />
          : <div className="promo-mgmt__view-img-placeholder" aria-hidden>🎉</div>}

        <div className="promo-mgmt__view-body">
          {/* Title + badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 className="promo-mgmt__view-title">{promo.title}</h2>
            <div className="promo-mgmt__badges">
              <span className={badgeClass}>{statusLabel}</span>
              {promo.category && (
                <span className="promo-mgmt__badge promo-mgmt__badge--cat">{promo.category}</span>
              )}
            </div>
          </div>

          {/* Price */}
          {(origNum != null || discountNum != null) && (
            <ul className="promo-mgmt__meta">
              <li className="promo-mgmt__meta-row">
                <IconDollarMeta />
                <span className="promo-mgmt__meta-text">
                  {origNum != null && `€${fmtPrice(origNum)}`}
                  {finalPrice != null && origNum != null && ` → €${fmtPrice(finalPrice)}`}
                  {discountNum != null && ` (${discountNum}% off)`}
                </span>
              </li>
              {(validFrom || validUntil) && (
                <li className="promo-mgmt__meta-row">
                  <IconCalMeta />
                  <span className="promo-mgmt__meta-text">
                    {validFrom && validUntil
                      ? `${validFrom} – ${validUntil}`
                      : validFrom ? `From ${validFrom}` : `Until ${validUntil}`}
                  </span>
                </li>
              )}
            </ul>
          )}

          {/* Date only (when no price shown) */}
          {origNum == null && discountNum == null && (validFrom || validUntil) && (
            <ul className="promo-mgmt__meta">
              <li className="promo-mgmt__meta-row">
                <IconCalMeta />
                <span className="promo-mgmt__meta-text">
                  {validFrom && validUntil
                    ? `${validFrom} – ${validUntil}`
                    : validFrom ? `From ${validFrom}` : `Until ${validUntil}`}
                </span>
              </li>
            </ul>
          )}

          {/* Description */}
          {promo.description && (
            <div className="promo-mgmt__view-section">
              <p className="promo-mgmt__view-section-label">Description</p>
              <p className="promo-mgmt__view-section-text">{promo.description}</p>
            </div>
          )}

          {/* What's included */}
          {promo.included_items && (
            <div className="promo-mgmt__view-section">
              <p className="promo-mgmt__view-section-label">What's Included</p>
              <p className="promo-mgmt__view-section-text">{promo.included_items}</p>
            </div>
          )}

          {/* Terms & conditions */}
          {promo.terms_conditions && (
            <div className="promo-mgmt__view-section">
              <p className="promo-mgmt__view-section-label">Terms & Conditions</p>
              <p className="promo-mgmt__view-section-text">{promo.terms_conditions}</p>
            </div>
          )}
        </div>

        <div className="promo-mgmt__view-footer">
          <button
            type="button"
            className="promo-mgmt__view-edit-btn"
            onClick={() => { onClose(); onEdit(promo) }}
          >
            <Pencil size={14} strokeWidth={2} aria-hidden />
            Edit Promotion
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Promotion Card ───────────────────────────────────────────────────────────

function PromotionCard({
  promo,
  onEdit,
  onDelete,
  onView,
  onRepeat,
  claimCount,
}: {
  promo: PromotionRow
  onEdit: (promo: PromotionRow) => void
  onDelete: (promo: PromotionRow) => void
  onView: (promo: PromotionRow) => void
  onRepeat?: (promo: PromotionRow) => void
  claimCount?: { claimed: number; redeemed: number }
}) {
  const isPassed = promoIsPassed(promo)
  const isDraft  = !isPassed && (promo.status === 'draft' || promo.status === 'pending')
  const isActive = !isPassed && promo.status === 'active'

  const statusLabel = isPassed ? 'passed' : (promo.status ?? 'draft')
  const badgeClass  = buildStatusBadgeClass(isPassed, isActive, isDraft)

  const validFrom  = fmtDateShort(promo.valid_from)
  const validUntil = fmtDateShort(promo.valid_until)

  const discountNum = promo.discount_value ? Number(promo.discount_value) : null
  const origNum     = promo.original_price ? Number(promo.original_price) : null

  return (
    <article className="promo-mgmt__card" onClick={() => onView(promo)}>
      {promo.image_url ? (
        <img className="promo-mgmt__card-img" src={promo.image_url} alt={promo.title} />
      ) : (
        <div className="promo-mgmt__card-img-placeholder" aria-hidden>
          🎉
        </div>
      )}

      <div className="promo-mgmt__card-body">
        <h2 className="promo-mgmt__card-title">{promo.title}</h2>

        <div className="promo-mgmt__badges">
          <span className={badgeClass}>{statusLabel}</span>
          {promo.category && (
            <span className="promo-mgmt__badge promo-mgmt__badge--cat">{promo.category}</span>
          )}
        </div>

        <ul className="promo-mgmt__meta">
          {(discountNum != null || origNum != null) && (
            <li className="promo-mgmt__meta-row">
              <IconDollarMeta />
              <span className="promo-mgmt__meta-text">
                {origNum != null && `€${fmtPrice(origNum)}`}
                {discountNum != null && origNum != null &&
                  ` → €${fmtPrice(origNum * (1 - discountNum / 100))}`}
                {discountNum != null && ` (${discountNum}% off)`}
              </span>
            </li>
          )}
          {(validFrom || validUntil) && (
            <li className="promo-mgmt__meta-row">
              <IconCalMeta />
              <span className="promo-mgmt__meta-text">
                {validFrom && validUntil
                  ? `${validFrom} – ${validUntil}`
                  : validFrom ? `From ${validFrom}` : `Until ${validUntil}`}
              </span>
            </li>
          )}
          {promo.included_items && (
            <li className="promo-mgmt__meta-row">
              <IconListMeta />
              <span className="promo-mgmt__meta-text">{promo.included_items}</span>
            </li>
          )}
        </ul>

        <div className="promo-mgmt__claim-row">
          <span className="promo-mgmt__claim-badge promo-mgmt__claim-badge--claimed">
            {claimCount?.claimed ?? 0} claimed
          </span>
          <span className="promo-mgmt__claim-badge promo-mgmt__claim-badge--redeemed">
            {claimCount?.redeemed ?? 0} used
          </span>
        </div>

        {/* Stop propagation so action buttons don't open view modal */}
        <div
          className="promo-mgmt__card-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {isPassed && onRepeat ? (
            <button
              type="button"
              className="promo-mgmt__action--edit"
              aria-label={`Repeat ${promo.title}`}
              onClick={() => onRepeat(promo)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              Repeat
            </button>
          ) : (
            <button
              type="button"
              className="promo-mgmt__action--edit"
              aria-label={`Edit ${promo.title}`}
              onClick={() => onEdit(promo)}
            >
              <Pencil size={13} strokeWidth={2} aria-hidden />
              Edit
            </button>
          )}
          <button
            type="button"
            className="promo-mgmt__action--delete"
            aria-label={`Delete ${promo.title}`}
            onClick={() => onDelete(promo)}
          >
            <IconTrashSm />
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM: PromotionFormState = {
  title: '',
  description: '',
  category: '',
  discount_value: '',
  original_price: '',
  valid_from: '',
  valid_until: '',
  what_included: '',
  terms_conditions: '',
  status: 'draft',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManagerPromotions() {
  const { club, clubId } = useManagerClub()
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [toast, setToast] = useState<ToastState>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [form, setForm] = useState<PromotionFormState>(EMPTY_FORM)
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('active')
  const [openDateTimePicker, setOpenDateTimePicker] = useState<'valid_from' | 'valid_until' | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [viewPromo, setViewPromo] = useState<PromotionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [globalTc, setGlobalTc] = useState('')
  const [claimCounts, setClaimCounts] = useState<Record<string, { claimed: number; redeemed: number }>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowForm(true)
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    }
  }, [])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function resetImageState(previewUrl: string) {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setImageFile(null)
    setImagePreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setEditingPromotionId(null)
    setOpenDateTimePicker(null)
    resetImageState(imagePreviewUrl)
  }

  function closeModal() {
    setShowForm(false)
    setOpenDateTimePicker(null)
    resetForm()
  }

  function openAddModal() {
    setFormErrors({})
    setEditingPromotionId(null)
    setForm({ ...EMPTY_FORM, terms_conditions: globalTc })
    resetImageState(imagePreviewUrl)
    setShowForm(true)
  }

  function openRepeatModal(promo: PromotionRow) {
    setFormErrors({})
    const fs = promotionRowToFormState(promo)
    // Clear dates so manager sets new ones, and reset status to draft
    fs.valid_from = ''
    fs.valid_until = ''
    if (!fs.terms_conditions && globalTc) fs.terms_conditions = globalTc
    setForm(fs)
    setEditingPromotionId(null) // null = create new, not edit existing
    resetImageState(imagePreviewUrl)
    setImagePreviewUrl(promo.image_url ?? '')
    setShowForm(true)
  }

  function openEditModal(promo: PromotionRow) {
    setFormErrors({})
    const fs = promotionRowToFormState(promo)
    // Fallback to global T&C if the promotion has none saved
    if (!fs.terms_conditions && globalTc) fs.terms_conditions = globalTc
    setForm(fs)
    setEditingPromotionId(promo.promotion_id)
    resetImageState(imagePreviewUrl)
    setImagePreviewUrl(promo.image_url ?? '')
    setShowForm(true)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imagePreviewUrl.startsWith('blob:')) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    resetImageState(imagePreviewUrl)
  }

  function updatePromotionDateTime(
    field: 'valid_from' | 'valid_until',
    part: 'date' | 'time',
    value: string,
  ) {
    setForm((current) => {
      const existing = splitDateTimeLocal(current[field])
      const nextDate = part === 'date' ? value : (existing.date || toDateLocalPart(new Date()))
      const nextTime = part === 'time' ? value : existing.time
      return { ...current, [field]: `${nextDate}T${nextTime}` }
    })
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    void supabase
      .from('promotions')
      .select(
        'promotion_id, title, description, category, discount_value, original_price, valid_from, valid_until, status, image_url, included_items, terms_conditions, created_at, deleted_at',
      )
      .eq('club_id', clubId)
      .is('deleted_at', null)
      .order('valid_until', { ascending: true, nullsFirst: false })
      .order('promotion_id', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setPromotions((data ?? []) as PromotionRow[])
        setLoading(false)
      })
  }, [clubId, refreshKey])

  // ── Fetch claim counts for all club promotions ────────────────────────────

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured || promotions.length === 0) return
    const ids = promotions.map(p => p.promotion_id)
    void supabase
      .from('claimed_promotions')
      .select('promotion_id, status')
      .in('promotion_id', ids)
      .then(({ data }) => {
        const counts: Record<string, { claimed: number; redeemed: number }> = {}
        for (const row of (data ?? []) as { promotion_id: string; status: string }[]) {
          if (!counts[row.promotion_id]) counts[row.promotion_id] = { claimed: 0, redeemed: 0 }
          counts[row.promotion_id].claimed += 1
          if (row.status === 'redeemed') counts[row.promotion_id].redeemed += 1
        }
        setClaimCounts(counts)
      })
  }, [promotions, clubId])

  // ── Toast auto-dismiss ────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Fetch global terms & conditions once ──────────────────────────────────

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    void supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'terms_and_conditions')
      .single()
      .then(({ data }) => {
        const val = (data as { value?: string } | null)?.value
        if (val) setGlobalTc(val)
      })
  }, [])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(
    () => [
      {
        label: 'Total',
        value: String(promotions.length),
        accent: 'purple',
        icon: <IconStatTag />,
      },
      {
        label: 'Active',
        value: String(promotions.filter((p) => p.status === 'active' && !promoIsPassed(p)).length),
        accent: 'green',
        icon: <IconStatCheck />,
      },
      {
        label: 'Draft',
        value: String(
          promotions.filter(
            (p) => (p.status === 'draft' || p.status === 'pending') && !promoIsPassed(p),
          ).length,
        ),
        accent: 'amber',
        icon: <IconStatPencil />,
      },
      {
        label: 'Passed',
        value: String(promotions.filter(promoIsPassed).length),
        accent: 'gray',
        icon: <IconStatHistory />,
      },
    ],
    [promotions],
  )

  // ── Filtered promotions ───────────────────────────────────────────────────

  const filteredPromotions = useMemo(() => {
    switch (activeFilter) {
      case 'active':
        return promotions.filter((p) => p.status === 'active' && !promoIsPassed(p))
      case 'draft':
        return promotions.filter(
          (p) => (p.status === 'draft' || p.status === 'pending') && !promoIsPassed(p),
        )
      case 'passed':
        return promotions.filter(promoIsPassed)
      default: {
        const order = (p: PromotionRow) =>
          p.status === 'active' && !promoIsPassed(p) ? 0 :
          (p.status === 'draft' || p.status === 'pending') && !promoIsPassed(p) ? 1 :
          promoIsPassed(p) ? 2 : 3
        return [...promotions].sort((a, b) => order(a) - order(b))
      }
    }
  }, [promotions, activeFilter])

  // ── Date range helpers ────────────────────────────────────────────────────

  const promotionRangeSummary = humanRangeSummary(form.valid_from, form.valid_until)
  const validFromParts = splitDateTimeLocal(form.valid_from)
  const validUntilParts = splitDateTimeLocal(form.valid_until)

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
      setForm((f) => ({
        ...f,
        valid_from: toDateTimeLocalValue(now),
        valid_until: toDateTimeLocalValue(new Date(now.getTime() + 7 * 86400000)),
      }))
      return
    }
    setForm((f) => ({
      ...f,
      valid_from: toDateTimeLocalValue(now),
      valid_until: toDateTimeLocalValue(new Date(now.getTime() + 30 * 86400000)),
    }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const nextErrors: FormErrors = {}
    if (!form.title.trim()) nextErrors.title = 'Title is required.'
    const validFromDt = parseDateTimeLocal(form.valid_from)
    const validUntilDt = parseDateTimeLocal(form.valid_until)
    if (validFromDt && validUntilDt && validUntilDt.getTime() <= validFromDt.getTime()) {
      nextErrors.valid_until = '"Valid until" must be after "Valid from".'
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

    setIsSubmitting(true)
    setToast(null)

    try {
      // Upload new image if one was selected
      let finalImageUrl: string | null = imagePreviewUrl.startsWith('http')
        ? imagePreviewUrl
        : null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() ?? 'jpg'
        const path = `${clubId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('promotion-images')
          .upload(path, imageFile, { upsert: true })
        if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`)
        const { data: urlData } = supabase.storage
          .from('promotion-images')
          .getPublicUrl(path)
        finalImageUrl = urlData.publicUrl
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        original_price: form.original_price.trim() ? Number(form.original_price) : null,
        valid_from: form.valid_from.trim() ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until.trim() ? new Date(form.valid_until).toISOString() : null,
        image_url: finalImageUrl,
        status: form.status,
        included_items: form.what_included.trim() || null,
        terms_conditions: form.terms_conditions.trim() || null,
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
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Archive (soft-delete) — preserves claimed_promotions rows ────────────

  async function confirmDelete() {
    if (!deleteTarget || !supabase || !isSupabaseConfigured) return
    setIsDeleting(true)
    const { error: delErr } = await supabase
      .from('promotions')
      .update({ status: 'archived', deleted_at: new Date().toISOString() })
      .eq('promotion_id', deleteTarget.id)
    setIsDeleting(false)
    setDeleteTarget(null)
    if (delErr) {
      setToast({ type: 'error', message: delErr.message })
    } else {
      setToast({ type: 'success', message: 'Promotion archived.' })
      setRefreshKey((k) => k + 1)
    }
  }

  // ── Loading / error shells ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div
            className="manager-dash__main manager-dash__main--event-mgmt"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
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
          <div
            className="manager-dash__main manager-dash__main--event-mgmt"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
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
            {/* ── Page header ─────────────────────────────────────────────── */}
            <header className="event-mgmt__head">
              <div className="event-mgmt__head-text">
                <h1 className="manager-dash__page-title">Promotions</h1>
                <p className="manager-dash__page-sub">Create and manage your club promotions</p>
              </div>
              <button type="button" className="event-mgmt__create" onClick={openAddModal}>
                <IconPlus />
                Add Promotion
              </button>
            </header>

            {/* ── Toast ───────────────────────────────────────────────────── */}
            {toast && (
              <div className={`event-mgmt__toast event-mgmt__toast--${toast.type}`}>
                {toast.message}
              </div>
            )}

            {/* ── View modal ──────────────────────────────────────────────── */}
            {viewPromo && (
              <PromotionViewModal
                promo={viewPromo}
                onClose={() => setViewPromo(null)}
                onEdit={(p) => { setViewPromo(null); openEditModal(p) }}
              />
            )}

            {/* ── Delete confirmation ─────────────────────────────────────── */}
            {deleteTarget && (
              <div
                className="event-mgmt__modal-overlay"
                onClick={() => { if (!isDeleting) setDeleteTarget(null) }}
                role="presentation"
              >
                <div
                  className="promo-mgmt__confirm"
                  onClick={(e) => e.stopPropagation()}
                  role="alertdialog"
                  aria-modal="true"
                  aria-label="Confirm deletion"
                >
                  <div className="promo-mgmt__confirm-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: 40, height: 40 }}>
                      <path
                        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                        stroke="#f87171"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <line x1="12" y1="9" x2="12" y2="13" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h2 className="promo-mgmt__confirm-title">Archive Promotion?</h2>
                  <p className="promo-mgmt__confirm-msg">
                    <span className="promo-mgmt__confirm-name">"{deleteTarget.title}"</span>
                    {' '}will be hidden from users. Users who already claimed it can still redeem their code.
                  </p>
                  <div className="promo-mgmt__confirm-actions">
                    <button
                      type="button"
                      className="promo-mgmt__confirm-cancel"
                      onClick={() => setDeleteTarget(null)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="promo-mgmt__confirm-delete"
                      onClick={confirmDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Archiving…' : 'Archive'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Add / Edit modal ────────────────────────────────────────── */}
            {showForm && (
              <div
                className="event-mgmt__modal-overlay"
                onClick={closeModal}
                role="presentation"
              >
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
                      aria-label="Close modal"
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="event-mgmt__modal-form">
                    <div className="event-mgmt__modal-body">

                      {/* Title */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Promotion Title *</label>
                        <input
                          className={
                            formErrors.title
                              ? 'event-mgmt__input event-mgmt__input--error'
                              : 'event-mgmt__input'
                          }
                          type="text"
                          placeholder="e.g. Free entry before midnight"
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        />
                        {formErrors.title && (
                          <p className="event-mgmt__field-error">{formErrors.title}</p>
                        )}
                      </div>

                      {/* Category */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Category</label>
                        <CategorySelect
                          value={form.category}
                          onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                        />
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
                            onChange={(e) =>
                              setForm((f) => ({ ...f, discount_value: e.target.value }))
                            }
                          />
                        </div>
                      </div>

                      {/* Final price — read-only calculation */}
                      {(() => {
                        const orig = form.original_price ? Number(form.original_price) : NaN
                        const disc = form.discount_value  ? Number(form.discount_value)  : NaN
                        if (!Number.isFinite(orig) || orig <= 0 || !Number.isFinite(disc) || disc <= 0) return null
                        const final = orig * (1 - disc / 100)
                        const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2))
                        return (
                          <div className="promo-mgmt__final-price">
                            <span className="promo-mgmt__final-price-label">Final price</span>
                            <span className="promo-mgmt__final-price-value">
                              €{fmt(orig)} → €{fmt(final)} ({disc}% off)
                            </span>
                          </div>
                        )
                      })()}

                      {/* Valid from + until */}
                      <div className="event-mgmt__field-grid">
                        <PromotionDatePickerField
                          label="Start Date"
                          value={validFromParts.date}
                          isOpen={openDateTimePicker === 'valid_from'}
                          onOpen={() => setOpenDateTimePicker('valid_from')}
                          onClose={() => setOpenDateTimePicker(null)}
                          onChange={(v) => updatePromotionDateTime('valid_from', 'date', v)}
                        />
                        <PromotionTimeField
                          label="Start Time"
                          value={validFromParts.time}
                          onChange={(v) => {
                            setOpenDateTimePicker(null)
                            updatePromotionDateTime('valid_from', 'time', v)
                          }}
                        />
                        <PromotionDatePickerField
                          label="End Date"
                          value={validUntilParts.date}
                          error={formErrors.valid_until}
                          isOpen={openDateTimePicker === 'valid_until'}
                          onOpen={() => setOpenDateTimePicker('valid_until')}
                          onClose={() => setOpenDateTimePicker(null)}
                          onChange={(v) => updatePromotionDateTime('valid_until', 'date', v)}
                        />
                        <PromotionTimeField
                          label="End Time"
                          value={validUntilParts.time}
                          onChange={(v) => {
                            setOpenDateTimePicker(null)
                            updatePromotionDateTime('valid_until', 'time', v)
                          }}
                        />
                      </div>

                      {/* Date presets */}
                      <div
                        className="event-time-picker__presets"
                        role="group"
                        aria-label="Quick date range presets"
                      >
                        {(['today', 'weekend', 'week', 'month'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            className="event-time-picker__preset-chip"
                            onClick={() => {
                              setOpenDateTimePicker(null)
                              applyPromotionDatePreset(p)
                            }}
                          >
                            {p === 'today'
                              ? 'Today only'
                              : p === 'weekend'
                                ? 'This weekend'
                                : p === 'week'
                                  ? '1 week'
                                  : '1 month'}
                          </button>
                        ))}
                      </div>
                      {promotionRangeSummary && (
                        <p className="event-time-picker__range-summary">
                          {promotionRangeSummary}
                        </p>
                      )}
                      {formErrors.valid_until && (
                        <p className="event-mgmt__field-error">{formErrors.valid_until}</p>
                      )}

                      {/* Image upload */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Promotion Image</label>
                        <div className="promo-mgmt__upload-wrap">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                          />
                          <button
                            type="button"
                            className="promo-mgmt__upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <IconUpload />
                            {imagePreviewUrl ? 'Change image' : 'Upload image'}
                          </button>
                          {imagePreviewUrl && (
                            <>
                              <img
                                src={imagePreviewUrl}
                                alt="Promotion preview"
                                className="promo-mgmt__upload-preview"
                              />
                              <button
                                type="button"
                                className="promo-mgmt__upload-remove"
                                onClick={handleRemoveImage}
                              >
                                Remove image
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Description</label>
                        <textarea
                          className="event-mgmt__input event-mgmt__input--textarea"
                          rows={3}
                          placeholder="Describe this promotion..."
                          value={form.description}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, description: e.target.value }))
                          }
                        />
                      </div>

                      {/* What's Included */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>What's Included</label>
                        <textarea
                          className="event-mgmt__input event-mgmt__input--textarea"
                          rows={2}
                          placeholder="e.g. 1 drink, skip-the-line entry, VIP wristband..."
                          value={form.what_included}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, what_included: e.target.value }))
                          }
                        />
                      </div>

                      {/* Terms & Conditions */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Terms & Conditions</label>
                        <textarea
                          className="event-mgmt__input event-mgmt__input--textarea"
                          rows={3}
                          placeholder="e.g. Valid for new customers only. Cannot be combined with other offers..."
                          value={form.terms_conditions}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, terms_conditions: e.target.value }))
                          }
                        />
                      </div>

                      {/* Status */}
                      <div className="event-mgmt__field event-mgmt__field--full">
                        <label>Status</label>
                        <div className="event-mgmt__status-toggle">
                          <button
                            type="button"
                            className={
                              form.status === 'draft'
                                ? 'event-mgmt__status-pill event-mgmt__status-pill--active'
                                : 'event-mgmt__status-pill'
                            }
                            onClick={() => setForm((f) => ({ ...f, status: 'draft' }))}
                          >
                            Draft
                          </button>
                          <button
                            type="button"
                            className={
                              form.status === 'active'
                                ? 'event-mgmt__status-pill event-mgmt__status-pill--active'
                                : 'event-mgmt__status-pill'
                            }
                            onClick={() => setForm((f) => ({ ...f, status: 'active' }))}
                          >
                            Active
                          </button>
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
                        ) : isEditMode ? (
                          'Save Changes'
                        ) : (
                          'Add Promotion'
                        )}
                      </button>
                    </div>
                  </form>
                </aside>
              </div>
            )}

            {/* ── Stat cards ──────────────────────────────────────────────── */}
            <section className="promo-mgmt__stats" aria-label="Promotions statistics">
              {stats.map((s) => (
                <article
                  key={s.label}
                  className={`promo-mgmt__stat promo-mgmt__stat--${s.accent}`}
                >
                  <div className="promo-mgmt__stat-body">
                    <p className="promo-mgmt__stat-value">{s.value}</p>
                    <p className="promo-mgmt__stat-label">{s.label}</p>
                  </div>
                  <span
                    className={`promo-mgmt__stat-icon promo-mgmt__stat-icon--${s.accent}`}
                    aria-hidden
                  >
                    {s.icon}
                  </span>
                </article>
              ))}
            </section>

            {/* ── Filter tabs ──────────────────────────────────────────────── */}
            <div className="promo-mgmt__filter-tabs" role="tablist" aria-label="Filter promotions">
              {(['active', 'draft', 'passed', 'all'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === tab}
                  className={[
                    'promo-mgmt__filter-tab',
                    activeFilter === tab ? 'promo-mgmt__filter-tab--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setActiveFilter(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Promotions grid ──────────────────────────────────────────── */}
            {filteredPromotions.length === 0 ? (
              <p style={{ color: '#8a8a8a', fontSize: '0.9375rem', paddingTop: '8px' }}>
                {activeFilter === 'all'
                  ? 'No promotions yet. Add your first promotion!'
                  : `No ${activeFilter} promotions.`}
              </p>
            ) : (
              <section className="event-mgmt__grid" aria-label="Promotions list">
                {filteredPromotions.map((promo) => (
                  <PromotionCard
                    key={promo.promotion_id}
                    promo={promo}
                    onEdit={openEditModal}
                    onDelete={(p) => setDeleteTarget({ id: p.promotion_id, title: p.title })}
                    onView={setViewPromo}
                    onRepeat={openRepeatModal}
                    claimCount={claimCounts[promo.promotion_id]}
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
