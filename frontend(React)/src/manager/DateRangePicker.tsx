import { useMemo, useState } from 'react'
import './DateRangePicker.css'

interface DateRangePickerProps {
  from: string  // YYYY-MM-DD or ''
  to: string    // YYYY-MM-DD or ''
  onChange: (from: string, to: string) => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toLocalISO(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function todayISO(): string {
  return toLocalISO(new Date())
}

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  // Build day cells for the displayed month
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const startPad = firstDay.getDay() // 0=Sun
    const result: Array<{ iso: string; day: number } | null> = []
    for (let i = 0; i < startPad; i++) result.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ iso: toLocalISO(new Date(viewYear, viewMonth, d)), day: d })
    }
    return result
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(iso: string) {
    if (!from || (from && to)) {
      // Start fresh selection
      onChange(iso, '')
    } else {
      // from is set, to is not — finalise the range
      if (iso < from) onChange(iso, from)
      else onChange(from, iso)  // works for same-day (iso === from → single day)
    }
  }

  function dayClass(iso: string): string {
    const isStart = !!from && iso === from
    const isEnd   = !!to && iso === to
    const inRange = !!from && !!to && from !== to && iso > from && iso < to
    const isToday = iso === todayISO()

    const cls = ['drp__day']
    if (isStart || isEnd) cls.push('drp__day--selected')
    else if (inRange)     cls.push('drp__day--in-range')
    if (isToday && !isStart && !isEnd) cls.push('drp__day--today')
    return cls.join(' ')
  }

  const rangeLabel = from
    ? (to && to !== from ? `${from}  →  ${to}` : from)
    : null

  const isSelectingEnd = !!from && !to

  return (
    <div className="drp">
      {/* Month navigation */}
      <div className="drp__header">
        <button type="button" className="drp__nav-btn" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className="drp__month-label">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" className="drp__nav-btn" onClick={nextMonth} aria-label="Next month">
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="drp__weekdays">
        {WEEKDAYS.map(d => <span key={d} className="drp__weekday">{d}</span>)}
      </div>

      {/* Day grid */}
      <div className="drp__grid">
        {cells.map((cell, i) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              className={dayClass(cell.iso)}
              onClick={() => handleDayClick(cell.iso)}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`pad-${i}`} className="drp__day drp__day--pad" aria-hidden />
          )
        )}
      </div>

      {/* Footer */}
      <div className="drp__footer">
        <button
          type="button"
          className="drp__today-btn"
          onClick={() => { const t = todayISO(); onChange(t, t) }}
        >
          Today
        </button>

        <div className="drp__footer-right">
          {rangeLabel && (
            <span className="drp__range-label">{rangeLabel}</span>
          )}
          {from && (
            <button
              type="button"
              className="drp__clear-btn"
              onClick={() => onChange('', '')}
              aria-label="Clear selection"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isSelectingEnd && (
        <p className="drp__hint">Click a second day to set the end of the range</p>
      )}
    </div>
  )
}
