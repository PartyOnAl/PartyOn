import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Image, Modal, Pressable,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Event, Club } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { isEventUpcomingOrLive } from '@/lib/eventDates'

const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

// ── Calendar Picker ──────────────────────────────────────────────────────────
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CalendarPickerProps {
  visible: boolean
  selectedFrom: Date | null
  selectedTo: Date | null
  onApply: (from: Date | null, to: Date | null) => void
  onClose: () => void
}

function CalendarPicker({ visible, selectedFrom, selectedTo, onApply, onClose }: CalendarPickerProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [from, setFrom] = useState<Date | null>(selectedFrom)
  const [to, setTo] = useState<Date | null>(selectedTo)
  const [step, setStep] = useState<'from' | 'to'>('from')

  useEffect(() => {
    if (visible) {
      setFrom(selectedFrom)
      setTo(selectedTo)
      setStep('from')
    }
  }, [visible])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  function tapDay(day: number) {
    const d = new Date(year, month, day)
    if (step === 'from') {
      setFrom(d)
      setTo(null)
      setStep('to')
    } else {
      if (from && d < from) {
        setFrom(d)
        setTo(null)
        setStep('to')
      } else {
        setTo(d)
        setStep('from')
      }
    }
  }

  function isSelected(day: number) {
    const d = new Date(year, month, day)
    if (from && isoDate(d) === isoDate(from)) return 'from'
    if (to && isoDate(d) === isoDate(to)) return 'to'
    return false
  }

  function isInRange(day: number) {
    if (!from || !to) return false
    const d = new Date(year, month, day)
    return d > from && d < to
  }

  function isToday(day: number) {
    return isoDate(new Date(year, month, day)) === isoDate(today)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.calOverlay} onPress={onClose}>
        <Pressable style={styles.calSheet} onPress={() => {}}>
          {/* Handle */}
          <View style={styles.calHandle} />

          {/* Instruction */}
          <Text style={styles.calInstruction}>
            {step === 'from' ? 'Select start date' : 'Select end date'}
          </Text>

          {/* Month nav */}
          <View style={styles.calNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.calNavTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.calDayHeaders}>
            {DAYS.map((d, i) => (
              <Text key={i} style={styles.calDayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.calRow}>
              {row.map((day, di) => {
                const sel = day ? isSelected(day) : false
                const inRange = day ? isInRange(day) : false
                const tod = day ? isToday(day) : false
                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      styles.calCell,
                      inRange && styles.calCellInRange,
                      sel === 'from' && styles.calCellFrom,
                      sel === 'to' && styles.calCellTo,
                    ]}
                    onPress={() => day && tapDay(day)}
                    activeOpacity={day ? 0.75 : 1}
                    disabled={!day}
                  >
                    {tod && !sel && <View style={styles.calTodayDot} />}
                    <Text style={[
                      styles.calCellText,
                      !day && { opacity: 0 },
                      inRange && styles.calCellTextInRange,
                      sel && styles.calCellTextSelected,
                    ]}>
                      {day ?? '·'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}

          {/* Selection summary */}
          <View style={styles.calSummary}>
            <View style={styles.calSummaryItem}>
              <Text style={styles.calSummaryLabel}>From</Text>
              <Text style={styles.calSummaryValue}>{from ? isoDate(from) : '—'}</Text>
            </View>
            <View style={styles.calSummaryDivider} />
            <View style={styles.calSummaryItem}>
              <Text style={styles.calSummaryLabel}>To</Text>
              <Text style={styles.calSummaryValue}>{to ? isoDate(to) : '—'}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.calActions}>
            <TouchableOpacity
              style={styles.calClearBtn}
              onPress={() => { setFrom(null); setTo(null); setStep('from') }}
            >
              <Text style={styles.calClearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calApplyBtn}
              onPress={() => onApply(from, to)}
            >
              <Text style={styles.calApplyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── City helpers ─────────────────────────────────────────────────────────────
const CITY_PATTERNS: { city: string; match: string }[] = [
  { city: 'Tirana', match: 'tiran' },
  { city: 'Durrës', match: 'durr' },
  { city: 'Vlorë', match: 'vlor' },
  { city: 'Shkodër', match: 'shkod' },
  { city: 'Elbasan', match: 'elbasan' },
  { city: 'Fier', match: 'fier' },
  { city: 'Korçë', match: 'korc' },
  { city: 'Berat', match: 'berat' },
  { city: 'Sarandë', match: 'saran' },
]

function addressToCity(address: string | null): string | null {
  if (!address) return null
  const lower = address.toLowerCase()
  const found = CITY_PATTERNS.find(p => lower.includes(p.match))
  return found?.city ?? null
}

// ── Search Screen ────────────────────────────────────────────────────────────
type ResultItem =
  | { kind: 'header'; label: string; onSeeAll?: () => void }
  | { kind: 'event'; data: Event }
  | { kind: 'club'; data: Club }
  | { kind: 'empty'; label: string }

export default function SearchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ q?: string }>()

  const [query, setQuery] = useState(params.q ?? '')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(false)
  const [allClubs, setAllClubs] = useState<Club[]>([])
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [showLocationDrop, setShowLocationDrop] = useState(false)

  useEffect(() => {
    supabase.from('clubs').select('club_id,club_name,club_address').eq('club_status', 'approved')
      .then(({ data }) => setAllClubs((data as Club[]) ?? []))
  }, [])

  // Derive unique cities that have at least one club
  const availableCities = useMemo(() => {
    const seen = new Set<string>()
    allClubs.forEach(c => {
      const city = addressToCity(c.club_address)
      if (city) seen.add(city)
    })
    return Array.from(seen).sort()
  }, [allClubs])

  // Club IDs belonging to the selected city
  const cityClubIds = useMemo(() => {
    if (!selectedCity) return null
    return allClubs
      .filter(c => addressToCity(c.club_address) === selectedCity)
      .map(c => c.club_id)
  }, [allClubs, selectedCity])

  const runSearch = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let evQ = supabase.from('events').select('*, clubs(*)').eq('event_status', 'published').gte('event_starting_date', today.toISOString()).order('event_starting_date', { ascending: true })
    if (query.trim()) evQ = evQ.ilike('event_name', `%${query.trim()}%`)
    if (dateFrom) evQ = evQ.gte('event_starting_date', isoDate(dateFrom))
    if (dateTo) evQ = evQ.lte('event_starting_date', isoDate(dateTo) + 'T23:59:59')
    if (cityClubIds && cityClubIds.length > 0) evQ = evQ.in('club_id', cityClubIds)

    let clQ = supabase.from('clubs').select('*').eq('club_status', 'approved')
    if (query.trim()) clQ = clQ.ilike('club_name', `%${query.trim()}%`)

    const [evRes, clRes] = await Promise.all([evQ, clQ])
    const rows = (evRes.data as Event[]) ?? []
    setEvents(dateFrom ? rows : rows.filter(ev => isEventUpcomingOrLive(ev)))
    setClubs((clRes.data as Club[]) ?? [])
    setLoading(false)
  }, [query, dateFrom, dateTo, cityClubIds])

  useEffect(() => {
    const t = setTimeout(runSearch, 350)
    return () => clearTimeout(t)
  }, [runSearch])

  function handleCalendarApply(from: Date | null, to: Date | null) {
    setDateFrom(from)
    setDateTo(to)
    setShowCalendar(false)
  }

  const hasFilter = dateFrom !== null || dateTo !== null
  const hasLocationFilter = selectedCity !== null

  const filterLabel = hasFilter
    ? `${dateFrom ? isoDate(dateFrom) : '…'} → ${dateTo ? isoDate(dateTo) : '…'}`
    : null

  const items: ResultItem[] = [
    { kind: 'header', label: 'Events', onSeeAll: () => router.push('/all-events') },
    ...(events.length === 0
      ? [{ kind: 'empty' as const, label: 'No events found.' }]
      : events.map((e) => ({ kind: 'event' as const, data: e }))),
    { kind: 'header', label: 'Clubs' },
    ...(clubs.length === 0
      ? [{ kind: 'empty' as const, label: 'No clubs found.' }]
      : clubs.map((c) => ({ kind: 'club' as const, data: c }))),
  ]

  function renderItem({ item }: { item: ResultItem }) {
    if (item.kind === 'header') {
      return (
        <View style={styles.catHeaderRow}>
          <Text style={styles.catHeader}>{item.label}</Text>
          {item.onSeeAll ? (
            <TouchableOpacity onPress={item.onSeeAll} hitSlop={8}>
              <Text style={styles.catSeeAll}>See all →</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )
    }
    if (item.kind === 'empty') {
      return <Text style={styles.empty}>{item.label}</Text>
    }
    if (item.kind === 'event') {
      const ev = item.data
      const hasTicketOffer = ev.final_ticket_price != null || ev.ticket_price != null
      const isReservationOnly = !hasTicketOffer && ((ev.reservation_only ?? ev.clubs?.reservation_only) ?? false)
      return (
        <TouchableOpacity style={styles.row} onPress={() => router.push(`/event/${ev.event_id}`)} activeOpacity={0.7}>
          {ev.event_image ? (
            <Image source={{ uri: ev.event_image }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, { backgroundColor: fallbackColor(ev.event_id) }]} />
          )}
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>{ev.event_name}</Text>
            <View style={styles.rowMeta}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.muted} />
              <Text style={styles.rowMetaText}>{formatDate(ev.event_starting_date)}</Text>
              {ev.clubs?.club_address && (
                <>
                  <View style={styles.dot} />
                  <Text style={styles.rowMetaText} numberOfLines={1}>{ev.clubs.club_address}</Text>
                </>
              )}
            </View>
            {ev.final_ticket_price != null ? (
              <Text style={styles.price}>€{Number(ev.final_ticket_price).toFixed(2)}</Text>
            ) : isReservationOnly ? (
              <Text style={styles.reservationTag}>Reservation Only</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
        </TouchableOpacity>
      )
    }
    if (item.kind === 'club') {
      const club = item.data
      return (
        <TouchableOpacity style={styles.row} onPress={() => router.push(`/club/${club.club_id}`)} activeOpacity={0.7}>
          {club.club_image ? (
            <Image source={{ uri: club.club_image }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, { backgroundColor: fallbackColor(club.club_id) }]} />
          )}
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle} numberOfLines={1}>{club.club_name}</Text>
            {club.club_address && (
              <View style={styles.rowMeta}>
                <Ionicons name="location-outline" size={11} color={COLORS.muted} />
                <Text style={styles.rowMetaText} numberOfLines={1}>{club.club_address}</Text>
              </View>
            )}
            {club.reservation_only && (
              <Text style={styles.reservationTag}>Free reservation</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
        </TouchableOpacity>
      )
    }
    return null
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, clubs…"
            placeholderTextColor={COLORS.mutedDark}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.mutedDark} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, hasLocationFilter && styles.filterBtnActive]}
          onPress={() => setShowLocationDrop(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="location-outline" size={18} color={hasLocationFilter ? COLORS.purple : COLORS.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, hasFilter && styles.filterBtnActive]}
          onPress={() => setShowCalendar(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={18} color={hasFilter ? COLORS.purple : COLORS.muted} />
        </TouchableOpacity>
      </View>

      {/* Active filter pills */}
      {(hasLocationFilter || hasFilter) && (
        <View style={styles.filterPillsRow}>
          {hasLocationFilter && (
            <View style={styles.filterPill}>
              <Ionicons name="location" size={13} color={COLORS.purple} />
              <Text style={styles.filterPillText} numberOfLines={1}>{selectedCity}</Text>
              <TouchableOpacity onPress={() => setSelectedCity(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={COLORS.mutedDark} />
              </TouchableOpacity>
            </View>
          )}
          {hasFilter && (
            <View style={styles.filterPill}>
              <Ionicons name="calendar" size={13} color={COLORS.purple} />
              <Text style={styles.filterPillText}>{filterLabel}</Text>
              <TouchableOpacity onPress={() => { setDateFrom(null); setDateTo(null) }} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={COLORS.mutedDark} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => {
            if (item.kind === 'header') return `h-${item.label}`
            if (item.kind === 'empty') return `e-${i}`
            if (item.kind === 'event') return `ev-${item.data.event_id}`
            if (item.kind === 'club') return `cl-${item.data.club_id}`
            return String(i)
          }}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CalendarPicker
        visible={showCalendar}
        selectedFrom={dateFrom}
        selectedTo={dateTo}
        onApply={handleCalendarApply}
        onClose={() => setShowCalendar(false)}
      />

      {/* City picker */}
      <Modal visible={showLocationDrop} transparent animationType="slide" onRequestClose={() => setShowLocationDrop(false)}>
        <Pressable style={styles.calOverlay} onPress={() => setShowLocationDrop(false)}>
          <Pressable style={styles.calSheet} onPress={() => {}}>
            <View style={styles.calHandle} />
            <Text style={styles.calInstruction}>Filter by city</Text>
            {availableCities.length === 0 ? (
              <Text style={styles.locEmpty}>No cities found.</Text>
            ) : (
              <FlatList
                data={availableCities}
                keyExtractor={c => c}
                style={styles.locList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.locSep} />}
                renderItem={({ item: city }) => {
                  const active = selectedCity === city
                  const count = allClubs.filter(c => addressToCity(c.club_address) === city).length
                  return (
                    <TouchableOpacity
                      style={[styles.locRow, active && styles.locRowActive]}
                      onPress={() => {
                        setSelectedCity(active ? null : city)
                        setShowLocationDrop(false)
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.locIcon, active && styles.locIconActive]}>
                        <Ionicons name="location-outline" size={16} color={active ? COLORS.purple : COLORS.muted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.locName, active && { color: COLORS.purple }]}>{city}</Text>
                        <Text style={styles.locAddr}>{count} venue{count !== 1 ? 's' : ''}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={18} color={COLORS.purple} />}
                    </TouchableOpacity>
                  )
                }}
              />
            )}
            {selectedCity && (
              <TouchableOpacity style={[styles.calClearBtn, { marginTop: SPACING.sm }]} onPress={() => { setSelectedCity(null); setShowLocationDrop(false) }}>
                <Text style={styles.calClearBtnText}>Clear city filter</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const CAL_CELL_SIZE = 40

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.base },
  filterBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: {
    borderColor: COLORS.purple,
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(167,139,250,0.10)',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    maxWidth: 200,
  },
  filterPillText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', flex: 1 },
  catHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  catSeeAll: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '700' },
  catHeader: {
    color: COLORS.mutedDark,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  thumb: {
    width: 50, height: 50, borderRadius: RADIUS.md,
    flexShrink: 0,
    backgroundColor: COLORS.bgCard,
  },
  rowBody: { flex: 1 },
  rowTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  rowMetaText: { color: COLORS.muted, fontSize: 12 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.mutedDark },
  price: { color: COLORS.purple, fontSize: 12, fontWeight: '700', marginTop: 3 },
  reservationTag: { color: COLORS.purple, fontSize: 11, fontWeight: '600', marginTop: 3 },

  // Calendar
  calOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  calSheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  calHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  calInstruction: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  calNavTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  calDayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.xs,
  },
  calDayHeader: {
    width: CAL_CELL_SIZE,
    textAlign: 'center',
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    fontWeight: '600',
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  calCell: {
    width: CAL_CELL_SIZE,
    height: CAL_CELL_SIZE,
    borderRadius: CAL_CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellInRange: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 0,
  },
  calCellFrom: {
    backgroundColor: COLORS.purple,
    borderRadius: CAL_CELL_SIZE / 2,
  },
  calCellTo: {
    backgroundColor: COLORS.purple,
    borderRadius: CAL_CELL_SIZE / 2,
  },
  calCellText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '500' },
  calCellTextInRange: { color: COLORS.purple },
  calCellTextSelected: { color: '#fff', fontWeight: '700' },
  calTodayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.purple,
  },
  calSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calSummaryItem: { flex: 1, alignItems: 'center' },
  calSummaryDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  calSummaryLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  calSummaryValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  calActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  calClearBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calClearBtnText: { color: COLORS.white, fontWeight: '600', fontSize: FONT.base },
  calApplyBtn: {
    flex: 2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.purple,
  },
  calApplyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },

  // Location picker
  locList: { maxHeight: 340 },
  locSep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  locEmpty: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingVertical: SPACING.xl },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  locRowActive: { backgroundColor: 'rgba(167,139,250,0.07)' },
  locIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.bgInput,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  locIconActive: { backgroundColor: 'rgba(167,139,250,0.15)' },
  locName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  locAddr: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
})
