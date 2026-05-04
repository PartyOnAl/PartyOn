import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './ManagerDashboard.css'
import './ReservationManagement.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

type FilterTab = 'all' | 'tickets' | 'tables'
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
  events: { event_name: string } | null
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
  raw: DbTableRow
}

type TableDisplay = {
  status: FloorStatus
  guestName?: string
  eventLabel?: string
  linkedReservationId?: string
}

type VipPackageDraft = { minSpend: string; bottleNote: string }

type TablePositionJson = {
  layout?: { col?: number; row?: number; colSpan?: number }
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

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'tables', label: 'Tables' },
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
      raw: row,
    }
  })
}

function getPrimaryReservationForTable(tableId: string, reservations: ReservationRow[]): ReservationRow | null {
  const list = reservations.filter(
    (r) => r.table_id === tableId && ['pending', 'confirmed'].includes((r.status ?? '').toLowerCase()),
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
  if (tab === 'tickets') return row.type === 'ticket'
  return isTableBookingType(row.type)
}

function resolvedAmount(payments: PaymentRow[]) {
  const paid = payments.filter((p) => p.status === 'paid')
  if (paid.length === 0) return null
  return paid.reduce((s, p) => s + parseFloat(p.amount || '0'), 0)
}

function resolvedPaymentStatus(payments: PaymentRow[]): 'paid' | 'pending' {
  return payments.some((p) => p.status === 'paid') ? 'paid' : 'pending'
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

function IconCrown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 16L3 7l5 3 4-6 4 6 5-3-2 9H5zm2-1h10v1H7v-1z" />
    </svg>
  )
}

function IconChair({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 12v6M18 12v6M8 14h8M8 14V9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function reservationGuestLabel(row: ReservationRow) {
  return row.user
    ? `${row.user.name ?? ''} ${row.user.surname ?? ''}`.trim() || 'Guest'
    : 'Guest'
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

  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

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
          events(event_name),
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

  const prevResHashRef = useRef<string | null>(null)

  useEffect(() => {
    if (!location.pathname.startsWith('/manager/reservations')) {
      prevResHashRef.current = location.hash
      return
    }
    const prev = prevResHashRef.current
    prevResHashRef.current = location.hash
    if (location.hash === '#tables') setFilter('tables')
    else if (prev === '#tables') setFilter('all')
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

  const floorConfigs = useMemo(() => layoutTablesForFloor(dbTables), [dbTables])

  const maxGridRow = useMemo(
    () => floorConfigs.reduce((m, t) => Math.max(m, t.gridRow), 0) || 3,
    [floorConfigs],
  )

  const tableDisplays = useMemo(() => {
    const m: Record<string, TableDisplay> = {}
    for (const row of dbTables) {
      m[row.id] = computeTableDisplay(row, reservations)
    }
    return m
  }, [dbTables, reservations])

  const visibleRows = useMemo(
    () => reservations.filter((r) => matchesFilter(r, filter)),
    [reservations, filter],
  )

  const tableReservationsOptions = useMemo(
    () => reservations.filter((r) => isTableBookingType(r.type)),
    [reservations],
  )

  const confirmed = reservations.filter((r) => r.status === 'confirmed').length
  const pending = reservations.filter((r) => r.status === 'pending').length
  const totalRevenue = reservations
    .flatMap((r) => r.payments)
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + parseFloat(p.amount || '0'), 0)

  const reservationStats = [
    { label: 'Total Reservations', value: String(reservations.length) },
    { label: 'Confirmed', value: String(confirmed) },
    { label: 'Pending', value: String(pending) },
    { label: 'Total Revenue', value: `€${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}` },
  ]

  const vipCount = floorConfigs.filter((t) => t.isVip).length
  const standardCount = floorConfigs.filter((t) => !t.isVip).length
  const reservedCount = floorConfigs.filter((t) => tableDisplays[t.id]?.status === 'reserved').length
  const availableCount = floorConfigs.filter((t) => tableDisplays[t.id]?.status === 'available').length
  const occupiedCount = floorConfigs.filter((t) => tableDisplays[t.id]?.status === 'occupied').length

  const tableStats = useMemo(
    () => [
      { label: 'Total Tables', value: String(floorConfigs.length) },
      { label: 'VIP Tables', value: String(vipCount) },
      { label: 'Standard Tables', value: String(standardCount) },
      { label: 'Reserved', value: String(reservedCount) },
      { label: 'Available', value: String(availableCount) },
      ...(occupiedCount > 0 ? [{ label: 'Occupied', value: String(occupiedCount) }] : []),
    ],
    [floorConfigs.length, vipCount, standardCount, reservedCount, availableCount, occupiedCount],
  )

  const stats = filter === 'tables' ? tableStats : reservationStats

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

  function floorStatusClass(status: FloorStatus) {
    if (status === 'available') return 'res-mgmt__floor-token--available'
    if (status === 'reserved') return 'res-mgmt__floor-token--reserved'
    return 'res-mgmt__floor-token--occupied'
  }

  function statusPillClass(status: FloorStatus) {
    if (status === 'available') return 'res-mgmt__floor-pill--ok'
    if (status === 'reserved') return 'res-mgmt__floor-pill--amber'
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

              return (
                <tr key={row.reservation_id}>
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
                      {row.nr_of_people ?? 1}
                    </span>
                  </td>
                  <td className="res-mgmt__cell-amount">
                    {amount != null ? `€${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td>
                    <span
                      className={
                        row.status === 'confirmed'
                          ? 'res-mgmt__pill res-mgmt__pill--ok'
                          : row.status === 'cancelled'
                            ? 'res-mgmt__pill res-mgmt__pill--pending'
                            : 'res-mgmt__pill res-mgmt__pill--pending'
                      }
                    >
                      {row.status === 'confirmed'
                        ? 'Confirmed'
                        : row.status === 'cancelled'
                          ? 'Cancelled'
                          : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        paymentStatus === 'paid'
                          ? 'res-mgmt__pill res-mgmt__pill--ok'
                          : 'res-mgmt__pill res-mgmt__pill--pending'
                      }
                    >
                      {paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="res-mgmt__actions">
                      <button type="button" className="res-mgmt__icon-btn" aria-label={`View ${guestName}`}>
                        <IconEye />
                      </button>
                      {row.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="res-mgmt__icon-btn res-mgmt__icon-btn--approve"
                            aria-label={`Approve ${guestName}`}
                            onClick={() => void handleApprove(row.reservation_id)}
                          >
                            <IconApprove />
                          </button>
                          <button
                            type="button"
                            className="res-mgmt__icon-btn res-mgmt__icon-btn--decline"
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

          <div className={`res-mgmt__bound${filter === 'tables' ? ' res-mgmt__bound--wide' : ''}`}>
            {error ? (
              <p className="res-mgmt__inline-warn" role="alert">
                {error}
              </p>
            ) : null}

            <header className={filter === 'tables' ? 'res-mgmt__head res-mgmt__head--split' : 'res-mgmt__head'}>
              <div className="res-mgmt__head-text">
                <h1 className="manager-dash__page-title">
                  {filter === 'tables' ? 'Table Management' : 'Reservation Management'}
                </h1>
                <p className="manager-dash__page-sub">
                  {filter === 'tables'
                    ? 'Floor layout and table status from your database — synced with reservations.'
                    : 'Manage all bookings and ticket sales'}
                </p>
              </div>
              {filter === 'tables' ? (
                <button type="button" className="res-mgmt__add-table-btn" onClick={() => setAddTableOpen(true)}>
                  + Add table
                </button>
              ) : null}
            </header>

            <section
              className={filter === 'tables' ? 'res-mgmt__stats res-mgmt__stats--tables' : 'res-mgmt__stats'}
              aria-label={filter === 'tables' ? 'Table statistics' : 'Reservation statistics'}
            >
              {stats.map((s) => (
                <article key={s.label} className="res-mgmt__stat">
                  <p className="res-mgmt__stat-value">{s.value}</p>
                  <p className="res-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            <div className="res-mgmt__tabs" role="tablist" aria-label="Reservation type filter">
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

            {filter === 'tables' ? (
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
                      <div className="res-mgmt__floor-map" aria-label="Venue floor plan">
                        <div className="res-mgmt__floor-stage">
                          <span className="res-mgmt__floor-stage-label">Stage / DJ booth</span>
                          <span className="res-mgmt__floor-stage-sub">Front of house</span>
                        </div>

                        <div
                          className="res-mgmt__floor-grid"
                          style={{
                            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                            gridTemplateRows: `repeat(${maxGridRow}, minmax(92px, 1fr))`,
                          }}
                        >
                          {floorConfigs.map((t) => {
                            const disp = tableDisplays[t.id] ?? { status: 'available' as const }
                            const isSelected = selectedFloorTableId === t.id
                            return (
                              <button
                                key={t.id}
                                type="button"
                                className={[
                                  'res-mgmt__floor-token',
                                  t.isVip ? 'res-mgmt__floor-token--vip' : 'res-mgmt__floor-token--standard',
                                  floorStatusClass(disp.status),
                                  isSelected ? 'res-mgmt__floor-token--selected' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                style={{
                                  gridColumn: `${t.gridColumn} / span ${t.gridColumnSpan}`,
                                  gridRow: t.gridRow,
                                }}
                                onClick={() => openTableManage(t.id)}
                                aria-label={`Table ${t.label}, ${t.isVip ? 'VIP' : 'standard'}, ${disp.status}`}
                              >
                                {t.isVip && (
                                  <span className="res-mgmt__floor-vip-badge" aria-hidden>
                                    <IconCrown className="res-mgmt__floor-crown" /> VIP
                                  </span>
                                )}
                                <IconChair className="res-mgmt__floor-chair" />
                                <span className="res-mgmt__floor-num">{t.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        <div className="res-mgmt__floor-legend" role="list" aria-label="Status legend">
                          <span className="res-mgmt__floor-legend-title">Legend</span>
                          <span className="res-mgmt__floor-legend-item" role="listitem">
                            <span className="res-mgmt__floor-dot res-mgmt__floor-dot--ok" /> Available
                          </span>
                          <span className="res-mgmt__floor-legend-item" role="listitem">
                            <span className="res-mgmt__floor-dot res-mgmt__floor-dot--amber" /> Reserved
                          </span>
                          <span className="res-mgmt__floor-legend-item" role="listitem">
                            <span className="res-mgmt__floor-dot res-mgmt__floor-dot--red" /> Occupied
                          </span>
                          <span className="res-mgmt__floor-legend-item res-mgmt__floor-legend-item--vip" role="listitem">
                            <IconCrown className="res-mgmt__floor-legend-crown" /> VIP table
                          </span>
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

                <details className="res-mgmt__bookings-fold">
                  <summary className="res-mgmt__bookings-fold-sum">Table reservations (bookings list)</summary>
                  <p className="res-mgmt__bookings-fold-hint">
                    Approve or decline table-related reservations from your guests — same as before.
                  </p>
                  {renderReservationsTable()}
                </details>
              </>
            ) : (
              renderReservationsTable()
            )}
          </div>
        </div>
      </div>

      {toastMessage ? <div className="res-mgmt__toast" role="status">{toastMessage}</div> : null}

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

