import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Armchair, ChevronDown, Crown, LayoutGrid, Lock, Pencil, Sparkles, Star, Trash2, UserPlus, Users } from 'lucide-react'
import './ManagerDashboard.css'
import './ReservationManagement.css'
import './TableManagement.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'
import { NO_SHOW_STATUS, normalizeReservationStatus, reservationIsNoShow } from './noShow'

// ─── Types ────────────────────────────────────────────────────────────────────

type TableType = 'standard' | 'vip' | 'premium' | 'lounge' | 'prive'
type FloorStatus = 'available' | 'reserved' | 'occupied'
type EventStatus = 'available' | 'reserved' | 'occupied'

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

type AddTypeCard = TableType | 'custom'

type DbTableRow = {
  id: string
  table_number: string
  seating_capacity: number
  minimum_spend: string | null
  description: string | null
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

type TableDisplay = {
  status: FloorStatus
  guestName?: string
  eventLabel?: string
  linkedReservationId?: string
  noShow?: boolean
}

type VipPackageDraft = { minSpend: string; bottleNote: string }

type TablePositionJson = {
  vip_note?: string
  label?: string
  floor_ui_status?: string
  [key: string]: unknown
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_TYPE_OPTIONS: Array<{ value: TableType; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'vip', label: 'VIP' },
  { value: 'premium', label: 'Premium' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'prive', label: 'Privé' },
]

const CAPACITY_OPTIONS = [2, 4, 6, 8, 10, 12, 16, 20]

const ADD_TYPE_DEFAULTS: Record<AddTypeCard, string> = {
  standard: 'Standard seating area with comfortable chairs. Great for groups who want a comfortable spot without a minimum spend.',
  premium:  'Superior positioning in the venue — closer to the stage or dance floor — with an enhanced service experience and priority staff.',
  vip:      'Exclusive VIP table with bottle service, priority entry, and a dedicated host. Elevated seating with premium amenities.',
  lounge:   'Relaxed lounge seating in a chill ambient area. Perfect for groups who prefer a more laid-back and comfortable atmosphere.',
  prive:    'Fully private, enclosed section with exclusive access, maximum privacy, and personalized VIP service.',
  custom:   '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTableType(type: string | null): TableType {
  const t = (type ?? 'standard').toLowerCase().trim()
  if (t === 'vip') return 'vip'
  if (t === 'premium') return 'premium'
  if (t === 'lounge') return 'lounge'
  if (t === 'prive' || t === 'privé') return 'prive'
  return 'standard'
}

function tableTypeMeta(type: string | null): { label: string } {
  const t = normalizeTableType(type)
  const map: Record<TableType, { label: string }> = {
    standard: { label: 'Standard' },
    vip:      { label: 'VIP' },
    premium:  { label: 'Premium' },
    lounge:   { label: 'Lounge' },
    prive:    { label: 'Privé' },
  }
  return map[t]
}

function buildPositionRecord(position: string | null): Record<string, unknown> {
  if (!position?.trim()) return {}
  try {
    const p = JSON.parse(position) as unknown
    if (p && typeof p === 'object') return { ...(p as Record<string, unknown>) }
    return { label: position }
  } catch { return { label: position } }
}

function parseTablePositionJson(position: string | null): TablePositionJson | null {
  if (!position?.trim()) return null
  try {
    const o = JSON.parse(position) as unknown
    if (o && typeof o === 'object') return o as TablePositionJson
  } catch { /* not JSON */ }
  return null
}

function getFloorUiOverride(position: string | null): FloorStatus | null {
  const p = parseTablePositionJson(position)
  if (!p?.floor_ui_status) return null
  if (String(p.floor_ui_status).toLowerCase().trim() === 'occupied') return 'occupied'
  return null
}

function positionJsonWithoutFloorUi(raw: string | null): string | null {
  const o = buildPositionRecord(raw)
  delete o.floor_ui_status
  return Object.keys(o).length > 0 ? JSON.stringify(o) : null
}

function normalizeFloorStatus(raw: string | null): FloorStatus {
  const t = (raw ?? 'available').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function isVipTableType(type: string | null): boolean {
  return !!(type && type.toLowerCase().includes('vip'))
}

function naturalCompareTableNum(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function getPrimaryReservation(tableId: string, reservations: ReservationRow[]): ReservationRow | null {
  const list = reservations
    .filter(r => r.table_id === tableId && ['pending', 'confirmed', 'noshow'].includes(normalizeReservationStatus(r.status)))
    .sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0))
  return list[0] ?? null
}

function computeTableDisplay(table: DbTableRow, reservations: ReservationRow[]): TableDisplay {
  const primary = getPrimaryReservation(table.id, reservations)
  const db = normalizeFloorStatus(table.table_status)
  const uiOcc = getFloorUiOverride(table.position)
  if (uiOcc === 'occupied' || db === 'occupied') {
    return { status: 'occupied', guestName: primary ? guestLabel(primary) : undefined, eventLabel: primary?.events?.event_name, linkedReservationId: primary?.reservation_id }
  }
  if (primary) {
    return { status: 'reserved', guestName: guestLabel(primary), eventLabel: primary.events?.event_name, linkedReservationId: primary.reservation_id, noShow: reservationIsNoShow(primary.status) }
  }
  if (db === 'reserved') return { status: 'reserved' }
  return { status: 'available' }
}

function computeDisplayForEvent(table: DbTableRow, reservations: ReservationRow[], eventId: string): TableDisplay {
  const forEvent = reservations
    .filter(r => r.table_id === table.id && r.event_id === eventId && ['pending', 'confirmed', 'noshow'].includes(normalizeReservationStatus(r.status)))
    .sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0))
  const primary = forEvent[0] ?? null
  const dbStatus = normalizeFloorStatus(table.table_status)
  const uiOcc = getFloorUiOverride(table.position)
  if (uiOcc === 'occupied' || dbStatus === 'occupied') {
    return { status: 'occupied', guestName: primary ? guestLabel(primary) : undefined, eventLabel: primary?.events?.event_name, linkedReservationId: primary?.reservation_id }
  }
  if (primary) {
    return { status: 'reserved', guestName: guestLabel(primary), eventLabel: primary.events?.event_name, linkedReservationId: primary.reservation_id, noShow: reservationIsNoShow(primary.status) }
  }
  return { status: 'available' }
}

function guestLabel(row: ReservationRow) {
  return row.user ? `${row.user.name ?? ''} ${row.user.surname ?? ''}`.trim() || 'Guest' : 'Guest'
}


function vipNoteFromDb(row: DbTableRow) {
  return parseTablePositionJson(row.position)?.vip_note ?? ''
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TableTypeIcon({ type }: { type: string | null }) {
  const t = normalizeTableType(type)
  const p = { size: 11, strokeWidth: 2.2, 'aria-hidden': true as const }
  if (t === 'vip') return <Crown {...p} />
  if (t === 'lounge') return <Armchair {...p} />
  if (t === 'premium') return <Sparkles {...p} />
  if (t === 'prive') return <Star {...p} />
  return <Users {...p} />
}

function TypeBadge({ type }: { type: string | null }) {
  const { label } = tableTypeMeta(type)
  const t = normalizeTableType(type)
  return (
    <span className={`tbl-badge tbl-badge--${t}`}>
      <TableTypeIcon type={type} />
      {label}
    </span>
  )
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  const label = status === 'reserved' ? 'Reserved' : status === 'occupied' ? 'Occupied' : 'Available'
  return (
    <span className={`tbl-status tbl-status--${status}`}>
      <span className="tbl-status-dot" aria-hidden />
      {label}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TableManagement() {
  const { club, clubId } = useManagerClub()
  const { user } = useAuth()

  // ── Data state ─────────────────────────────────────────────────────────────
  const [dbTables, setDbTables] = useState<DbTableRow[]>([])
  const [clubEvents, setClubEvents] = useState<ClubEventRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  // ── View state ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [eventFilterOpen, setEventFilterOpen] = useState(false)
  const eventFilterRef = useRef<HTMLDivElement | null>(null)

  // ── Add table ──────────────────────────────────────────────────────────────
  const [addTableOpen, setAddTableOpen] = useState(false)
  const [addTypeCard, setAddTypeCard] = useState<AddTypeCard>('standard')
  const [addCustomLabel, setAddCustomLabel] = useState('')
  const [addCapacity, setAddCapacity] = useState('4')
  const [addMinSpend, setAddMinSpend] = useState('')
  const [addDescription, setAddDescription] = useState('')
  const [addDescriptionDirty, setAddDescriptionDirty] = useState(false)
  const [addTableCount, setAddTableCount] = useState(1)
  const [addStartingNumber, setAddStartingNumber] = useState(1)
  const [addTableBusy, setAddTableBusy] = useState(false)
  const [addMinSpendError, setAddMinSpendError] = useState('')
  const [addCapacityOpen, setAddCapacityOpen] = useState(false)
  const addCapacityRef = useRef<HTMLDivElement | null>(null)

  // ── Edit table ─────────────────────────────────────────────────────────────
  const [editTableId, setEditTableId] = useState<string | null>(null)
  const [editTableNumber, setEditTableNumber] = useState('')
  const [editTableType, setEditTableType] = useState<TableType>('standard')
  const [editCapacity, setEditCapacity] = useState('4')
  const [editMinSpend, setEditMinSpend] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [editMinSpendError, setEditMinSpendError] = useState('')
  const [editTypeOpen, setEditTypeOpen] = useState(false)
  const editTypeRef = useRef<HTMLDivElement | null>(null)

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteDialogTableId, setDeleteDialogTableId] = useState<string | null>(null)
  const [deleteDialogBusy, setDeleteDialogBusy] = useState(false)

  // ── Manage slide-out ───────────────────────────────────────────────────────
  const [manageTableId, setManageTableId] = useState<string | null>(null)
  const [reserveGuest, setReserveGuest] = useState('')
  const [_reserveEvent, setReserveEvent] = useState('')
  const [_reserveEventId, setReserveEventId] = useState('')
  const [_reserveLinkId, setReserveLinkId] = useState('')
  const [_vipDraft, setVipDraft] = useState<VipPackageDraft>({ minSpend: '', bottleNote: '' })

  // ── Relocate + cancel confirm ──────────────────────────────────────────────
  const [relocateOpen, setRelocateOpen] = useState(false)
  const [relocateTableId, setRelocateTableId] = useState('')
  const [relocateBusy, setRelocateBusy] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)

  // ── Walk-in ────────────────────────────────────────────────────────────────
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInTableId, setWalkInTableId] = useState('')
  const [walkInGuestName, setWalkInGuestName] = useState('')
  const [walkInPeople, setWalkInPeople] = useState(1)
  const [walkInBusy, setWalkInBusy] = useState(false)
  const [walkInTableOpen, setWalkInTableOpen] = useState(false)
  const walkInTableRef = useRef<HTMLDivElement | null>(null)

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadClubData = useCallback(async () => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setDbTables([]); setClubEvents([]); setReservations([]); return
    }
    const { data: tblData, error: tblErr } = await supabase
      .from('tables')
      .select('id, table_number, seating_capacity, minimum_spend, description, position, location, type, table_status, club_id')
      .eq('club_id', clubId)
      .order('table_number', { ascending: true })
    if (tblErr) { setError(tblErr.message); setDbTables([]) }
    else { setDbTables((tblData ?? []) as DbTableRow[]) }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: evData, error: evErr } = await supabase
      .from('events')
      .select('event_id, event_name, event_starting_date')
      .eq('club_id', clubId)
      .gte('event_starting_date', todayStart.toISOString())
      .order('event_starting_date', { ascending: true })
    if (evErr) { setError(p => p ?? evErr.message); setClubEvents([]); setReservations([]); return }

    const evs = (evData ?? []) as ClubEventRow[]
    setClubEvents(evs)
    const eventIds = evs.map(e => e.event_id)
    if (eventIds.length === 0) { setReservations([]); return }

    const { data: resData, error: resErr } = await supabase
      .from('reservations')
      .select(`reservation_id, type, status, nr_of_people, created_at, table_id, event_id, notes,
        user:profiles(id, name, surname),
        events(event_name, ticket_price, final_ticket_price, event_type, event_starting_date),
        payments(amount, status)`)
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })
    if (resErr) { setError(p => p ?? resErr.message); setReservations([]); return }
    setReservations((resData ?? []) as unknown as ReservationRow[])
  }, [clubId])

  useEffect(() => {
    if (!clubId || !supabase || !isSupabaseConfigured) { setLoading(false); return }
    setLoading(true); setError(null)
    void (async () => { await loadClubData(); setLoading(false) })()
  }, [clubId, loadClubData])

  useEffect(() => {
    if (!toastMessage) return
    const t = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(t)
  }, [toastMessage])

  useEffect(() => {
    if (!deleteDialogTableId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDeleteDialogTableId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteDialogTableId])

  // ── Derived state ──────────────────────────────────────────────────────────

  const sortedTables = useMemo(
    () => [...dbTables].sort((a, b) => naturalCompareTableNum(a.table_number, b.table_number)),
    [dbTables],
  )

  const tableDisplays = useMemo(() => {
    const m: Record<string, TableDisplay> = {}
    for (const row of dbTables) m[row.id] = computeTableDisplay(row, reservations)
    return m
  }, [dbTables, reservations])

  const eventDisplays = useMemo(() => {
    if (!selectedEventId) return tableDisplays
    const m: Record<string, TableDisplay> = {}
    for (const row of dbTables) m[row.id] = computeDisplayForEvent(row, reservations, selectedEventId)
    return m
  }, [dbTables, reservations, selectedEventId, tableDisplays])

  const activeDisplayMap = selectedEventId ? eventDisplays : tableDisplays

  const filteredTables = useMemo(() => {
    let rows = sortedTables
    if (selectedEventId && statusFilter !== 'all') {
      rows = rows.filter(t => (eventDisplays[t.id]?.status ?? 'available') === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(t =>
        t.table_number.toLowerCase().includes(q) ||
        (t.type ?? '').toLowerCase().includes(q) ||
        (activeDisplayMap[t.id]?.guestName ?? '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [sortedTables, activeDisplayMap, eventDisplays, statusFilter, selectedEventId, searchQuery])

  const activeReservation = useMemo(() => {
    if (!manageTableId || !selectedEventId) return null
    return reservations.find(
      r => r.table_id === manageTableId &&
        r.event_id === selectedEventId &&
        ['pending', 'confirmed', 'noshow'].includes(normalizeReservationStatus(r.status)),
    ) ?? null
  }, [manageTableId, selectedEventId, reservations])

  const availableTablesForWalkIn = useMemo(() => {
    if (!selectedEventId) return []
    return sortedTables.filter(t =>
      (eventDisplays[t.id]?.status ?? 'available') === 'available' &&
      t.seating_capacity >= walkInPeople,
    )
  }, [sortedTables, eventDisplays, selectedEventId, walkInPeople])

  const addPreviewLabels = useMemo(() => {
    if (!addTableOpen) return []
    if (addTypeCard === 'custom') return addCustomLabel.trim() ? [addCustomLabel.trim()] : []
    const count = Math.max(1, Math.min(addTableCount, 20))
    return Array.from({ length: count }, (_, i) => `T${addStartingNumber + i}`)
  }, [addTableOpen, addTypeCard, addCustomLabel, addTableCount, addStartingNumber])
  const addMinSpendRequired = addTypeCard !== 'standard'

  const tableStats = useMemo(() => {
    const typeDefs = [
      { key: 'standard', label: 'Standard', accent: 'gray',   icon: <Users    size={22} aria-hidden /> },
      { key: 'premium',  label: 'Premium',  accent: 'amber',  icon: <Star     size={22} aria-hidden /> },
      { key: 'vip',      label: 'VIP',      accent: 'purple', icon: <Crown    size={22} aria-hidden /> },
      { key: 'lounge',   label: 'Lounge',   accent: 'teal',   icon: <Armchair size={22} aria-hidden /> },
      { key: 'prive',    label: 'Privé',    accent: 'rose',   icon: <Lock     size={22} aria-hidden /> },
    ]
    return [
      { label: 'Total Tables', value: sortedTables.length, accent: 'purple', icon: <LayoutGrid size={22} aria-hidden /> },
      ...typeDefs
        .map(def => ({
          label: def.label,
          value: sortedTables.filter(t => normalizeTableType(t.type) === def.key).length,
          accent: def.accent,
          icon: def.icon,
        }))
        .filter(s => s.value > 0),
    ]
  }, [sortedTables])

  const eventFilterOptions = useMemo(
    () => [
      { value: '', label: 'All Events' },
      ...clubEvents.map(ev => ({
        value: ev.event_id,
        label: `${ev.event_name}${ev.event_starting_date ? ` (${new Date(ev.event_starting_date).toLocaleDateString()})` : ''}`,
      })),
    ],
    [clubEvents],
  )
  const selectedEventLabel = eventFilterOptions.find(option => option.value === selectedEventId)?.label ?? 'All Events'
  const editMinSpendRequired = editTableType !== 'standard'
  const editTypeLabel = TABLE_TYPE_OPTIONS.find(option => option.value === editTableType)?.label ?? 'Standard'
  const selectedWalkInTableLabel = (() => {
    const table = availableTablesForWalkIn.find(t => t.id === walkInTableId)
    if (!table) return 'Select available table...'
    return `${table.table_number}${table.type ? ` (${tableTypeMeta(table.type).label})` : ''} · ${table.seating_capacity} seats`
  })()

  const activeManageRow = manageTableId ? dbTables.find(t => t.id === manageTableId) ?? null : null
  const activeManageDisplay = manageTableId
    ? ((selectedEventId ? eventDisplays : tableDisplays)[manageTableId] ?? null)
    : null

  const availableTablesForRelocate = useMemo(() => {
    if (!selectedEventId) return []
    const partySize = activeReservation?.nr_of_people ?? 1
    return sortedTables.filter(t =>
      t.id !== manageTableId &&
      (eventDisplays[t.id]?.status ?? 'available') === 'available' &&
      t.seating_capacity >= partySize,
    )
  }, [sortedTables, eventDisplays, selectedEventId, activeReservation, manageTableId])

  const deleteTarget = deleteDialogTableId ? dbTables.find(t => t.id === deleteDialogTableId) ?? null : null

  useEffect(() => {
    if (!eventFilterOpen) return undefined

    function handleMouseDown(event: MouseEvent) {
      if (eventFilterRef.current && !eventFilterRef.current.contains(event.target as Node)) {
        setEventFilterOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [eventFilterOpen])

  useEffect(() => {
    if (!editTypeOpen) return undefined

    function handleMouseDown(event: MouseEvent) {
      if (editTypeRef.current && !editTypeRef.current.contains(event.target as Node)) {
        setEditTypeOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [editTypeOpen])

  useEffect(() => {
    if (!addCapacityOpen) return undefined

    function handleMouseDown(event: MouseEvent) {
      if (addCapacityRef.current && !addCapacityRef.current.contains(event.target as Node)) {
        setAddCapacityOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [addCapacityOpen])

  useEffect(() => {
    if (!walkInTableOpen) return undefined

    function handleMouseDown(event: MouseEvent) {
      if (walkInTableRef.current && !walkInTableRef.current.contains(event.target as Node)) {
        setWalkInTableOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    return () => window.removeEventListener('mousedown', handleMouseDown)
  }, [walkInTableOpen])

  useEffect(() => {
    if (!walkInOpen) setWalkInTableOpen(false)
  }, [walkInOpen])

  // ── Actions ────────────────────────────────────────────────────────────────

  function selectEventFilter(value: string) {
    setSelectedEventId(value)
    setStatusFilter('all')
    setSearchQuery('')
    setEventFilterOpen(false)
  }

  function selectEditTableType(value: TableType) {
    setEditTableType(value)
    setEditError('')
    if (value === 'standard' || editMinSpend.trim() !== '') setEditMinSpendError('')
    setEditTypeOpen(false)
    setEditDescription(ADD_TYPE_DEFAULTS[value])
  }

  function selectAddCapacity(value: number) {
    setAddCapacity(String(value))
    setAddCapacityOpen(false)
  }

  function selectWalkInTable(value: string) {
    setWalkInTableId(value)
    setWalkInTableOpen(false)
  }

  function openTableManage(tableId: string) {
    const row = dbTables.find(t => t.id === tableId)
    if (!row) return
    const disp = (selectedEventId ? eventDisplays : tableDisplays)[tableId]
    setManageTableId(tableId)
    setReserveGuest(disp?.guestName ?? '')
    setReserveEvent(disp?.eventLabel ?? '')
    setReserveEventId(selectedEventId || '')
    setReserveLinkId(disp?.linkedReservationId ?? '')
    setVipDraft({
      minSpend: row.minimum_spend != null ? String(Number.parseFloat(row.minimum_spend)) : '',
      bottleNote: vipNoteFromDb(row),
    })
  }

  function closeTableManage() {
    setManageTableId(null)
    setRelocateOpen(false)
    setRelocateTableId('')
    setCancelConfirmOpen(false)
  }

  async function relocateGuest() {
    if (!supabase || !manageTableId || !relocateTableId || !activeReservation) return
    setRelocateBusy(true)
    const newTableRow = dbTables.find(t => t.id === relocateTableId)
    await supabase.from('reservations')
      .update({ table_id: relocateTableId })
      .eq('reservation_id', activeReservation.reservation_id)
    const posNext = positionJsonWithoutFloorUi(activeManageRow?.position ?? null)
    await supabase.from('tables').update({ table_status: 'available', position: posNext }).eq('id', manageTableId)
    await supabase.from('tables').update({ table_status: 'reserved' }).eq('id', relocateTableId)
    setRelocateBusy(false)
    await loadClubData()
    setToastMessage(`Guest relocated to ${newTableRow?.table_number ?? 'new table'}.`)
    closeTableManage()
  }

  async function cancelReservation() {
    if (!supabase || !manageTableId || !activeReservation) return
    setCancelBusy(true)
    await supabase.from('reservations')
      .update({ status: 'cancelled', table_id: null })
      .eq('reservation_id', activeReservation.reservation_id)
    const posNext = positionJsonWithoutFloorUi(activeManageRow?.position ?? null)
    await supabase.from('tables').update({ table_status: 'available', position: posNext }).eq('id', manageTableId)
    setCancelBusy(false)
    await loadClubData()
    setToastMessage('Reservation cancelled.')
    closeTableManage()
  }

  function openAddTable() {
    const nums = sortedTables
      .map(t => { const m = /^T(\d+)$/i.exec(t.table_number); return m ? parseInt(m[1], 10) : null })
      .filter((n): n is number => n !== null)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    setAddStartingNumber(next)
    setAddTypeCard('standard')
    setAddCustomLabel('')
    setAddCapacity('4')
    setAddMinSpend('')
    setAddDescription(ADD_TYPE_DEFAULTS['standard'])
    setAddDescriptionDirty(false)
    setAddTableCount(1)
    setAddMinSpendError('')
    setAddCapacityOpen(false)
    setAddTableOpen(true)
  }

  function openEditTable(tableId: string) {
    const row = dbTables.find(t => t.id === tableId)
    if (!row) return
    setEditTableId(tableId)
    setEditTableNumber(row.table_number)
    setEditTableType(normalizeTableType(row.type))
    setEditCapacity(String(row.seating_capacity))
    setEditMinSpend(row.minimum_spend != null ? String(Number.parseFloat(row.minimum_spend)) : '')
    setEditDescription(row.description?.trim() || ADD_TYPE_DEFAULTS[normalizeTableType(row.type)] || '')
    setEditError('')
    setEditMinSpendError('')
    setEditTypeOpen(false)
  }

  function closeEditTable() { setEditTableId(null); setEditTypeOpen(false) }

  async function submitAddTable() {
    if (!supabase || !clubId) return
    const minParsed = Number.parseFloat(addMinSpend)
    if (addMinSpendRequired && (addMinSpend.trim() === '' || !Number.isFinite(minParsed) || minParsed <= 0)) {
      setAddMinSpendError('Minimum spend is required for this table type.')
      return
    }
    setAddMinSpendError('')
    const cap = Math.max(1, Number.parseInt(addCapacity, 10) || 1)
    const minVal = addMinSpend.trim() === '' || !Number.isFinite(minParsed) ? null : minParsed
    const descVal = addDescription.trim() || null
    setAddTableBusy(true)
    if (addTypeCard === 'custom') {
      const label = addCustomLabel.trim()
      if (!label) { setAddTableBusy(false); setToastMessage('Enter a custom table label.'); return }
      const { error: insErr } = await supabase.from('tables').insert({
        club_id: clubId, table_number: label, seating_capacity: cap,
        minimum_spend: minVal, description: descVal, type: 'custom', table_status: 'available',
      })
      setAddTableBusy(false)
      if (insErr) { setToastMessage(insErr.message ?? 'Could not add table.'); return }
    } else {
      const count = Math.max(1, Math.min(addTableCount, 50))
      const rows = Array.from({ length: count }, (_, i) => ({
        club_id: clubId,
        table_number: `T${addStartingNumber + i}`,
        seating_capacity: cap,
        minimum_spend: minVal,
        description: descVal,
        type: addTypeCard,
        table_status: 'available',
      }))
      const { error: insErr } = await supabase.from('tables').insert(rows)
      setAddTableBusy(false)
      if (insErr) { setToastMessage(insErr.message ?? 'Could not add tables.'); return }
    }
    setAddTableOpen(false)
    await loadClubData()
    setToastMessage('Table(s) added.')
  }

  async function submitEditTable() {
    if (!supabase || !editTableId) return
    const num = editTableNumber.trim()
    if (!num) { setEditError('Enter a table name.'); return }
    const cap = Math.max(1, Number.parseInt(editCapacity, 10) || 1)
    const minParsed = Number.parseFloat(editMinSpend)
    if (editMinSpendRequired && (editMinSpend.trim() === '' || !Number.isFinite(minParsed) || minParsed <= 0)) {
      setEditMinSpendError('Minimum spend is required for this table type.')
      return
    }
    setEditMinSpendError('')
    const minVal = editMinSpend.trim() === '' || !Number.isFinite(minParsed) ? null : minParsed
    setEditBusy(true)
    const { error: updErr } = await supabase.from('tables').update({
      table_number: num,
      seating_capacity: cap,
      minimum_spend: minVal,
      description: editDescription.trim() || null,
      type: editTableType,
    }).eq('id', editTableId)
    setEditBusy(false)
    if (updErr) { setEditError(updErr.message); return }
    closeEditTable()
    await loadClubData()
    setToastMessage('Table updated.')
  }

  async function executeDeleteTable(tableId: string) {
    if (!supabase) return
    setDeleteDialogBusy(true)
    try {
      await supabase.from('reservations').update({ table_id: null }).eq('table_id', tableId).in('status', ['pending', 'confirmed', NO_SHOW_STATUS])
      const { error: delErr } = await supabase.from('tables').delete().eq('id', tableId)
      if (delErr) { setToastMessage(delErr.message); return }
      setDeleteDialogTableId(null)
      await loadClubData()
      setToastMessage('Table removed.')
    } finally { setDeleteDialogBusy(false) }
  }

  async function submitWalkIn() {
    if (!supabase || !selectedEventId || !walkInTableId || !user?.id) return
    if (!walkInGuestName.trim()) { setToastMessage('Enter a guest name.'); return }
    const qr = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `walkin-${Date.now()}-${Math.random().toString(16).slice(2)}`
    setWalkInBusy(true)
    const { error: insErr } = await supabase.from('reservations').insert({
      user_id: user.id,
      event_id: selectedEventId,
      table_id: walkInTableId,
      nr_of_people: walkInPeople,
      type: 'table',
      status: 'confirmed',
      notes: `Walk-in: ${walkInGuestName.trim()}`,
      qr_code: qr,
      reservation_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    if (insErr) { setWalkInBusy(false); setToastMessage(insErr.message); return }
    const walkInRow = dbTables.find(t => t.id === walkInTableId)
    const posNext = positionJsonWithoutFloorUi(walkInRow?.position ?? null)
    await supabase.from('tables').update({ table_status: 'reserved', position: posNext }).eq('id', walkInTableId)
    setWalkInBusy(false)
    setWalkInOpen(false); setWalkInGuestName(''); setWalkInTableId(''); setWalkInPeople(1)
    await loadClubData()
    setToastMessage('Walk-in guest assigned.')
  }

  async function submitReserve() {
    if (!supabase || !manageTableId || !activeManageRow) return
    if (!reserveGuest.trim()) { setToastMessage('Enter a guest name.'); return }
    if (!selectedEventId) { setToastMessage('Select an event from the filter first.'); return }
    if (!user?.id) { setToastMessage('You must be signed in.'); return }
    const qr = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mgr-${Date.now()}-${Math.random().toString(16).slice(2)}`
    setActionBusy(true)
    const { error: insErr } = await supabase.from('reservations').insert({
      user_id: user.id, event_id: selectedEventId, table_id: manageTableId,
      nr_of_people: 1, type: 'table', status: 'confirmed',
      notes: `Guest: ${reserveGuest.trim()}`, qr_code: qr,
      reservation_date: new Date().toISOString(), created_at: new Date().toISOString(),
    })
    if (insErr) { setActionBusy(false); setToastMessage(insErr.message); return }
    const posNext = positionJsonWithoutFloorUi(activeManageRow.position)
    await supabase.from('tables').update({ table_status: 'reserved', position: posNext }).eq('id', manageTableId)
    setActionBusy(false)
    await loadClubData()
    setToastMessage('Table reserved.')
    closeTableManage()
  }

  async function releaseTable() {
    if (!supabase || !manageTableId) return
    setActionBusy(true)
    await supabase.from('reservations').update({ table_id: null }).eq('table_id', manageTableId).in('status', ['pending', 'confirmed', NO_SHOW_STATUS])
    const posNext = positionJsonWithoutFloorUi(activeManageRow?.position ?? null)
    await supabase.from('tables').update({ table_status: 'available', position: posNext }).eq('id', manageTableId)
    setActionBusy(false)
    await loadClubData(); setToastMessage('Table released.'); closeTableManage()
  }

  async function markOccupied() {
    if (!supabase || !manageTableId || !activeManageRow) return
    setActionBusy(true)
    const tryOcc = await supabase.from('tables').update({ table_status: 'occupied' }).eq('id', manageTableId).select('id')
    if (!tryOcc.error && tryOcc.data?.length) {
      const posNext = positionJsonWithoutFloorUi(activeManageRow.position)
      if (posNext !== (activeManageRow.position ?? null)) await supabase.from('tables').update({ position: posNext }).eq('id', manageTableId)
    } else {
      const rec = buildPositionRecord(activeManageRow.position)
      rec.floor_ui_status = 'occupied'
      await supabase.from('tables').update({ position: JSON.stringify(rec) }).eq('id', manageTableId)
    }
    setActionBusy(false)
    await loadClubData(); setToastMessage('Table marked occupied.'); closeTableManage()
  }

  // ── Loading / error screens ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--res-mgmt tbl-mgmt__center">
            <span style={{ color: '#8a8a8a' }}>Loading…</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-dash__main--res-mgmt">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="res-mgmt__bound res-mgmt__bound--wide">
            {error ? <p className="res-mgmt__inline-warn" role="alert">{error}</p> : null}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="res-mgmt__head res-mgmt__head--split">
              <div className="res-mgmt__head-text">
                <h1 className="manager-dash__page-title">Table Management</h1>
                <p className="manager-dash__page-sub">
                  Manage your tables and track reservations per event.
                </p>
              </div>
              <div className="tbl-header-actions">
                {selectedEventId && (
                  <button
                    type="button"
                    className="tbl-walkin-btn"
                    onClick={() => { setWalkInTableId(''); setWalkInGuestName(''); setWalkInPeople(1); setWalkInOpen(true) }}
                  >
                    <UserPlus size={14} aria-hidden />
                    Walk-in
                  </button>
                )}
                <button type="button" className="res-mgmt__add-table-btn" onClick={openAddTable}>
                  + Add Table
                </button>
              </div>
            </header>

            {/* ── Stats ──────────────────────────────────────────────────── */}
            <section className="res-mgmt__stats tbl-mgmt__stats" aria-label="Table statistics">
              {tableStats.map(s => (
                <article key={s.label} className={`res-mgmt__stat res-mgmt__stat--${s.accent}`}>
                  <div className="res-mgmt__stat-body">
                    <p className="res-mgmt__stat-value">{s.value}</p>
                    <p className="res-mgmt__stat-label">{s.label}</p>
                  </div>
                  <span className={`res-mgmt__stat-icon res-mgmt__stat-icon--${s.accent}`} aria-hidden>
                    {s.icon}
                  </span>
                </article>
              ))}
            </section>

            {/* ── Toolbar: event filter + search ─────────────────────────── */}
            <div className="tbl-toolbar">
              <div className="tbl-evt-wrap" ref={eventFilterRef}>
                <button
                  type="button"
                  className={`tbl-evt-select${selectedEventId ? ' tbl-evt-select--active' : ''}`}
                  onClick={() => setEventFilterOpen(open => !open)}
                  aria-label="Filter by event"
                  aria-haspopup="listbox"
                  aria-expanded={eventFilterOpen}
                >
                  <span className="tbl-evt-select__label">{selectedEventLabel}</span>
                </button>
                <ChevronDown size={14} className="tbl-evt-arrow" aria-hidden />
                {eventFilterOpen && (
                  <div className="tbl-evt-menu" role="listbox" aria-label="Filter by event">
                    {eventFilterOptions.map(option => (
                      <button
                        key={option.value || 'all-events'}
                        type="button"
                        role="option"
                        aria-selected={option.value === selectedEventId}
                        className={`tbl-evt-option${option.value === selectedEventId ? ' tbl-evt-option--active' : ''}`}
                        onClick={() => selectEventFilter(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="tbl-mgmt__search-wrap">
                <svg className="tbl-mgmt__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <input
                  className="tbl-mgmt__search"
                  type="search"
                  placeholder={selectedEventId ? 'Search by table or guest…' : 'Search by table or type…'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search tables"
                />
              </div>
            </div>

            {/* ── Status pills (event view only) ─────────────────────────── */}
            {selectedEventId && (
              <div className="tbl-status-pills" role="group" aria-label="Filter by status">
                {(['all', 'available', 'reserved'] as const).map(s => (
                  <button
                    key={s} type="button"
                    className={`tbl-status-pill${statusFilter === s ? ' tbl-status-pill--active' : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* ── Table list ─────────────────────────────────────────────── */}
            {sortedTables.length === 0 ? (
              <div className="res-mgmt__empty-tables">
                <p className="res-mgmt__empty-tables-msg">No tables yet for this club.</p>
                <button type="button" className="res-mgmt__btn res-mgmt__btn--primary res-mgmt__btn--inline" onClick={() => setAddTableOpen(true)}>
                  Add your first table
                </button>
              </div>
            ) : filteredTables.length === 0 ? (
              <p style={{ color: '#8a8a8a', fontSize: '0.9375rem', paddingTop: '8px' }}>
                No tables match the current filter.
              </p>
            ) : (
              <div className="res-mgmt__table-wrap">
                <table className="res-mgmt__table tbl-mgmt__list">
                  <thead>
                    <tr>
                      <th scope="col">Table</th>
                      <th scope="col">Type</th>
                      <th scope="col">Capacity</th>
                      <th scope="col">Min. Spend</th>
                      {selectedEventId && <th scope="col">Status</th>}
                      {selectedEventId && <th scope="col">Current Guest</th>}
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTables.map(row => {
                      const disp = activeDisplayMap[row.id] ?? { status: 'available' as const }
                      const minSpend = row.minimum_spend != null ? Number.parseFloat(row.minimum_spend) : null
                      const evStatus: EventStatus = disp.status as EventStatus
                      return (
                        <tr key={row.id} className="tbl-mgmt__row">
                          <td data-label="Table">
                            <span className="tbl-mgmt__table-label">{row.table_number}</span>
                          </td>
                          <td data-label="Type">
                            <TypeBadge type={row.type} />
                          </td>
                          <td className="tbl-mgmt__cell-num" data-label="Capacity">
                            <div className="tbl-mgmt__capacity">
                              <svg viewBox="0 0 24 24" fill="none" aria-hidden className="tbl-mgmt__seat-ic">
                                <path d="M9 10h6M9 14h3M6 12h3v6H6v-6Zm9 0h3v6h-3v-6ZM4 10h5M15 10h5M9 6h6v4H9V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {row.seating_capacity}
                            </div>
                          </td>
                          <td className="tbl-mgmt__cell-num" data-label="Min. Spend">
                            {minSpend != null && minSpend > 0
                              ? `€${minSpend.toLocaleString('en-US')}`
                              : <span className="tbl-mgmt__muted">—</span>}
                          </td>
                          {selectedEventId && (
                            <td data-label="Status">
                              <div className="tbl-mgmt__status-stack">
                                <EventStatusBadge status={evStatus} />
                                {disp.noShow ? (
                                  <span className="tbl-mgmt__noshow-warning">No-Show needs attention</span>
                                ) : null}
                              </div>
                            </td>
                          )}
                          {selectedEventId && (
                            <td data-label="Current Guest">
                              {disp.guestName
                                ? <span className="tbl-mgmt__guest-name">{disp.guestName}</span>
                                : <span className="tbl-mgmt__muted">—</span>}
                            </td>
                          )}
                          <td data-label="Actions">
                            {selectedEventId ? (
                              <button
                                type="button"
                                className="tbl-manage-btn"
                                onClick={() => openTableManage(row.id)}
                                aria-label={`Manage table ${row.table_number}`}
                              >
                                Manage
                              </button>
                            ) : (
                              <div className="res-mgmt__actions">
                                <button
                                  type="button"
                                  className="tbl-edit-btn"
                                  onClick={() => openEditTable(row.id)}
                                  title="Edit table"
                                  aria-label={`Edit table ${row.table_number}`}
                                >
                                  <Pencil size={13} strokeWidth={2} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="res-mgmt__icon-btn res-mgmt__icon-btn--cancel"
                                  title="Delete table"
                                  aria-label={`Delete table ${row.table_number}`}
                                  onClick={() => setDeleteDialogTableId(row.id)}
                                >
                                  <Trash2 className="res-mgmt__lucide-action" size={15} strokeWidth={2} aria-hidden />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toastMessage ? <div className="res-mgmt__toast" role="status">{toastMessage}</div> : null}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {deleteDialogTableId && deleteTarget ? (
        <div className="res-mgmt__confirm-backdrop" role="presentation" onClick={() => !deleteDialogBusy && setDeleteDialogTableId(null)}>
          <div className="res-mgmt__confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="del-table-title" onClick={e => e.stopPropagation()}>
            <div className="res-mgmt__confirm-icon-circle" aria-hidden>
              <Trash2 className="res-mgmt__confirm-trash-icon" size={28} strokeWidth={2} />
            </div>
            <h2 id="del-table-title" className="res-mgmt__confirm-title">Delete Table {deleteTarget.table_number}?</h2>
            <p className="res-mgmt__confirm-message">
              This will permanently remove the table and unlink any active reservations. This cannot be undone.
            </p>
            <div className="res-mgmt__confirm-actions">
              <button type="button" className="res-mgmt__confirm-btn res-mgmt__confirm-btn--keep" disabled={deleteDialogBusy} onClick={() => setDeleteDialogTableId(null)}>Keep Table</button>
              <button type="button" className="res-mgmt__confirm-btn res-mgmt__confirm-btn--yes" disabled={deleteDialogBusy} onClick={() => void executeDeleteTable(deleteDialogTableId)}>
                {deleteDialogBusy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Add table modal ───────────────────────────────────────────────── */}
      {addTableOpen ? (
        <div className="tbl-add-backdrop" role="presentation" onClick={() => !addTableBusy && setAddTableOpen(false)}>
          <div className="tbl-add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-table-title" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="tbl-add-head">
              <h2 id="add-table-title" className="tbl-add-title">Add Tables</h2>
              <button type="button" className="tbl-add-close" onClick={() => !addTableBusy && setAddTableOpen(false)} aria-label="Close">×</button>
            </div>

            {/* Type card grid */}
            <div className="tbl-type-grid">
              {([
                { key: 'standard' as AddTypeCard, name: 'Standard', sub: 'Standard seating',    Icon: Users },
                { key: 'premium'  as AddTypeCard, name: 'Premium',  sub: 'Premium · Min spend', Icon: Sparkles },
                { key: 'vip'      as AddTypeCard, name: 'VIP',      sub: 'Elevated experience', Icon: Crown },
                { key: 'lounge'   as AddTypeCard, name: 'Lounge',   sub: 'Relaxed seating',     Icon: Armchair },
                { key: 'prive'    as AddTypeCard, name: 'Privé',    sub: 'Exclusive privé',     Icon: Star },
                { key: 'custom'   as AddTypeCard, name: 'Custom',   sub: 'Custom table name',   Icon: Pencil },
              ]).map(({ key, name, sub, Icon }) => (
                <button
                  key={key} type="button"
                  className={`tbl-type-card${addTypeCard === key ? ' tbl-type-card--active' : ''}`}
                  onClick={() => {
                    setAddTypeCard(key)
                    if (key === 'standard' || addMinSpend.trim() !== '') setAddMinSpendError('')
                    if (!addDescriptionDirty) setAddDescription(ADD_TYPE_DEFAULTS[key])
                  }}
                >
                  <span className="tbl-type-card__icon"><Icon size={20} strokeWidth={1.8} aria-hidden /></span>
                  <span className="tbl-type-card__name">{name}</span>
                  <span className="tbl-type-card__sub">{sub}</span>
                </button>
              ))}
            </div>

            {/* Custom label (only when custom selected) */}
            {addTypeCard === 'custom' && (
              <div className="tbl-add-section">
                <p className="tbl-add-label">TABLE LABEL</p>
                <input
                  className="tbl-add-input"
                  value={addCustomLabel}
                  onChange={e => setAddCustomLabel(e.target.value)}
                  placeholder="e.g. Booth A, Terrace 1"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Minimum spend */}
            <div className="tbl-add-section">
              <p className="tbl-add-label">
                MINIMUM SPEND
                {addMinSpendRequired ? <span className="tbl-add-required" aria-hidden>*</span> : null}
              </p>
              <div className="tbl-currency-row">
                <span className="tbl-currency-sym">€</span>
                <input
                  className="tbl-currency-inp"
                  inputMode="decimal"
                  value={addMinSpend}
                  onChange={e => {
                    setAddMinSpend(e.target.value)
                    if (addMinSpendError) setAddMinSpendError('')
                  }}
                  placeholder="0.00"
                />
              </div>
              {addMinSpendError ? <p className="tbl-add-error">{addMinSpendError}</p> : null}
            </div>

            {/* Description */}
            <div className="tbl-add-section">
              <p className="tbl-add-label">DESCRIPTION (OPTIONAL)</p>
              <textarea
                className="tbl-add-textarea"
                value={addDescription}
                onChange={e => { setAddDescription(e.target.value); setAddDescriptionDirty(true) }}
                placeholder="e.g. VIP table with bottle service and dedicated host"
                rows={3}
              />
            </div>

            {/* Count + Starting number (hidden for custom) */}
            {addTypeCard !== 'custom' && (
              <div className="tbl-two-col">
                <div className="tbl-add-section">
                  <p className="tbl-add-label">TABLE COUNT</p>
                  <div className="tbl-stepper">
                    <button type="button" className="tbl-stepper__btn" onClick={() => setAddTableCount(c => Math.max(1, c - 1))} aria-label="Decrease">−</button>
                    <span className="tbl-stepper__val">{addTableCount}</span>
                    <button type="button" className="tbl-stepper__btn" onClick={() => setAddTableCount(c => Math.min(50, c + 1))} aria-label="Increase">+</button>
                  </div>
                </div>
                <div className="tbl-add-section">
                  <p className="tbl-add-label">STARTING NUMBER</p>
                  <div className="tbl-start-row">
                    <span className="tbl-start-prefix">T</span>
                    <input
                      className="tbl-start-inp"
                      type="number"
                      min={1}
                      value={addStartingNumber}
                      onChange={e => setAddStartingNumber(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Capacity */}
            <div className="tbl-add-section">
              <p className="tbl-add-label">CAPACITY PER TABLE</p>
              <div className="tbl-cap-wrap" ref={addCapacityRef}>
                <button
                  type="button"
                  className="tbl-cap-select"
                  onClick={() => setAddCapacityOpen(open => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={addCapacityOpen}
                >
                  <span>{addCapacity}</span>
                </button>
                <ChevronDown size={14} className="tbl-cap-arrow" aria-hidden />
                {addCapacityOpen && (
                  <div className="tbl-cap-menu" role="listbox" aria-label="Capacity per table">
                    {CAPACITY_OPTIONS.map(n => (
                      <button
                        key={n}
                        type="button"
                        role="option"
                        aria-selected={String(n) === addCapacity}
                        className={`tbl-cap-option${String(n) === addCapacity ? ' tbl-cap-option--active' : ''}`}
                        onClick={() => selectAddCapacity(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview banner */}
            {addPreviewLabels.length > 0 && (
              <div className="tbl-preview">
                <span className="tbl-preview__info" aria-hidden>ℹ</span>
                <span className="tbl-preview__text">
                  This will create {addTypeCard === 'custom' ? '1 custom' : `${addTableCount} ${addTypeCard === 'prive' ? 'Privé' : addTypeCard.charAt(0).toUpperCase() + addTypeCard.slice(1)}`} table{addTableCount !== 1 && addTypeCard !== 'custom' ? 's' : ''}:
                </span>
                <span className="tbl-preview__tags">
                  {addPreviewLabels.map(l => <span key={l} className="tbl-preview__tag">{l}</span>)}
                </span>
              </div>
            )}

            {/* Footer */}
            <div className="tbl-add-footer">
              <button type="button" className="tbl-add-cancel" onClick={() => setAddTableOpen(false)} disabled={addTableBusy}>Cancel</button>
              <button type="button" className="tbl-add-create" onClick={() => void submitAddTable()} disabled={addTableBusy || !clubId}>
                {addTableBusy ? 'Creating…' : '+ Create Tables'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit table slide-out ──────────────────────────────────────────── */}
      {editTableId ? (
        <div className="res-mgmt__sheet-backdrop" role="presentation" onClick={() => !editBusy && closeEditTable()}>
          <div className="res-mgmt__sheet res-mgmt__sheet--compact tbl-edit-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-table-title" onClick={e => e.stopPropagation()}>
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="edit-table-title" className="res-mgmt__sheet-title">Edit Table</h2>
                <p className="res-mgmt__sheet-sub">Update this table's settings.</p>
              </div>
              <button type="button" className="res-mgmt__sheet-close" onClick={() => !editBusy && closeEditTable()} aria-label="Close">×</button>
            </div>
            <label className="res-mgmt__field">
              <span>Table number / label</span>
              <input className="res-mgmt__input" value={editTableNumber} onChange={e => { setEditTableNumber(e.target.value); setEditError('') }} />
            </label>
            <label className="res-mgmt__field">
              <span>Type</span>
              <div className="tbl-edit-type-wrap" ref={editTypeRef}>
                <button
                  type="button"
                  className="res-mgmt__input tbl-edit-type-trigger"
                  onClick={() => setEditTypeOpen(open => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={editTypeOpen}
                >
                  <span>{editTypeLabel}</span>
                  <ChevronDown size={14} className="tbl-edit-type-arrow" aria-hidden />
                </button>
                {editTypeOpen && (
                  <div className="tbl-edit-type-menu" role="listbox" aria-label="Table type">
                    {TABLE_TYPE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={option.value === editTableType}
                        className={`tbl-edit-type-option${option.value === editTableType ? ' tbl-edit-type-option--active' : ''}`}
                        onClick={() => selectEditTableType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="res-mgmt__field">
              <span>Description (optional)</span>
              <textarea className="res-mgmt__textarea" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} />
            </label>
            <label className="res-mgmt__field">
              <span>
                Minimum spend (€{editMinSpendRequired ? ')' : ', optional)'}
                {editMinSpendRequired ? <span className="tbl-add-required" aria-hidden>*</span> : null}
              </span>
              <input
                className="res-mgmt__input"
                inputMode="decimal"
                value={editMinSpend}
                onChange={e => {
                  setEditMinSpend(e.target.value)
                  setEditError('')
                  if (editMinSpendError) setEditMinSpendError('')
                }}
                placeholder={editMinSpendRequired ? '0.00' : 'Optional'}
              />
              {editMinSpendError ? <p className="tbl-edit-error">{editMinSpendError}</p> : null}
            </label>
            <label className="res-mgmt__field">
              <span>Capacity (seats)</span>
              <input className="res-mgmt__input" inputMode="numeric" value={editCapacity} onChange={e => { setEditCapacity(e.target.value); setEditError('') }} />
            </label>
            {editError && <p className="res-mgmt__inline-warn" role="alert">{editError}</p>}
            <button type="button" className="res-mgmt__btn tbl-btn--primary" onClick={() => void submitEditTable()} disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Walk-in slide-out ─────────────────────────────────────────────── */}
      {walkInOpen && selectedEventId ? (
        <div className="res-mgmt__sheet-backdrop" role="presentation" onClick={() => !walkInBusy && setWalkInOpen(false)}>
          <div className="res-mgmt__sheet res-mgmt__sheet--compact" role="dialog" aria-modal="true" aria-labelledby="walkin-title" onClick={e => e.stopPropagation()}>
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="walkin-title" className="res-mgmt__sheet-title">Walk-in Guest</h2>
                <p className="res-mgmt__sheet-sub">Assign a walk-in to an available table for this event.</p>
              </div>
              <button type="button" className="res-mgmt__sheet-close" onClick={() => !walkInBusy && setWalkInOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="res-mgmt__field">
              <span>Party size</span>
              <div className="tbl-stepper">
                <button
                  type="button"
                  className="tbl-stepper__btn"
                  onClick={() => {
                    const next = Math.max(1, walkInPeople - 1)
                    setWalkInPeople(next)
                    if (walkInTableId) {
                      const t = dbTables.find(row => row.id === walkInTableId)
                      if (t && t.seating_capacity < next) setWalkInTableId('')
                    }
                  }}
                  aria-label="Decrease party size"
                  disabled={walkInPeople <= 1}
                >−</button>
                <span className="tbl-stepper__val">{walkInPeople}</span>
                <button
                  type="button"
                  className="tbl-stepper__btn"
                  onClick={() => {
                    const next = Math.min(20, walkInPeople + 1)
                    setWalkInPeople(next)
                    if (walkInTableId) {
                      const t = dbTables.find(row => row.id === walkInTableId)
                      if (t && t.seating_capacity < next) setWalkInTableId('')
                    }
                  }}
                  aria-label="Increase party size"
                  disabled={walkInPeople >= 20}
                >+</button>
              </div>
            </div>
            <label className="res-mgmt__field">
              <span>Table</span>
              <div className="tbl-walkin-table-wrap" ref={walkInTableRef}>
                <button
                  type="button"
                  className="res-mgmt__input tbl-walkin-table-trigger"
                  onClick={() => setWalkInTableOpen(open => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={walkInTableOpen}
                >
                  <span>{selectedWalkInTableLabel}</span>
                  <ChevronDown size={14} className="tbl-walkin-table-arrow" aria-hidden />
                </button>
                {walkInTableOpen && (
                  <div className="tbl-walkin-table-menu" role="listbox" aria-label="Walk-in table">
                    <button
                      type="button"
                      role="option"
                      aria-selected={walkInTableId === ''}
                      className={`tbl-walkin-table-option${walkInTableId === '' ? ' tbl-walkin-table-option--active' : ''}`}
                      onClick={() => selectWalkInTable('')}
                    >
                      Select available table...
                    </button>
                    {availableTablesForWalkIn.map(t => {
                      const label = `${t.table_number}${t.type ? ` (${tableTypeMeta(t.type).label})` : ''} · ${t.seating_capacity} seats`
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="option"
                          aria-selected={walkInTableId === t.id}
                          className={`tbl-walkin-table-option${walkInTableId === t.id ? ' tbl-walkin-table-option--active' : ''}`}
                          onClick={() => selectWalkInTable(t.id)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </label>
            <label className="res-mgmt__field">
              <span>Guest name</span>
              <input className="res-mgmt__input" value={walkInGuestName} onChange={e => setWalkInGuestName(e.target.value)} placeholder="Full name" autoComplete="off" />
            </label>
            {availableTablesForWalkIn.length === 0 && (
              <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                No available tables that fit {walkInPeople} {walkInPeople === 1 ? 'guest' : 'guests'} for this event.
              </p>
            )}
            <button type="button" className="res-mgmt__btn res-mgmt__btn--primary" onClick={() => void submitWalkIn()} disabled={walkInBusy || !walkInTableId || !user?.id}>
              {walkInBusy ? 'Assigning…' : 'Assign Walk-in'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Manage table slide-out ────────────────────────────────────────── */}
      {manageTableId && activeManageRow && activeManageDisplay ? (
        <div className="res-mgmt__sheet-backdrop" role="presentation" onClick={closeTableManage}>
          <div className="res-mgmt__sheet" role="dialog" aria-modal="true" aria-labelledby="table-manage-title" onClick={e => e.stopPropagation()}>
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="table-manage-title" className="res-mgmt__sheet-title">Table {activeManageRow.table_number}</h2>
                <p className="res-mgmt__sheet-sub">
                  {tableTypeMeta(activeManageRow.type).label} · Capacity {activeManageRow.seating_capacity}
                  {activeManageRow.minimum_spend ? ` · Min. €${Number.parseFloat(activeManageRow.minimum_spend).toLocaleString('en-US')}` : ''}
                </p>
              </div>
              <button type="button" className="res-mgmt__sheet-close" onClick={closeTableManage} aria-label="Close">×</button>
            </div>

            <div className="res-mgmt__sheet-badges">
              <span className={isVipTableType(activeManageRow.type) ? 'res-mgmt__mini-badge res-mgmt__mini-badge--vip' : 'res-mgmt__mini-badge res-mgmt__mini-badge--std'}>
                {tableTypeMeta(activeManageRow.type).label}
              </span>
              <span className={`tbl-modal-status tbl-modal-status--${activeManageDisplay.status}`}>
                <span className="tbl-modal-status-dot" aria-hidden />
                {activeManageDisplay.status.charAt(0).toUpperCase() + activeManageDisplay.status.slice(1)}
              </span>
              {activeManageDisplay.noShow ? (
                <span className="tbl-modal-noshow">No-Show</span>
              ) : null}
            </div>

            {relocateOpen ? (
              <div className="res-mgmt__sheet-block">
                <h3 className="res-mgmt__sheet-h3">Choose a table to relocate to</h3>
                {availableTablesForRelocate.length === 0 ? (
                  <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                    No available tables can accommodate a party of {activeReservation?.nr_of_people ?? 1}. Consider cancelling or contacting the guest.
                  </p>
                ) : (
                  <div className="tbl-relocate-list">
                    {availableTablesForRelocate.map(t => (
                      <button
                        key={t.id} type="button"
                        className={`tbl-relocate-item${relocateTableId === t.id ? ' tbl-relocate-item--active' : ''}`}
                        onClick={() => setRelocateTableId(t.id)}
                      >
                        <span className="tbl-relocate-item__name">{t.table_number}</span>
                        <TypeBadge type={t.type} />
                        <span className="tbl-relocate-item__cap">{t.seating_capacity} seats</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="tbl-relocate-footer">
                  <button type="button" className="res-mgmt__btn res-mgmt__btn--ghost" onClick={() => { setRelocateOpen(false); setRelocateTableId('') }}>
                    ← Back
                  </button>
                  {availableTablesForRelocate.length > 0 && (
                    <button type="button" className="tbl-relocate-confirm-btn" onClick={() => void relocateGuest()} disabled={relocateBusy || !relocateTableId}>
                      {relocateBusy ? 'Relocating…' : 'Confirm Relocate'}
                    </button>
                  )}
                </div>
              </div>
            ) : cancelConfirmOpen ? (
              <div className="tbl-cancel-confirm-block">
                <h3 className="tbl-cancel-confirm-title">Cancel Reservation?</h3>
                <p className="tbl-cancel-confirm-body">
                  This will permanently cancel the guest's reservation. They will lose their table for this event. Consider relocating them instead.
                </p>
                <button type="button" className="tbl-cancel-confirm-btn" onClick={() => void cancelReservation()} disabled={cancelBusy}>
                  {cancelBusy ? 'Cancelling…' : 'Cancel reservation'}
                </button>
                <button type="button" className="res-mgmt__btn res-mgmt__btn--ghost" onClick={() => setCancelConfirmOpen(false)} disabled={cancelBusy}>
                  Go back
                </button>
              </div>
            ) : (
              <>
                {/* Reservation details */}
                {activeManageDisplay.status !== 'available' && activeReservation && (
                  <div className="res-mgmt__sheet-block">
                    <h3 className="res-mgmt__sheet-h3">Reservation Details</h3>
                    <p className="res-mgmt__sheet-p"><strong>Guest:</strong> {activeManageDisplay.guestName ?? '—'}</p>
                    <p className="res-mgmt__sheet-p"><strong>Party size:</strong> {activeReservation.nr_of_people ?? '—'}</p>
                    <p className="res-mgmt__sheet-p"><strong>Booked:</strong> {activeReservation.created_at ? new Date(activeReservation.created_at).toLocaleString() : '—'}</p>
                    {activeReservation.notes && <p className="res-mgmt__sheet-p"><strong>Notes:</strong> {activeReservation.notes}</p>}
                  </div>
                )}

                {/* Reserve form — available only */}
                {activeManageDisplay.status === 'available' && (
                  <div className="res-mgmt__sheet-block">
                    <h3 className="res-mgmt__sheet-h3">Reserve this table</h3>
                    <label className="res-mgmt__field">
                      <span>Guest name</span>
                      <input className="res-mgmt__input" value={reserveGuest} onChange={e => setReserveGuest(e.target.value)} placeholder="Full name" autoComplete="off" />
                    </label>
                    <button type="button" className="res-mgmt__btn res-mgmt__btn--primary" onClick={() => void submitReserve()} disabled={actionBusy}>
                      {actionBusy ? 'Reserving…' : 'Reserve this table'}
                    </button>
                  </div>
                )}

                {/* Reserved: three action buttons */}
                {activeManageDisplay.status === 'reserved' && (
                  <div className="tbl-manage-actions">
                    <button type="button" className="tbl-manage-action tbl-manage-action--primary" onClick={() => setRelocateOpen(true)} disabled={actionBusy}>
                      Relocate Guest
                    </button>
                    <button type="button" className="tbl-manage-action tbl-manage-action--amber" onClick={() => void markOccupied()} disabled={actionBusy}>
                      Mark as Occupied
                    </button>
                    <button type="button" className="tbl-manage-action tbl-manage-action--danger" onClick={() => setCancelConfirmOpen(true)} disabled={actionBusy}>
                      Cancel Reservation
                    </button>
                  </div>
                )}

                {/* Occupied: relocate + release */}
                {activeManageDisplay.status === 'occupied' && (
                  <div className="tbl-manage-actions">
                    <button type="button" className="tbl-manage-action tbl-manage-action--primary" onClick={() => setRelocateOpen(true)} disabled={actionBusy}>
                      Relocate Guest
                    </button>
                    <button type="button" className="tbl-manage-action tbl-manage-action--ghost" onClick={() => void releaseTable()} disabled={actionBusy}>
                      Release Table
                    </button>
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
