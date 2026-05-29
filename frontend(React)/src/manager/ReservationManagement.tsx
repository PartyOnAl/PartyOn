import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ChevronDown, Clock, Crown, TrendingUp, Trash2, Users, XCircle } from 'lucide-react'
import './ManagerDashboard.css'
import './ReservationManagement.css'
import DateRangePicker from './DateRangePicker'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { isPaidTicketEvent, reservationGuestCount, totalGuestCount } from './eventPaidEntry'
import {
  // NO_SHOW_STATUS,            // no-show: commented out
  // getNoShowState,            // no-show: commented out
  // incrementNoShowBadgeCount, // no-show: commented out
  // loadNoShowGraceMinutes,    // no-show: commented out
  // reservationIsNoShow,       // no-show: commented out
  normalizeReservationStatus,
} from './noShow'

type FilterTab = 'all' | 'tickets'
type DatePreset = 'all' | 'tonight' | 'this_week' | 'custom'
type FloorStatus = 'available' | 'reserved' | 'occupied'

type PaymentRow = { amount: string; status: string | null }

type ReservationRow = {
  reservation_id: string
  type: string | null
  status: string | null
  nr_of_people: number | null
  created_at: string | null
  table_id: string | null
  event_id: string | null
  notes: string | null
  user: { id: string; name: string | null; surname: string | null } | null
  events: {
    event_name: string
    ticket_price: string | null
    final_ticket_price: string | null
    event_type: string | null
    event_starting_date: string | null
  } | null
  payments: PaymentRow[]
}

type DbTableRow = {
  id: string
  table_number: string
  seating_capacity: number
  minimum_spend: string | null
  position: string | null
  location: string | null
  type: string | null
  table_status: string | null
}

type ClubEventRow = {
  event_id: string
  event_name: string
  event_starting_date: string | null
}

type FloorTableConfig = {
  id: string
  number: number
  label: string
  isVip: boolean
  capacity: number
  minSpend: number
  gridColumn: number
  gridColumnSpan: number
  gridRow: number
  /** Pixel center on floor plan SVG (viewBox 0 0 1000 700) */
  x: number
  y: number
  /** Seat count around table (from DB seating_capacity) */
  seats: number
  raw: DbTableRow
}

type TableDisplay = {
  status: FloorStatus
  guestName?: string
  eventLabel?: string
  linkedReservationId?: string
  // noShow?: boolean  // no-show: commented out
}

type VipPackageDraft = { minSpend: string; bottleNote: string }

type TablePositionJson = {
  layout?: { col?: number; row?: number; colSpan?: number; x?: number; y?: number; cs?: string }
  vip_note?: string
  label?: string
  /** When DB disallows `table_status = occupied`, UI stores this in JSON instead */
  floor_ui_status?: string
}

function buildPositionRecord(position: string | null): Record<string, unknown> {
  if (!position?.trim()) return {}
  try {
    const p = JSON.parse(position) as unknown
    if (p && typeof p === 'object') return { ...(p as Record<string, unknown>) }
    return { label: position }
  } catch {
    return { label: position }
  }
}

function parseTablePositionJson(position: string | null): TablePositionJson | null {
  if (!position?.trim()) return null
  try {
    const o = JSON.parse(position) as unknown
    if (o && typeof o === 'object') return o as TablePositionJson
  } catch {
    /* not JSON */
  }
  return null
}

function getFloorUiOverride(position: string | null): FloorStatus | null {
  const p = parseTablePositionJson(position)
  if (!p?.floor_ui_status) return null
  const s = String(p.floor_ui_status).toLowerCase().trim()
  if (s === 'occupied') return 'occupied'
  return null
}

function positionJsonWithoutFloorUi(raw: string | null): string | null {
  const o = buildPositionRecord(raw)
  delete o.floor_ui_status
  return Object.keys(o).length > 0 ? JSON.stringify(o) : null
}

/** Logical floor canvas size (positions stored in this space when `layout.cs === '9x6'`). */
const FLOOR_CANVAS_W = 900
const FLOOR_CANVAS_H = 600
const FLOOR_TOKEN_R = 26
const FLOOR_TOKEN_R_VIP = 32

type FloorZoneKey = 'stage' | 'bar' | 'dancefloor' | 'restrooms' | 'lounge'

const DEFAULT_ZONE_LAYOUT: Record<FloorZoneKey, { x: number; y: number }> = {
  stage: { x: 34, y: 7.14 },
  dancefloor: { x: 34, y: 25.71 },
  bar: { x: 84, y: 25.71 },
  restrooms: { x: 4, y: 25.71 },
  lounge: { x: 38, y: 91 },
}

/** Zone box width/height as % of canvas (for clamping while dragging). */
const ZONE_PCT_BOUNDS: Record<FloorZoneKey, { w: number; h: number }> = {
  stage: { w: 32, h: 12.86 },
  dancefloor: { w: 32, h: 31.43 },
  bar: { w: 14, h: 54.29 },
  restrooms: { w: 12, h: 25.71 },
  lounge: { w: 24, h: 6 },
}

function parseClubLayoutConfig(raw: string | null | undefined): Partial<Record<FloorZoneKey, { x: number; y: number }>> {
  if (!raw?.trim()) return {}
  try {
    const o = JSON.parse(raw) as { zones?: Record<string, { x?: unknown; y?: unknown }> }
    const z = o.zones
    if (!z || typeof z !== 'object') return {}
    const out: Partial<Record<FloorZoneKey, { x: number; y: number }>> = {}
    const keys: FloorZoneKey[] = ['stage', 'bar', 'dancefloor', 'restrooms', 'lounge']
    for (const k of keys) {
      const p = z[k]
      const x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : null
      const y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : null
      if (x != null && y != null) out[k] = { x, y }
    }
    return out
  } catch {
    return {}
  }
}

function mergeFlushedZoneLayout(
  base: Record<FloorZoneKey, { x: number; y: number }>,
  zRef: { key: FloorZoneKey; currX: number; currY: number } | null,
  zPre: { key: FloorZoneKey; x: number; y: number } | null,
): Record<FloorZoneKey, { x: number; y: number }> {
  let next = { ...base }
  if (zRef) next = { ...next, [zRef.key]: { x: zRef.currX, y: zRef.currY } }
  else if (zPre) next = { ...next, [zPre.key]: { x: zPre.x, y: zPre.y } }
  return next
}

function stripTableCanvasCoords(position: string | null): string | null {
  const rec = buildPositionRecord(position)
  const lo = rec.layout
  if (lo && typeof lo === 'object' && !Array.isArray(lo)) {
    const o = { ...(lo as Record<string, unknown>) }
    delete o.x
    delete o.y
    delete o.cs
    if (Object.keys(o).length === 0) {
      delete rec.layout
    } else {
      rec.layout = o
    }
  }
  const keys = Object.keys(rec)
  return keys.length > 0 ? JSON.stringify(rec) : null
}

function mergePositionLayout(existing: string | null, x: number, y: number): string {
  const rec = buildPositionRecord(existing)
  const prevLayout = rec.layout
  const layoutObj: Record<string, unknown> =
    prevLayout && typeof prevLayout === 'object' && !Array.isArray(prevLayout)
      ? { ...(prevLayout as Record<string, unknown>) }
      : {}
  layoutObj.x = Math.round(x)
  layoutObj.y = Math.round(y)
  layoutObj.cs = '9x6'
  rec.layout = layoutObj
  return JSON.stringify(rec)
}

function layoutXYFromPosition(
  parsed: TablePositionJson | null,
  i: number,
  isVip: boolean,
): { x: number; y: number } {
  const rClamp = isVip ? FLOOR_TOKEN_R_VIP : FLOOR_TOKEN_R
  const lx = parsed?.layout?.x
  const ly = parsed?.layout?.y
  const cs = parsed?.layout?.cs
  if (typeof lx === 'number' && typeof ly === 'number' && Number.isFinite(lx) && Number.isFinite(ly)) {
    const x =
      cs === '9x6'
        ? lx
        : (lx / 1000) * FLOOR_CANVAS_W
    const y =
      cs === '9x6'
        ? ly
        : (ly / 700) * FLOOR_CANVAS_H
    return {
      x: Math.min(FLOOR_CANVAS_W - rClamp, Math.max(rClamp, x)),
      y: Math.min(FLOOR_CANVAS_H - rClamp, Math.max(rClamp, y)),
    }
  }
  const slotXY = FLOOR_PLAN_XY_SLOTS[i % FLOOR_PLAN_XY_SLOTS.length]!
  const ring = Math.floor(i / FLOOR_PLAN_XY_SLOTS.length)
  const x1000 = slotXY.x + (ring % 5) * 12 - 24
  const y700 = slotXY.y + Math.floor(ring / 5) * 14
  const rawX = (x1000 / 1000) * FLOOR_CANVAS_W
  const rawY = (y700 / 700) * FLOOR_CANVAS_H
  return {
    x: Math.min(FLOOR_CANVAS_W - rClamp, Math.max(rClamp, rawX)),
    y: Math.min(FLOOR_CANVAS_H - rClamp, Math.max(rClamp, rawY)),
  }
}

const FLOOR_SLOTS: { col: number; row: number }[] = [
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 4, row: 1 },
  { col: 6, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 1, row: 3 },
  { col: 4, row: 3 },
]

const BLOCK_ROW_SPAN = 3

/** SVG centers for tables — avoids dance floor (~340–660 × 180–400), bar (x ≥ 820), restrooms (x ≤ 160, y ≤ 360). */
const FLOOR_PLAN_XY_SLOTS: { x: number; y: number }[] = [
  { x: 200, y: 440 },
  { x: 260, y: 460 },
  { x: 220, y: 520 },
  { x: 280, y: 560 },
  { x: 200, y: 590 },
  { x: 380, y: 430 },
  { x: 460, y: 450 },
  { x: 540, y: 430 },
  { x: 620, y: 450 },
  { x: 400, y: 510 },
  { x: 500, y: 520 },
  { x: 600, y: 510 },
  { x: 420, y: 580 },
  { x: 500, y: 600 },
  { x: 580, y: 580 },
  { x: 680, y: 200 },
  { x: 740, y: 240 },
  { x: 700, y: 300 },
  { x: 780, y: 340 },
  { x: 720, y: 400 },
  { x: 800, y: 220 },
  { x: 720, y: 460 },
  { x: 780, y: 500 },
  { x: 740, y: 560 },
  { x: 800, y: 580 },
  { x: 340, y: 440 },
  { x: 660, y: 440 },
  { x: 360, y: 560 },
  { x: 640, y: 560 },
  { x: 300, y: 480 },
  { x: 250, y: 430 },
]

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tickets', label: 'Tickets' },
]

function naturalCompareTableNum(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function isVipTableType(type: string | null): boolean {
  if (!type) return false
  return type.toLowerCase().includes('vip')
}

function normalizeFloorStatus(raw: string | null): FloorStatus {
  const t = (raw ?? 'available').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function layoutTablesForFloor(rows: DbTableRow[]): FloorTableConfig[] {
  const sorted = [...rows].sort((a, b) => naturalCompareTableNum(a.table_number, b.table_number))
  return sorted.map((row, i) => {
    const block = Math.floor(i / FLOOR_SLOTS.length)
    const slot = FLOOR_SLOTS[i % FLOOR_SLOTS.length]!
    const parsed = parseTablePositionJson(row.position)
    const lc = parsed?.layout?.col
    const lr = parsed?.layout?.row
    const col = typeof lc === 'number' && Number.isFinite(lc) ? lc : slot.col
    const rowN = typeof lr === 'number' && Number.isFinite(lr) ? lr : slot.row + block * BLOCK_ROW_SPAN
    const cs = parsed?.layout?.colSpan
    const colSpan = typeof cs === 'number' && Number.isFinite(cs) && cs > 0 ? cs : 1
    const num = Number.parseInt(row.table_number.replace(/\D/g, ''), 10)
    const cap = row.seating_capacity
    const seats = Number.isFinite(cap) && cap > 0 ? Math.round(cap) : 4
    const { x, y } = layoutXYFromPosition(parsed, i, isVipTableType(row.type))
    return {
      id: row.id,
      number: Number.isFinite(num) ? num : i + 1,
      label: row.table_number.trim() || String(i + 1),
      isVip: isVipTableType(row.type),
      capacity: row.seating_capacity,
      minSpend: row.minimum_spend != null ? Number.parseFloat(row.minimum_spend) || 0 : 0,
      gridColumn: col,
      gridColumnSpan: colSpan,
      gridRow: rowN,
      x,
      y,
      seats,
      raw: row,
    }
  })
}

function getPrimaryReservationForTable(tableId: string, reservations: ReservationRow[]): ReservationRow | null {
  const list = reservations.filter(
    (r) => r.table_id === tableId && ['pending', 'confirmed' /*, 'noshow' // no-show: commented out */].includes(normalizeReservationStatus(r.status)),
  )
  list.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
  return list[0] ?? null
}

function computeTableDisplay(table: DbTableRow, reservations: ReservationRow[]): TableDisplay {
  const primary = getPrimaryReservationForTable(table.id, reservations)
  const db = normalizeFloorStatus(table.table_status)
  const uiOcc = getFloorUiOverride(table.position)

  if (uiOcc === 'occupied') {
    return {
      status: 'occupied',
      guestName: primary ? reservationGuestLabel(primary) : undefined,
      eventLabel: primary?.events?.event_name ?? undefined,
      linkedReservationId: primary?.reservation_id,
    }
  }

  if (db === 'occupied') {
    return {
      status: 'occupied',
      guestName: primary ? reservationGuestLabel(primary) : undefined,
      eventLabel: primary?.events?.event_name ?? undefined,
      linkedReservationId: primary?.reservation_id,
    }
  }

  if (primary) {
    return {
      status: 'reserved',
      guestName: reservationGuestLabel(primary),
      eventLabel: primary.events?.event_name ?? undefined,
      linkedReservationId: primary.reservation_id,
      // noShow: reservationIsNoShow(primary.status),  // no-show: commented out
    }
  }

  if (db === 'reserved') return { status: 'reserved' }
  return { status: 'available' }
}

function typeLabel(t: string | null) {
  switch (t) {
    case 'vip_table':
      return 'VIP Table'
    case 'ticket':
      return 'Ticket'
    case 'standard_table':
      return 'Standard Table'
    case 'table':
      return 'Table'
    default:
      return t ?? '—'
  }
}

function isTableBookingType(t: string | null) {
  if (!t) return false
  const x = t.toLowerCase()
  return x === 'vip_table' || x === 'standard_table' || x === 'table'
}

function matchesFilter(row: ReservationRow, tab: FilterTab) {
  if (tab === 'all') return true
  return row.type === 'ticket'
}

function localDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function matchesDatePreset(row: ReservationRow, preset: DatePreset, from: string, to: string): boolean {
  if (preset === 'all') return true
  const eventDate = row.events?.event_starting_date?.slice(0, 10) ?? null
  const today = new Date()
  const todayStr = localDateStr(today)
  if (preset === 'tonight') return eventDate === todayStr
  if (preset === 'this_week') {
    const monday = new Date(today)
    const diff = today.getDay() === 0 ? -6 : 1 - today.getDay()
    monday.setDate(today.getDate() + diff)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return !!eventDate && eventDate >= localDateStr(monday) && eventDate <= localDateStr(sunday)
  }
  if (preset === 'custom') {
    if (!from && !to) return true
    if (!eventDate) return false
    if (from && eventDate < from) return false
    if (to && eventDate > to) return false
    return true
  }
  return true
}

function resolvedAmount(payments: PaymentRow[]) {
  const paid = payments.filter((p) => paymentIsCompleted(p.status))
  if (paid.length === 0) return null
  return paid.reduce((s, p) => s + parseFloat(p.amount || '0'), 0)
}

function resolvedPaymentStatus(payments: PaymentRow[]): 'paid' | 'pending' {
  return payments.some((p) => paymentIsCompleted(p.status)) ? 'paid' : 'pending'
}

function paymentIsCompleted(status: string | null) {
  const s = (status ?? '').trim().toLowerCase()
  return s === 'paid' || s === 'completed' || s === 'succeeded'
}

/** Free entry using same rules as Event Management / dashboard. Missing event pricing → treat as paid path. */
function reservationEventIsFree(row: ReservationRow): boolean {
  const ev = row.events
  if (!ev) return false
  return !isPaidTicketEvent(ev)
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

function reservationGuestLabel(row: ReservationRow) {
  return row.user
    ? `${row.user.name ?? ''} ${row.user.surname ?? ''}`.trim() || 'Guest'
    : 'Guest'
}

function reservationIsCancelled(status: string | null) {
  const s = (status ?? '').trim().toLowerCase()
  return s === 'cancelled' || s === 'canceled'
}

function reservationStatusLabel(status: string | null) {
  // if (reservationIsNoShow(status)) return 'No-Show'  // no-show: commented out
  if (normalizeReservationStatus(status) === 'confirmed') return 'Confirmed'
  if (reservationIsCancelled(status)) return 'Cancelled'
  return 'Pending'
}

function reservationStatusClass(status: string | null) {
  // if (reservationIsNoShow(status)) return 'res-mgmt__pill res-mgmt__pill--noshow'  // no-show: commented out
  if (normalizeReservationStatus(status) === 'confirmed') return 'res-mgmt__pill res-mgmt__pill--ok'
  if (reservationIsCancelled(status)) return 'res-mgmt__pill res-mgmt__pill--cancelled'
  return 'res-mgmt__pill res-mgmt__pill--pending'
}

// ─── Custom Event Select (pink hover, no native browser blue) ─────────────────
function EventSelect({
  value,
  onChange,
  events,
}: {
  value: string
  onChange: (v: string) => void
  events: ClubEventRow[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const label = value === 'all'
    ? 'All Events'
    : events.find((e) => e.event_id === value)?.event_name ?? 'All Events'

  return (
    <div className="res-mgmt__ev-select" ref={ref}>
      <button
        type="button"
        className="res-mgmt__ev-select-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="res-mgmt__ev-select-label">
          {value !== 'all' && <span className="res-mgmt__ev-dot" aria-hidden />}
          <span className={value !== 'all' ? 'res-mgmt__ev-select-label--active' : ''}>{label}</span>
        </span>
        <ChevronDown size={14} className={`res-mgmt__ev-chevron${open ? ' res-mgmt__ev-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="res-mgmt__ev-select-menu" role="listbox">
          {[{ event_id: 'all', event_name: 'All Events' }, ...events].map((ev) => (
            <button
              key={ev.event_id}
              type="button"
              role="option"
              aria-selected={value === ev.event_id}
              className={`res-mgmt__ev-select-opt${value === ev.event_id ? ' res-mgmt__ev-select-opt--active' : ''}`}
              onClick={() => { onChange(ev.event_id); setOpen(false) }}
            >
              {ev.event_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReservationManagement() {
  const { club, clubId } = useManagerClub()
  const { user } = useAuth()
  const location = useLocation()
  const [dbTables, setDbTables] = useState<DbTableRow[]>([])
  const [clubEvents, setClubEvents] = useState<ClubEventRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('tonight')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')

  const [selectedFloorTableId, setSelectedFloorTableId] = useState<string | null>(null)
  const [manageTableId, setManageTableId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const [reserveGuest, setReserveGuest] = useState('')
  const [reserveEvent, setReserveEvent] = useState('')
  const [reserveEventId, setReserveEventId] = useState('')
  const [reserveLinkId, setReserveLinkId] = useState('')

  const [vipDraft, setVipDraft] = useState<VipPackageDraft>({ minSpend: '', bottleNote: '' })

  const [addTableOpen, setAddTableOpen] = useState(false)
  const [addTableNumber, setAddTableNumber] = useState('')
  const [addCapacity, setAddCapacity] = useState('4')
  const [addMinSpend, setAddMinSpend] = useState('')
  const [addIsVip, setAddIsVip] = useState(false)
  const [addTableBusy, setAddTableBusy] = useState(false)

  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [layoutDragPreview, setLayoutDragPreview] = useState<{ tableId: string; x: number; y: number } | null>(null)
  const [zoneLayout, setZoneLayout] = useState<Record<FloorZoneKey, { x: number; y: number }>>(() => ({
    ...DEFAULT_ZONE_LAYOUT,
  }))
  const [zoneDragPreview, setZoneDragPreview] = useState<{ key: FloorZoneKey; x: number; y: number } | null>(null)
  const [floorLayoutBusy, setFloorLayoutBusy] = useState(false)
  const floorCanvasRef = useRef<HTMLDivElement>(null)
  const layoutDragRef = useRef<{
    tableId: string
    originX: number
    originY: number
    startMX: number
    startMY: number
    moved: boolean
    currX: number
    currY: number
    isVip: boolean
  } | null>(null)
  const zoneDragRef = useRef<{
    key: FloorZoneKey
    originX: number
    originY: number
    startMX: number
    startMY: number
    moved: boolean
    currX: number
    currY: number
  } | null>(null)

  const [detailReservationId, setDetailReservationId] = useState<string | null>(null)
  const [cancelDialogReservationId, setCancelDialogReservationId] = useState<string | null>(null)
  const [cancelDialogBusy, setCancelDialogBusy] = useState(false)
  const [deleteDialogReservationId, setDeleteDialogReservationId] = useState<string | null>(null)
  const [deleteDialogBusy, setDeleteDialogBusy] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  /* no-show: commented out
  const [noShowActionReservationId, setNoShowActionReservationId] = useState<string | null>(null)
  const [noShowActionBusy, setNoShowActionBusy] = useState(false)
  const [noShowGraceMinutes, setNoShowGraceMinutes] = useState(loadNoShowGraceMinutes)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const autoNoShowRef = useRef<Set<string>>(new Set())
  */

  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const calendarRef = useRef<HTMLDivElement>(null)

  const loadClubData = useCallback(async () => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setDbTables([])
      setClubEvents([])
      setReservations([])
      return
    }

    const { data: tblData, error: tblErr } = await supabase
      .from('tables')
      .select(
        'id, table_number, seating_capacity, minimum_spend, position, location, type, table_status, club_id',
      )
      .eq('club_id', clubId)
      .order('table_number', { ascending: true })

    if (tblErr) {
      setError(tblErr.message)
      setDbTables([])
    } else {
      setDbTables((tblData ?? []) as DbTableRow[])
    }

    const { data: evData, error: evErr } = await supabase
      .from('events')
      .select('event_id, event_name, event_starting_date')
      .eq('club_id', clubId)
      .order('event_starting_date', { ascending: true })

    if (evErr) {
      setError((prev) => prev ?? evErr.message)
      setClubEvents([])
      setReservations([])
      return
    }

    const evs = (evData ?? []) as ClubEventRow[]
    setClubEvents(evs)
    const eventIds = evs.map((e) => e.event_id)

    if (eventIds.length === 0) {
      setReservations([])
      return
    }

    const { data: resData, error: resErr } = await supabase
      .from('reservations')
      .select(
        `
          reservation_id, type, status, nr_of_people, created_at, table_id, event_id, notes,
          user:profiles(id, name, surname),
          events(event_name, ticket_price, final_ticket_price, event_type, event_starting_date),
          payments(amount, status)
        `,
      )
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })

    if (resErr) {
      setError((prev) => prev ?? resErr.message)
      setReservations([])
      return
    }
    setReservations((resData ?? []) as unknown as ReservationRow[])
  }, [clubId])

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    void (async () => {
      await loadClubData()
      setLoading(false)
    })()
  }, [clubId, loadClubData])

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) return
    let cancelled = false
    void (async () => {
      const { data, error: layoutErr } = await supabase
        .from('clubs')
        .select('layout_config')
        .eq('club_id', clubId)
        .maybeSingle()
      if (cancelled || layoutErr) return
      const parsed = parseClubLayoutConfig(data?.layout_config ?? null)
      setZoneLayout({ ...DEFAULT_ZONE_LAYOUT, ...parsed })
    })()
    return () => {
      cancelled = true
    }
  }, [clubId])

  const prevResHashRef = useRef<string | null>(null)

  useEffect(() => {
    if (!location.pathname.startsWith('/manager/reservations')) {
      prevResHashRef.current = location.hash
      return
    }
    prevResHashRef.current = location.hash
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!selectedFloorTableId) return
    const el = cardRefs.current.get(selectedFloorTableId)
    window.requestAnimationFrame(() => {
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [selectedFloorTableId])

  useEffect(() => {
    if (!toastMessage) return
    const t = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(t)
  }, [toastMessage])

  /* no-show: commented out
  useEffect(() => {
    const t = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    setNoShowGraceMinutes(club?.no_show_grace_period_minutes ?? loadNoShowGraceMinutes())
  }, [club?.no_show_grace_period_minutes])
  */

  async function handleApprove(reservationId: string) {
    if (!supabase) return
    const { error: err } = await supabase
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('reservation_id', reservationId)
    if (!err) {
      setReservations((prev) =>
        prev.map((r) => (r.reservation_id === reservationId ? { ...r, status: 'confirmed' } : r)),
      )
      void loadClubData()
    }
  }

  async function handleDecline(reservationId: string) {
    if (!supabase) return
    const { error: err } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('reservation_id', reservationId)
    if (!err) {
      setReservations((prev) =>
        prev.map((r) => (r.reservation_id === reservationId ? { ...r, status: 'cancelled' } : r)),
      )
      void loadClubData()
    }
  }

  async function executeCancelReservation(reservationId: string) {
    if (!supabase) return
    setCancelDialogBusy(true)
    try {
      const { error: err } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('reservation_id', reservationId)
      if (err) {
        setToastMessage(err.message)
        return
      }
      setReservations((prev) =>
        prev.map((r) => (r.reservation_id === reservationId ? { ...r, status: 'cancelled' } : r)),
      )
      setDetailReservationId((id) => (id === reservationId ? null : id))
      setCancelDialogReservationId(null)
      void loadClubData()
    } finally {
      setCancelDialogBusy(false)
    }
  }

  async function executeDeleteReservation(reservationId: string) {
    if (!supabase) return
    setDeleteDialogBusy(true)
    try {
      const { error: err } = await supabase
        .from('reservations')
        .delete()
        .eq('reservation_id', reservationId)
      if (err) { setToastMessage(err.message); return }
      setReservations((prev) => prev.filter((r) => r.reservation_id !== reservationId))
      setDetailReservationId((id) => (id === reservationId ? null : id))
      setDeleteDialogReservationId(null)
    } finally {
      setDeleteDialogBusy(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function freeReservationTable(row: ReservationRow) {
    if (!supabase || !row.table_id) return
    const table = dbTables.find((t) => t.id === row.table_id)
    const position = table ? positionJsonWithoutFloorUi(table.position) : undefined
    const payload: { table_status: string; position?: string | null } = { table_status: 'available' }
    if (position !== undefined) payload.position = position
    await supabase.from('tables').update(payload).eq('id', row.table_id)
  }

  /* no-show: commented out
  async function markReservationNoShow(row: ReservationRow, openActions = false) {
    if (!supabase || reservationIsNoShow(row.status)) return
    const { error: err } = await supabase
      .from('reservations')
      .update({ status: NO_SHOW_STATUS })
      .eq('reservation_id', row.reservation_id)
    if (err) {
      setToastMessage(err.message)
      return
    }
    setReservations((prev) =>
      prev.map((r) => (r.reservation_id === row.reservation_id ? { ...r, status: NO_SHOW_STATUS } : r)),
    )
    incrementNoShowBadgeCount()
    setToastMessage('Reservation marked as No-Show.')
    if (openActions) setNoShowActionReservationId(row.reservation_id)
  }

  async function freeNoShowTable(row: ReservationRow) {
    if (!supabase) return
    setNoShowActionBusy(true)
    try {
      await freeReservationTable(row)
      const { error: err } = await supabase
        .from('reservations')
        .update({ status: NO_SHOW_STATUS, table_id: null })
        .eq('reservation_id', row.reservation_id)
      if (err) {
        setToastMessage(err.message)
        return
      }
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === row.reservation_id
            ? { ...r, status: NO_SHOW_STATUS, table_id: null }
            : r,
        ),
      )
      setNoShowActionReservationId(null)
      setToastMessage('Table freed and reservation archived as No-Show.')
      void loadClubData()
    } finally {
      setNoShowActionBusy(false)
    }
  }

  async function removeNoShowReservation(row: ReservationRow) {
    if (!supabase) return
    setNoShowActionBusy(true)
    try {
      await freeReservationTable(row)
      const { error: err } = await supabase
        .from('reservations')
        .delete()
        .eq('reservation_id', row.reservation_id)
      if (err) {
        setToastMessage(err.message)
        return
      }
      setReservations((prev) => prev.filter((r) => r.reservation_id !== row.reservation_id))
      setNoShowActionReservationId(null)
      setToastMessage('Reservation removed and table freed.')
      void loadClubData()
    } finally {
      setNoShowActionBusy(false)
    }
  }

  async function markArrivedLate(row: ReservationRow) {
    if (!supabase) return
    setNoShowActionBusy(true)
    try {
      const { error: err } = await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('reservation_id', row.reservation_id)
      if (err) {
        setToastMessage(err.message)
        return
      }
      if (row.table_id) {
        const tryOcc = await supabase.from('tables').update({ table_status: 'occupied' }).eq('id', row.table_id).select('id')
        if (tryOcc.error) {
          const table = dbTables.find((t) => t.id === row.table_id)
          const rec = buildPositionRecord(table?.position ?? null)
          rec.floor_ui_status = 'occupied'
          await supabase.from('tables').update({ position: JSON.stringify(rec) }).eq('id', row.table_id)
        }
      }
      setReservations((prev) =>
        prev.map((r) => (r.reservation_id === row.reservation_id ? { ...r, status: 'confirmed' } : r)),
      )
      setNoShowActionReservationId(null)
      setToastMessage('Guest marked as arrived late.')
      void loadClubData()
    } finally {
      setNoShowActionBusy(false)
    }
  }
  */ // end no-show: commented out

  // Close calendar when clicking outside
  useEffect(() => {
    if (!calendarOpen) return
    function onOutsideClick(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [calendarOpen])

  const floorConfigs = useMemo(() => layoutTablesForFloor(dbTables), [dbTables])

  const tableDisplays = useMemo(() => {
    const m: Record<string, TableDisplay> = {}
    for (const row of dbTables) {
      m[row.id] = computeTableDisplay(row, reservations)
    }
    return m
  }, [dbTables, reservations])

  /* no-show: commented out
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return
    for (const row of reservations) {
      if (autoNoShowRef.current.has(row.reservation_id)) continue
      const tableOccupied = row.table_id
        ? (tableDisplays[row.table_id]?.status ?? 'available') === 'occupied'
        : false
      const noShow = getNoShowState(
        row.status,
        row.events?.event_starting_date,
        noShowGraceMinutes,
        nowMs,
        tableOccupied,
      )
      if (noShow.state !== 'expired') continue
      autoNoShowRef.current.add(row.reservation_id)
      void markReservationNoShow(row, true)
    }
  }, [reservations, tableDisplays, noShowGraceMinutes, nowMs])
  */

  const visibleRows = useMemo(() => {
    return reservations.filter((r) => {
      if (!matchesFilter(r, filter)) return false
      if (!matchesDatePreset(r, datePreset, customDateFrom, customDateTo)) return false
      if (eventFilter !== 'all' && r.event_id !== eventFilter) return false
      return true
    })
  }, [reservations, filter, datePreset, customDateFrom, customDateTo, eventFilter])

  const tableReservationsOptions = useMemo(
    () => reservations.filter((r) => isTableBookingType(r.type)),
    [reservations],
  )

  const pendingCount = reservations.filter((r) => normalizeReservationStatus(r.status) === 'pending').length
  const cancelledCount = reservations.filter((r) => normalizeReservationStatus(r.status) === 'cancelled').length
  // Sum actual payment amounts for completed payments — same logic as the dashboard backend
  const totalRevenue = useMemo(
    () =>
      reservations
        .flatMap((r) => r.payments.filter((p) => paymentIsCompleted(p.status)))
        .reduce((sum, p) => sum + parseFloat(String(p.amount || '0')), 0),
    [reservations],
  )

  const statCards = [
    {
      label: 'Total Reservations',
      value: String(totalGuestCount(reservations)),
      accent: 'purple',
      icon: <Users size={22} aria-hidden />,
    },
    {
      label: 'Pending',
      value: String(pendingCount),
      accent: 'amber',
      icon: <Clock size={22} aria-hidden />,
    },
    {
      label: 'Total Revenue',
      value: `€${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
      accent: 'pink',
      icon: <TrendingUp size={22} aria-hidden />,
    },
    {
      label: 'Cancelled',
      value: String(cancelledCount),
      accent: 'red',
      icon: <XCircle size={22} aria-hidden />,
    },
  ]

  const detailRow = useMemo(
    () =>
      detailReservationId
        ? reservations.find((r) => r.reservation_id === detailReservationId) ?? null
        : null,
    [detailReservationId, reservations],
  )

  /* no-show: commented out
  const noShowActionRow = useMemo(
    () =>
      noShowActionReservationId
        ? reservations.find((r) => r.reservation_id === noShowActionReservationId) ?? null
        : null,
    [noShowActionReservationId, reservations],
  )
  */

  useEffect(() => {
    if (detailReservationId && !detailRow) setDetailReservationId(null)
  }, [detailReservationId, detailRow])

  useEffect(() => {
    if (!cancelDialogReservationId) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setCancelDialogReservationId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancelDialogReservationId])

  const activeManageConfig = manageTableId ? floorConfigs.find((t) => t.id === manageTableId) : null
  const activeManageDisplay = manageTableId ? tableDisplays[manageTableId] : null

  const vipNoteFromDb = (row: DbTableRow) => parseTablePositionJson(row.position)?.vip_note ?? ''

  function openTableManage(tableId: string) {
    const cfg = floorConfigs.find((t) => t.id === tableId)
    if (!cfg) return
    const disp = tableDisplays[tableId]
    setSelectedFloorTableId(tableId)
    setManageTableId(tableId)
    setReserveGuest(disp?.guestName ?? '')
    setReserveEvent(disp?.eventLabel ?? '')
    setReserveEventId('')
    setReserveLinkId(disp?.linkedReservationId ?? '')
    setVipDraft({
      minSpend:
        cfg.raw.minimum_spend != null && cfg.raw.minimum_spend !== ''
          ? String(Number.parseFloat(cfg.raw.minimum_spend))
          : '',
      bottleNote: vipNoteFromDb(cfg.raw),
    })
  }

  async function persistTableLayout(tableId: string, x: number, y: number) {
    if (!supabase || !isSupabaseConfigured) return
    const row = dbTables.find((t) => t.id === tableId)
    if (!row) return
    const newPosition = mergePositionLayout(row.position, x, y)
    const { error } = await supabase.from('tables').update({ position: newPosition }).eq('id', tableId)
    if (error) {
      setToastMessage(error.message)
      void loadClubData()
      return
    }
    setDbTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, position: newPosition } : t)))
  }

  async function resetFloorLayout() {
    if (!supabase || !clubId || !isSupabaseConfigured || floorLayoutBusy) return
    const sb = supabase
    setFloorLayoutBusy(true)
    try {
      const { error: clubErr } = await sb.from('clubs').update({ layout_config: null }).eq('club_id', clubId)
      if (clubErr) {
        setToastMessage(clubErr.message)
        return
      }
      const updates = dbTables.map((t) => ({
        id: t.id,
        position: stripTableCanvasCoords(t.position),
      }))
      const results = await Promise.all(
        updates.map((u) => sb.from('tables').update({ position: u.position }).eq('id', u.id)),
      )
      const firstErr = results.find((r) => r.error)?.error
      if (firstErr) {
        setToastMessage(firstErr.message)
        void loadClubData()
        return
      }
      setZoneLayout({ ...DEFAULT_ZONE_LAYOUT })
      layoutDragRef.current = null
      setLayoutDragPreview(null)
      zoneDragRef.current = null
      setZoneDragPreview(null)
      await loadClubData()
      setToastMessage('Layout reset to defaults.')
    } finally {
      setFloorLayoutBusy(false)
    }
  }

  async function commitLayoutEdit() {
    const zRef = zoneDragRef.current
    const tRef = layoutDragRef.current
    const zPre = zoneDragPreview
    zoneDragRef.current = null
    layoutDragRef.current = null
    setZoneDragPreview(null)
    setLayoutDragPreview(null)

    const nextZones = mergeFlushedZoneLayout(zoneLayout, zRef, zPre)
    setZoneLayout(nextZones)

    if (tRef?.moved) {
      await persistTableLayout(tRef.tableId, tRef.currX, tRef.currY)
    }

    if (clubId && supabase && isSupabaseConfigured) {
      setFloorLayoutBusy(true)
      const payload = JSON.stringify({ zones: nextZones })
      const { error } = await supabase.from('clubs').update({ layout_config: payload }).eq('club_id', clubId)
      setFloorLayoutBusy(false)
      if (error) setToastMessage(error.message)
    }

    setLayoutEditMode(false)
  }

  function floorZoneDisplay(key: FloorZoneKey): { x: number; y: number } {
    if (zoneDragPreview?.key === key) return { x: zoneDragPreview.x, y: zoneDragPreview.y }
    return zoneLayout[key]!
  }

  function floorZoneBoxStyle(key: FloorZoneKey): CSSProperties {
    const p = floorZoneDisplay(key)
    const { w, h } = ZONE_PCT_BOUNDS[key]
    return {
      left: `${p.x}%`,
      top: `${p.y}%`,
      width: `${w}%`,
      height: `${h}%`,
      pointerEvents: layoutEditMode ? 'auto' : 'none',
    }
  }

  function handleZoneLayoutMouseDown(key: FloorZoneKey, e: ReactMouseEvent<HTMLDivElement>) {
    if (!layoutEditMode) return
    e.preventDefault()
    e.stopPropagation()
    const p = floorZoneDisplay(key)
    layoutDragRef.current = null
    setLayoutDragPreview(null)
    zoneDragRef.current = {
      key,
      originX: p.x,
      originY: p.y,
      startMX: e.clientX,
      startMY: e.clientY,
      moved: false,
      currX: p.x,
      currY: p.y,
    }
    setZoneDragPreview({ key, x: p.x, y: p.y })
  }

  const openTableManageRef = useRef(openTableManage)
  openTableManageRef.current = openTableManage
  const persistLayoutRef = useRef(persistTableLayout)
  persistLayoutRef.current = persistTableLayout

  useEffect(() => {
    if (!layoutDragPreview) return
    function onMove(e: MouseEvent) {
      const ref = layoutDragRef.current
      const canvas = floorCanvasRef.current
      if (!ref || !canvas) return
      const dx = e.clientX - ref.startMX
      const dy = e.clientY - ref.startMY
      if (Math.hypot(dx, dy) > 6) ref.moved = true
      const rect = canvas.getBoundingClientRect()
      const scaleX = FLOOR_CANVAS_W / rect.width
      const scaleY = FLOOR_CANVAS_H / rect.height
      let nx = ref.originX + dx * scaleX
      let ny = ref.originY + dy * scaleY
      const R = ref.isVip ? FLOOR_TOKEN_R_VIP : FLOOR_TOKEN_R
      nx = Math.min(FLOOR_CANVAS_W - R, Math.max(R, nx))
      ny = Math.min(FLOOR_CANVAS_H - R, Math.max(R, ny))
      ref.currX = nx
      ref.currY = ny
      setLayoutDragPreview({ tableId: ref.tableId, x: nx, y: ny })
    }
    function onUp() {
      const ref = layoutDragRef.current
      layoutDragRef.current = null
      setLayoutDragPreview(null)
      if (!ref) return
      if (ref.moved) {
        void persistLayoutRef.current(ref.tableId, ref.currX, ref.currY)
      } else {
        openTableManageRef.current(ref.tableId)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [layoutDragPreview])

  useEffect(() => {
    if (!zoneDragPreview) return
    function onMove(e: MouseEvent) {
      const ref = zoneDragRef.current
      const canvas = floorCanvasRef.current
      if (!ref || !canvas) return
      const dx = e.clientX - ref.startMX
      const dy = e.clientY - ref.startMY
      if (Math.hypot(dx, dy) > 6) ref.moved = true
      const rect = canvas.getBoundingClientRect()
      const dMx = ((e.clientX - ref.startMX) / rect.width) * 100
      const dMy = ((e.clientY - ref.startMY) / rect.height) * 100
      let nx = ref.originX + dMx
      let ny = ref.originY + dMy
      const { w, h } = ZONE_PCT_BOUNDS[ref.key]
      nx = Math.min(100 - w, Math.max(0, nx))
      ny = Math.min(100 - h, Math.max(0, ny))
      ref.currX = nx
      ref.currY = ny
      setZoneDragPreview({ key: ref.key, x: nx, y: ny })
    }
    function onUp() {
      const ref = zoneDragRef.current
      zoneDragRef.current = null
      setZoneDragPreview(null)
      if (!ref) return
      if (ref.moved) {
        setZoneLayout((z) => ({ ...z, [ref.key]: { x: ref.currX, y: ref.currY } }))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoneDragPreview])

  function closeTableManage() {
    setManageTableId(null)
  }

  async function submitReserve() {
    if (!supabase || !manageTableId || !activeManageConfig) return
    if (reserveLinkId) {
      setActionBusy(true)
      const posNext = positionJsonWithoutFloorUi(activeManageConfig.raw.position)
      const { error: r0 } = await supabase
        .from('reservations')
        .update({ table_id: manageTableId })
        .eq('reservation_id', reserveLinkId)
      const { error: r1, data: tRows } = await supabase
        .from('tables')
        .update({ table_status: 'reserved', position: posNext })
        .eq('id', manageTableId)
        .select('id')
      setActionBusy(false)
      if (r0 || r1) {
        setToastMessage(r0?.message || r1?.message || 'Could not link reservation.')
        return
      }
      if (!tRows?.length) {
        setToastMessage('Reservation linked but table row was not updated — check Supabase policies.')
        await loadClubData()
        closeTableManage()
        return
      }
      await loadClubData()
      setToastMessage('Reservation linked to this table.')
      closeTableManage()
      return
    }

    if (!reserveGuest.trim()) {
      setToastMessage('Please enter a guest name.')
      return
    }
    if (!reserveEventId) {
      setToastMessage('Please select an event for this booking.')
      return
    }
    if (!user?.id) {
      setToastMessage('You must be signed in to create a reservation.')
      return
    }

    const qr =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `mgr-${Date.now()}-${Math.random().toString(16).slice(2)}`

    const notesLine = [
      `Guest: ${reserveGuest.trim()}`,
      reserveEvent.trim() ? `Details: ${reserveEvent.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    setActionBusy(true)
    const payload = {
      user_id: user.id,
      event_id: reserveEventId,
      table_id: manageTableId,
      nr_of_people: 1,
      type: 'table',
      status: 'confirmed',
      notes: notesLine,
      qr_code: qr,
      reservation_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const { error: insErr } = await supabase.from('reservations').insert(payload)

    if (insErr) {
      setActionBusy(false)
      setToastMessage(insErr.message)
      return
    }

    const posNext = positionJsonWithoutFloorUi(activeManageConfig.raw.position)
    const { error: stErr, data: stRows } = await supabase
      .from('tables')
      .update({ table_status: 'reserved', position: posNext })
      .eq('id', manageTableId)
      .select('id')

    setActionBusy(false)
    if (stErr || !stRows?.length) {
      setToastMessage(
        stErr?.message ?? (!stRows?.length ? 'Booking created but table was not updated — check permissions.' : 'Error'),
      )
      await loadClubData()
      closeTableManage()
      return
    }

    await loadClubData()
    setToastMessage('Table reserved and booking created.')
    closeTableManage()
  }

  async function releaseTable() {
    if (!supabase || !manageTableId) return
    const raw = floorConfigs.find((t) => t.id === manageTableId)?.raw
    setActionBusy(true)
    await supabase
      .from('reservations')
      .update({ table_id: null })
      .eq('table_id', manageTableId)
      .in('status', ['pending', 'confirmed'])
    const posNext = positionJsonWithoutFloorUi(raw?.position ?? null)
    const { error: e1, data: rows } = await supabase
      .from('tables')
      .update({ table_status: 'available', position: posNext })
      .eq('id', manageTableId)
      .select('id')
    setActionBusy(false)
    if (e1 || !rows?.length) {
      setToastMessage(e1?.message ?? 'No rows updated — check Supabase table policies.')
      return
    }
    await loadClubData()
    setToastMessage('Table released.')
    closeTableManage()
  }

  async function markOccupied() {
    if (!supabase || !manageTableId || !activeManageConfig) return
    setActionBusy(true)

    const tryOcc = await supabase
      .from('tables')
      .update({ table_status: 'occupied' })
      .eq('id', manageTableId)
      .select('id')

    if (!tryOcc.error && tryOcc.data?.length) {
      const posNext = positionJsonWithoutFloorUi(activeManageConfig.raw.position)
      if (posNext !== (activeManageConfig.raw.position ?? null)) {
        await supabase.from('tables').update({ position: posNext }).eq('id', manageTableId)
      }
      setActionBusy(false)
      await loadClubData()
      setToastMessage('Table marked occupied.')
      closeTableManage()
      return
    }

    const rec = buildPositionRecord(activeManageConfig.raw.position)
    rec.floor_ui_status = 'occupied'
    const fb = await supabase
      .from('tables')
      .update({ position: JSON.stringify(rec) })
      .eq('id', manageTableId)
      .select('id')

    setActionBusy(false)
    if (fb.error || !fb.data?.length) {
      setToastMessage(
        fb.error?.message ||
          tryOcc.error?.message ||
          'Could not mark occupied. Check table updates in Supabase or extend allowed table_status values.',
      )
      return
    }
    await loadClubData()
    setToastMessage('Table marked occupied.')
    closeTableManage()
  }

  async function markAvailableFromOccupied() {
    if (!supabase || !manageTableId) return
    const raw = floorConfigs.find((t) => t.id === manageTableId)?.raw
    setActionBusy(true)
    await supabase
      .from('reservations')
      .update({ table_id: null })
      .eq('table_id', manageTableId)
      .in('status', ['pending', 'confirmed'])
    const posNext = positionJsonWithoutFloorUi(raw?.position ?? null)
    const { error: e1, data: rows } = await supabase
      .from('tables')
      .update({ table_status: 'available', position: posNext })
      .eq('id', manageTableId)
      .select('id')
    setActionBusy(false)
    if (e1 || !rows?.length) {
      setToastMessage(e1?.message ?? 'No rows updated — check Supabase table policies.')
      return
    }
    await loadClubData()
    setToastMessage('Table is available again.')
    closeTableManage()
  }

  async function saveVipPackage() {
    if (!supabase || !manageTableId || !activeManageConfig) return
    let posObj: Record<string, unknown> = {}
    const rawPos = activeManageConfig.raw.position
    if (rawPos?.trim()) {
      try {
        const parsed = JSON.parse(rawPos) as unknown
        if (parsed && typeof parsed === 'object') posObj = { ...(parsed as Record<string, unknown>) }
        else posObj = { label: rawPos }
      } catch {
        posObj = { label: rawPos }
      }
    }
    const note = vipDraft.bottleNote.trim()
    if (note) posObj.vip_note = note
    else delete posObj.vip_note

    const minNum = Number.parseFloat(vipDraft.minSpend)
    const minSpendUpd = Number.isFinite(minNum) ? minNum : null

    const updatePayload: { minimum_spend: number | null; position?: string } = {
      minimum_spend: minSpendUpd,
    }
    if (Object.keys(posObj).length > 0) updatePayload.position = JSON.stringify(posObj)

    setActionBusy(true)
    const { error: e1 } = await supabase.from('tables').update(updatePayload).eq('id', manageTableId)
    setActionBusy(false)
    if (e1) {
      setToastMessage(e1.message)
      return
    }
    await loadClubData()
    setToastMessage('VIP package saved.')
  }

  async function submitAddTable() {
    if (!supabase || !clubId) return
    const num = addTableNumber.trim()
    if (!num) {
      setToastMessage('Enter a table number or label (e.g. T3 or VIP-A).')
      return
    }
    const cap = Math.max(1, Number.parseInt(addCapacity, 10) || 1)
    const minParsed = Number.parseFloat(addMinSpend)
    const minVal = addMinSpend.trim() === '' || !Number.isFinite(minParsed) ? null : minParsed

    setAddTableBusy(true)
    const { data, error: insErr } = await supabase
      .from('tables')
      .insert({
        club_id: clubId,
        table_number: num,
        seating_capacity: cap,
        minimum_spend: minVal,
        type: addIsVip ? 'vip' : 'standard',
        table_status: 'available',
      })
      .select('id')
    setAddTableBusy(false)
    if (insErr || !data?.length) {
      setToastMessage(insErr?.message ?? 'Could not add table — check policies and unique table numbers.')
      return
    }
    setAddTableOpen(false)
    setAddTableNumber('')
    setAddCapacity('4')
    setAddMinSpend('')
    setAddIsVip(false)
    await loadClubData()
    setToastMessage('Table added.')
  }

  function statusPillClass(status: FloorStatus) {
    if (status === 'available') return 'res-mgmt__floor-pill--ok'
    if (status === 'reserved') return 'res-mgmt__floor-pill--red'
    return 'res-mgmt__floor-pill--red'
  }

  function renderReservationsTable() {
    if (visibleRows.length === 0) {
      return (
        <p style={{ color: '#8a8a8a', fontSize: '0.9375rem', paddingTop: '8px' }}>No reservations found.</p>
      )
    }
    return (
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
            {visibleRows.map((row) => {
              const guestName = reservationGuestLabel(row)
              const bookingDate = row.created_at ? new Date(row.created_at).toLocaleDateString('en-US') : '—'
              const amount = resolvedAmount(row.payments)
              const paymentStatus = resolvedPaymentStatus(row.payments)
              const eventFree = reservationEventIsFree(row)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const tableOccupied = row.table_id
                ? (tableDisplays[row.table_id]?.status ?? 'available') === 'occupied'
                : false
              /* no-show: commented out
              const noShow = getNoShowState(
                row.status,
                row.events?.event_starting_date,
                noShowGraceMinutes,
                nowMs,
                tableOccupied,
              )
              */

              return (
                <tr
                  key={row.reservation_id}
                  className=""
                >
                  <td>
                    <div className="res-mgmt__customer">
                      <span className="res-mgmt__customer-name">{guestName}</span>
                      <span className="res-mgmt__customer-date">{bookingDate}</span>
                    </div>
                  </td>
                  <td className="res-mgmt__cell-event">{row.events?.event_name ?? '—'}</td>
                  <td>
                            <span className={`res-mgmt__type res-mgmt__type--${row.type === 'vip_table' ? 'vip_table' : row.type === 'ticket' ? 'ticket' : 'standard_table'}`}>
                      {typeLabel(row.type)}
                    </span>
                  </td>
                  <td>
                    <span className="res-mgmt__guests">
                      <IconUser />
                      {reservationGuestCount(row)}
                    </span>
                  </td>
                  <td className="res-mgmt__cell-amount">
                    {amount != null ? `€${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td>
                    <div className="res-mgmt__status-stack">
                      <span className={reservationStatusClass(row.status)}>
                        {reservationStatusLabel(row.status)}
                      </span>
                      {/* no-show countdown: commented out
                      {noShow.state === 'countdown' ? (
                        <span className="res-mgmt__noshow-countdown">
                          {(() => {
                            const lateMs = noShowGraceMinutes * 60_000 - noShow.remainingMs
                            const lateMin = Math.floor(lateMs / 60_000)
                            return lateMin < 1 ? 'Late · just now' : `Late · ${lateMin} min`
                          })()}
                        </span>
                      ) : null}
                      */}
                    </div>
                  </td>
                  <td>
                    {eventFree ? (
                      <span className="res-mgmt__pill res-mgmt__pill--free">Free</span>
                    ) : (
                      <span
                        className={
                          paymentStatus === 'paid'
                            ? 'res-mgmt__pill res-mgmt__pill--ok'
                            : 'res-mgmt__pill res-mgmt__pill--pending'
                        }
                      >
                        {paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="res-mgmt__actions">
                      <button
                        type="button"
                        className="res-mgmt__icon-btn res-mgmt__icon-btn--view"
                        title="View"
                        aria-label={`View ${guestName}`}
                        onClick={() => setDetailReservationId(row.reservation_id)}
                      >
                        <IconEye />
                      </button>
                      {reservationIsCancelled(row.status) ? (
                        <button
                          type="button"
                          className="res-mgmt__icon-btn res-mgmt__icon-btn--delete"
                          title="Delete permanently"
                          aria-label={`Delete reservation for ${guestName}`}
                          onClick={() => setDeleteDialogReservationId(row.reservation_id)}
                        >
                          <Trash2 className="res-mgmt__lucide-action" size={16} strokeWidth={2} aria-hidden />
                        </button>
                      ) : (
                        /* no-show branch removed — was: reservationIsNoShow(row.status) ? noshow-actions : cancel */
                        <button
                          type="button"
                          className="res-mgmt__icon-btn res-mgmt__icon-btn--cancel"
                          title="Cancel"
                          aria-label={`Cancel reservation for ${guestName}`}
                          onClick={() => setCancelDialogReservationId(row.reservation_id)}
                        >
                          <Trash2 className="res-mgmt__lucide-action" size={16} strokeWidth={2} aria-hidden />
                        </button>
                      )}
                      {normalizeReservationStatus(row.status) === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="res-mgmt__icon-btn res-mgmt__icon-btn--approve"
                            title="Approve"
                            aria-label={`Approve ${guestName}`}
                            onClick={() => void handleApprove(row.reservation_id)}
                          >
                            <IconApprove />
                          </button>
                          <button
                            type="button"
                            className="res-mgmt__icon-btn res-mgmt__icon-btn--decline"
                            title="Decline"
                            aria-label={`Decline ${guestName}`}
                            onClick={() => void handleDecline(row.reservation_id)}
                          >
                            <IconDecline />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div
            className="manager-dash__main manager-dash__main--res-mgmt"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ color: '#8a8a8a' }}>Loading…</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && dbTables.length === 0 && reservations.length === 0 && clubEvents.length === 0) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div
            className="manager-dash__main manager-dash__main--res-mgmt"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
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

        <div className="manager-dash__main manager-dash__main--res-mgmt">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="res-mgmt__bound">
            {error ? (
              <p className="res-mgmt__inline-warn" role="alert">
                {error}
              </p>
            ) : null}

            <header className="res-mgmt__head">
              <div className="res-mgmt__head-text">
                <h1 className="res-mgmt__title">Reservation Management</h1>
                <p className="res-mgmt__subtitle">Manage all bookings and ticket sales</p>
              </div>
            </header>

            {/* ── Stat cards ───────────────────────────────────────────────── */}
            <section className="res-mgmt__stats" aria-label="Reservation statistics">
              {statCards.map((s) => (
                <article key={s.label} className={`res-mgmt__stat res-mgmt__stat--${s.accent}`}>
                  <div className="res-mgmt__stat-body">
                    <p className={`res-mgmt__stat-value res-mgmt__stat-value--${s.accent}`}>{s.value}</p>
                    <p className="res-mgmt__stat-label">{s.label}</p>
                  </div>
                  <div className={`res-mgmt__stat-icon res-mgmt__stat-icon--${s.accent}`}>{s.icon}</div>
                </article>
              ))}
            </section>

            {/* ── Combined filter row ──────────────────────────────────────── */}
            <div className="res-mgmt__filter-combined">
              {/* Left: type tabs */}
              <div className="res-mgmt__filter-left" role="tablist" aria-label="Reservation type filter">
                {FILTER_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === t.id}
                    className={filter === t.id ? 'res-mgmt__tab res-mgmt__tab--active' : 'res-mgmt__tab'}
                    onClick={() => setFilter(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Right: date preset + floating calendar */}
              <div className="res-mgmt__filter-right" ref={calendarRef}>
                {(['tonight', 'this_week', 'custom', 'all'] as DatePreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={datePreset === p ? 'res-mgmt__date-btn res-mgmt__date-btn--active' : 'res-mgmt__date-btn'}
                    onClick={() => {
                      if (p === 'custom') {
                        setDatePreset('custom')
                        setCalendarOpen((prev) => datePreset !== 'custom' ? true : !prev)
                      } else {
                        setDatePreset(p)
                        setCalendarOpen(false)
                        setCustomDateFrom('')
                        setCustomDateTo('')
                      }
                    }}
                  >
                    {p === 'all'
                      ? 'All Dates'
                      : p === 'tonight'
                        ? 'Tonight'
                        : p === 'this_week'
                          ? 'This Week'
                          : customDateFrom
                            ? customDateTo && customDateTo !== customDateFrom
                              ? `${customDateFrom} → ${customDateTo}`
                              : customDateFrom
                            : 'Custom'}
                  </button>
                ))}
                {calendarOpen && datePreset === 'custom' && (
                  <div className="res-mgmt__calendar-popup">
                    <DateRangePicker
                      from={customDateFrom}
                      to={customDateTo}
                      onChange={(f, t) => { setCustomDateFrom(f); setCustomDateTo(t) }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Event filter ─────────────────────────────────────────────── */}
            <div className="res-mgmt__event-bar">
              <EventSelect
                value={eventFilter}
                onChange={setEventFilter}
                events={clubEvents}
              />
            </div>

            {/* ── Pink section divider ─────────────────────────────────────── */}
            <div className="res-mgmt__section-divider" aria-hidden />

            {false ? (
              <>
                {floorConfigs.length === 0 ? (
                  <div className="res-mgmt__empty-tables">
                    <p className="res-mgmt__empty-tables-msg">No tables yet for this club.</p>
                    <button
                      type="button"
                      className="res-mgmt__btn res-mgmt__btn--primary res-mgmt__btn--inline"
                      onClick={() => setAddTableOpen(true)}
                    >
                      Add your first table
                    </button>
                  </div>
                ) : (
                  <div className="res-mgmt__tables-split">
                    <div className="res-mgmt__floor-column">
                      <div className="res-mgmt__floor-dd-toolbar">
                        <button
                          type="button"
                          className="res-mgmt__floor-dd-toggle"
                          disabled={floorLayoutBusy}
                          onClick={() => {
                            if (layoutEditMode) {
                              void commitLayoutEdit()
                            } else {
                              setLayoutEditMode(true)
                            }
                          }}
                        >
                          {layoutEditMode ? 'Done' : 'Edit Layout'}
                        </button>
                        {layoutEditMode ? (
                          <button
                            type="button"
                            className="res-mgmt__floor-dd-reset"
                            disabled={floorLayoutBusy}
                            onClick={() => void resetFloorLayout()}
                          >
                            Reset Layout
                          </button>
                        ) : null}
                        {layoutEditMode ? (
                          <p className="res-mgmt__floor-dd-hint">Drag tables or venue zones to rearrange</p>
                        ) : null}
                      </div>
                      <div className="res-mgmt__floor-dd" aria-label="Venue floor plan">
                        <div ref={floorCanvasRef} className="res-mgmt__floor-dd-canvas">
                          <div className="res-mgmt__floor-dd-bg" aria-hidden>
                            <div className="res-mgmt__floor-dd-parquet" />
                            <div className="res-mgmt__floor-dd-wall" />
                            <div className="res-mgmt__floor-dd-entrance-gap" />
                            <div className="res-mgmt__floor-dd-label res-mgmt__floor-dd-label--entrance">ENTRANCE</div>
                            <div
                              className={[
                                'res-mgmt__floor-dd-stage',
                                layoutEditMode ? 'res-mgmt__floor-dd-zone--editable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={floorZoneBoxStyle('stage')}
                              title={layoutEditMode ? 'Drag to reposition' : undefined}
                              onMouseDown={(e) => handleZoneLayoutMouseDown('stage', e)}
                            >
                              <div className="res-mgmt__floor-dd-stage-inner">
                                <div className="res-mgmt__floor-dd-stage-glow" />
                                <div className="res-mgmt__floor-dd-deck res-mgmt__floor-dd-deck--l" />
                                <div className="res-mgmt__floor-dd-mixer" />
                                <div className="res-mgmt__floor-dd-deck res-mgmt__floor-dd-deck--r" />
                                <span className="res-mgmt__floor-dd-zone-label">STAGE / DJ BOOTH</span>
                              </div>
                            </div>
                            <div
                              className={[
                                'res-mgmt__floor-dd-dance',
                                layoutEditMode ? 'res-mgmt__floor-dd-zone--editable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={floorZoneBoxStyle('dancefloor')}
                              title={layoutEditMode ? 'Drag to reposition' : undefined}
                              onMouseDown={(e) => handleZoneLayoutMouseDown('dancefloor', e)}
                            >
                              <span className="res-mgmt__floor-dd-dance-title">DANCE FLOOR</span>
                            </div>
                            <div
                              className={[
                                'res-mgmt__floor-dd-bar',
                                layoutEditMode ? 'res-mgmt__floor-dd-zone--editable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={floorZoneBoxStyle('bar')}
                              title={layoutEditMode ? 'Drag to reposition' : undefined}
                              onMouseDown={(e) => handleZoneLayoutMouseDown('bar', e)}
                            >
                              <div className="res-mgmt__floor-dd-bar-counter" />
                              <div className="res-mgmt__floor-dd-bar-stools">
                                {Array.from({ length: 7 }).map((_, i) => (
                                  <span key={i} className="res-mgmt__floor-dd-stool" />
                                ))}
                              </div>
                              <span className="res-mgmt__floor-dd-bar-vert-label">BAR</span>
                            </div>
                            <div
                              className={[
                                'res-mgmt__floor-dd-restrooms',
                                layoutEditMode ? 'res-mgmt__floor-dd-zone--editable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={floorZoneBoxStyle('restrooms')}
                              title={layoutEditMode ? 'Drag to reposition' : undefined}
                              onMouseDown={(e) => handleZoneLayoutMouseDown('restrooms', e)}
                            >
                              <span className="res-mgmt__floor-dd-zone-label res-mgmt__floor-dd-zone-label--rest">RESTROOMS</span>
                            </div>
                            <div
                              className={[
                                'res-mgmt__floor-dd-lounge-label',
                                layoutEditMode ? 'res-mgmt__floor-dd-zone--editable' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              style={floorZoneBoxStyle('lounge')}
                              title={layoutEditMode ? 'Drag to reposition' : undefined}
                              onMouseDown={(e) => handleZoneLayoutMouseDown('lounge', e)}
                            >
                              LOUNGE
                            </div>
                          </div>
                          {floorConfigs.map((t) => {
                            const disp = tableDisplays[t.id] ?? { status: 'available' as const }
                            const isSelected = selectedFloorTableId === t.id
                            const cx =
                              layoutDragPreview?.tableId === t.id ? layoutDragPreview.x : t.x
                            const cy =
                              layoutDragPreview?.tableId === t.id ? layoutDragPreview.y : t.y
                            return (
                              <div
                                key={t.id}
                                className={[
                                  'res-mgmt__floor-dd-token',
                                  `res-mgmt__floor-dd-token--${disp.status}`,
                                  t.isVip ? 'res-mgmt__floor-dd-token--vip' : '',
                                  isSelected ? 'res-mgmt__floor-dd-token--selected' : '',
                                  layoutEditMode ? 'res-mgmt__floor-dd-token--editable' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                style={{
                                  left: `${(cx / FLOOR_CANVAS_W) * 100}%`,
                                  top: `${(cy / FLOOR_CANVAS_H) * 100}%`,
                                } as CSSProperties}
                                onMouseDown={
                                  layoutEditMode
                                    ? (e: ReactMouseEvent<HTMLDivElement>) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        zoneDragRef.current = null
                                        setZoneDragPreview(null)
                                        layoutDragRef.current = {
                                          tableId: t.id,
                                          originX: t.x,
                                          originY: t.y,
                                          startMX: e.clientX,
                                          startMY: e.clientY,
                                          moved: false,
                                          currX: t.x,
                                          currY: t.y,
                                          isVip: t.isVip,
                                        }
                                        setLayoutDragPreview({ tableId: t.id, x: t.x, y: t.y })
                                      }
                                    : undefined
                                }
                                onClick={layoutEditMode ? undefined : () => openTableManage(t.id)}
                                role="button"
                                tabIndex={0}
                                aria-label={`Table ${t.label}, ${t.isVip ? 'VIP' : 'standard'}, ${disp.status}`}
                              >
                                {t.isVip ? (
                                  <span className="res-mgmt__floor-dd-token-crown" aria-hidden>
                                    <Crown size={15} strokeWidth={2.25} />
                                  </span>
                                ) : null}
                                <span className="res-mgmt__floor-dd-token-label">{t.label}</span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="floorplan__legend">
                          <span>
                            <i className="floorplan__dot floorplan__dot--ok" />
                            Available
                          </span>
                          <span>
                            <i className="floorplan__dot floorplan__dot--amber" />
                            Reserved
                          </span>
                          <span>
                            <i className="floorplan__dot floorplan__dot--red" />
                            Occupied
                          </span>
                          <span className="floorplan__legend--vip">♛ VIP table</span>
                        </div>
                      </div>
                    </div>

                    <aside className="res-mgmt__table-panel" aria-label="Table details">
                      <div className="res-mgmt__table-panel-head">
                        <h2 className="res-mgmt__table-panel-title">Table details</h2>
                        <p className="res-mgmt__table-panel-sub">Select a table on the map to manage it</p>
                      </div>
                      <div className="res-mgmt__table-panel-scroll">
                        {floorConfigs.map((t) => {
                          const disp = tableDisplays[t.id] ?? { status: 'available' as const }
                          const isSelected = selectedFloorTableId === t.id
                          const displayPrice = t.minSpend
                          return (
                            <div
                              key={t.id}
                              ref={(el) => {
                                cardRefs.current.set(t.id, el)
                              }}
                              className={`res-mgmt__table-card${isSelected ? ' res-mgmt__table-card--active' : ''}`}
                              data-table-id={t.id}
                            >
                              <div className="res-mgmt__table-card-top">
                                <div>
                                  <h3 className="res-mgmt__table-card-title">Table {t.label}</h3>
                                  <div className="res-mgmt__table-card-badges">
                                    <span
                                      className={
                                        t.isVip ? 'res-mgmt__mini-badge res-mgmt__mini-badge--vip' : 'res-mgmt__mini-badge res-mgmt__mini-badge--std'
                                      }
                                    >
                                      {t.isVip ? 'VIP' : 'Standard'}
                                    </span>
                                    <span className={`res-mgmt__mini-badge ${statusPillClass(disp.status)}`}>
                                      <span className="res-mgmt__mini-dot" data-status={disp.status} />
                                      {disp.status}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="res-mgmt__table-card-action"
                                  onClick={() => openTableManage(t.id)}
                                >
                                  Manage
                                </button>
                              </div>
                              <dl className="res-mgmt__table-card-meta">
                                <div>
                                  <dt>Capacity</dt>
                                  <dd>{t.capacity}</dd>
                                </div>
                                <div>
                                  <dt>Min. spend</dt>
                                  <dd>€{displayPrice.toLocaleString('en-US')}</dd>
                                </div>
                              </dl>
                            </div>
                          )
                        })}
                      </div>
                    </aside>
                  </div>
                )}
              </>
            ) : null}

            {renderReservationsTable()}
          </div>
        </div>
      </div>

      {toastMessage ? <div className="res-mgmt__toast" role="status">{toastMessage}</div> : null}

      {cancelDialogReservationId ? (
        <div
          className="res-mgmt__confirm-backdrop"
          role="presentation"
          onClick={() => !cancelDialogBusy && setCancelDialogReservationId(null)}
        >
          <div
            className="res-mgmt__confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-res-title"
            aria-describedby="cancel-res-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__confirm-icon-circle" aria-hidden>
              <Trash2 className="res-mgmt__confirm-trash-icon" size={28} strokeWidth={2} />
            </div>
            <h2 id="cancel-res-title" className="res-mgmt__confirm-title">
              Cancel Reservation
            </h2>
            <p id="cancel-res-desc" className="res-mgmt__confirm-message">
              Are you sure you want to cancel this reservation? This action cannot be undone.
            </p>
            <div className="res-mgmt__confirm-actions">
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--keep"
                disabled={cancelDialogBusy}
                onClick={() => setCancelDialogReservationId(null)}
              >
                Keep Reservation
              </button>
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--yes"
                disabled={cancelDialogBusy}
                onClick={() => void executeCancelReservation(cancelDialogReservationId)}
              >
                {cancelDialogBusy ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteDialogReservationId ? (
        <div
          className="res-mgmt__confirm-backdrop"
          role="presentation"
          onClick={() => !deleteDialogBusy && setDeleteDialogReservationId(null)}
        >
          <div
            className="res-mgmt__confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-res-title"
            aria-describedby="delete-res-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__confirm-icon-circle res-mgmt__confirm-icon-circle--delete" aria-hidden>
              <Trash2 className="res-mgmt__confirm-trash-icon" size={28} strokeWidth={2} />
            </div>
            <h2 id="delete-res-title" className="res-mgmt__confirm-title">Delete Reservation</h2>
            <p id="delete-res-desc" className="res-mgmt__confirm-message">
              This will permanently remove the reservation record. This cannot be undone.
            </p>
            <div className="res-mgmt__confirm-actions">
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--keep"
                disabled={deleteDialogBusy}
                onClick={() => setDeleteDialogReservationId(null)}
              >
                Keep It
              </button>
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--yes"
                disabled={deleteDialogBusy}
                onClick={() => void executeDeleteReservation(deleteDialogReservationId)}
              >
                {deleteDialogBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* no-show action modal: commented out
      {noShowActionRow ? (
        <div
          className="res-mgmt__sheet-backdrop"
          role="presentation"
          onClick={() => !noShowActionBusy && setNoShowActionReservationId(null)}
        >
          <div
            className="res-mgmt__sheet res-mgmt__sheet--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="noshow-actions-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="noshow-actions-title" className="res-mgmt__sheet-title">
                  No-Show Reservation
                </h2>
                <p className="res-mgmt__sheet-sub">
                  {reservationGuestLabel(noShowActionRow)} · {noShowActionRow.events?.event_name ?? 'Event'}
                </p>
              </div>
              <button
                type="button"
                className="res-mgmt__sheet-close"
                onClick={() => !noShowActionBusy && setNoShowActionReservationId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="res-mgmt__sheet-actions res-mgmt__sheet-actions--stack">
              <button
                type="button"
                className="res-mgmt__btn res-mgmt__btn--warn"
                disabled={noShowActionBusy}
                onClick={() => void freeNoShowTable(noShowActionRow)}
              >
                Free the Table
              </button>
              <button
                type="button"
                className="res-mgmt__btn res-mgmt__btn--ghost"
                disabled={noShowActionBusy}
                onClick={() => void markArrivedLate(noShowActionRow)}
              >
                Mark as Arrived (Late)
              </button>
              <button
                type="button"
                className="res-mgmt__btn res-mgmt__btn--danger"
                disabled={noShowActionBusy}
                onClick={() => void removeNoShowReservation(noShowActionRow)}
              >
                Remove Reservation
              </button>
            </div>
          </div>
        </div>
      ) : null}
      */}

      {detailRow ? (
        <div
          className="res-mgmt__sheet-backdrop"
          role="presentation"
          onClick={() => setDetailReservationId(null)}
        >
          <div
            className="res-mgmt__sheet res-mgmt__sheet--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="res-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="res-detail-title" className="res-mgmt__sheet-title">
                  Reservation details
                </h2>
                <p className="res-mgmt__sheet-sub">
                  {reservationGuestLabel(detailRow)} · {detailRow.events?.event_name ?? '—'}
                </p>
              </div>
              <button
                type="button"
                className="res-mgmt__sheet-close"
                onClick={() => setDetailReservationId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <dl className="res-mgmt__detail-dl">
              <div>
                <dt>Reservation ID</dt>
                <dd>
                  <code>{detailRow.reservation_id}</code>
                </dd>
              </div>
              <div>
                <dt>Guest</dt>
                <dd>{reservationGuestLabel(detailRow)}</dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>{detailRow.events?.event_name ?? '—'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{typeLabel(detailRow.type)}</dd>
              </div>
              <div>
                <dt>Guests</dt>
                <dd>{reservationGuestCount(detailRow)}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>
                  {resolvedAmount(detailRow.payments) != null
                    ? `€${resolvedAmount(detailRow.payments)!.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{reservationStatusLabel(detailRow.status)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{resolvedPaymentStatus(detailRow.payments) === 'paid' ? 'Paid' : 'Pending'}</dd>
              </div>
              <div>
                <dt>Booked</dt>
                <dd>
                  {detailRow.created_at
                    ? new Date(detailRow.created_at).toLocaleString('en-US')
                    : '—'}
                </dd>
              </div>
              {detailRow.table_id ? (
                <div>
                  <dt>Table ID</dt>
                  <dd>
                    <code>{detailRow.table_id}</code>
                  </dd>
                </div>
              ) : null}
              {detailRow.event_id ? (
                <div>
                  <dt>Event ID</dt>
                  <dd>
                    <code>{detailRow.event_id}</code>
                  </dd>
                </div>
              ) : null}
              {detailRow.notes?.trim() ? (
                <div>
                  <dt>Notes</dt>
                  <dd>{detailRow.notes}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}

      {addTableOpen ? (
        <div className="res-mgmt__sheet-backdrop" role="presentation" onClick={() => !addTableBusy && setAddTableOpen(false)}>
          <div
            className="res-mgmt__sheet res-mgmt__sheet--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-table-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="add-table-title" className="res-mgmt__sheet-title">
                  Add table
                </h2>
                <p className="res-mgmt__sheet-sub">Creates a row in <code>tables</code> for this club.</p>
              </div>
              <button
                type="button"
                className="res-mgmt__sheet-close"
                onClick={() => !addTableBusy && setAddTableOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <label className="res-mgmt__field">
              <span>Table number / label</span>
              <input
                className="res-mgmt__input"
                value={addTableNumber}
                onChange={(e) => setAddTableNumber(e.target.value)}
                placeholder="e.g. T3, VIP-1"
                autoComplete="off"
              />
            </label>
            <label className="res-mgmt__field">
              <span>Capacity (seats)</span>
              <input
                className="res-mgmt__input"
                inputMode="numeric"
                value={addCapacity}
                onChange={(e) => setAddCapacity(e.target.value)}
              />
            </label>
            <label className="res-mgmt__field">
              <span>Minimum spend (€, optional)</span>
              <input
                className="res-mgmt__input"
                inputMode="decimal"
                value={addMinSpend}
                onChange={(e) => setAddMinSpend(e.target.value)}
                placeholder="e.g. 500"
              />
            </label>
            <label className="res-mgmt__field res-mgmt__field--check">
              <input
                type="checkbox"
                checked={addIsVip}
                onChange={(e) => setAddIsVip(e.target.checked)}
              />
              <span>VIP table</span>
            </label>
            <button
              type="button"
              className="res-mgmt__btn res-mgmt__btn--primary"
              onClick={() => void submitAddTable()}
              disabled={addTableBusy || !clubId}
            >
              {addTableBusy ? 'Saving…' : 'Save table'}
            </button>
          </div>
        </div>
      ) : null}

      {manageTableId && activeManageConfig && activeManageDisplay ? (
        <div className="res-mgmt__sheet-backdrop" role="presentation" onClick={closeTableManage}>
          <div
            className="res-mgmt__sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-manage-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="table-manage-title" className="res-mgmt__sheet-title">
                  Table {activeManageConfig.label}
                </h2>
                <p className="res-mgmt__sheet-sub">
                  {activeManageConfig.isVip ? 'VIP table' : 'Standard table'} · Capacity {activeManageConfig.capacity} ·
                  Min. spend €
                  {activeManageConfig.minSpend.toLocaleString('en-US')}
                </p>
              </div>
              <button type="button" className="res-mgmt__sheet-close" onClick={closeTableManage} aria-label="Close">
                ×
              </button>
            </div>

            <div className="res-mgmt__sheet-badges">
              <span
                className={
                  activeManageConfig.isVip ? 'res-mgmt__mini-badge res-mgmt__mini-badge--vip' : 'res-mgmt__mini-badge res-mgmt__mini-badge--std'
                }
              >
                {activeManageConfig.isVip ? 'VIP' : 'Standard'}
              </span>
              <span className={`res-mgmt__mini-badge ${statusPillClass(activeManageDisplay.status)}`}>
                <span className="res-mgmt__mini-dot" data-status={activeManageDisplay.status} />
                {activeManageDisplay.status}
              </span>
            </div>

            {activeManageDisplay.status === 'reserved' && (
              <div className="res-mgmt__sheet-block">
                <h3 className="res-mgmt__sheet-h3">Reservation</h3>
                <p className="res-mgmt__sheet-p">
                  <strong>Guest:</strong> {activeManageDisplay.guestName ?? '—'}
                </p>
                {activeManageDisplay.eventLabel ? (
                  <p className="res-mgmt__sheet-p">
                    <strong>Event:</strong> {activeManageDisplay.eventLabel}
                  </p>
                ) : null}
                {activeManageDisplay.linkedReservationId ? (
                  <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                    Booking ID: {activeManageDisplay.linkedReservationId}
                  </p>
                ) : null}
              </div>
            )}

            {activeManageDisplay.status === 'available' && (
              <div className="res-mgmt__sheet-block">
                <h3 className="res-mgmt__sheet-h3">Reserve this table</h3>
                <label className="res-mgmt__field">
                  <span>Guest name</span>
                  <input
                    className="res-mgmt__input"
                    value={reserveGuest}
                    onChange={(e) => setReserveGuest(e.target.value)}
                    placeholder="Full name"
                    autoComplete="off"
                  />
                </label>
                <label className="res-mgmt__field">
                  <span>Event</span>
                  <select
                    className="res-mgmt__input"
                    value={reserveEventId}
                    onChange={(e) => setReserveEventId(e.target.value)}
                    disabled={Boolean(reserveLinkId)}
                  >
                    <option value="">Select event…</option>
                    {clubEvents.map((ev) => (
                      <option key={ev.event_id} value={ev.event_id}>
                        {ev.event_name}
                        {ev.event_starting_date
                          ? ` (${new Date(ev.event_starting_date).toLocaleDateString()})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="res-mgmt__field">
                  <span>Date / note (stored on booking)</span>
                  <input
                    className="res-mgmt__input"
                    value={reserveEvent}
                    onChange={(e) => setReserveEvent(e.target.value)}
                    placeholder="e.g. arrival time or party note"
                    disabled={Boolean(reserveLinkId)}
                  />
                </label>
                <label className="res-mgmt__field">
                  <span>Link existing reservation (optional)</span>
                  <select
                    className="res-mgmt__input"
                    value={reserveLinkId}
                    onChange={(e) => {
                      setReserveLinkId(e.target.value)
                      if (e.target.value) setReserveEventId('')
                    }}
                  >
                    <option value="">None — create new booking</option>
                    {tableReservationsOptions.map((r) => (
                      <option key={r.reservation_id} value={r.reservation_id}>
                        {reservationGuestLabel(r)} — {r.events?.event_name ?? 'Event'} ({r.status})
                      </option>
                    ))}
                  </select>
                </label>
                {clubEvents.length === 0 && !reserveLinkId ? (
                  <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                    Create an event for this club before adding new table bookings.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="res-mgmt__btn res-mgmt__btn--primary"
                  onClick={() => void submitReserve()}
                  disabled={actionBusy}
                >
                  Reserve this table
                </button>
              </div>
            )}

            {activeManageDisplay.status === 'reserved' && (
              <div className="res-mgmt__sheet-actions">
                <button type="button" className="res-mgmt__btn res-mgmt__btn--ghost" onClick={() => void releaseTable()} disabled={actionBusy}>
                  Release table
                </button>
                <button type="button" className="res-mgmt__btn res-mgmt__btn--warn" onClick={() => void markOccupied()} disabled={actionBusy}>
                  Mark as occupied
                </button>
              </div>
            )}

            {activeManageDisplay.status === 'occupied' && (
              <div className="res-mgmt__sheet-actions">
                <button
                  type="button"
                  className="res-mgmt__btn res-mgmt__btn--primary"
                  onClick={() => void markAvailableFromOccupied()}
                  disabled={actionBusy}
                >
                  Mark as available
                </button>
              </div>
            )}

            {activeManageConfig.isVip && (
              <div className="res-mgmt__sheet-block res-mgmt__sheet-block--vip">
                <h3 className="res-mgmt__sheet-h3">VIP package</h3>
                <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                  Custom minimum spend updates <code>minimum_spend</code>. Bottle note is stored as JSON in{' '}
                  <code>position.vip_note</code>.
                </p>
                <label className="res-mgmt__field">
                  <span>Custom min. spend (€)</span>
                  <input
                    className="res-mgmt__input"
                    inputMode="decimal"
                    value={vipDraft.minSpend}
                    onChange={(e) => setVipDraft((d) => ({ ...d, minSpend: e.target.value }))}
                    placeholder={String(activeManageConfig.minSpend)}
                  />
                </label>
                <label className="res-mgmt__field">
                  <span>Bottle package note</span>
                  <textarea
                    className="res-mgmt__textarea"
                    value={vipDraft.bottleNote}
                    onChange={(e) => setVipDraft((d) => ({ ...d, bottleNote: e.target.value }))}
                    placeholder="e.g. 2× spirits + mixers"
                    rows={3}
                  />
                </label>
                <button type="button" className="res-mgmt__btn res-mgmt__btn--gold" onClick={() => void saveVipPackage()} disabled={actionBusy}>
                  Create VIP package
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

