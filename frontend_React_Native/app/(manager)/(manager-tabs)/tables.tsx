import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, FlatList, StyleSheet,
  TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert,
  RefreshControl, KeyboardAvoidingView, Platform, Pressable, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const SCREEN_W = Dimensions.get('window').width

// ── Types ─────────────────────────────────────────────────────────────────────
type ClubEvent = {
  event_id: string
  event_name: string
  event_starting_date: string
  event_ending_date: string | null
}

type ReservationRow = {
  reservation_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  nr_of_people: number | null
  reservation_date: string | null
  notes: string | null
  event_id: string | null
  profiles: { name: string | null; surname: string | null } | null
  events: { event_name: string } | null
}

type VenueTable = {
  id: string
  table_number: string
  seating_capacity: number
  minimum_spend: number | null
  sector: string | null
  location: string | null
  type: string | null
  table_status: 'available' | 'reserved' | 'occupied'
  reservations: ReservationRow[]
}

type FlatReservation = {
  reservation_id: string
  type: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  nr_of_people: number | null
  reservation_date: string | null
  notes: string | null
  event_id: string | null
  guest_name: string
  event_name: string | null
  /** Present when filtering queue to upcoming reservations */
  event_starting_date: string | null
  event_ending_date: string | null
  table_number: string | null
  table_id: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PRESET_TYPES = ['Standard', 'VIP', 'Premium', 'Lounge']

const STATUS_COLOR: Record<string, string> = {
  available: COLORS.green,
  reserved:  '#f59e0b',
  occupied:  COLORS.red,
}

const RESERV_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  confirmed: COLORS.green,
  cancelled: COLORS.red,
  completed: COLORS.mutedDark,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function guestNameFromRow(r: { profiles: { name: string | null; surname: string | null } | null } | null): string {
  if (!r?.profiles) return 'Guest'
  return [r.profiles.name, r.profiles.surname].filter(Boolean).join(' ') || 'Guest'
}

function fmt(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  const direct = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (direct) return direct[1]
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function matchesEventDate(reservationDate: string | null | undefined, eventDate: string | null | undefined) {
  const rDay = isoDay(reservationDate)
  const eDay = isoDay(eventDate)
  return !!rDay && !!eDay && rDay === eDay
}

function reservationMatchesEvent(
  r: { event_id: string | null; reservation_date: string | null },
  ev: ClubEvent,
) {
  return r.event_id === ev.event_id ||
    (!r.event_id && matchesEventDate(r.reservation_date, ev.event_starting_date))
}

/** Keep only bookings whose event night (or reservation_date fallback) has not ended vs now */
function isReservationStillInQueue(
  reservation_date: string | null,
  event_starting_date: string | null | undefined,
  event_ending_date?: string | null,
): boolean {
  const ref = (event_ending_date && String(event_ending_date).trim())
    ? event_ending_date
    : event_starting_date && String(event_starting_date).trim()
      ? event_starting_date
    : reservation_date && String(reservation_date).trim()
      ? reservation_date
      : null
  if (!ref) return true
  const d = new Date(ref)
  if (Number.isNaN(d.getTime())) return true

  const isMidnightOnly =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0

  if (isMidnightOnly) {
    d.setHours(23, 59, 59, 999)
  }

  return d.getTime() >= Date.now()
}

function isVIP(t: VenueTable) {
  return t.type === 'VIP' || t.type === 'Premium'
}

// ── Table Grid Card ───────────────────────────────────────────────────────────
function TableGridCard({
  table, activeReserv, eventMode, manualOccupied, onPress,
}: {
  table: VenueTable
  activeReserv: ReservationRow | null
  eventMode: boolean
  manualOccupied?: boolean
  onPress: () => void
}) {
  const vip = isVIP(table)

  // In event mode: reservation data is primary; manual override (Mark Occupied) is secondary.
  // DB table_status is ignored to avoid stale data from previous events.
  const sc = eventMode
    ? activeReserv
      ? activeReserv.status === 'pending' ? '#f59e0b' : COLORS.red
      : manualOccupied
        ? STATUS_COLOR.occupied
        : COLORS.green
    : null

  const gName = activeReserv ? guestNameFromRow(activeReserv) : null

  return (
    <TouchableOpacity
      style={[g.card, vip && g.cardVIP]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {/* Color bar — only shown when event is selected */}
      <View style={[g.bar, { backgroundColor: sc ?? COLORS.border }]} />

      <View style={g.cardBody}>
        {/* Top row: type tag + status dot (event mode only) */}
        <View style={g.cardTop}>
          {vip ? (
            <View style={g.vipTag}>
              <Text style={g.vipTagText}>{table.type}</Text>
            </View>
          ) : (
            <View style={g.typeTag}>
              <Text style={g.typeTagText}>{table.type ?? 'Std'}</Text>
            </View>
          )}
          {eventMode && sc && (
            <View style={[g.statusDot, { backgroundColor: sc }]} />
          )}
        </View>

        {/* Table number */}
        <Text style={g.tableNum} numberOfLines={1}>{table.table_number}</Text>

        {/* Capacity + min spend */}
        <View style={g.capRow}>
          <Ionicons name="people-outline" size={11} color={COLORS.mutedDark} />
          <Text style={g.capText}>{table.seating_capacity}p</Text>
          {table.minimum_spend != null && (
            <Text style={g.spendText}>· €{table.minimum_spend}</Text>
          )}
        </View>

        {/* Sector / location — shown when no event selected */}
        {!eventMode && (table.sector || table.location) && (
          <Text style={g.locationText} numberOfLines={1}>
            {[table.sector, table.location].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Guest name or available/occupied label — event mode only */}
        {eventMode && (
          gName
            ? <Text style={g.guestName} numberOfLines={1}>{gName}</Text>
            : manualOccupied
              ? <Text style={[g.statusLabel, { color: STATUS_COLOR.occupied }]}>Occupied</Text>
              : <Text style={[g.statusLabel, { color: COLORS.green }]}>Available</Text>
        )}

        {/* Reservation status pill — event mode only */}
        {eventMode && activeReserv && (
          <View style={[g.reservPill, { backgroundColor: (activeReserv.status === 'pending' ? '#f59e0b' : COLORS.red) + '22' }]}>
            <Text style={[g.reservPillText, { color: activeReserv.status === 'pending' ? '#f59e0b' : COLORS.red }]}>
              {activeReserv.status === 'pending' ? 'Pending' : 'Reserved'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TablesScreen() {
  const { profile } = useAuth()

  // Core data
  const [events, setEvents]                   = useState<ClubEvent[]>([])
  const [upcomingEvents, setUpcomingEvents]   = useState<ClubEvent[]>([])
  const [pastEvents, setPastEvents]           = useState<ClubEvent[]>([])
  const [tables, setTables]                   = useState<VenueTable[]>([])
  const [flatReservs, setFlatReservs]         = useState<FlatReservation[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)

  // Filters
  const [selectedEvent, setSelectedEvent] = useState<ClubEvent | null>(null)
  const [viewMode, setViewMode]           = useState<'tables' | 'list'>('tables')
  const [statusFilter, setStatusFilter]   = useState<'all' | 'pending' | 'confirmed'>('all')
  const [guestSearch, setGuestSearch]     = useState('')

  // Event picker
  const [showEventPicker, setShowEventPicker] = useState(false)
  const [eventSearch, setEventSearch]         = useState('')
  const [showPastInPicker, setShowPastInPicker] = useState(false)

  // Table detail sheet
  const [detailTable, setDetailTable] = useState<VenueTable | null>(null)

  // Table modal
  const [showTableModal, setShowTableModal] = useState(false)
  const [editingTable, setEditingTable]     = useState<VenueTable | null>(null)
  const [savingTable, setSavingTable]       = useState(false)
  const [tableNumber, setTableNumber]       = useState('')
  const [tableType, setTableType]           = useState('Standard')
  const [capacity, setCapacity]             = useState('')
  const [minSpend, setMinSpend]             = useState('')
  const [sector, setSector]                 = useState('')
  const [location, setLocation]             = useState('')

  const [customType, setCustomType] = useState('')

  const tableNumberRef = useRef(''); const tableTypeRef = useRef('Standard')
  const capacityRef    = useRef(''); const minSpendRef  = useRef('')
  const sectorRef      = useRef(''); const locationRef  = useRef('')
  const customTypeRef  = useRef('')

  function syncTN(v: string) { tableNumberRef.current = v; setTableNumber(v) }
  function syncTT(v: string) { tableTypeRef.current   = v; setTableType(v) }
  function syncCap(v: string){ capacityRef.current    = v; setCapacity(v) }
  function syncMS(v: string) { minSpendRef.current    = v; setMinSpend(v) }
  function syncSec(v: string){ sectorRef.current      = v; setSector(v) }
  function syncLoc(v: string){ locationRef.current    = v; setLocation(v) }
  function syncCT(v: string) { customTypeRef.current  = v; setCustomType(v) }

  // Manual occupied overrides for current event session (cleared on event change)
  const [eventOccupied, setEventOccupied] = useState<Record<string, boolean>>({})

  // Edit reservation modal
  const [showReservModal, setShowReservModal] = useState(false)
  const [editingReserv, setEditingReserv]     = useState<ReservationRow | FlatReservation | null>(null)
  const [reservStatus, setReservStatus]       = useState<'pending' | 'confirmed' | 'cancelled' | 'completed'>('pending')
  const [reservNotes, setReservNotes]         = useState('')
  const [reservGuestCount, setReservGuestCount] = useState(1)
  const [reservTableId, setReservTableId]     = useState<string | null>(null)
  const [savingReserv, setSavingReserv]       = useState(false)

  // Create reservation modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createEventId, setCreateEventId]     = useState('')
  const [createTableId, setCreateTableId]     = useState('')
  const [createGuestName, setCreateGuestName] = useState('')
  const [createGuests, setCreateGuests]       = useState('2')
  const [createDate, setCreateDate]           = useState('')
  const [createNotes, setCreateNotes]         = useState('')
  const [savingCreate, setSavingCreate]       = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    const clubId = profile.club_id

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    const [evUpcomingRes, evPastRes, tbRes] = await Promise.all([
      supabase
        .from('events')
        .select('event_id, event_name, event_starting_date, event_ending_date')
        .eq('club_id', clubId)
        .eq('event_status', 'published')
        .gte('event_starting_date', todayIso)
        .order('event_starting_date', { ascending: true }),
      supabase
        .from('events')
        .select('event_id, event_name, event_starting_date, event_ending_date')
        .eq('club_id', clubId)
        .eq('event_status', 'published')
        .lt('event_starting_date', todayIso)
        .order('event_starting_date', { ascending: false })
        .limit(20),
      supabase
        .from('tables')
        .select(`
          id, table_number, seating_capacity, minimum_spend,
          sector, location, type, table_status,
          reservations(
            reservation_id, status, nr_of_people, reservation_date, notes, event_id,
            profiles(name, surname),
            events:event_id(event_name)
          )
        `)
        .eq('club_id', clubId)
        .order('table_number', { ascending: true }),
    ])

    const upcomingEvs = (evUpcomingRes.data ?? []) as ClubEvent[]
    const pastEvs     = (evPastRes.data ?? []) as ClubEvent[]
    setUpcomingEvents(upcomingEvs)
    setPastEvents(pastEvs)
    // Combined for the picker (upcoming first, then past)
    setEvents([...upcomingEvs, ...pastEvs])

    const normalized = ((tbRes.data ?? []) as any[]).map(t => ({
      ...t,
      reservations: ((t.reservations ?? []) as ReservationRow[])
        .filter(r => r.status === 'pending' || r.status === 'confirmed')
        .sort((a, b) => {
          const o: Record<string, number> = { confirmed: 0, pending: 1 }
          return (o[a.status] ?? 2) - (o[b.status] ?? 2)
        }),
    })) as VenueTable[]
    setTables(normalized)

    // Rebuild occupied overrides from DB so manual "Mark Occupied" persists across refreshes
    const occupiedFromDB: Record<string, boolean> = {}
    for (const t of normalized) {
      if (t.table_status === 'occupied') occupiedFromDB[t.id] = true
    }
    setEventOccupied(occupiedFromDB)

    const tableIds = normalized.map(t => t.id)
    if (tableIds.length > 0) {
      await fetchFlatReservs(tableIds)
    } else {
      setFlatReservs([])
    }

    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  async function fetchFlatReservs(tableIds: string[]) {
    if (!profile?.club_id) return

    // Get event IDs for this club so we can find ALL reservations, not just ones with tables
    const { data: clubEvents } = await supabase
      .from('events')
      .select('event_id')
      .eq('club_id', profile.club_id)
    const clubEventIds = (clubEvents ?? []).map((e: any) => e.event_id)

    const selectClause = `
      reservation_id, type, status, nr_of_people, reservation_date, notes, event_id, table_id,
      profiles(name, surname),
      events:event_id(event_name, event_starting_date, event_ending_date),
      tables:table_id(table_number)
    `

    const queries = []
    if (clubEventIds.length > 0) {
      queries.push(
        supabase
          .from('reservations')
          .select(selectClause)
          .in('status', ['pending', 'confirmed'])
          .in('event_id', clubEventIds)
          .order('created_at', { ascending: false }),
      )
    }
    if (tableIds.length > 0) {
      queries.push(
        supabase
          .from('reservations')
          .select(selectClause)
          .in('status', ['pending', 'confirmed'])
          .in('table_id', tableIds)
          .order('created_at', { ascending: false }),
      )
    }
    if (queries.length === 0) {
      setFlatReservs([])
      return
    }

    const results = await Promise.all(queries)
    const byId = new Map<string, any>()
    for (const result of results) {
      for (const row of result.data ?? []) byId.set(row.reservation_id, row)
    }

    const rawRows = Array.from(byId.values())
    const scopedRows = selectedEvent
      ? rawRows.filter(r => reservationMatchesEvent(r, selectedEvent))
      : rawRows

    const items: FlatReservation[] = (scopedRows as any[])
      .map(r => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        const ev = Array.isArray(r.events) ? r.events[0] : r.events
        const tb = Array.isArray(r.tables) ? r.tables[0] : r.tables
        const fallbackEvent = selectedEvent && !r.event_id && matchesEventDate(r.reservation_date, selectedEvent.event_starting_date)
          ? selectedEvent
          : null
        return {
          reservation_id:    r.reservation_id,
          type:               r.type,
          status:             r.status,
          nr_of_people:       r.nr_of_people,
          reservation_date:   r.reservation_date,
          notes:              r.notes,
          event_id:           r.event_id,
          guest_name:         [prof?.name, prof?.surname].filter(Boolean).join(' ') || 'Guest',
          event_name:         ev?.event_name ?? fallbackEvent?.event_name ?? null,
          event_starting_date: (ev?.event_starting_date as string | undefined) ?? fallbackEvent?.event_starting_date ?? null,
          event_ending_date:   (ev?.event_ending_date as string | undefined) ?? fallbackEvent?.event_ending_date ?? null,
          table_number:       tb?.table_number ?? null,
          table_id:           r.table_id,
        }
      })
      .filter(r => isReservationStillInQueue(r.reservation_date, r.event_starting_date, r.event_ending_date))
    setFlatReservs(items)
  }

  useFocusEffect(useCallback(() => { setLoading(true); fetchAll() }, [fetchAll]))

  useEffect(() => {
    fetchFlatReservs(tables.map(t => t.id))
  }, [selectedEvent])

  const onRefresh = () => { setRefreshing(true); fetchAll() }

  // ── Derived / filtered ────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    if (!selectedEvent) return tables

    const withEventReserv = tables.map(t => ({
      ...t,
      reservations: t.reservations.filter(r => reservationMatchesEvent(r, selectedEvent)),
    }))

    // Available tables first, then those with a reservation for this event
    return [...withEventReserv].sort((a, b) => {
      const aReserved = a.reservations.length > 0
      const bReserved = b.reservations.length > 0
      if (!aReserved && bReserved) return -1
      if (aReserved && !bReserved) return 1
      return 0
    })
  }, [tables, selectedEvent])

  // Grouped by type — used only when no event is selected
  const tablesByType = useMemo(() => {
    if (selectedEvent) return null
    // Normalize to title-case so "standard" and "Standard" collapse into one group
    const normalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    const TYPE_ORDER = ['VIP', 'Premium', 'Lounge', 'Standard']
    const seen = new Set<string>()
    const normalized = tables.map(t => normalize(t.type ?? 'Standard'))
    const allTypes = [
      ...TYPE_ORDER.filter(o => normalized.some(n => n === o)),
      ...Array.from(new Set(normalized)).filter(t => !TYPE_ORDER.includes(t)),
    ].filter(t => { if (seen.has(t)) return false; seen.add(t); return true })
    return allTypes.map(type => ({
      type,
      tables: tables.filter(t => normalize(t.type ?? 'Standard') === type),
    })).filter(g => g.tables.length > 0)
  }, [tables, selectedEvent])

  const scopedReservs = useMemo(() => {
    let list = flatReservs
    if (selectedEvent) list = list.filter(r => reservationMatchesEvent(r, selectedEvent))
    return list.filter(r => isReservationStillInQueue(r.reservation_date, r.event_starting_date, r.event_ending_date))
  }, [flatReservs, selectedEvent])

  const filteredReservs = useMemo(() => {
    let list = scopedReservs
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
    if (guestSearch.trim()) {
      const q = guestSearch.toLowerCase()
      list = list.filter(r => r.guest_name.toLowerCase().includes(q))
    }
    return list
  }, [scopedReservs, statusFilter, guestSearch])

  const pickerEvents = useMemo(() => {
    const search = eventSearch.trim().toLowerCase()
    const match = (e: ClubEvent) => !search || e.event_name.toLowerCase().includes(search)
    return {
      upcoming: upcomingEvents.filter(match),
      past:     pastEvents.filter(match),
    }
  }, [upcomingEvents, pastEvents, eventSearch])

  // Active reservation for a table — only shown when an event is selected
  function getActiveReserv(table: VenueTable): ReservationRow | null {
    if (!selectedEvent) return null
    return table.reservations.find(r => reservationMatchesEvent(r, selectedEvent)) ?? null
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = filteredTables.length
    if (!selectedEvent) {
      return { total, available: 0, reserved: 0, occupied: 0, occupancy: 0 }
    }
    // Derive purely from reservations for that event + manual overrides (not stale table_status)
    const reserved  = filteredTables.filter(t => t.reservations[0]?.status === 'pending').length
    const occupied  = filteredTables.filter(t =>
      t.reservations[0]?.status === 'confirmed' || eventOccupied[t.id] === true
    ).length
    const available = total - reserved - occupied
    const occupancy = total > 0 ? Math.round(((reserved + occupied) / total) * 100) : 0
    return { total, available: Math.max(available, 0), reserved, occupied, occupancy }
  }, [filteredTables, selectedEvent, eventOccupied])

  // Tonight = nearest future event
  function selectTonight() {
    const upcoming = [...events]
      .filter(e => isReservationStillInQueue(null, e.event_starting_date, e.event_ending_date))
      .sort((a, b) => new Date(a.event_starting_date).getTime() - new Date(b.event_starting_date).getTime())
    if (upcoming.length > 0) setSelectedEvent(upcoming[0])
    else if (events.length > 0) setSelectedEvent(events[0])
  }

  // ── Table CRUD ─────────────────────────────────────────────────────────────
  function resetTableForm() {
    syncTN(''); syncTT('Standard'); syncCap(''); syncMS(''); syncSec(''); syncLoc('')
    syncCT('')
  }

  function openAddTable() { resetTableForm(); setEditingTable(null); setShowTableModal(true) }

  function openEditTable(t: VenueTable) {
    syncTN(t.table_number)
    const existingType = t.type ?? 'Standard'
    if (PRESET_TYPES.includes(existingType)) {
      syncTT(existingType); syncCT('')
    } else {
      syncTT('__custom__'); syncCT(existingType)
    }
    syncCap(String(t.seating_capacity)); syncMS(t.minimum_spend != null ? String(t.minimum_spend) : '')
    syncSec(t.sector ?? ''); syncLoc(t.location ?? '')
    setEditingTable(t); setShowTableModal(true)
  }

  async function handleSaveTable() {
    const num = tableNumberRef.current.trim()
    if (!num) { Alert.alert('Required', 'Table name/number is required.'); return }
    if (!profile?.club_id) return
    setSavingTable(true)
    const resolvedType = tableTypeRef.current === '__custom__'
      ? (customTypeRef.current.trim() || 'Standard')
      : tableTypeRef.current
    const payload = {
      table_number:     num,
      type:             resolvedType,
      seating_capacity: parseInt(capacityRef.current) || 2,
      minimum_spend:    minSpendRef.current ? parseFloat(minSpendRef.current) : null,
      sector:           sectorRef.current.trim() || null,
      location:         locationRef.current.trim() || null,
    }
    if (editingTable) {
      const { error } = await supabase.from('tables').update(payload).eq('id', editingTable.id)
      setSavingTable(false)
      if (error) { Alert.alert('Error', error.message); return }
      setTables(prev => prev.map(t => t.id === editingTable.id ? { ...t, ...payload } : t))
    } else {
      const { data, error } = await supabase
        .from('tables')
        .insert({ ...payload, club_id: profile.club_id, table_status: 'available' })
        .select('id, table_number, seating_capacity, minimum_spend, sector, location, type, table_status')
        .single()
      setSavingTable(false)
      if (error) { Alert.alert('Error', error.message); return }
      if (data) setTables(prev => [...prev, { ...(data as any), reservations: [] }])
    }
    resetTableForm(); setShowTableModal(false); setEditingTable(null)
  }

  async function handleDeleteTable(id: string, name: string) {
    Alert.alert('Remove Table', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('tables').delete().eq('id', id)
          if (error) { Alert.alert('Error', error.message); return }
          setTables(prev => prev.filter(t => t.id !== id))
        },
      },
    ])
  }

  async function handleStatusChange(table: VenueTable, next: VenueTable['table_status']) {
    const { error } = await supabase.from('tables').update({ table_status: next }).eq('id', table.id)
    if (error) { Alert.alert('Error', error.message); return }
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, table_status: next } : t))
    if (detailTable?.id === table.id) setDetailTable(prev => prev ? { ...prev, table_status: next } : null)
    // Track manual override so event-mode cards reflect the change without stale DB data confusion
    if (selectedEvent) {
      setEventOccupied(prev => ({ ...prev, [table.id]: next === 'occupied' }))
    }
  }

  // ── Edit reservation ───────────────────────────────────────────────────────
  function openEditReserv(r: ReservationRow | FlatReservation) {
    setEditingReserv(r); setReservStatus(r.status); setReservNotes(r.notes ?? '')
    setReservGuestCount(r.nr_of_people ?? 1)
    setReservTableId('table_id' in r ? r.table_id : null)
    setShowReservModal(true)
  }

  async function handleSaveReserv() {
    if (!editingReserv) return
    setSavingReserv(true)

    const oldTableId = 'table_id' in editingReserv ? editingReserv.table_id : null
    const tableChanged = reservTableId !== oldTableId
    const guestChanged = reservGuestCount !== (editingReserv.nr_of_people ?? 1)

    // Free old table if reassigning
    if (tableChanged && oldTableId) {
      await supabase.from('tables').update({ table_status: 'available' }).eq('id', oldTableId)
    }
    // Mark new table as reserved
    if (tableChanged && reservTableId) {
      await supabase.from('tables').update({ table_status: 'reserved' }).eq('id', reservTableId)
    }

    const updates: any = { status: reservStatus, notes: reservNotes.trim() || null }
    if (tableChanged) updates.table_id = reservTableId
    if (guestChanged) updates.nr_of_people = reservGuestCount

    const { error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('reservation_id', editingReserv.reservation_id)
    setSavingReserv(false)
    if (error) { Alert.alert('Error', error.message); return }

    const newTableNum = reservTableId ? tables.find(t => t.id === reservTableId)?.table_number ?? null : null
    setTables(prev => prev.map(t => ({
      ...t,
      reservations: t.reservations
        .map(r => r.reservation_id === editingReserv.reservation_id
          ? { ...r, status: reservStatus, notes: reservNotes.trim() || null, nr_of_people: reservGuestCount }
          : r
        )
        .filter(r => r.status === 'pending' || r.status === 'confirmed'),
    })))
    setFlatReservs(prev => prev.map(r =>
      r.reservation_id === editingReserv.reservation_id
        ? { ...r, status: reservStatus, notes: reservNotes.trim() || null, nr_of_people: reservGuestCount, table_id: reservTableId, table_number: newTableNum }
        : r
    ))
    setShowReservModal(false); setEditingReserv(null)
  }

  // ── Create reservation ─────────────────────────────────────────────────────
  function autoAssignTable(guestCount: number, currentTableId?: string): string {
    const count = guestCount || 1
    const available = tables
      .filter(t => t.table_status === 'available' && t.seating_capacity >= count)
      .sort((a, b) => a.seating_capacity - b.seating_capacity)
    return available.length > 0 ? available[0].id : (currentTableId ?? '')
  }

  function handleGuestsChange(val: string) {
    setCreateGuests(val)
    const n = parseInt(val)
    if (n > 0) setCreateTableId(autoAssignTable(n, createTableId))
  }

  function openCreateReservForTable(table?: VenueTable) {
    setCreateEventId(selectedEvent?.event_id ?? '')
    setCreateDate(selectedEvent?.event_starting_date?.split('T')[0] ?? '')
    setCreateGuestName(''); setCreateNotes('')
    const defaultGuests = 2
    setCreateGuests(String(defaultGuests))
    setCreateTableId(table?.id ?? autoAssignTable(defaultGuests))
    setShowCreateModal(true)
  }

  async function handleCreateReserv() {
    if (!createTableId) { Alert.alert('Required', 'Please select a table.'); return }
    if (!createEventId) { Alert.alert('Required', 'Please select an event.'); return }
    setSavingCreate(true)
    const notesParts = [
      createGuestName.trim() ? `Walk-in: ${createGuestName.trim()}` : null,
      createNotes.trim() || null,
    ].filter(Boolean)
    const { error } = await supabase
      .from('reservations')
      .insert({
        event_id:         createEventId,
        table_id:         createTableId,
        type:             'table',
        status:           'pending',
        nr_of_people:     parseInt(createGuests) || 1,
        reservation_date: createDate || null,
        notes:            notesParts.join('\n') || null,
      })
    if (!error) {
      await supabase.from('tables')
        .update({ table_status: 'reserved' })
        .eq('id', createTableId)
        .eq('table_status', 'available')
    }
    setSavingCreate(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('Done', 'Reservation created.')
    setShowCreateModal(false)
    setDetailTable(null)
    fetchAll()
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const cardW = (SCREEN_W - SPACING.md * 2 - SPACING.sm) / 2

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={s.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Party<Text style={{ color: COLORS.purple }}>On</Text></Text>
          <Text style={s.appSub}>Manager Portal</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openAddTable}>
          <Ionicons name="add" size={15} color="#fff" />
          <Text style={s.addBtnText}>Add Table</Text>
        </TouchableOpacity>
      </View>

      {/* ── Event filter bar ── */}
      <View style={s.filterBar}>
        <TouchableOpacity
          style={[s.eventPill, selectedEvent && s.eventPillActive]}
          onPress={() => { setEventSearch(''); setShowPastInPicker(false); setShowEventPicker(true) }}
        >
          <Ionicons name="calendar-outline" size={13} color={selectedEvent ? COLORS.purple : COLORS.mutedDark} />
          <Text style={[s.eventPillText, selectedEvent && s.eventPillTextActive]} numberOfLines={1}>
            {selectedEvent ? selectedEvent.event_name : 'All Events'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={selectedEvent ? COLORS.purple : COLORS.mutedDark} />
        </TouchableOpacity>

        {selectedEvent ? (
          <TouchableOpacity style={s.clearEvent} onPress={() => setSelectedEvent(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.tonightBtn} onPress={selectTonight}>
            <Ionicons name="moon-outline" size={12} color={COLORS.purple} />
            <Text style={s.tonightBtnText}>Tonight</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.createBtn} onPress={() => openCreateReservForTable()}>
          <Ionicons name="person-add-outline" size={13} color={COLORS.purpleDark} />
          <Text style={s.createBtnText}>Reserve</Text>
        </TouchableOpacity>
      </View>

      {/* ── View mode toggle ── */}
      <View style={s.modeToggle}>
        <TouchableOpacity
          style={[s.modeBtn, viewMode === 'tables' && s.modeBtnActive]}
          onPress={() => setViewMode('tables')}
        >
          <Ionicons name="grid-outline" size={13} color={viewMode === 'tables' ? COLORS.white : COLORS.mutedDark} />
          <Text style={[s.modeBtnText, viewMode === 'tables' && s.modeBtnTextActive]}>
            Floor ({filteredTables.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeBtn, viewMode === 'list' && s.modeBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons name="list-outline" size={13} color={viewMode === 'list' ? COLORS.white : COLORS.mutedDark} />
          <Text style={[s.modeBtnText, viewMode === 'list' && s.modeBtnTextActive]}>
            Reservations ({flatReservs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ════════════ FLOOR VIEW (2-col grid) ════════════ */}
      {viewMode === 'tables' && (
        <ScrollView
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
        >
          {/* Stats strip + legend — only when an event is selected */}
          {selectedEvent && (
            <>
              <View style={s.statsStrip}>
                {([
                  [stats.total,     COLORS.white,  'Tables'],
                  [stats.available, COLORS.green,  'Free'],
                  [stats.reserved,  '#f59e0b',     'Reserved'],
                  [stats.occupied,  COLORS.red,    'Occupied'],
                ] as [number, string, string][]).map(([n, c, l]) => (
                  <View key={l} style={s.statPill}>
                    <Text style={[s.statNum, { color: c }]}>{n}</Text>
                    <Text style={s.statLabel}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={s.legend}>
                {([
                  ['Free',     COLORS.green],
                  ['Reserved', '#f59e0b'],
                  ['Occupied', COLORS.red],
                  ['VIP',      COLORS.purple],
                ] as [string, string][]).map(([l, c]) => (
                  <View key={l} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: c }]} />
                    <Text style={s.legendText}>{l}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {tables.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="restaurant-outline" size={52} color={COLORS.mutedDark} />
              <Text style={s.emptyTitle}>No tables yet</Text>
              <Text style={s.emptySub}>Add your venue tables so guests can make reservations.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openAddTable}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add First Table</Text>
              </TouchableOpacity>
            </View>
          ) : tablesByType ? (
            /* ── No event: grouped by type ── */
            <>
              {tablesByType.map(group => (
                <View key={group.type} style={s.typeGroup}>
                  <View style={s.typeGroupHeader}>
                    <Text style={s.typeGroupTitle}>{group.type}</Text>
                    <Text style={s.typeGroupCount}>{group.tables.length}</Text>
                  </View>
                  <View style={s.grid}>
                    {group.tables.map(table => (
                      <View key={table.id} style={{ width: cardW }}>
                        <TableGridCard
                          table={table}
                          activeReserv={null}
                          eventMode={false}
                          onPress={() => setDetailTable(table)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.addMore} onPress={openAddTable}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.purple} />
                <Text style={s.addMoreText}>Add Table</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ── Event selected: sorted flat grid ── */
            <>
              <View style={s.grid}>
                {filteredTables.map(table => (
                  <View key={table.id} style={{ width: cardW }}>
                    <TableGridCard
                      table={table}
                      activeReserv={getActiveReserv(table)}
                      eventMode={true}
                      manualOccupied={eventOccupied[table.id] === true}
                      onPress={() => setDetailTable(table)}
                    />
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.addMore} onPress={openAddTable}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.purple} />
                <Text style={s.addMoreText}>Add Table</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ════════════ RESERVATIONS LIST VIEW ════════════ */}
      {viewMode === 'list' && (
        <View style={{ flex: 1 }}>
          <View style={s.listControls}>
            <View style={s.searchBar}>
              <Ionicons name="search-outline" size={14} color={COLORS.mutedDark} />
              <TextInput
                style={s.searchInput}
                placeholder="Search guest name…"
                placeholderTextColor={COLORS.mutedDark}
                value={guestSearch}
                onChangeText={setGuestSearch}
                autoCorrect={false}
              />
              {guestSearch.length > 0 && (
                <TouchableOpacity onPress={() => setGuestSearch('')} hitSlop={6}>
                  <Ionicons name="close-circle" size={14} color={COLORS.mutedDark} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipScroll}
            contentContainerStyle={s.chipContent}
          >
            {(['all', 'pending', 'confirmed'] as const).map(st => (
              <TouchableOpacity
                key={st}
                style={[s.chip, statusFilter === st && s.chipActive]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[s.chipText, statusFilter === st && s.chipTextActive]}>
                  {st === 'all' ? `All (${scopedReservs.length})` : st.charAt(0).toUpperCase() + st.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.queueHint}>
            Upcoming bookings only — past reservations are not shown here.
          </Text>

          <FlatList
            data={filteredReservs}
            keyExtractor={r => r.reservation_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
            contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="receipt-outline" size={48} color={COLORS.mutedDark} />
                <Text style={s.emptyTitle}>No reservations found</Text>
                <Text style={s.emptySub}>
                  {selectedEvent ? `No reservations for "${selectedEvent.event_name}"` : 'Try selecting an event or adjusting filters'}
                </Text>
              </View>
            }
            renderItem={({ item: r }) => {
              const sc = RESERV_COLOR[r.status]
              return (
                <TouchableOpacity
                  style={s.reservCard}
                  onPress={() => openEditReserv(r as any)}
                  activeOpacity={0.82}
                >
                  <View style={[s.reservCardAccent, { backgroundColor: sc }]} />
                  <View style={s.reservCardInner}>
                    <View style={s.reservCardTop}>
                      <View style={s.guestAvatar}>
                        <Text style={s.guestAvatarText}>{r.guest_name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reservCardName}>{r.guest_name}</Text>
                        <Text style={s.reservCardSub} numberOfLines={1}>
                          {[r.table_number ? `Table ${r.table_number}` : null, r.event_name].filter(Boolean).join(' · ')}
                        </Text>
                        {r.reservation_date && (
                          <Text style={s.reservCardDate}>{fmtShort(r.reservation_date)}</Text>
                        )}
                      </View>
                      <View style={s.reservCardRight}>
                        {r.nr_of_people != null && (
                          <View style={s.guestCountBadge}>
                            <Ionicons name="people-outline" size={11} color={COLORS.mutedDark} />
                            <Text style={s.guestCountText}>{r.nr_of_people}</Text>
                          </View>
                        )}
                        <View style={[s.reservStatusBadge, { backgroundColor: sc + '22' }]}>
                          <Text style={[s.reservStatusText, { color: sc }]}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {r.notes && (
                      <Text style={s.reservCardNotes} numberOfLines={1}>{r.notes}</Text>
                    )}

                    <View style={s.reservCardActions}>
                      {r.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            style={s.confirmBtn}
                            onPress={() => { openEditReserv(r as any) }}
                          >
                            <Ionicons name="checkmark-outline" size={12} color={COLORS.green} />
                            <Text style={[s.actionBtnText, { color: COLORS.green }]}>Confirm</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.declineBtn}
                            onPress={() => { openEditReserv(r as any) }}
                          >
                            <Text style={[s.actionBtnText, { color: COLORS.red }]}>Decline</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {r.status === 'confirmed' && (
                        <TouchableOpacity
                          style={s.completeBtn}
                          onPress={() => { openEditReserv(r as any) }}
                        >
                          <Ionicons name="checkmark-done-outline" size={12} color={COLORS.purple} />
                          <Text style={[s.actionBtnText, { color: COLORS.purple }]}>Complete</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.editBtn} onPress={() => openEditReserv(r as any)}>
                        <Ionicons name="create-outline" size={12} color={COLORS.muted} />
                        <Text style={[s.actionBtnText, { color: COLORS.muted }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            }}
          />
        </View>
      )}

      {/* ══════════ TABLE DETAIL SHEET ══════════ */}
      <Modal
        visible={!!detailTable}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailTable(null)}
      >
        <Pressable style={m.overlay} onPress={() => setDetailTable(null)}>
          <Pressable style={m.sheet} onPress={() => {}}>
            {detailTable && (() => {
              const t = detailTable
              const vip = isVIP(t)
              const activeReserv = getActiveReserv(t)
              const gName = activeReserv ? guestNameFromRow(activeReserv) : null

              // Derive effective status the same way cards do — never read stale table_status in event mode
              const effectiveStatus: VenueTable['table_status'] = selectedEvent
                ? activeReserv
                  ? (activeReserv.status === 'confirmed' ? 'occupied' : activeReserv.status === 'pending' ? 'reserved' : 'available')
                  : eventOccupied[t.id] ? 'occupied' : 'available'
                : t.table_status

              const sc = vip && effectiveStatus === 'available' ? COLORS.purple : (STATUS_COLOR[effectiveStatus] ?? COLORS.muted)

              return (
                <>
                  <View style={m.handle} />

                  {/* Table identity */}
                  <View style={m.detailHeader}>
                    <View style={[m.detailColorBar, { backgroundColor: sc }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                        {vip && <View style={m.vipTag}><Text style={m.vipTagText}>{t.type}</Text></View>}
                        <Text style={m.detailTableName}>{t.table_number}</Text>
                      </View>
                      <Text style={m.detailMeta}>
                        {t.seating_capacity} seats
                        {t.minimum_spend != null ? ` · Min €${t.minimum_spend}` : ''}
                        {(t.sector || t.location) ? ` · ${[t.sector, t.location].filter(Boolean).join(', ')}` : ''}
                      </Text>
                    </View>
                    <View style={[m.statusBadge, { backgroundColor: sc + '22' }]}>
                      <View style={[m.statusDot, { backgroundColor: sc }]} />
                      <Text style={[m.statusText, { color: sc }]}>
                        {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={m.divider} />

                  {/* Reservation info */}
                  {activeReserv ? (
                    <View style={m.reservInfo}>
                      <View style={m.reservInfoTop}>
                        <View style={m.guestAvatarLg}>
                          <Text style={m.guestAvatarLgText}>{(gName ?? '?').charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={m.guestNameLg}>{gName}</Text>
                          {activeReserv.events?.event_name && (
                            <Text style={m.guestEventText} numberOfLines={1}>{activeReserv.events.event_name}</Text>
                          )}
                          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: 4 }}>
                            {activeReserv.nr_of_people != null && (
                              <Text style={m.reservMeta}>👥 {activeReserv.nr_of_people} guests</Text>
                            )}
                            {activeReserv.reservation_date && (
                              <Text style={m.reservMeta}>📅 {fmt(activeReserv.reservation_date)}</Text>
                            )}
                          </View>
                        </View>
                        <View style={[m.reservStatusBadge, { backgroundColor: RESERV_COLOR[activeReserv.status] + '22' }]}>
                          <Text style={[m.reservStatusText, { color: RESERV_COLOR[activeReserv.status] }]}>
                            {activeReserv.status.charAt(0).toUpperCase() + activeReserv.status.slice(1)}
                          </Text>
                        </View>
                      </View>
                      {activeReserv.notes && (
                        <Text style={m.reservNotes}>{activeReserv.notes}</Text>
                      )}
                    </View>
                  ) : (
                    <View style={m.noReservBox}>
                      <Ionicons name="calendar-outline" size={22} color={COLORS.mutedDark} />
                      <Text style={m.noReservText}>
                        {selectedEvent ? `No reservation for "${selectedEvent.event_name}"` : 'No active reservation'}
                      </Text>
                    </View>
                  )}

                  <View style={m.divider} />

                  {/* Quick actions */}
                  <View style={m.actionGrid}>
                    {/* Status actions */}
                    {effectiveStatus === 'available' && (
                      <TouchableOpacity
                        style={[m.actionBtn, { backgroundColor: COLORS.red + '18', borderColor: COLORS.red + '40' }]}
                        onPress={() => handleStatusChange(t, 'occupied')}
                      >
                        <Ionicons name="lock-closed-outline" size={15} color={COLORS.red} />
                        <Text style={[m.actionBtnText, { color: COLORS.red }]}>Mark Occupied</Text>
                      </TouchableOpacity>
                    )}
                    {effectiveStatus === 'occupied' && (
                      <TouchableOpacity
                        style={[m.actionBtn, { backgroundColor: COLORS.green + '18', borderColor: COLORS.green + '40' }]}
                        onPress={() => handleStatusChange(t, 'available')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.green} />
                        <Text style={[m.actionBtnText, { color: COLORS.green }]}>Mark Free</Text>
                      </TouchableOpacity>
                    )}
                    {effectiveStatus === 'reserved' && (
                      <TouchableOpacity
                        style={[m.actionBtn, { backgroundColor: COLORS.green + '18', borderColor: COLORS.green + '40' }]}
                        onPress={() => handleStatusChange(t, 'occupied')}
                      >
                        <Ionicons name="enter-outline" size={15} color={COLORS.green} />
                        <Text style={[m.actionBtnText, { color: COLORS.green }]}>Check In</Text>
                      </TouchableOpacity>
                    )}

                    {/* Reservation actions */}
                    {activeReserv && (
                      <TouchableOpacity
                        style={[m.actionBtn, { backgroundColor: COLORS.purple + '18', borderColor: COLORS.purple + '40' }]}
                        onPress={() => { openEditReserv(activeReserv); setDetailTable(null) }}
                      >
                        <Ionicons name="create-outline" size={15} color={COLORS.purple} />
                        <Text style={[m.actionBtnText, { color: COLORS.purple }]}>Edit Reservation</Text>
                      </TouchableOpacity>
                    )}

                    {!activeReserv && (
                      <TouchableOpacity
                        style={[m.actionBtn, { backgroundColor: COLORS.purple + '18', borderColor: COLORS.purple + '40' }]}
                        onPress={() => { setDetailTable(null); openCreateReservForTable(t) }}
                      >
                        <Ionicons name="person-add-outline" size={15} color={COLORS.purple} />
                        <Text style={[m.actionBtnText, { color: COLORS.purple }]}>Create Reservation</Text>
                      </TouchableOpacity>
                    )}

                    {/* Table management */}
                    <TouchableOpacity
                      style={[m.actionBtn, m.actionBtnMuted]}
                      onPress={() => { setDetailTable(null); openEditTable(t) }}
                    >
                      <Ionicons name="pencil-outline" size={15} color={COLORS.muted} />
                      <Text style={[m.actionBtnText, { color: COLORS.muted }]}>Edit Table</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[m.actionBtn, { backgroundColor: COLORS.red + '10', borderColor: COLORS.red + '30' }]}
                      onPress={() => { setDetailTable(null); handleDeleteTable(t.id, t.table_number) }}
                    >
                      <Ionicons name="trash-outline" size={15} color={COLORS.red} />
                      <Text style={[m.actionBtnText, { color: COLORS.red }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
                </>
              )
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════ EVENT PICKER MODAL ══════════ */}
      <Modal visible={showEventPicker} transparent animationType="slide" onRequestClose={() => setShowEventPicker(false)}>
        <Pressable style={m.overlay} onPress={() => setShowEventPicker(false)}>
          <Pressable style={m.sheet} onPress={() => {}}>
            <View style={m.handle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Select Event</Text>
              <TouchableOpacity onPress={() => setShowEventPicker(false)} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <View style={m.searchWrap}>
              <Ionicons name="search-outline" size={14} color={COLORS.mutedDark} />
              <TextInput
                style={m.searchInput}
                placeholder="Search events…"
                placeholderTextColor={COLORS.mutedDark}
                value={eventSearch}
                onChangeText={setEventSearch}
                autoCorrect={false}
              />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* All events row */}
              <TouchableOpacity
                style={[m.eventRow, !selectedEvent && m.eventRowActive]}
                onPress={() => { setSelectedEvent(null); setShowEventPicker(false) }}
              >
                <Ionicons name="calendar-outline" size={16} color={!selectedEvent ? COLORS.purple : COLORS.mutedDark} />
                <Text style={[m.eventRowText, !selectedEvent && m.eventRowTextActive]}>All Events</Text>
                {!selectedEvent && <Ionicons name="checkmark" size={16} color={COLORS.purple} />}
              </TouchableOpacity>

              {/* Upcoming events */}
              {pickerEvents.upcoming.length > 0 && (
                <Text style={m.pickerSectionLabel}>Upcoming</Text>
              )}
              {pickerEvents.upcoming.map(ev => {
                const isSel = selectedEvent?.event_id === ev.event_id
                return (
                  <TouchableOpacity
                    key={ev.event_id}
                    style={[m.eventRow, isSel && m.eventRowActive]}
                    onPress={() => { setSelectedEvent(ev); setShowEventPicker(false) }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[m.eventRowText, isSel && m.eventRowTextActive]} numberOfLines={1}>{ev.event_name}</Text>
                      <Text style={m.eventRowDate}>{fmtShort(ev.event_starting_date)}</Text>
                    </View>
                    {isSel && <Ionicons name="checkmark" size={16} color={COLORS.purple} />}
                  </TouchableOpacity>
                )
              })}
              {pickerEvents.upcoming.length === 0 && !eventSearch && (
                <Text style={m.pickerEmptyText}>No upcoming events</Text>
              )}

              {/* Past events toggle */}
              {pickerEvents.past.length > 0 && (
                <TouchableOpacity
                  style={m.pastToggleRow}
                  onPress={() => setShowPastInPicker(p => !p)}
                >
                  <Ionicons name="time-outline" size={14} color={COLORS.mutedDark} />
                  <Text style={m.pastToggleText}>Past Events ({pickerEvents.past.length})</Text>
                  <Ionicons
                    name={showPastInPicker ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={COLORS.mutedDark}
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
              )}
              {showPastInPicker && pickerEvents.past.map(ev => {
                const isSel = selectedEvent?.event_id === ev.event_id
                return (
                  <TouchableOpacity
                    key={ev.event_id}
                    style={[m.eventRow, m.eventRowPast, isSel && m.eventRowActive]}
                    onPress={() => { setSelectedEvent(ev); setShowEventPicker(false) }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[m.eventRowText, { color: COLORS.muted }, isSel && m.eventRowTextActive]} numberOfLines={1}>
                        {ev.event_name}
                      </Text>
                      <Text style={m.eventRowDate}>{fmtShort(ev.event_starting_date)}</Text>
                    </View>
                    {isSel && <Ionicons name="checkmark" size={16} color={COLORS.purple} />}
                  </TouchableOpacity>
                )
              })}

              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════ ADD / EDIT TABLE MODAL ══════════ */}
      <Modal
        visible={showTableModal} animationType="slide" transparent
        onRequestClose={() => { resetTableForm(); setShowTableModal(false); setEditingTable(null) }}
      >
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1}
            onPress={() => { resetTableForm(); setShowTableModal(false); setEditingTable(null) }} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>{editingTable ? 'Edit Table' : 'Add New Table'}</Text>
              <TouchableOpacity onPress={() => { resetTableForm(); setShowTableModal(false); setEditingTable(null) }} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={m.label}>Table Name / Number *</Text>
              <TextInput style={m.input} value={tableNumber} onChangeText={syncTN}
                placeholder="e.g. Table 1, VIP-A" placeholderTextColor={COLORS.mutedDark} />

              <Text style={m.label}>Category</Text>
              <View style={m.pillRow}>
                {PRESET_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[m.pill, tableType === t && m.pillActive]} onPress={() => { syncTT(t); syncCT('') }}>
                    <Text style={[m.pillText, tableType === t && m.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[m.pill, tableType === '__custom__' && m.pillActive]}
                  onPress={() => syncTT('__custom__')}
                >
                  <Ionicons name="add" size={13} color={tableType === '__custom__' ? '#fff' : COLORS.muted} />
                  <Text style={[m.pillText, tableType === '__custom__' && m.pillTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {tableType === '__custom__' && (
                <TextInput
                  style={[m.input, { marginTop: -SPACING.xs }]}
                  value={customType}
                  onChangeText={syncCT}
                  placeholder="e.g. Terrace, Booth, Skybox…"
                  placeholderTextColor={COLORS.mutedDark}
                  autoFocus
                />
              )}

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Capacity</Text>
                  <TextInput style={m.input} value={capacity} onChangeText={syncCap}
                    placeholder="6" placeholderTextColor={COLORS.mutedDark} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Min. Spend (€)</Text>
                  <TextInput style={m.input} value={minSpend} onChangeText={syncMS}
                    placeholder="200" placeholderTextColor={COLORS.mutedDark} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Sector / Area</Text>
                  <TextInput style={m.input} value={sector} onChangeText={syncSec}
                    placeholder="VIP Zone" placeholderTextColor={COLORS.mutedDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Location</Text>
                  <TextInput style={m.input} value={location} onChangeText={syncLoc}
                    placeholder="Main floor" placeholderTextColor={COLORS.mutedDark} />
                </View>
              </View>

              <TouchableOpacity style={[m.saveBtn, savingTable && { opacity: 0.6 }]} onPress={handleSaveTable} disabled={savingTable}>
                {savingTable
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={m.saveBtnText}>{editingTable ? 'Save Changes' : 'Add Table'}</Text></>
                }
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════ EDIT RESERVATION MODAL ══════════ */}
      <Modal
        visible={showReservModal} animationType="slide" transparent
        onRequestClose={() => { setShowReservModal(false); setEditingReserv(null) }}
      >
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1}
            onPress={() => { setShowReservModal(false); setEditingReserv(null) }} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Edit Reservation</Text>
              <TouchableOpacity onPress={() => { setShowReservModal(false); setEditingReserv(null) }} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editingReserv && (
                <View style={m.guestInfoCard}>
                  <View style={s.guestAvatar}>
                    <Text style={s.guestAvatarText}>
                      {('guest_name' in editingReserv ? editingReserv.guest_name : guestNameFromRow(editingReserv as ReservationRow)).charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={m.guestName}>
                      {'guest_name' in editingReserv ? editingReserv.guest_name : guestNameFromRow(editingReserv as ReservationRow)}
                    </Text>
                    {editingReserv.nr_of_people != null && (
                      <Text style={m.guestSub}>{editingReserv.nr_of_people} guests · {fmt(editingReserv.reservation_date)}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* ── Guest count ── */}
              <Text style={m.label}>Number of Guests</Text>
              <View style={m.guestStepRow}>
                <TouchableOpacity
                  style={[m.stepBtn, reservGuestCount <= 1 && { opacity: 0.35 }]}
                  onPress={() => setReservGuestCount(n => Math.max(1, n - 1))}
                  disabled={reservGuestCount <= 1}
                >
                  <Ionicons name="remove" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={m.stepValue}>{reservGuestCount}</Text>
                <TouchableOpacity style={m.stepBtn} onPress={() => setReservGuestCount(n => n + 1)}>
                  <Ionicons name="add" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              {/* ── Table assignment ── */}
              <Text style={m.label}>
                Table {reservTableId ? `— ${tables.find(t => t.id === reservTableId)?.table_number ?? ''}` : '— None assigned'}
              </Text>
              <View style={m.tableGrid}>
                {tables
                  .filter(t => t.seating_capacity >= reservGuestCount)
                  .map(t => {
                    const isSel = reservTableId === t.id
                    const isTaken = t.table_status === 'reserved' && !isSel
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[m.tableChip, isSel && m.tableChipActive, isTaken && { opacity: 0.4 }]}
                        onPress={() => !isTaken && setReservTableId(isSel ? null : t.id)}
                        disabled={isTaken}
                        activeOpacity={isTaken ? 1 : 0.7}
                      >
                        <Text style={[m.tableChipNum, isSel && { color: COLORS.purple }]}>{t.table_number}</Text>
                        <Text style={m.tableChipCap}>{t.seating_capacity}p</Text>
                      </TouchableOpacity>
                    )
                  })}
              </View>

              <Text style={m.label}>Status</Text>
              <View style={m.pillRow}>
                {(['pending', 'confirmed', 'cancelled', 'completed'] as const).map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[m.statusPill, reservStatus === st && { backgroundColor: RESERV_COLOR[st] + '30', borderColor: RESERV_COLOR[st] }]}
                    onPress={() => setReservStatus(st)}
                  >
                    <Text style={[m.statusPillText, reservStatus === st && { color: RESERV_COLOR[st], fontWeight: '700' }]}>
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={m.label}>Notes</Text>
              <TextInput style={[m.input, m.textarea]} value={reservNotes} onChangeText={setReservNotes}
                placeholder="Add a note…" placeholderTextColor={COLORS.mutedDark}
                multiline numberOfLines={3} textAlignVertical="top" />

              <TouchableOpacity style={[m.saveBtn, savingReserv && { opacity: 0.6 }]} onPress={handleSaveReserv} disabled={savingReserv}>
                {savingReserv ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="checkmark-circle-outline" size={16} color="#fff" /><Text style={m.saveBtnText}>Save</Text></>
                }
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════ CREATE RESERVATION MODAL ══════════ */}
      <Modal
        visible={showCreateModal} animationType="slide" transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={() => setShowCreateModal(false)} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>New Reservation</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={m.closeBtn}>
                <Ionicons name="close" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={m.label}>Event *</Text>
              {upcomingEvents.length === 0 ? (
                <Text style={m.noEventsText}>No upcoming events</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                  {upcomingEvents.map(ev => (
                    <TouchableOpacity
                      key={ev.event_id}
                      style={[m.eventChip, createEventId === ev.event_id && m.eventChipActive]}
                      onPress={() => { setCreateEventId(ev.event_id); setCreateDate(ev.event_starting_date.split('T')[0]) }}
                    >
                      <Text style={[m.eventChipText, createEventId === ev.event_id && m.eventChipTextActive]} numberOfLines={1}>
                        {ev.event_name}
                      </Text>
                      <Text style={[m.eventChipDate, createEventId === ev.event_id && { color: COLORS.purple + 'cc' }]}>
                        {fmtShort(ev.event_starting_date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Guests</Text>
                  <TextInput style={m.input} value={createGuests} onChangeText={handleGuestsChange}
                    placeholder="2" placeholderTextColor={COLORS.mutedDark} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Date</Text>
                  <TextInput style={m.input} value={createDate} onChangeText={setCreateDate}
                    placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.mutedDark} />
                </View>
              </View>

              <Text style={m.label}>Table *</Text>
              <View style={m.tableGrid}>
                {tables.map(t => {
                  const isSel = createTableId === t.id
                  const guestCount = parseInt(createGuests) || 0
                  const fits = t.seating_capacity >= guestCount

                  // Derive availability from reservation data for the selected event,
                  // falling back to the raw table_status only when no event is chosen
                  const eventReserv = createEventId
                    ? t.reservations.find(r =>
                      r.event_id === createEventId ||
                      (!r.event_id && matchesEventDate(r.reservation_date, events.find(ev => ev.event_id === createEventId)?.event_starting_date))
                    )
                    : null
                  const sc = createEventId
                    ? eventReserv
                      ? RESERV_COLOR[eventReserv.status]   // amber=pending, green=confirmed, red=cancelled
                      : (isVIP(t) ? COLORS.purple : COLORS.green)  // no booking for this event = free
                    : (STATUS_COLOR[t.table_status] ?? COLORS.muted)
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        m.tableChip,
                        {
                          borderColor: isSel ? COLORS.purple : sc,
                          shadowColor: isSel ? COLORS.purple : sc,
                          shadowOpacity: 0.35,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 4,
                        },
                        isSel && m.tableChipActive,
                        !fits && { opacity: 0.35 },
                      ]}
                      onPress={() => setCreateTableId(t.id)}
                    >
                      <View style={[m.tableChipDot, { backgroundColor: sc }]} />
                      <Text style={[m.tableChipText, isSel && m.tableChipTextActive]} numberOfLines={1}>
                        {t.table_number}
                      </Text>
                      <Text style={m.tableChipCap}>{t.seating_capacity}p</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              {createTableId ? (
                <Text style={m.autoHint}>
                  <Ionicons name="flash-outline" size={11} color={COLORS.purple} />{' '}Auto-assigned · tap to override
                </Text>
              ) : (
                <Text style={[m.autoHint, { color: COLORS.red }]}>No available table fits this party size</Text>
              )}

              <Text style={m.label}>Guest Name</Text>
              <TextInput style={m.input} value={createGuestName} onChangeText={setCreateGuestName}
                placeholder="Walk-in guest name" placeholderTextColor={COLORS.mutedDark} />

              <Text style={m.label}>Notes (optional)</Text>
              <TextInput style={[m.input, m.textarea]} value={createNotes} onChangeText={setCreateNotes}
                placeholder="Special requests…" placeholderTextColor={COLORS.mutedDark}
                multiline numberOfLines={3} textAlignVertical="top" />

              <TouchableOpacity style={[m.saveBtn, savingCreate && { opacity: 0.6 }]} onPress={handleCreateReserv} disabled={savingCreate}>
                {savingCreate ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="person-add-outline" size={16} color="#fff" /><Text style={m.saveBtnText}>Create Reservation</Text></>
                }
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  )
}

// ── Grid card styles ──────────────────────────────────────────────────────────
const g = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  cardVIP: { borderColor: COLORS.purple + '50' },
  bar: { height: 5, width: '100%' },
  cardBody: { padding: SPACING.sm + 2, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vipTag: { backgroundColor: COLORS.purple + '22', borderRadius: RADIUS.sm - 2, paddingHorizontal: 6, paddingVertical: 2 },
  vipTagText: { color: COLORS.purple, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  typeTag: { backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.sm - 2, paddingHorizontal: 6, paddingVertical: 2 },
  typeTagText: { color: COLORS.mutedDark, fontSize: 9, fontWeight: '600' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  tableNum: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800', lineHeight: FONT.md + 2 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  capText: { color: COLORS.mutedDark, fontSize: 11 },
  spendText: { color: COLORS.mutedDark, fontSize: 10 },
  guestName: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  statusLabel: { fontSize: 11, fontWeight: '600' },
  reservPill: { alignSelf: 'flex-start', borderRadius: RADIUS.sm - 2, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  reservPillText: { fontSize: 10, fontWeight: '700' },
  locationText: { color: COLORS.mutedDark, fontSize: 10 },
})

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs,
  },
  appName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  appSub:  { color: COLORS.mutedDark, fontSize: 11, marginTop: 1 },
  addBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  eventPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 7,
    maxWidth: 190,
  },
  eventPillActive: { borderColor: COLORS.purple + '60' },
  eventPillText: { color: COLORS.mutedDark, fontSize: FONT.sm, flex: 1 },
  eventPillTextActive: { color: COLORS.purple, fontWeight: '600' },
  clearEvent: { marginLeft: -2 },
  tonightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purple + '15', borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.purple + '40',
    paddingHorizontal: SPACING.sm, paddingVertical: 7,
  },
  tonightBtnText: { color: COLORS.purple, fontSize: 11, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purpleDark + '22', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.purple + '44',
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 7,
  },
  createBtnText: { color: COLORS.purple, fontSize: 12, fontWeight: '600' },

  modeToggle: {
    flexDirection: 'row', marginHorizontal: SPACING.md,
    marginTop: SPACING.xs, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: 3, gap: 3, borderWidth: 1, borderColor: COLORS.border,
  },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: RADIUS.sm - 2 },
  modeBtnActive: { backgroundColor: COLORS.purpleDark },
  modeBtnText: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },

  statsStrip: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
  statPill: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  statNum:  { fontSize: FONT.md, fontWeight: '800', marginBottom: 1 },
  statLabel:{ color: COLORS.mutedDark, fontSize: 9, textAlign: 'center' },

  legend: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: COLORS.muted, fontSize: 11 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  typeGroup: { marginBottom: SPACING.md },
  typeGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  typeGroupTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  typeGroupCount: {
    color: COLORS.mutedDark, fontSize: 12,
    backgroundColor: COLORS.bgCard2,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },

  empty: { alignItems: 'center', paddingVertical: 56, gap: SPACING.sm },
  emptyTitle:{ color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySub:  { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
  emptyBtn:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },

  addMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.purple + '44',
  },
  addMoreText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  listControls: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 4,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.sm },
  chipScroll:  { maxHeight: 34 },
  chipContent: { paddingHorizontal: SPACING.md, gap: SPACING.xs, paddingVertical: 0, alignItems: 'center' },
  queueHint: {
    color: COLORS.mutedDark, fontSize: 11, lineHeight: 15,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, marginTop: -2,
  },
  chip:       { height: 28, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  chipText:   { color: COLORS.mutedDark, fontSize: 12, lineHeight: 14, fontWeight: '600', includeFontPadding: false, textAlignVertical: 'center' },
  chipTextActive: { color: '#fff' },

  reservCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', overflow: 'hidden',
  },
  reservCardAccent: { width: 4 },
  reservCardInner: { flex: 1, padding: SPACING.sm + 2, gap: SPACING.xs },
  reservCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  reservCardName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  reservCardSub:  { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
  reservCardDate: { color: COLORS.mutedDark, fontSize: 11, marginTop: 1 },
  reservCardRight:{ alignItems: 'flex-end', gap: 4 },
  guestCountBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  guestCountText: { color: COLORS.mutedDark, fontSize: 11 },
  reservStatusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  reservStatusText:  { fontSize: 11, fontWeight: '600' },
  reservCardNotes: {
    color: COLORS.mutedDark, fontSize: 11, fontStyle: 'italic',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: 4,
  },
  reservCardActions: {
    flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: SPACING.xs,
  },
  confirmBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, backgroundColor: COLORS.green + '18', borderWidth: 1, borderColor: COLORS.green + '44' },
  declineBtn:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, backgroundColor: COLORS.red + '18', borderWidth: 1, borderColor: COLORS.red + '44' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, backgroundColor: COLORS.purple + '18', borderWidth: 1, borderColor: COLORS.purple + '44' },
  editBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, borderWidth: 1, borderColor: COLORS.border },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  guestAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.purpleDark, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  guestAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4, borderTopRightRadius: RADIUS.xl + 4,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xs,
    maxHeight: '92%',
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.sm, marginTop: SPACING.xs },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: SPACING.sm },

  // Detail sheet
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.xs },
  detailColorBar: { width: 4, height: 44, borderRadius: 2, flexShrink: 0 },
  detailTableName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  detailMeta: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  vipTag: { backgroundColor: COLORS.purple + '22', borderRadius: RADIUS.sm - 2, paddingHorizontal: 6, paddingVertical: 2 },
  vipTagText: { color: COLORS.purple, fontSize: 10, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },

  reservInfo: { gap: SPACING.xs },
  reservInfoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  guestAvatarLg: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.purpleDark, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  guestAvatarLgText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  guestNameLg: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  guestEventText: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  reservMeta: { color: COLORS.mutedDark, fontSize: 12 },
  reservStatusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 'auto' },
  reservStatusText: { fontSize: 12, fontWeight: '600' },
  reservNotes: { color: COLORS.muted, fontSize: FONT.sm, fontStyle: 'italic', marginTop: SPACING.xs },
  noReservBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  noReservText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, paddingTop: SPACING.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderRadius: RADIUS.md, borderWidth: 1,
    flex: 1, minWidth: '45%',
  },
  actionBtnMuted: { backgroundColor: COLORS.bgCard2, borderColor: COLORS.border },
  actionBtnText: { fontSize: FONT.sm, fontWeight: '600' },

  // Common form
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 12, paddingHorizontal: SPACING.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  eventRowActive: { backgroundColor: COLORS.purpleDark + '15' },
  eventRowText: { flex: 1, color: COLORS.muted, fontSize: FONT.base },
  eventRowTextActive: { color: COLORS.white, fontWeight: '600' },
  eventRowDate: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  eventRowPast: { opacity: 0.65 },
  pickerSectionLabel: {
    color: COLORS.mutedDark, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: SPACING.xs, paddingTop: SPACING.md, paddingBottom: 4,
  },
  pickerEmptyText: { color: COLORS.mutedDark, fontSize: FONT.sm, paddingHorizontal: SPACING.xs, paddingVertical: SPACING.sm },
  pastToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: 12, paddingHorizontal: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  pastToggleText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },
  label: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, color: COLORS.white, fontSize: FONT.base, marginBottom: SPACING.md },
  textarea: { minHeight: 80, paddingTop: SPACING.sm + 4 },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  pillText: { color: COLORS.muted, fontSize: FONT.sm },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  statusPill: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  statusPillText: { color: COLORS.muted, fontSize: FONT.sm },
  guestInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  guestName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  guestSub:  { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.sm },
  saveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
  eventChip: { marginRight: SPACING.xs, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm + 2, paddingVertical: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, maxWidth: 180 },
  eventChipActive: { backgroundColor: COLORS.purpleDark + '22', borderColor: COLORS.purple },
  eventChipText: { color: COLORS.muted, fontSize: 12 },
  eventChipTextActive: { color: '#fff', fontWeight: '600' },
  eventChipDate: { color: COLORS.mutedDark, fontSize: 10, marginTop: 2 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
  tableChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.sm, paddingVertical: 7, minWidth: '30%', flex: 1 },
  tableChipActive: { backgroundColor: COLORS.purpleDark + '22' },
  tableChipDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  tableChipText: { color: COLORS.muted, fontSize: 12, flex: 1 },
  tableChipTextActive: { color: COLORS.white, fontWeight: '600' },
  tableChipCap: { color: COLORS.mutedDark, fontSize: 10 },
  tableChipNum: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  autoHint: { color: COLORS.purple, fontSize: 11, marginTop: -SPACING.xs, marginBottom: SPACING.md, opacity: 0.8 },
  noEventsText: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.md, fontStyle: 'italic' },
  guestStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.lg, marginBottom: SPACING.md },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepValue: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', minWidth: 32, textAlign: 'center' },
})
