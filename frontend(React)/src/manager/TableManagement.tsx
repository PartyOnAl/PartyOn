import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crown, Trash2 } from 'lucide-react'
import './ManagerDashboard.css'
import './ReservationManagement.css'
import './TableManagement.css'
import { ManagerSidebar, ManagerTopBar } from './ManagerNav'
import { useManagerClub } from './useManagerClub'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured, managerSupabase as supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type TableDisplay = {
  status: FloorStatus
  guestName?: string
  eventLabel?: string
  linkedReservationId?: string
}

type VipPackageDraft = { minSpend: string; bottleNote: string }

type TablePositionJson = {
  layout?: { col?: number; row?: number; colSpan?: number; x?: number; y?: number; cs?: string }
  vip_note?: string
  label?: string
  floor_ui_status?: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

function normalizeFloorStatus(raw: string | null): FloorStatus {
  const t = (raw ?? 'available').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function isVipTableType(type: string | null): boolean {
  if (!type) return false
  return type.toLowerCase().includes('vip')
}

function naturalCompareTableNum(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function getPrimaryReservationForTable(
  tableId: string,
  reservations: ReservationRow[],
): ReservationRow | null {
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
      guestName: primary ? guestLabel(primary) : undefined,
      eventLabel: primary?.events?.event_name ?? undefined,
      linkedReservationId: primary?.reservation_id,
    }
  }
  if (db === 'occupied') {
    return {
      status: 'occupied',
      guestName: primary ? guestLabel(primary) : undefined,
      eventLabel: primary?.events?.event_name ?? undefined,
      linkedReservationId: primary?.reservation_id,
    }
  }
  if (primary) {
    return {
      status: 'reserved',
      guestName: guestLabel(primary),
      eventLabel: primary.events?.event_name ?? undefined,
      linkedReservationId: primary.reservation_id,
    }
  }
  if (db === 'reserved') return { status: 'reserved' }
  return { status: 'available' }
}

function guestLabel(row: ReservationRow) {
  return row.user
    ? `${row.user.name ?? ''} ${row.user.surname ?? ''}`.trim() || 'Guest'
    : 'Guest'
}

function isTableBookingType(t: string | null) {
  if (!t) return false
  const x = t.toLowerCase()
  return x === 'vip_table' || x === 'standard_table' || x === 'table'
}

function vipNoteFromDb(row: DbTableRow) {
  return parseTablePositionJson(row.position)?.vip_note ?? ''
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TableManagement() {
  const { club, clubId } = useManagerClub()
  const { user } = useAuth()

  const [dbTables, setDbTables] = useState<DbTableRow[]>([])
  const [clubEvents, setClubEvents] = useState<ClubEventRow[]>([])
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FloorStatus>('all')

  // ── Add-table modal ────────────────────────────────────────────────────────
  const [addTableOpen, setAddTableOpen] = useState(false)
  const [addTableNumber, setAddTableNumber] = useState('')
  const [addCapacity, setAddCapacity] = useState('4')
  const [addMinSpend, setAddMinSpend] = useState('')
  const [addIsVip, setAddIsVip] = useState(false)
  const [addTableBusy, setAddTableBusy] = useState(false)

  // ── Delete confirmation dialog ─────────────────────────────────────────────
  const [deleteDialogTableId, setDeleteDialogTableId] = useState<string | null>(null)
  const [deleteDialogBusy, setDeleteDialogBusy] = useState(false)

  // ── Manage-table slide-out ─────────────────────────────────────────────────
  const [manageTableId, setManageTableId] = useState<string | null>(null)
  const [reserveGuest, setReserveGuest] = useState('')
  const [reserveEvent, setReserveEvent] = useState('')
  const [reserveEventId, setReserveEventId] = useState('')
  const [reserveLinkId, setReserveLinkId] = useState('')
  const [vipDraft, setVipDraft] = useState<VipPackageDraft>({ minSpend: '', bottleNote: '' })

  // ─────────────────────────────────────────────────────────────────────────

  const loadClubData = useCallback(async () => {
    if (!clubId || !supabase || !isSupabaseConfigured) {
      setDbTables([])
      setClubEvents([])
      setReservations([])
      return
    }

    const { data: tblData, error: tblErr } = await supabase
      .from('tables')
      .select('id, table_number, seating_capacity, minimum_spend, position, location, type, table_status, club_id')
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
        `reservation_id, type, status, nr_of_people, created_at, table_id, event_id, notes,
          user:profiles(id, name, surname),
          events(event_name, ticket_price, final_ticket_price, event_type),
          payments(amount, status)`,
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
    if (!toastMessage) return
    const t = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(t)
  }, [toastMessage])

  useEffect(() => {
    if (!deleteDialogTableId) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteDialogTableId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteDialogTableId])

  // ── Derived state ─────────────────────────────────────────────────────────

  const sortedTables = useMemo(
    () => [...dbTables].sort((a, b) => naturalCompareTableNum(a.table_number, b.table_number)),
    [dbTables],
  )

  const tableDisplays = useMemo(() => {
    const m: Record<string, TableDisplay> = {}
    for (const row of dbTables) {
      m[row.id] = computeTableDisplay(row, reservations)
    }
    return m
  }, [dbTables, reservations])

  const tableReservationsOptions = useMemo(
    () => reservations.filter((r) => isTableBookingType(r.type)),
    [reservations],
  )

  const filteredTables = useMemo(() => {
    let rows = sortedTables
    if (statusFilter !== 'all') {
      rows = rows.filter((t) => (tableDisplays[t.id]?.status ?? 'available') === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.table_number.toLowerCase().includes(q) ||
          (t.type ?? '').toLowerCase().includes(q) ||
          (tableDisplays[t.id]?.guestName ?? '').toLowerCase().includes(q) ||
          (tableDisplays[t.id]?.eventLabel ?? '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [sortedTables, tableDisplays, statusFilter, searchQuery])

  const vipCount = sortedTables.filter((t) => isVipTableType(t.type)).length
  const standardCount = sortedTables.filter((t) => !isVipTableType(t.type)).length
  const reservedCount = sortedTables.filter((t) => tableDisplays[t.id]?.status === 'reserved').length
  const availableCount = sortedTables.filter((t) => tableDisplays[t.id]?.status === 'available').length
  const occupiedCount = sortedTables.filter((t) => tableDisplays[t.id]?.status === 'occupied').length

  const tableStats = [
    { label: 'Total Tables', value: String(sortedTables.length) },
    { label: 'Available', value: String(availableCount) },
    { label: 'Reserved', value: String(reservedCount) },
    { label: 'Occupied', value: String(occupiedCount) },
    { label: 'VIP Tables', value: String(vipCount) },
    { label: 'Standard', value: String(standardCount) },
  ]

  // ── Active manage context ──────────────────────────────────────────────────

  const activeManageRow = manageTableId ? dbTables.find((t) => t.id === manageTableId) ?? null : null
  const activeManageDisplay = manageTableId ? (tableDisplays[manageTableId] ?? null) : null

  // ── Actions ───────────────────────────────────────────────────────────────

  function openTableManage(tableId: string) {
    const row = dbTables.find((t) => t.id === tableId)
    if (!row) return
    const disp = tableDisplays[tableId]
    setManageTableId(tableId)
    setReserveGuest(disp?.guestName ?? '')
    setReserveEvent(disp?.eventLabel ?? '')
    setReserveEventId('')
    setReserveLinkId(disp?.linkedReservationId ?? '')
    const minRaw = row.minimum_spend
    setVipDraft({
      minSpend: minRaw != null && minRaw !== '' ? String(Number.parseFloat(minRaw)) : '',
      bottleNote: vipNoteFromDb(row),
    })
  }

  function closeTableManage() {
    setManageTableId(null)
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

  async function executeDeleteTable(tableId: string) {
    if (!supabase) return
    setDeleteDialogBusy(true)
    try {
      await supabase
        .from('reservations')
        .update({ table_id: null })
        .eq('table_id', tableId)
        .in('status', ['pending', 'confirmed'])
      const { error: delErr } = await supabase.from('tables').delete().eq('id', tableId)
      if (delErr) {
        setToastMessage(delErr.message)
        return
      }
      setDeleteDialogTableId(null)
      await loadClubData()
      setToastMessage('Table removed.')
    } finally {
      setDeleteDialogBusy(false)
    }
  }

  async function submitReserve() {
    if (!supabase || !manageTableId || !activeManageRow) return
    if (reserveLinkId) {
      setActionBusy(true)
      const posNext = positionJsonWithoutFloorUi(activeManageRow.position)
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

    const posNext = positionJsonWithoutFloorUi(activeManageRow.position)
    const { error: stErr, data: stRows } = await supabase
      .from('tables')
      .update({ table_status: 'reserved', position: posNext })
      .eq('id', manageTableId)
      .select('id')

    setActionBusy(false)
    if (stErr || !stRows?.length) {
      setToastMessage(
        stErr?.message ??
          (!stRows?.length ? 'Booking created but table was not updated — check permissions.' : 'Error'),
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
    const raw = activeManageRow
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
    if (!supabase || !manageTableId || !activeManageRow) return
    setActionBusy(true)

    const tryOcc = await supabase
      .from('tables')
      .update({ table_status: 'occupied' })
      .eq('id', manageTableId)
      .select('id')

    if (!tryOcc.error && tryOcc.data?.length) {
      const posNext = positionJsonWithoutFloorUi(activeManageRow.position)
      if (posNext !== (activeManageRow.position ?? null)) {
        await supabase.from('tables').update({ position: posNext }).eq('id', manageTableId)
      }
      setActionBusy(false)
      await loadClubData()
      setToastMessage('Table marked occupied.')
      closeTableManage()
      return
    }

    const rec = buildPositionRecord(activeManageRow.position)
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
    setActionBusy(true)
    await supabase
      .from('reservations')
      .update({ table_id: null })
      .eq('table_id', manageTableId)
      .in('status', ['pending', 'confirmed'])
    const posNext = positionJsonWithoutFloorUi(activeManageRow?.position ?? null)
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
    if (!supabase || !manageTableId || !activeManageRow) return
    let posObj: Record<string, unknown> = {}
    const rawPos = activeManageRow.position
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

  // ── Render ────────────────────────────────────────────────────────────────

  function statusBadgeClass(status: FloorStatus) {
    if (status === 'available') return 'tbl-mgmt__status-pill tbl-mgmt__status-pill--ok'
    if (status === 'reserved') return 'tbl-mgmt__status-pill tbl-mgmt__status-pill--amber'
    return 'tbl-mgmt__status-pill tbl-mgmt__status-pill--red'
  }

  function statusPillClass(status: FloorStatus) {
    if (status === 'available') return 'res-mgmt__floor-pill--ok'
    if (status === 'reserved') return 'res-mgmt__floor-pill--amber'
    return 'res-mgmt__floor-pill--red'
  }

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

  if (error && dbTables.length === 0 && reservations.length === 0) {
    return (
      <div className="manager-dash">
        <div className="manager-dash__layout">
          <ManagerSidebar />
          <div className="manager-dash__main manager-dash__main--res-mgmt tbl-mgmt__center">
            <span style={{ color: '#f87171' }}>Error: {error}</span>
          </div>
        </div>
      </div>
    )
  }

  const deleteTarget = deleteDialogTableId
    ? (dbTables.find((t) => t.id === deleteDialogTableId) ?? null)
    : null

  return (
    <div className="manager-dash">
      <div className="manager-dash__layout">
        <ManagerSidebar />

        <div className="manager-dash__main manager-dash__main--res-mgmt">
          <ManagerTopBar clubName={club?.club_name} />

          <div className="res-mgmt__bound res-mgmt__bound--wide">
            {error ? (
              <p className="res-mgmt__inline-warn" role="alert">{error}</p>
            ) : null}

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="res-mgmt__head res-mgmt__head--split">
              <div className="res-mgmt__head-text">
                <h1 className="manager-dash__page-title">Table Management</h1>
                <p className="manager-dash__page-sub">
                  Live table status, guest assignments, and bookings — synced with your reservations.
                </p>
              </div>
              <button
                type="button"
                className="res-mgmt__add-table-btn"
                onClick={() => setAddTableOpen(true)}
              >
                + Add Table
              </button>
            </header>

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <section className="res-mgmt__stats tbl-mgmt__stats" aria-label="Table statistics">
              {tableStats.map((s) => (
                <article key={s.label} className="res-mgmt__stat">
                  <p className="res-mgmt__stat-value">{s.value}</p>
                  <p className="res-mgmt__stat-label">{s.label}</p>
                </article>
              ))}
            </section>

            {/* ── Toolbar: search + status filter ────────────────────────── */}
            <div className="tbl-mgmt__toolbar">
              <div className="tbl-mgmt__search-wrap">
                <svg className="tbl-mgmt__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                <input
                  className="tbl-mgmt__search"
                  type="search"
                  placeholder="Search by table, guest, event…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search tables"
                />
              </div>
              <div className="tbl-mgmt__filter-pills" role="group" aria-label="Filter by status">
                {(['all', 'available', 'reserved', 'occupied'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`res-mgmt__tab${statusFilter === s ? ' res-mgmt__tab--active' : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Table list ─────────────────────────────────────────────── */}
            {sortedTables.length === 0 ? (
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
                      <th scope="col">Status</th>
                      <th scope="col">Capacity</th>
                      <th scope="col">Min. Spend</th>
                      <th scope="col">Current Guest</th>
                      <th scope="col">Event</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTables.map((row) => {
                      const disp = tableDisplays[row.id] ?? { status: 'available' as const }
                      const isVip = isVipTableType(row.type)
                      const minSpend =
                        row.minimum_spend != null
                          ? Number.parseFloat(row.minimum_spend)
                          : null

                      return (
                          <tr key={row.id} className="tbl-mgmt__row">
                          <td data-label="Table">
                            <div className="tbl-mgmt__table-name">
                              {isVip && (
                                <span className="tbl-mgmt__crown" aria-hidden>
                                  <Crown size={13} strokeWidth={2.25} />
                                </span>
                              )}
                              <span className="tbl-mgmt__table-label">{row.table_number}</span>
                            </div>
                          </td>
                          <td data-label="Type">
                            <span
                              className={
                                isVip
                                  ? 'res-mgmt__type res-mgmt__type--vip_table'
                                  : 'res-mgmt__type res-mgmt__type--standard_table'
                              }
                            >
                              {isVip ? 'VIP' : 'Standard'}
                            </span>
                          </td>
                          <td data-label="Status">
                            <span className={statusBadgeClass(disp.status)}>
                              <span
                                className="tbl-mgmt__status-dot"
                                data-status={disp.status}
                                aria-hidden
                              />
                              {disp.status.charAt(0).toUpperCase() + disp.status.slice(1)}
                            </span>
                          </td>
                          <td className="tbl-mgmt__cell-num" data-label="Capacity">
                            <div className="tbl-mgmt__capacity">
                              <svg viewBox="0 0 24 24" fill="none" aria-hidden className="tbl-mgmt__seat-ic">
                                <path
                                  d="M9 10h6M9 14h3M6 12h3v6H6v-6Zm9 0h3v6h-3v-6ZM4 10h5M15 10h5M9 6h6v4H9V6Z"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {row.seating_capacity}
                            </div>
                          </td>
                          <td className="tbl-mgmt__cell-num" data-label="Min. Spend">
                            {minSpend != null && minSpend > 0
                              ? `€${minSpend.toLocaleString('en-US')}`
                              : <span className="tbl-mgmt__muted">—</span>}
                          </td>
                          <td data-label="Current Guest">
                            {disp.guestName ? (
                              <div className="tbl-mgmt__guest">
                                <span className="tbl-mgmt__guest-name">{disp.guestName}</span>
                              </div>
                            ) : (
                              <span className="tbl-mgmt__muted">—</span>
                            )}
                          </td>
                          <td className="tbl-mgmt__cell-event" data-label="Event">
                            {disp.eventLabel ?? <span className="tbl-mgmt__muted">—</span>}
                          </td>
                          <td data-label="Actions">
                            <div className="res-mgmt__actions">
                              <button
                                type="button"
                                className="tbl-mgmt__manage-btn"
                                onClick={() => openTableManage(row.id)}
                                aria-label={`Manage table ${row.table_number}`}
                              >
                                Manage
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

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastMessage ? <div className="res-mgmt__toast" role="status">{toastMessage}</div> : null}

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {deleteDialogTableId && deleteTarget ? (
        <div
          className="res-mgmt__confirm-backdrop"
          role="presentation"
          onClick={() => !deleteDialogBusy && setDeleteDialogTableId(null)}
        >
          <div
            className="res-mgmt__confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-table-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__confirm-icon-circle" aria-hidden>
              <Trash2 className="res-mgmt__confirm-trash-icon" size={28} strokeWidth={2} />
            </div>
            <h2 id="del-table-title" className="res-mgmt__confirm-title">
              Delete Table {deleteTarget.table_number}?
            </h2>
            <p className="res-mgmt__confirm-message">
              This will permanently remove the table and unlink any active reservations. This cannot be undone.
            </p>
            <div className="res-mgmt__confirm-actions">
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--keep"
                disabled={deleteDialogBusy}
                onClick={() => setDeleteDialogTableId(null)}
              >
                Keep Table
              </button>
              <button
                type="button"
                className="res-mgmt__confirm-btn res-mgmt__confirm-btn--yes"
                disabled={deleteDialogBusy}
                onClick={() => void executeDeleteTable(deleteDialogTableId)}
              >
                {deleteDialogBusy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Add table slide-out ─────────────────────────────────────────────── */}
      {addTableOpen ? (
        <div
          className="res-mgmt__sheet-backdrop"
          role="presentation"
          onClick={() => !addTableBusy && setAddTableOpen(false)}
        >
          <div
            className="res-mgmt__sheet res-mgmt__sheet--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-table-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-mgmt__sheet-head">
              <div>
                <h2 id="add-table-title" className="res-mgmt__sheet-title">Add Table</h2>
                <p className="res-mgmt__sheet-sub">Creates a new table row for this club.</p>
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
              {addTableBusy ? 'Saving…' : 'Save Table'}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Manage table slide-out ──────────────────────────────────────────── */}
      {manageTableId && activeManageRow && activeManageDisplay ? (
        <div
          className="res-mgmt__sheet-backdrop"
          role="presentation"
          onClick={closeTableManage}
        >
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
                  Table {activeManageRow.table_number}
                </h2>
                <p className="res-mgmt__sheet-sub">
                  {isVipTableType(activeManageRow.type) ? 'VIP table' : 'Standard table'} ·
                  Capacity {activeManageRow.seating_capacity} ·
                  Min. spend €{activeManageRow.minimum_spend != null
                    ? Number.parseFloat(activeManageRow.minimum_spend).toLocaleString('en-US')
                    : '0'}
                </p>
              </div>
              <button
                type="button"
                className="res-mgmt__sheet-close"
                onClick={closeTableManage}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="res-mgmt__sheet-badges">
              <span
                className={
                  isVipTableType(activeManageRow.type)
                    ? 'res-mgmt__mini-badge res-mgmt__mini-badge--vip'
                    : 'res-mgmt__mini-badge res-mgmt__mini-badge--std'
                }
              >
                {isVipTableType(activeManageRow.type) ? 'VIP' : 'Standard'}
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
                        {guestLabel(r)} — {r.events?.event_name ?? 'Event'} ({r.status})
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
                <button
                  type="button"
                  className="res-mgmt__btn res-mgmt__btn--ghost"
                  onClick={() => void releaseTable()}
                  disabled={actionBusy}
                >
                  Release table
                </button>
                <button
                  type="button"
                  className="res-mgmt__btn res-mgmt__btn--warn"
                  onClick={() => void markOccupied()}
                  disabled={actionBusy}
                >
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

            {isVipTableType(activeManageRow.type) && (
              <div className="res-mgmt__sheet-block res-mgmt__sheet-block--vip">
                <h3 className="res-mgmt__sheet-h3">VIP Package</h3>
                <p className="res-mgmt__sheet-p res-mgmt__sheet-p--muted">
                  Custom minimum spend updates <code>minimum_spend</code>. Bottle note is stored
                  as JSON in <code>position.vip_note</code>.
                </p>
                <label className="res-mgmt__field">
                  <span>Custom min. spend (€)</span>
                  <input
                    className="res-mgmt__input"
                    inputMode="decimal"
                    value={vipDraft.minSpend}
                    onChange={(e) => setVipDraft((d) => ({ ...d, minSpend: e.target.value }))}
                    placeholder={
                      activeManageRow.minimum_spend != null
                        ? String(Number.parseFloat(activeManageRow.minimum_spend))
                        : '0'
                    }
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
                <button
                  type="button"
                  className="res-mgmt__btn res-mgmt__btn--gold"
                  onClick={() => void saveVipPackage()}
                  disabled={actionBusy}
                >
                  Save VIP Package
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
