import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

type ViewMode = 'days' | 'years'

type DatePickerProps = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  accentHex?: string
  minYear?: number
  maxYear?: number
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  accentHex,
  minYear = 1930,
  maxYear,
  className = '',
}: DatePickerProps) {
  const today = new Date()
  const resolvedMaxYear = maxYear ?? today.getFullYear()

  const parsed = useMemo(() => {
    if (!value) return null
    const d = new Date(value + 'T12:00:00')
    return Number.isNaN(d.getTime()) ? null : d
  }, [value])

  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('days')
  const [viewYear, setViewYear] = useState(() =>
    parsed?.getFullYear() ?? Math.max(minYear, today.getFullYear() - 20),
  )
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth() ?? today.getMonth())

  // ── Year-grid: groups of 16 (4 × 4) ──────────────────────────────────────
  const yearGridStart = Math.floor(viewYear / 16) * 16
  const yearGridEnd = Math.min(yearGridStart + 15, resolvedMaxYear)
  const yearGrid = Array.from(
    { length: yearGridEnd - yearGridStart + 1 },
    (_, i) => yearGridStart + i,
  ).filter((y) => y >= minYear && y <= resolvedMaxYear)

  function prevYearPage() {
    const next = yearGridStart - 16
    if (next + 15 < minYear) return
    setViewYear(Math.max(minYear, next + 8))
  }
  function nextYearPage() {
    const next = yearGridStart + 16
    if (next > resolvedMaxYear) return
    setViewYear(Math.min(resolvedMaxYear, next + 8))
  }

  function selectYear(y: number) {
    setViewYear(y)
    setViewMode('days')
  }

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => Math.max(minYear, y - 1)) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => Math.min(resolvedMaxYear, y + 1)) }
    else setViewMonth((m) => m + 1)
  }

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
    setViewMode('days')
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay()

  const displayLabel = parsed
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      }).format(parsed)
    : placeholder

  const accentStyle = accentHex ? { backgroundColor: accentHex } : undefined
  const selectedDayClass = accentHex
    ? 'font-bold text-white shadow-md'
    : 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500 font-bold text-white shadow-md'

  const navBtn =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-pink-400 disabled:pointer-events-none disabled:opacity-20'

  return (
    <div className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setViewMode('days') }}
        className="flex w-full cursor-pointer items-center justify-between rounded-full border border-white/15 bg-black/35 px-4 py-3 text-sm text-white outline-none transition hover:border-white/25 focus:border-pink-500/60"
      >
        <span className={parsed ? 'text-white' : 'text-white/35'}>{displayLabel}</span>
        <Calendar className="h-4 w-4 shrink-0 text-pink-400" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setViewMode('days') }} />

          {/* ── Popup ── */}
          <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#16161e] shadow-2xl shadow-black/70">

            {/* ════════════════════════
                DAY VIEW
            ════════════════════════ */}
            {viewMode === 'days' && (
              <div className="p-4">
                {/* Month + Year header */}
                <div className="mb-3 flex items-center justify-between">
                  <button type="button" className={navBtn} onClick={prevMonth} aria-label="Previous month">
                    <ChevronLeft size={14} />
                  </button>

                  {/* Clicking the label switches to year-grid */}
                  <button
                    type="button"
                    onClick={() => setViewMode('years')}
                    className="group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-white/8"
                    aria-label="Pick year"
                  >
                    <span className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                      {MONTHS[viewMonth]}
                    </span>
                    <span className="rounded-md border border-white/15 bg-white/8 px-1.5 py-0.5 text-xs font-bold text-white/60 group-hover:border-pink-500/40 group-hover:text-pink-300 transition-colors">
                      {viewYear}
                    </span>
                    {/* small caret to hint it's tappable */}
                    <svg
                      width="10" height="6" viewBox="0 0 10 6" fill="none"
                      className="text-white/30 group-hover:text-pink-400 transition-colors"
                    >
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <button type="button" className={navBtn} onClick={nextMonth} aria-label="Next month">
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Day-of-week labels */}
                <div className="mb-1 grid grid-cols-7">
                  {DAYS_SHORT.map((d) => (
                    <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/25">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const isSelected =
                      parsed?.getFullYear() === viewYear &&
                      parsed?.getMonth() === viewMonth &&
                      parsed?.getDate() === day
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => selectDay(day)}
                        style={isSelected && accentStyle ? accentStyle : undefined}
                        className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg text-[13px] transition
                          ${isSelected ? selectedDayClass : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ════════════════════════
                YEAR GRID VIEW
            ════════════════════════ */}
            {viewMode === 'years' && (
              <div className="p-4">
                {/* Range header */}
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    className={navBtn}
                    onClick={prevYearPage}
                    disabled={yearGridStart - 16 + 15 < minYear}
                    aria-label="Previous years"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="text-sm font-bold text-white/70">
                    {yearGridStart} – {yearGridEnd}
                  </span>

                  <button
                    type="button"
                    className={navBtn}
                    onClick={nextYearPage}
                    disabled={yearGridStart + 16 > resolvedMaxYear}
                    aria-label="Next years"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Hint */}
                <p className="mb-3 text-center text-[10px] text-white/30 uppercase tracking-wider">
                  Select year
                </p>

                {/* Year grid — 4 columns */}
                <div className="grid grid-cols-4 gap-1.5">
                  {yearGrid.map((y) => {
                    const isCurrentView = y === viewYear
                    const isSelectedYear = parsed?.getFullYear() === y
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => selectYear(y)}
                        style={isSelectedYear && accentStyle ? accentStyle : undefined}
                        className={`cursor-pointer rounded-xl py-2 text-sm font-semibold transition
                          ${isSelectedYear
                            ? accentHex
                              ? 'text-white shadow-md'
                              : 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-500 text-white shadow-md'
                            : isCurrentView
                              ? 'border border-pink-500/40 text-pink-300'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}
