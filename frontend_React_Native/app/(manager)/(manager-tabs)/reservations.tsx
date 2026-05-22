import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type TypeFilter = 'All' | 'Tickets' | 'Tables'

type Reservation = {
  reservation_id:   string
  type:             'ticket' | 'table'
  status:           'pending' | 'confirmed' | 'cancelled' | 'completed'
  nr_of_people:     number | null
  reservation_date: string | null
  created_at:       string | null
  events: { event_name: string; final_ticket_price: number | null } | null
  profiles: { name: string | null; surname: string | null } | null
  tables: { minimum_spend: number | null; table_number: string } | null
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReservationsScreen() {
  const { profile } = useAuth()
  const PRESETS = useMemo(() => getPresetWeeks(), [])

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('All')
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

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

    const { data: eventRows } = await supabase
      .from('events').select('event_id').eq('club_id', profile.club_id)
    const eventIds = (eventRows ?? []).map((e: { event_id: string }) => e.event_id)

    const { data: ticketRes } = eventIds.length > 0
      ? await supabase
          .from('reservations')
          .select(`reservation_id,type,status,nr_of_people,reservation_date,created_at,
            events(event_name,final_ticket_price),profiles(name,surname),tables(minimum_spend,table_number),ticket_types(name,price)`)
          .in('event_id', eventIds)
          .gte('reservation_date', rangeStart)
          .lte('reservation_date', rangeEnd)
          .order('reservation_date', { ascending: true })
      : { data: [] }

    const { data: tableRows } = await supabase
      .from('tables').select('id').eq('club_id', profile.club_id)
    const tableIds = (tableRows ?? []).map((t: { id: string }) => t.id)

    const { data: tableRes } = tableIds.length > 0
      ? await supabase
          .from('reservations')
          .select(`reservation_id,type,status,nr_of_people,reservation_date,created_at,
            events(event_name,final_ticket_price),profiles(name,surname),tables(minimum_spend,table_number),ticket_types(name,price)`)
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
      .sort((a, b) => ((a.reservation_date ?? '') > (b.reservation_date ?? '') ? 1 : -1))

    setReservations(deduped as unknown as Reservation[])
    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchReservations(selectedWeek) }, [fetchReservations, selectedWeek])

  const onRefresh = () => { setRefreshing(true); fetchReservations(selectedWeek) }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (typeFilter === 'All') return reservations
    return reservations.filter(r => r.type === (typeFilter === 'Tickets' ? 'ticket' : 'table'))
  }, [reservations, typeFilter])

  const grouped = useMemo(() => {
    const map: Record<string, Reservation[]> = {}
    for (const r of filtered) {
      const key = (r.reservation_date ?? r.created_at ?? '').slice(0, 10) || 'no-date'
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const total     = reservations.length
  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const pending   = reservations.filter(r => r.status === 'pending').length
  const cancelled = reservations.filter(r => r.status === 'cancelled').length

  // ── Status change ─────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: Reservation['status']) {
    const { error } = await supabase.from('reservations').update({ status }).eq('reservation_id', id)
    if (error) { Alert.alert('Error', error.message); return }
    setReservations(prev => prev.map(r => r.reservation_id === id ? { ...r, status } : r))
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getDisplayName(r: Reservation) {
    if (!r.profiles) return 'Guest'
    return [r.profiles.name, r.profiles.surname].filter(Boolean).join(' ') || 'Guest'
  }
  function getAmount(r: Reservation) {
    if (r.type === 'table' && r.tables?.minimum_spend) return `€${r.tables.minimum_spend}`
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
  function formatDate(d: string | null) {
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

        <Text style={s.pageTitle}>Reservations & Tickets</Text>
        <Text style={s.pageSubtitle}>Manage all bookings and reservations</Text>

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
            [String(pending),   COLORS.cta,   'Pending'],
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
          {(['All', 'Tickets', 'Tables'] as TypeFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, typeFilter === f && s.filterTabActive]}
              onPress={() => setTypeFilter(f)}
            >
              <Text style={[s.filterText, typeFilter === f && s.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Empty ── */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>
              No {typeFilter !== 'All' ? typeFilter.toLowerCase() + ' ' : ''}reservations
            </Text>
            <Text style={s.emptySubtitle}>{fmtRange(selectedWeek.start, selectedWeek.end)}</Text>
          </View>
        ) : (
          grouped.map(([dateKey, rows]) => (
            <View key={dateKey}>
              <View style={s.dayHeader}>
                <View style={s.dayDot} />
                <Text style={s.dayHeaderText}>{formatDayHeader(dateKey)}</Text>
                <View style={s.dayLine} />
                <View style={s.dayCountBadge}><Text style={s.dayCountText}>{rows.length}</Text></View>
              </View>

              {rows.map(r => {
                const sc = STATUS_COLOR[r.status] ?? COLORS.muted
                const tc = TYPE_COLOR[r.type]    ?? COLORS.muted
                const name      = getDisplayName(r)
                const amount    = getAmount(r)
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
                          {r.reservation_date && <Text style={s.reservDate}>{formatDate(r.reservation_date)}</Text>}
                        </View>
                      </View>
                      <Text style={s.reservAmount}>{amount}</Text>
                    </View>

                    <View style={s.reservTags}>
                      <View style={[s.typeBadge, { backgroundColor: tc + '22' }]}>
                        <Text style={[s.typeText, { color: tc }]}>{r.type.charAt(0).toUpperCase() + r.type.slice(1)}</Text>
                      </View>
                      <View style={[s.typeBadge, { backgroundColor: sc + '22' }]}>
                        <Text style={[s.typeText, { color: sc }]}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Text>
                      </View>
                      {r.nr_of_people != null && (
                        <View style={s.typeBadge}><Text style={s.typeText}>{r.nr_of_people} guests</Text></View>
                      )}
                    </View>

                    {r.status === 'pending' && (
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
                    {r.status === 'confirmed' && (
                      <TouchableOpacity style={s.completeBtn} onPress={(e) => { e.stopPropagation(); handleStatusChange(r.reservation_id, 'completed') }}>
                        <Ionicons name="checkmark-done-outline" size={14} color={COLORS.green} />
                        <Text style={s.completeBtnText}>Mark Completed</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          ))
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
                <DetailRow icon="calendar-outline" label="Event" value={selectedReservation.events?.event_name ?? 'No event linked'} />
                <View style={d.divider} />
                <DetailRow icon="time-outline" label="Date" value={formatDate(selectedReservation.reservation_date) || 'Date not set'} />
                <View style={d.divider} />
                <DetailRow icon="checkmark-circle-outline" label="Status" value={selectedReservation.status.charAt(0).toUpperCase() + selectedReservation.status.slice(1)} />
                <View style={d.divider} />
                {selectedReservation.type === 'table' ? (
                  <>
                    <DetailRow icon="restaurant-outline" label="Table" value={selectedReservation.tables?.table_number ? `Table ${selectedReservation.tables.table_number}` : 'Table not set'} />
                    <View style={d.divider} />
                    <DetailRow icon="cash-outline" label="Minimum spend" value={selectedReservation.tables?.minimum_spend ? `€${selectedReservation.tables.minimum_spend.toFixed(2)}` : 'Not set'} />
                  </>
                ) : (
                  <>
                    <DetailRow icon="ticket-outline" label="Ticket type" value={selectedReservation.ticket_types?.name ?? 'Standard ticket'} />
                    <View style={d.divider} />
                    <DetailRow icon="cash-outline" label="Ticket price" value={
                      selectedReservation.ticket_types?.price != null
                        ? `€${selectedReservation.ticket_types.price.toFixed(2)}`
                        : selectedReservation.events?.final_ticket_price != null
                          ? `€${selectedReservation.events.final_ticket_price.toFixed(2)}`
                          : 'Not set'
                    } />
                  </>
                )}
              </View>

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
  appName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
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
  filterRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  filterTab:        { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive:  { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purpleDark },
  filterText:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

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
  typeBadge:    { backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  typeText:     { color: COLORS.muted, fontSize: 11, fontWeight: '600' },

  actionRow:      { flexDirection: 'row', gap: SPACING.sm },
  confirmBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.green, borderRadius: RADIUS.sm, paddingVertical: 10 },
  confirmBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  rejectBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.red + '22', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.red + '44' },
  rejectBtnText:  { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },
  completeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.green + '22', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.green + '44' },
  completeBtnText:{ color: COLORS.green, fontSize: FONT.sm, fontWeight: '600' },
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
