import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Modal,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { DEFAULT_RESERVATION_HOLD_MINUTES, normalizeReservationHoldMinutes } from '@/lib/reservationPolicy'

// ── Types ─────────────────────────────────────────────────────────────────────
type TypeFilter = 'All' | 'Tickets' | 'Tables' | 'Completed'

type TableOption = {
  id: string
  table_number: string
  seating_capacity: number | null
  minimum_spend: number | null
  sector: string | null
  type: string | null
}

type Reservation = {
  reservation_id:   string
  type:             'ticket' | 'table'
  status:           'pending' | 'confirmed' | 'cancelled' | 'completed'
  nr_of_people:     number | null
  reservation_date: string | null
  created_at:       string | null
  event_id:         string | null
  table_id:         string | null
  events: {
    event_id: string
    event_name: string
    final_ticket_price: number | null
    event_starting_date: string | null
    event_ending_date: string | null
    event_hours: string | null
  } | null
  profiles: { name: string | null; surname: string | null } | null
  tables: TableOption | null
  ticket_types: { name: string | null; price: number | null } | null
}

type WeekRange = {
  label: string   // "Last Week" / "This Week" / "Next Week" / custom date string
  start: Date
  end:   Date
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function mondayOf(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const dow = copy.getDay()
  copy.setDate(copy.getDate() - (dow === 0 ? 6 : dow - 1))
  return copy
}

function makeWeek(monday: Date): WeekRange {
  const start = new Date(monday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { label: fmtRange(start, end), start, end }
}

function fmtRange(s: Date, e: Date) {
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return `${f(s)} – ${f(e)}`
}

function toISODate(d: Date) { return d.toISOString().slice(0, 10) }

function dayKey(value: string | null | undefined) {
  return (value ?? '').slice(0, 10)
}

function bookingDisplayDate(r: Reservation) {
  return r.events?.event_starting_date ?? r.reservation_date ?? r.created_at
}

function bookingDayKey(r: Reservation) {
  return dayKey(bookingDisplayDate(r))
}

function bookingEnded(r: Reservation) {
  const ref = r.events?.event_ending_date || r.events?.event_starting_date || r.reservation_date
  if (!ref) return false
  const dt = new Date(ref)
  if (Number.isNaN(dt.getTime())) return false
  const midnightOnly = dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0 && dt.getUTCMilliseconds() === 0
  if (midnightOnly) dt.setHours(23, 59, 59, 999)
  return dt.getTime() < Date.now()
}

function bookingStartGracePassed(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  const ref = r.events?.event_starting_date || r.reservation_date
  if (!ref) return false
  const dt = new Date(ref)
  if (Number.isNaN(dt.getTime())) return false
  const midnightOnly = dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0 && dt.getUTCMilliseconds() === 0
  if (midnightOnly) dt.setHours(23, 59, 59, 999)
  return dt.getTime() + normalizeReservationHoldMinutes(holdMinutes) * 60 * 1000 < Date.now()
}

function isPastUnresolved(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  return bookingStartGracePassed(r, holdMinutes) && r.status !== 'completed' && r.status !== 'cancelled'
}

function reservationNeedsTable(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  return r.type === 'table' && r.status !== 'cancelled' && r.status !== 'completed' && !isPastUnresolved(r, holdMinutes) && !r.table_id
}

function reservationLockedForEdits(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  return r.status === 'completed' || r.status === 'cancelled' || bookingEnded(r) || isPastUnresolved(r, holdMinutes)
}

function reservationStatusLabel(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  if (isPastUnresolved(r, holdMinutes)) return 'No-show'
  return r.status.charAt(0).toUpperCase() + r.status.slice(1)
}

function reservationStatusColor(r: Reservation, holdMinutes = DEFAULT_RESERVATION_HOLD_MINUTES) {
  if (isPastUnresolved(r, holdMinutes)) return COLORS.red
  return STATUS_COLOR[r.status] ?? COLORS.muted
}

function sameWeek(a: WeekRange, b: WeekRange) {
  return toISODate(a.start) === toISODate(b.start)
}

function getPresetWeeks(): WeekRange[] {
  const thisMonday = mondayOf(new Date())
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
  const nextMonday = new Date(thisMonday); nextMonday.setDate(thisMonday.getDate() + 7)
  return [
    { ...makeWeek(lastMonday), label: 'Last Week' },
    { ...makeWeek(thisMonday), label: 'This Week' },
    { ...makeWeek(nextMonday), label: 'Next Week' },
  ]
}

// Calendar grid (Mon→Sun rows) for a given year/month
function buildCalendarGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const start    = mondayOf(firstDay)
  const endDow   = lastDay.getDay()
  const end      = new Date(lastDay)
  end.setDate(lastDay.getDate() + (endDow === 0 ? 0 : 7 - endDow))

  const weeks: Date[][] = []
  const cur = new Date(start)
  while (cur <= end) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

// ── Colour maps ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  confirmed: COLORS.green, pending: COLORS.cta, cancelled: COLORS.red, completed: COLORS.muted,
}
const TYPE_COLOR: Record<string, string> = { table: COLORS.purple, ticket: COLORS.cta }

const TX = {
  title: 'Reservations & Tickets',
  subtitle: 'Prepare upcoming bookings and review tickets',
  tableReservations: 'Table Reservations',
  assignTable: 'Assign table',
  changeTable: 'Change table',
  noTable: 'No table assigned',
  tableNeeded: 'Needs table',
  tableTaken: 'Already assigned',
  details: {
    event: 'Event',
    date: 'Date',
    status: 'Status',
    table: 'Table',
    minimumSpend: 'Minimum spend',
    ticketType: 'Ticket type',
    ticketPrice: 'Ticket price',
  },
  lockedPast: 'This reservation is locked because the event time has passed.',
  noShow: 'No check-in was recorded inside the venue hold window. The table is treated as free.',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReservationsScreen() {
  const { profile } = useAuth()
  const PRESETS = useMemo(() => getPresetWeeks(), [])

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [clubTables, setClubTables]     = useState<TableOption[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('All')
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [assigningTableId, setAssigningTableId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState('all')
  const [selectedEventId, setSelectedEventId] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingGuestCount, setEditingGuestCount] = useState('1')
  const [savingReservationEdit, setSavingReservationEdit] = useState(false)
  const [reservationHoldMinutes, setReservationHoldMinutes] = useState(DEFAULT_RESERVATION_HOLD_MINUTES)

  // Selected week (default: This Week)
  const [selectedWeek, setSelectedWeek] = useState<WeekRange>(PRESETS[1])

  // Week picker modal
  const [showPicker, setShowPicker]         = useState(false)
  const [pickerYear, setPickerYear]         = useState(new Date().getFullYear())
  const [pickerMonth, setPickerMonth]       = useState(new Date().getMonth())
  const [pickerHovered, setPickerHovered]   = useState<Date | null>(null) // any day in hovered week
  const [pickerConfirmed, setPickerConfirmed] = useState<Date | null>(null) // confirmed pick

  // ── Fetch for selected week ───────────────────────────────────────────────
  const fetchReservations = useCallback(async (week: WeekRange) => {
    if (!profile?.club_id) { setLoading(false); return }

    const rangeStart = toISODate(week.start)
    const rangeEnd   = toISODate(week.end)
    const eventRangeStart = rangeStart
    const eventRangeEnd = week.end.toISOString()

    const { data: clubRow } = await supabase
      .from('clubs')
      .select('*')
      .eq('club_id', profile.club_id)
      .single()
    setReservationHoldMinutes(normalizeReservationHoldMinutes((clubRow as any)?.reservation_hold_minutes))

    const { data: eventRows } = await supabase
      .from('events')
      .select('event_id')
      .eq('club_id', profile.club_id)
      .gte('event_starting_date', eventRangeStart)
      .lte('event_starting_date', eventRangeEnd)
    const eventIds = (eventRows ?? []).map((e: { event_id: string }) => e.event_id)

    const { data: ticketRes } = eventIds.length > 0
      ? await supabase
          .from('reservations')
          .select(`reservation_id,type,status,nr_of_people,reservation_date,created_at,event_id,table_id,
            events(event_id,event_name,final_ticket_price,event_starting_date,event_ending_date,event_hours),profiles(name,surname),tables(id,minimum_spend,table_number,seating_capacity,sector,type),ticket_types(name,price)`)
          .in('event_id', eventIds)
      : { data: [] }

    const { data: tableRows } = await supabase
      .from('tables')
      .select('id,table_number,seating_capacity,minimum_spend,sector,type')
      .eq('club_id', profile.club_id)
      .order('table_number', { ascending: true })
    const tableOptions = (tableRows ?? []) as TableOption[]
    setClubTables(tableOptions)
    const tableIds = tableOptions.map(t => t.id)

    const { data: tableRes } = tableIds.length > 0
      ? await supabase
          .from('reservations')
          .select(`reservation_id,type,status,nr_of_people,reservation_date,created_at,event_id,table_id,
            events(event_id,event_name,final_ticket_price,event_starting_date,event_ending_date,event_hours),profiles(name,surname),tables(id,minimum_spend,table_number,seating_capacity,sector,type),ticket_types(name,price)`)
          .in('table_id', tableIds)
          .is('event_id', null)
          .gte('reservation_date', rangeStart)
          .lte('reservation_date', rangeEnd)
          .order('reservation_date', { ascending: true })
      : { data: [] }

    const all  = [...(ticketRes ?? []), ...(tableRes ?? [])]
    const seen = new Set<string>()
    const deduped = all
      .filter(r => { if (seen.has(r.reservation_id)) return false; seen.add(r.reservation_id); return true })
      .sort((a, b) => {
        const left = bookingDisplayDate(a as unknown as Reservation) ?? ''
        const right = bookingDisplayDate(b as unknown as Reservation) ?? ''
        return left.localeCompare(right)
      })

    setReservations(deduped as unknown as Reservation[])
    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchReservations(selectedWeek) }, [fetchReservations, selectedWeek])

  useEffect(() => {
    setSelectedDay('all')
    setSelectedEventId('all')
    setSearchQuery('')
  }, [selectedWeek])

  useEffect(() => {
    if (!selectedReservation) return
    setEditingGuestCount(String(Math.max(1, selectedReservation.nr_of_people ?? 1)))
  }, [selectedReservation])

  const onRefresh = () => { setRefreshing(true); fetchReservations(selectedWeek) }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = reservations
    if (typeFilter === 'Tickets') {
      rows = rows.filter(r => r.type === 'ticket')
    } else if (typeFilter === 'Tables') {
      rows = rows.filter(r => r.type === 'table')
    } else if (typeFilter === 'Completed') {
      rows = rows.filter(r => r.status === 'completed')
    }
    if (selectedDay !== 'all') rows = rows.filter(r => bookingDayKey(r) === selectedDay)
    if (selectedEventId !== 'all') rows = rows.filter(r => r.event_id === selectedEventId || r.events?.event_id === selectedEventId)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      rows = rows.filter(r => {
        const haystack = [
          getDisplayName(r),
          r.events?.event_name,
          r.tables?.table_number,
          r.ticket_types?.name,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    return rows
  }, [reservations, typeFilter, selectedDay, selectedEventId, searchQuery])

  const dayOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of reservations) {
      const key = bookingDayKey(r)
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [reservations])

  const eventOptions = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>()
    const source = selectedDay === 'all'
      ? reservations
      : reservations.filter(r => bookingDayKey(r) === selectedDay)
    for (const r of source) {
      const id = r.event_id ?? r.events?.event_id
      if (!id) continue
      const cur = counts.get(id)
      counts.set(id, { name: cur?.name ?? r.events?.event_name ?? 'Untitled event', count: (cur?.count ?? 0) + 1 })
    }
    return Array.from(counts.entries()).map(([id, value]) => ({ id, ...value })).sort((a, b) => a.name.localeCompare(b.name))
  }, [reservations, selectedDay])

  const weekDays = useMemo(() => {
    const today = toISODate(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(selectedWeek.start)
      date.setDate(selectedWeek.start.getDate() + i)
      date.setHours(12, 0, 0, 0)
      const key = toISODate(date)
      const dayRs = reservations.filter(r => bookingDayKey(r) === key)
      return {
        key,
        date,
        total: dayRs.length,
        ticketCount: dayRs.filter(r => r.type === 'ticket').length,
        tableCount: dayRs.filter(r => r.type === 'table').length,
        unassigned: dayRs.filter(r => reservationNeedsTable(r, reservationHoldMinutes)).length,
        flagged: dayRs.filter(r => isPastUnresolved(r, reservationHoldMinutes)).length,
        confirmed: dayRs.filter(r => r.status === 'confirmed').length,
        completed: dayRs.filter(r => r.status === 'completed').length,
        cancelled: dayRs.filter(r => r.status === 'cancelled').length,
        events: [...new Set(dayRs.map(r => r.events?.event_name).filter(Boolean))] as string[],
        isToday: key === today,
        isPast: key < today,
      }
    })
  }, [selectedWeek, reservations, reservationHoldMinutes])

  const isOverview = selectedDay === 'all' && !searchQuery.trim()

  const grouped = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    for (const r of filtered) {
      const key = bookingDayKey(r) || 'no-date'
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const total     = reservations.length
  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const cancelled = reservations.filter(r => r.status === 'cancelled').length
  const completed = reservations.filter(r => r.status === 'completed').length

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: Reservation['status']) {
    const reservation = reservations.find(r => r.reservation_id === id)
    if (reservation && reservationLockedForEdits(reservation, reservationHoldMinutes)) {
      Alert.alert('Locked', 'This reservation can no longer be changed because its event window has passed.')
      return
    }

    const { error } = await supabase.from('reservations').update({ status }).eq('reservation_id', id)
    if (error) { Alert.alert('Error', error.message); return }
    await fetchReservations(selectedWeek)
  }

  function tableConflict(tableId: string, reservation: Reservation) {
    return reservations.some(r => {
      if (r.reservation_id === reservation.reservation_id) return false
      if (r.table_id !== tableId) return false
      if (r.status === 'cancelled' || r.status === 'completed' || isPastUnresolved(r, reservationHoldMinutes)) return false
      if (reservation.event_id) return r.event_id === reservation.event_id
      return bookingDayKey(r) === bookingDayKey(reservation)
    })
  }

  async function handleAssignTable(reservation: Reservation, table: TableOption) {
    if (reservationLockedForEdits(reservation, reservationHoldMinutes)) {
      Alert.alert('Locked', 'This reservation can no longer be changed because its event window has passed.')
      return
    }

    if (tableConflict(table.id, reservation)) {
      Alert.alert('Table unavailable', 'This table is already assigned for this event or date.')
      return
    }

    setAssigningTableId(table.id)
    const { error } = await supabase
      .from('reservations')
      .update({ table_id: table.id })
      .eq('reservation_id', reservation.reservation_id)
    setAssigningTableId(null)
    if (error) { Alert.alert('Error', error.message); return }

    setSelectedReservation(prev => prev?.reservation_id === reservation.reservation_id
      ? { ...prev, table_id: table.id, tables: table }
      : prev)
    await fetchReservations(selectedWeek)
  }

  async function handleSaveReservationDetails() {
    if (!selectedReservation || selectedReservation.type !== 'table') return
    if (reservationLockedForEdits(selectedReservation, reservationHoldMinutes)) {
      Alert.alert('Locked', 'This reservation can no longer be changed because its event window has passed.')
      return
    }

    const guests = Math.max(1, Number.parseInt(editingGuestCount, 10) || 1)
    setSavingReservationEdit(true)
    const { error } = await supabase
      .from('reservations')
      .update({ nr_of_people: guests })
      .eq('reservation_id', selectedReservation.reservation_id)
    setSavingReservationEdit(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    setEditingGuestCount(String(guests))
    setSelectedReservation(prev => prev?.reservation_id === selectedReservation.reservation_id
      ? { ...prev, nr_of_people: guests }
      : prev)
    await fetchReservations(selectedWeek)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getDisplayName(r: Reservation) {
    if (!r.profiles) return 'Guest'
    return [r.profiles.name, r.profiles.surname].filter(Boolean).join(' ') || 'Guest'
  }
  function getAmount(r: Reservation) {
    if (r.type === 'table') return ''
    if (r.type === 'ticket' && r.events?.final_ticket_price && r.nr_of_people)
      return `€${(r.events.final_ticket_price * r.nr_of_people).toFixed(2)}`
    if (r.type === 'ticket' && r.events?.final_ticket_price)
      return `€${r.events.final_ticket_price.toFixed(2)}`
    return '–'
  }
  function formatDayHeader(key: string) {
    if (key === 'no-date') return 'Date not set'
    return new Date(key + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })
  }
  function formatDate(d: string | null | undefined) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // ── Week picker helpers ───────────────────────────────────────────────────
  const calGrid = useMemo(() => buildCalendarGrid(pickerYear, pickerMonth), [pickerYear, pickerMonth])

  const pickerHoveredMonday = pickerHovered ? mondayOf(pickerHovered) : null
  const pickerConfirmedMonday = pickerConfirmed ? mondayOf(pickerConfirmed) : null

  function isInPickerWeek(day: Date, weekMonday: Date | null) {
    if (!weekMonday) return false
    const dayStr = toISODate(day)
    const weekEnd = new Date(weekMonday); weekEnd.setDate(weekMonday.getDate() + 6)
    return dayStr >= toISODate(weekMonday) && dayStr <= toISODate(weekEnd)
  }

  function prevPickerMonth() {
    if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1) }
    else setPickerMonth(m => m - 1)
  }
  function nextPickerMonth() {
    if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1) }
    else setPickerMonth(m => m + 1)
  }

  function confirmPickerWeek() {
    if (!pickerConfirmedMonday) return
    const week = makeWeek(pickerConfirmedMonday)
    // check if it matches a preset
    const preset = PRESETS.find(p => sameWeek(p, week))
    setSelectedWeek(preset ?? week)
    setShowPicker(false)
  }

  // Is the selected week one of the 3 presets?
  const activePresetIndex = PRESETS.findIndex(p => sameWeek(p, selectedWeek))
  const emptyTitle = typeFilter === 'Tables'
      ? 'No table reservations'
      : typeFilter === 'All'
        ? 'No reservations'
        : `No ${typeFilter.toLowerCase()}`

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>{TX.title}</Text>
        <Text style={s.pageSubtitle}>{TX.subtitle}</Text>

        {/* ── Select Week button ── */}
        <TouchableOpacity style={s.weekPickerBtn} onPress={() => {
          // open picker initialised on selected week's month
          setPickerMonth(selectedWeek.start.getMonth())
          setPickerYear(selectedWeek.start.getFullYear())
          setPickerConfirmed(selectedWeek.start)
          setPickerHovered(null)
          setShowPicker(true)
        }}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.purple} />
          <View style={{ flex: 1 }}>
            <Text style={s.weekPickerLabel}>Select Week</Text>
            <Text style={s.weekPickerValue}>{selectedWeek.label !== 'Last Week' && selectedWeek.label !== 'This Week' && selectedWeek.label !== 'Next Week'
              ? selectedWeek.label
              : `${selectedWeek.label}  ·  ${fmtRange(selectedWeek.start, selectedWeek.end)}`
            }</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={COLORS.mutedDark} />
        </TouchableOpacity>

        {/* ── Preset week tabs ── */}
        <View style={s.weekRow}>
          {PRESETS.map((w, i) => (
            <TouchableOpacity
              key={w.label}
              style={[s.weekTab, activePresetIndex === i && s.weekTabActive]}
              onPress={() => setSelectedWeek(w)}
            >
              <Text style={[s.weekLabel, activePresetIndex === i && s.weekLabelActive]}>{w.label}</Text>
              <Text style={[s.weekDates, activePresetIndex === i && s.weekDatesActive]}>
                {fmtRange(w.start, w.end)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          {([
            [String(total),     COLORS.white, 'Total'],
            [String(confirmed), COLORS.green, 'Confirmed'],
            [String(completed), COLORS.muted, 'Completed'],
            [String(cancelled), COLORS.red,   'Cancelled'],
          ] as [string, string, string][]).map(([num, color, label]) => (
            <View key={label} style={s.statItem}>
              <Text style={[s.statNum, { color }]}>{num}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Type filter ── */}
        <View style={s.filterRow}>
          {(['All', 'Tickets', 'Tables', 'Completed'] as TypeFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, typeFilter === f && s.filterTabActive]}
              onPress={() => setTypeFilter(f)}
            >
              <Text style={[s.filterText, typeFilter === f && s.filterTextActive]}>
                {f === 'Tables' ? TX.tableReservations : f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search and quick filters */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={15} color={COLORS.mutedDark} />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search guest, event, table..."
            placeholderTextColor={COLORS.mutedDark}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Day overview cards (default) or drill-down list ── */}
        {isOverview ? (
          <View style={{ gap: SPACING.sm, marginBottom: SPACING.xl }}>
            {weekDays.map(day => {
              const filteredCnt = typeFilter === 'Tickets' ? day.ticketCount
                : typeFilter === 'Tables' ? day.tableCount
                : typeFilter === 'Completed' ? day.completed
                : day.total
              const hasRs = day.total > 0
              const dimmed = !hasRs || (typeFilter !== 'All' && filteredCnt === 0)
              const displayCnt = typeFilter === 'All' ? day.total : filteredCnt
              const canOpenDay = hasRs && displayCnt > 0

              return (
                <TouchableOpacity
                  key={day.key}
                  style={[s.dayCard, day.isToday && s.dayCardToday, dimmed && s.dayCardMuted]}
                  onPress={() => { if (canOpenDay) { setSelectedDay(day.key); setSelectedEventId('all') } }}
                  activeOpacity={canOpenDay ? 0.8 : 1}
                >
                  <View style={s.dayCardHeader}>
                    <View style={s.dayCardLeft}>
                      <Text style={[s.dayCardWeekday, day.isToday && s.dayCardWeekdayToday]}>
                        {day.date.toLocaleDateString('en-GB', { weekday: 'long' })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.dayCardDate, day.isToday && { color: COLORS.purple }]}>
                          {day.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </Text>
                        {day.isToday && (
                          <View style={s.todayPill}><Text style={s.todayPillText}>Today</Text></View>
                        )}
                      </View>
                    </View>

                    <View style={s.dayCardRight}>
                      {hasRs ? (
                        <>
                          <View style={[s.countCircle, day.isToday && s.countCircleToday]}>
                            <Text style={[s.countCircleText, day.isToday && s.countCircleTextToday]}>
                              {displayCnt}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={day.isToday ? COLORS.purple : COLORS.mutedDark} />
                        </>
                      ) : (
                        <Text style={s.noBookingsText}>No bookings</Text>
                      )}
                    </View>
                  </View>

                  {hasRs && (
                    <>
                      <View style={s.statusBarTrack}>
                        {day.confirmed > 0 && <View style={[s.statusBarSeg, { flex: day.confirmed, backgroundColor: COLORS.green }]} />}
                        {day.completed > 0 && <View style={[s.statusBarSeg, { flex: day.completed, backgroundColor: COLORS.muted }]} />}
                        {day.cancelled > 0 && <View style={[s.statusBarSeg, { flex: day.cancelled, backgroundColor: COLORS.border }]} />}
                      </View>

                      <View style={s.dayCardStats}>
                        {day.ticketCount > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.cta + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.cta }]}>{day.ticketCount} tickets</Text>
                          </View>
                        )}
                        {day.tableCount > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.purple + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.purple }]}>{day.tableCount} tables</Text>
                          </View>
                        )}
                        {day.unassigned > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.pink + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.pink }]}>{day.unassigned} unassigned</Text>
                          </View>
                        )}
                        {day.flagged > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.red + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.red }]}>{day.flagged} no-show</Text>
                          </View>
                        )}
                        {day.confirmed > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.green + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.green }]}>{day.confirmed} confirmed</Text>
                          </View>
                        )}
                        {day.completed > 0 && (
                          <View style={[s.statPill, { backgroundColor: COLORS.muted + '18' }]}>
                            <Text style={[s.statPillText, { color: COLORS.muted }]}>{day.completed} done</Text>
                          </View>
                        )}
                      </View>

                      {day.events.length > 0 && (
                        <View style={s.dayCardEvents}>
                          {day.events.slice(0, 3).map(ev => (
                            <View key={ev} style={s.eventPill}>
                              <Ionicons name="musical-notes-outline" size={10} color={COLORS.purple} />
                              <Text style={s.eventPillText} numberOfLines={1}>{ev}</Text>
                            </View>
                          ))}
                          {day.events.length > 3 && (
                            <Text style={s.eventMoreText}>+{day.events.length - 3} more</Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <>
            {/* Back button when viewing a specific day */}
            {selectedDay !== 'all' && (
              <TouchableOpacity
                style={s.backButton}
                onPress={() => { setSelectedDay('all'); setSelectedEventId('all') }}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.purple} />
                <Text style={s.backButtonText}>{formatDayHeader(selectedDay)}</Text>
                <View style={{ flex: 1 }} />
                <View style={s.backCountBadge}>
                  <Text style={s.backCountText}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Search result context */}
            {searchQuery.trim() !== '' && (
              <View style={s.searchResultHeader}>
                <Ionicons name="search" size={13} color={COLORS.mutedDark} />
                <Text style={s.searchResultText}>
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{searchQuery.trim()}&rdquo;
                </Text>
              </View>
            )}

            {/* Event filter chips */}
            {eventOptions.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickScroll} contentContainerStyle={s.quickContent}>
                <TouchableOpacity style={[s.eventChip, selectedEventId === 'all' && s.eventChipActive]} onPress={() => setSelectedEventId('all')}>
                  <Text style={[s.eventChipText, selectedEventId === 'all' && s.eventChipTextActive]}>All events</Text>
                </TouchableOpacity>
                {eventOptions.map(ev => (
                  <TouchableOpacity key={ev.id} style={[s.eventChip, selectedEventId === ev.id && s.eventChipActive]} onPress={() => setSelectedEventId(ev.id)}>
                    <Text style={[s.eventChipText, selectedEventId === ev.id && s.eventChipTextActive]} numberOfLines={1}>
                      {ev.name} ({ev.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Reservation list */}
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="receipt-outline" size={48} color={COLORS.mutedDark} />
                <Text style={s.emptyTitle}>{emptyTitle}</Text>
                <Text style={s.emptySubtitle}>{fmtRange(selectedWeek.start, selectedWeek.end)}</Text>
              </View>
            ) : (
              grouped.map(([dateKey, rows]) => (
                <View key={dateKey}>
                  {selectedDay === 'all' && (
                    <View style={s.dayHeader}>
                      <View style={s.dayDot} />
                      <Text style={s.dayHeaderText}>{formatDayHeader(dateKey)}</Text>
                      <View style={s.dayLine} />
                      <View style={s.dayCountBadge}><Text style={s.dayCountText}>{rows.length}</Text></View>
                    </View>
                  )}

                  {rows.map(r => {
                    const sc = reservationStatusColor(r, reservationHoldMinutes)
                    const tc = TYPE_COLOR[r.type]    ?? COLORS.muted
                    const name      = getDisplayName(r)
                    const amount    = getAmount(r)
                    const pastUnresolved = isPastUnresolved(r, reservationHoldMinutes)
                    const locked = reservationLockedForEdits(r, reservationHoldMinutes)
                    const eventName = r.events?.event_name ?? (r.tables ? `Table ${r.tables.table_number}` : '–')

                    return (
                      <TouchableOpacity
                        key={r.reservation_id}
                        style={s.reservCard}
                        onPress={() => setSelectedReservation(r)}
                        activeOpacity={0.84}
                      >
                        <View style={s.reservTop}>
                          <View style={s.reservLeft}>
                            <View style={s.avatarCircle}>
                              <Text style={s.avatarText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.reservName}>{name}</Text>
                              <Text style={s.reservEvent} numberOfLines={1}>{eventName}</Text>
                              {bookingDisplayDate(r) && <Text style={s.reservDate}>{formatDate(bookingDisplayDate(r))}</Text>}
                            </View>
                          </View>
                          {amount ? <Text style={s.reservAmount}>{amount}</Text> : null}
                        </View>

                        <View style={s.reservTags}>
                          <View style={[s.typeBadge, { backgroundColor: tc + '22' }]}>
                            <Text style={[s.typeText, { color: tc }]}>{r.type.charAt(0).toUpperCase() + r.type.slice(1)}</Text>
                          </View>
                          <View style={[s.typeBadge, { backgroundColor: sc + '22' }]}>
                            <Text style={[s.typeText, { color: sc }]}>{reservationStatusLabel(r, reservationHoldMinutes)}</Text>
                          </View>
                          {reservationNeedsTable(r, reservationHoldMinutes) && (
                            <View style={[s.typeBadge, s.needsTableBadge]}>
                              <Ionicons name="restaurant-outline" size={11} color={COLORS.pink} />
                              <Text style={[s.typeText, { color: COLORS.pink }]}>{TX.tableNeeded}</Text>
                            </View>
                          )}
                          {pastUnresolved && (
                            <View style={[s.typeBadge, s.noShowBadge]}>
                              <Ionicons name="alert-circle-outline" size={11} color={COLORS.red} />
                              <Text style={[s.typeText, { color: COLORS.red }]}>No-show</Text>
                            </View>
                          )}
                          {r.type === 'table' && r.tables?.table_number && (
                            <View style={s.typeBadge}><Text style={s.typeText}>Table {r.tables.table_number}</Text></View>
                          )}
                          {r.nr_of_people != null && (
                            <View style={s.typeBadge}><Text style={s.typeText}>{r.nr_of_people} guests</Text></View>
                          )}
                        </View>

                        {r.status === 'pending' && !locked && (
                          <View style={s.actionRow}>
                            <TouchableOpacity style={s.confirmBtn} onPress={(e) => { e.stopPropagation(); handleStatusChange(r.reservation_id, 'confirmed') }}>
                              <Ionicons name="checkmark-outline" size={14} color="#fff" />
                              <Text style={s.confirmBtnText}>Confirm</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.rejectBtn} onPress={(e) => { e.stopPropagation(); handleStatusChange(r.reservation_id, 'cancelled') }}>
                              <Ionicons name="close-outline" size={14} color={COLORS.red} />
                              <Text style={s.rejectBtnText}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ══════════════ Week Picker Modal ══════════════ */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={p.overlay}>
          <TouchableOpacity style={p.backdrop} activeOpacity={1} onPress={() => setShowPicker(false)} />
          <View style={p.sheet}>
            <View style={p.dragHandle} />

            {/* Modal header */}
            <View style={p.modalHeader}>
              <Text style={p.modalTitle}>Select a Week</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={p.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {/* Month navigation */}
            <View style={p.monthNav}>
              <TouchableOpacity onPress={prevPickerMonth} style={p.navBtn}>
                <Ionicons name="chevron-back" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <Text style={p.monthLabel}>
                {new Date(pickerYear, pickerMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={nextPickerMonth} style={p.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={p.dowRow}>
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <Text key={d} style={p.dowText}>{d}</Text>
              ))}
            </View>

            {/* Week rows */}
            {calGrid.map((week, wi) => {
              const weekMonday = week[0]
              const isHovered   = isInPickerWeek(weekMonday, pickerHoveredMonday)
              const isConfirmed = isInPickerWeek(weekMonday, pickerConfirmedMonday)

              return (
                <TouchableOpacity
                  key={wi}
                  style={[p.weekRow, isHovered && p.weekRowHovered, isConfirmed && p.weekRowConfirmed]}
                  onPress={() => setPickerConfirmed(weekMonday)}
                  activeOpacity={0.7}
                >
                  {week.map((day, di) => {
                    const isCurrentMonth = day.getMonth() === pickerMonth
                    const isToday = toISODate(day) === toISODate(new Date())
                    const isFirst = di === 0
                    const isLast  = di === 6

                    return (
                      <View
                        key={di}
                        style={[
                          p.dayCell,
                          isFirst && { borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md },
                          isLast  && { borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md },
                        ]}
                      >
                        {isToday && <View style={p.todayRing} />}
                        <Text style={[
                          p.dayText,
                          !isCurrentMonth && p.dayTextMuted,
                          isConfirmed && p.dayTextActive,
                          isToday && p.dayTextToday,
                        ]}>
                          {day.getDate()}
                        </Text>
                      </View>
                    )
                  })}
                </TouchableOpacity>
              )
            })}

            {/* Footer */}
            <View style={p.footer}>
              {pickerConfirmedMonday && (
                <Text style={p.previewText}>
                  {fmtRange(pickerConfirmedMonday, (() => { const e = new Date(pickerConfirmedMonday); e.setDate(pickerConfirmedMonday.getDate() + 6); return e })())}
                </Text>
              )}
              <TouchableOpacity
                style={[p.confirmBtn, !pickerConfirmedMonday && { opacity: 0.4 }]}
                onPress={confirmPickerWeek}
                disabled={!pickerConfirmedMonday}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={p.confirmBtnText}>View This Week</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedReservation}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReservation(null)}
      >
        <View style={d.overlay}>
          <TouchableOpacity style={d.backdrop} activeOpacity={1} onPress={() => setSelectedReservation(null)} />
          {selectedReservation && (
            <View style={d.sheet}>
              <View style={d.dragHandle} />
              <View style={d.header}>
                <Text style={d.title}>{selectedReservation.type === 'ticket' ? 'Ticket Details' : 'Reservation Details'}</Text>
                <TouchableOpacity style={d.closeBtn} onPress={() => setSelectedReservation(null)}>
                  <Ionicons name="close" size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <View style={d.guestBlock}>
                <View style={d.avatar}>
                  <Text style={d.avatarText}>{getDisplayName(selectedReservation)[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={d.guestName}>{getDisplayName(selectedReservation)}</Text>
                  <Text style={d.guestSub}>
                    {selectedReservation.nr_of_people ?? 1} guest{(selectedReservation.nr_of_people ?? 1) !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <View style={d.infoCard}>
                <DetailRow icon="calendar-outline" label={TX.details.event} value={selectedReservation.events?.event_name ?? 'No event linked'} />
                <View style={d.divider} />
                <DetailRow icon="time-outline" label={TX.details.date} value={formatDate(bookingDisplayDate(selectedReservation)) || 'Date not set'} />
                <View style={d.divider} />
                <DetailRow icon="checkmark-circle-outline" label={TX.details.status} value={reservationStatusLabel(selectedReservation, reservationHoldMinutes)} />
                <View style={d.divider} />
                {selectedReservation.type === 'table' ? (
                  <>
                    <DetailRow icon="restaurant-outline" label={TX.details.table} value={selectedReservation.tables?.table_number ? `Table ${selectedReservation.tables.table_number}` : TX.noTable} />
                  </>
                ) : (
                  <>
                    <DetailRow icon="ticket-outline" label={TX.details.ticketType} value={selectedReservation.ticket_types?.name ?? 'Standard ticket'} />
                    <View style={d.divider} />
                    <DetailRow icon="cash-outline" label={TX.details.ticketPrice} value={
                      selectedReservation.ticket_types?.price != null
                        ? `€${selectedReservation.ticket_types.price.toFixed(2)}`
                        : selectedReservation.events?.final_ticket_price != null
                          ? `€${selectedReservation.events.final_ticket_price.toFixed(2)}`
                          : 'Not set'
                    } />
                  </>
                )}
              </View>

              {isPastUnresolved(selectedReservation, reservationHoldMinutes) && (
                <View style={d.warningBox}>
                  <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
                  <Text style={[d.warningText, { color: COLORS.red }]}>{TX.noShow}</Text>
                </View>
              )}

              {!isPastUnresolved(selectedReservation, reservationHoldMinutes) && bookingEnded(selectedReservation) && selectedReservation.status !== 'completed' && selectedReservation.status !== 'cancelled' && (
                <View style={d.warningBox}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.mutedDark} />
                  <Text style={d.warningText}>{TX.lockedPast}</Text>
                </View>
              )}

              {selectedReservation.type === 'table' && (selectedReservation.status === 'pending' || selectedReservation.status === 'confirmed') && !reservationLockedForEdits(selectedReservation, reservationHoldMinutes) && (
                <TouchableOpacity
                  style={d.checkInBtn}
                  onPress={() => handleStatusChange(selectedReservation.reservation_id, 'completed')}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                  <Text style={d.checkInBtnText}>Mark checked in</Text>
                </TouchableOpacity>
              )}

              {selectedReservation.type === 'table' && !reservationLockedForEdits(selectedReservation, reservationHoldMinutes) && (
                <View style={d.editBlock}>
                  <View style={d.editRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={d.assignTitle}>Guests</Text>
                      <Text style={d.editHint}>Update the reservation size for the host list.</Text>
                    </View>
                    <TextInput
                      style={d.guestInput}
                      value={editingGuestCount}
                      onChangeText={(value) => setEditingGuestCount(value.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={3}
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={[d.saveMiniBtn, savingReservationEdit && d.saveMiniBtnDisabled]}
                      onPress={handleSaveReservationDetails}
                      disabled={savingReservationEdit}
                    >
                      {savingReservationEdit ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={d.saveMiniBtnText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={d.assignBlock}>
                    <Text style={d.assignTitle}>
                      {selectedReservation.table_id ? TX.changeTable : TX.assignTable}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={d.tableOptions}>
                      {clubTables.map(table => {
                        const selected = selectedReservation.table_id === table.id
                        const taken = tableConflict(table.id, selectedReservation) && !selected
                        const assigning = assigningTableId === table.id
                        return (
                          <TouchableOpacity
                            key={table.id}
                            style={[d.tableOption, selected && d.tableOptionActive, taken && d.tableOptionDisabled]}
                            onPress={() => handleAssignTable(selectedReservation, table)}
                            disabled={taken || assigningTableId !== null}
                          >
                            <Text style={[d.tableOptionNum, selected && d.tableOptionTextActive]}>
                              Table {table.table_number}
                            </Text>
                            <Text style={d.tableOptionMeta}>
                              {[table.seating_capacity ? `${table.seating_capacity} guests` : null, table.type].filter(Boolean).join(' - ')}
                            </Text>
                            {assigning ? (
                              <ActivityIndicator size="small" color={COLORS.purple} />
                            ) : taken ? (
                              <Text style={d.tableTakenText}>{TX.tableTaken}</Text>
                            ) : selected ? (
                              <Ionicons name="checkmark-circle" size={16} color={COLORS.purple} />
                            ) : null}
                          </TouchableOpacity>
                        )
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              <TouchableOpacity style={d.doneBtn} onPress={() => setSelectedReservation(null)}>
                <Text style={d.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={d.row}>
      <View style={d.rowIcon}>
        <Ionicons name={icon} size={16} color={COLORS.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={d.rowLabel}>{label}</Text>
        <Text style={d.rowValue}>{value}</Text>
      </View>
    </View>
  )
}

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  appName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  sub:     { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  // Select week button
  weekPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.purple + '55',
  },
  weekPickerLabel: { color: COLORS.mutedDark, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekPickerValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700', marginTop: 2 },

  // Preset week tabs
  weekRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  weekTab: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.sm,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  weekTabActive:   { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  weekLabel:       { color: COLORS.mutedDark, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  weekLabelActive: { color: '#fff' },
  weekDates:       { color: COLORS.mutedDark + '88', fontSize: 9, textAlign: 'center' },
  weekDatesActive: { color: 'rgba(255,255,255,0.65)' },

  // Stats
  statsRow:  { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: COLORS.mutedDark, fontSize: 10, textAlign: 'center' },

  // Type filter
  filterRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  filterTab:        { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive:  { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purpleDark },
  filterText:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, height: 46, marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.sm },
  quickScroll: { marginBottom: SPACING.sm },
  quickContent: { gap: SPACING.sm, paddingRight: SPACING.md },
  quickChip: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  quickChipActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  quickChipText: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700' },
  quickChipTextActive: { color: COLORS.white },
  eventChip: {
    maxWidth: 190, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  eventChipActive: { backgroundColor: COLORS.purple + '24', borderColor: COLORS.purple },
  eventChipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  eventChipTextActive: { color: COLORS.white },

  // Empty
  empty:         { alignItems: 'center', paddingVertical: 56, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center' },

  // Day headers
  dayHeader:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
  dayDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.purple, flexShrink: 0 },
  dayHeaderText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  dayLine:       { flex: 1, height: 1, backgroundColor: COLORS.border },
  dayCountBadge: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  dayCountText:  { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Cards
  reservCard:   { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  reservTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reservLeft:   { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, flex: 1, marginRight: SPACING.sm },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.purpleDark + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { color: COLORS.purple, fontSize: 16, fontWeight: '700' },
  reservName:   { color: COLORS.white, fontSize: FONT.base, fontWeight: '600', marginBottom: 2 },
  reservEvent:  { color: COLORS.mutedDark, fontSize: 12, marginBottom: 2 },
  reservDate:   { color: COLORS.mutedDark, fontSize: 11 },
  reservAmount: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flexShrink: 0 },
  reservTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  typeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  typeText:     { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  needsTableBadge: { backgroundColor: COLORS.pink + '18', borderWidth: 1, borderColor: COLORS.pink + '44' },
  noShowBadge: { backgroundColor: COLORS.red + '18', borderWidth: 1, borderColor: COLORS.red + '44' },

  actionRow:      { flexDirection: 'row', gap: SPACING.sm },
  confirmBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.green, borderRadius: RADIUS.sm, paddingVertical: 10 },
  confirmBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  rejectBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.red + '22', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.red + '44' },
  rejectBtnText:  { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },
  completeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.green + '22', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.green + '44' },
  completeBtnText:{ color: COLORS.green, fontSize: FONT.sm, fontWeight: '600' },
  completeBtnDisabled: { backgroundColor: COLORS.bgCard2, borderColor: COLORS.border, opacity: 0.7 },
  completeBtnTextDisabled: { color: COLORS.mutedDark },

  // ── Needs-action banner ────────────────────────────────────────────────────
  // ── Day overview cards ─────────────────────────────────────────────────────
  dayCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm,
  },
  dayCardToday: { borderColor: COLORS.purple + '66', backgroundColor: COLORS.purpleDark + '22' },
  dayCardMuted: { opacity: 0.5 },
  dayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayCardLeft: { gap: 3 },
  dayCardWeekday: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  dayCardWeekdayToday: { color: COLORS.purple },
  dayCardDate: { color: COLORS.mutedDark, fontSize: FONT.sm },
  dayCardRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.cta + '20', borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  alertBadgeText: { color: COLORS.cta, fontSize: 11, fontWeight: '700' },
  countCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.bgCard2, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  countCircleToday: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  countCircleText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  countCircleTextToday: { color: '#fff' },
  noBookingsText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontStyle: 'italic' },

  statusBarTrack: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: COLORS.border },
  statusBarSeg: { height: 4 },
  dayCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  statPill: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statPillText: { fontSize: 11, fontWeight: '700' },
  dayCardEvents: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: 2 },
  eventPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.purple + '18', borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  eventPillText: { color: COLORS.purple, fontSize: 11, fontWeight: '600', maxWidth: 140 },
  eventMoreText: { color: COLORS.mutedDark, fontSize: 11, alignSelf: 'center' },
  todayPill: { backgroundColor: COLORS.purple + '20', borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  todayPillText: { color: COLORS.purple, fontSize: 10, fontWeight: '700' },

  // ── Back button ────────────────────────────────────────────────────────────
  backButton: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  backButtonText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  backCountBadge: {
    backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  backCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Search result header ───────────────────────────────────────────────────
  searchResultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  searchResultText: { color: COLORS.mutedDark, fontSize: FONT.sm },
})

// ── Week Picker Modal styles ───────────────────────────────────────────────────
const d = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  dragHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  guestBlock: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.purpleDark + '44', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.purple, fontSize: 18, fontWeight: '800' },
  guestName: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  guestSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  infoCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  rowIcon: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: COLORS.mutedDark, fontSize: 11, marginBottom: 3 },
  rowValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginLeft: SPACING.md + 34 + SPACING.sm },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.cta + '14',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cta + '44',
    padding: SPACING.md,
  },
  warningText: { flex: 1, color: COLORS.cta, fontSize: FONT.sm, fontWeight: '700', lineHeight: 19 },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  checkInBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '800' },
  editBlock: { gap: SPACING.md },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  editHint: { color: COLORS.mutedDark, fontSize: 11, marginTop: 3 },
  guestInput: {
    width: 58,
    height: 42,
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: COLORS.bgCard2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveMiniBtn: {
    minWidth: 58,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
  },
  saveMiniBtnDisabled: { opacity: 0.6 },
  saveMiniBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '800' },
  assignBlock: { gap: SPACING.sm },
  assignTitle: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '800' },
  tableOptions: { gap: SPACING.sm, paddingRight: SPACING.md },
  tableOption: {
    width: 132,
    minHeight: 78,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    gap: 3,
  },
  tableOptionActive: { borderColor: COLORS.purple, backgroundColor: COLORS.purple + '18' },
  tableOptionDisabled: { opacity: 0.45 },
  tableOptionNum: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '800' },
  tableOptionTextActive: { color: COLORS.purple },
  tableOptionMeta: { color: COLORS.mutedDark, fontSize: 11 },
  tableTakenText: { color: COLORS.pink, fontSize: 10, fontWeight: '700', marginTop: 2 },
  doneBtn: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '800' },
})

const p = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl,
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  dragHandle:  { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle:  { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },

  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },

  dowRow:   { flexDirection: 'row', marginBottom: SPACING.xs },
  dowText:  { flex: 1, textAlign: 'center', color: COLORS.mutedDark, fontSize: 12, fontWeight: '600' },

  weekRow:          { flexDirection: 'row', borderRadius: RADIUS.md, marginBottom: 4, overflow: 'hidden' },
  weekRowHovered:   { backgroundColor: COLORS.purpleDark + '33' },
  weekRowConfirmed: { backgroundColor: COLORS.purpleDark + '55', borderWidth: 1, borderColor: COLORS.purple + '88' },

  dayCell:  { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dayText:      { color: COLORS.white, fontSize: 14, fontWeight: '500', zIndex: 1 },
  dayTextMuted: { color: COLORS.mutedDark },
  dayTextActive:{ color: '#fff', fontWeight: '700' },
  dayTextToday: { color: COLORS.purple, fontWeight: '800' },
  todayRing:    { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.purple },

  footer:      { marginTop: SPACING.lg, gap: SPACING.sm },
  previewText: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center' },
  confirmBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  confirmBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
})
