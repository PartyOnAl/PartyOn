import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Modal, Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Event } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

// ── Helpers ───────────────────────────────────────────────────────────────────
const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
}
function formatRangeLabel(from: Date | null, to: Date | null) {
  if (!from) return 'Pick dates'
  const fmt = (d: Date) => formatShortDate(d.toISOString())
  if (!to || isoDate(from) === isoDate(to)) return fmt(from)
  return `${fmt(from)} — ${fmt(to)}`
}

// ── Quick filter presets ──────────────────────────────────────────────────────
type Preset = 'all' | 'thisWeek' | 'nextWeek' | 'thisMonth'

function presetRange(key: Preset): { from: Date; to: Date } | null {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const wStart = new Date(now); wStart.setDate(now.getDate() + diffToMon); wStart.setHours(0, 0, 0, 0)
  const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6); wEnd.setHours(23, 59, 59, 999)
  const nwStart = new Date(wStart); nwStart.setDate(wStart.getDate() + 7)
  const nwEnd = new Date(nwStart); nwEnd.setDate(nwStart.getDate() + 6); nwEnd.setHours(23, 59, 59, 999)
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  switch (key) {
    case 'thisWeek':  return { from: now,    to: wEnd  }
    case 'nextWeek':  return { from: nwStart, to: nwEnd }
    case 'thisMonth': return { from: mStart,  to: mEnd  }
    default:          return null
  }
}

// ── Calendar Picker ───────────────────────────────────────────────────────────
const CAL_DAYS  = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const CAL_MONTHS = [
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
  const [to, setTo]     = useState<Date | null>(selectedTo)
  const [step, setStep] = useState<'from' | 'to'>('from')

  useEffect(() => {
    if (visible) { setFrom(selectedFrom); setTo(selectedTo); setStep('from') }
  }, [visible])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function tapDay(day: number) {
    const d = new Date(year, month, day)
    if (step === 'from') { setFrom(d); setTo(null); setStep('to') }
    else {
      if (from && d < from) { setFrom(d); setTo(null); setStep('to') }
      else { setTo(d); setStep('from') }
    }
  }

  function isSelected(day: number) {
    const d = new Date(year, month, day)
    if (from && isoDate(d) === isoDate(from)) return 'from'
    if (to   && isoDate(d) === isoDate(to))   return 'to'
    return false
  }
  function isInRange(day: number) {
    if (!from || !to) return false
    const d = new Date(year, month, day)
    return d > from && d < to
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={calS.overlay} onPress={onClose}>
        <Pressable style={calS.sheet} onPress={() => {}}>
          <View style={calS.handle} />
          <Text style={calS.instruction}>
            {step === 'from' ? 'Select start date' : 'Select end date'}
          </Text>

          {/* Month nav */}
          <View style={calS.nav}>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month - 1, 1))} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={calS.navTitle}>{CAL_MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month + 1, 1))} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={calS.dayHeaders}>
            {CAL_DAYS.map((d, i) => <Text key={i} style={calS.dayHeader}>{d}</Text>)}
          </View>

          {/* Grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={calS.row}>
              {row.map((day, di) => {
                const sel = day ? isSelected(day) : false
                const inR = day ? isInRange(day) : false
                return (
                  <TouchableOpacity
                    key={di}
                    style={[calS.cell, inR && calS.cellInRange, sel === 'from' && calS.cellFrom, sel === 'to' && calS.cellTo]}
                    onPress={() => day && tapDay(day)}
                    activeOpacity={day ? 0.75 : 1}
                    disabled={!day}
                  >
                    <Text style={[calS.cellText, !day && { opacity: 0 }, inR && calS.cellTextInRange, sel && calS.cellTextSel]}>
                      {day ?? '·'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}

          {/* Summary */}
          <View style={calS.summary}>
            <View style={calS.summaryItem}>
              <Text style={calS.summaryLabel}>From</Text>
              <Text style={calS.summaryValue}>{from ? isoDate(from) : '—'}</Text>
            </View>
            <View style={calS.summaryDivider} />
            <View style={calS.summaryItem}>
              <Text style={calS.summaryLabel}>To</Text>
              <Text style={calS.summaryValue}>{to ? isoDate(to) : '—'}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={calS.actions}>
            <TouchableOpacity style={calS.clearBtn} onPress={() => { setFrom(null); setTo(null); setStep('from') }}>
              <Text style={calS.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={calS.applyBtn} onPress={() => onApply(from, to)}>
              <Text style={calS.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const calS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  instruction: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center', marginBottom: SPACING.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  dayHeaders: { flexDirection: 'row', marginBottom: SPACING.xs },
  dayHeader: { flex: 1, textAlign: 'center', color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 2 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  cellInRange: { backgroundColor: 'rgba(124,58,237,0.18)' },
  cellFrom: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm },
  cellTo: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm },
  cellText: { color: COLORS.white, fontSize: FONT.sm },
  cellTextInRange: { color: COLORS.purple },
  cellTextSel: { color: COLORS.white, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, padding: SPACING.sm },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  clearBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  clearBtnText: { color: COLORS.muted, fontSize: FONT.base, fontWeight: '600' },
  applyBtn: { flex: 2, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.purpleDark, alignItems: 'center' },
  applyBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
})

// ── Event list card ───────────────────────────────────────────────────────────
function EventListCard({ event }: { event: Event }) {
  const router = useRouter()
  const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const d = new Date(event.event_starting_date)
  const isFree = event.final_ticket_price === 0

  return (
    <TouchableOpacity
      style={eventCardS.card}
      onPress={() => router.push(`/event/${event.event_id}`)}
      activeOpacity={0.82}
    >
      {/* Date column */}
      <View style={eventCardS.dateCol}>
        <Text style={eventCardS.dateDay}>{d.getDate()}</Text>
        <Text style={eventCardS.dateMonth}>{MONTHS_SHORT[d.getMonth()]}</Text>
      </View>

      {/* Thumbnail */}
      {event.event_image ? (
        <Image source={{ uri: event.event_image }} style={eventCardS.thumb} resizeMode="cover" />
      ) : (
        <View style={[eventCardS.thumb, { backgroundColor: fallbackColor(event.event_id) }]} />
      )}

      {/* Info */}
      <View style={eventCardS.info}>
        {event.event_type && (
          <Text style={eventCardS.type}>{event.event_type.toUpperCase()}</Text>
        )}
        <Text style={eventCardS.name} numberOfLines={2}>{event.event_name}</Text>
        <Text style={eventCardS.date}>{formatDate(event.event_starting_date)}</Text>
        {event.clubs?.club_name && (
          <View style={eventCardS.venueRow}>
            <Ionicons name="location-outline" size={10} color={COLORS.mutedDark} />
            <Text style={eventCardS.venue} numberOfLines={1}>{event.clubs.club_name}</Text>
          </View>
        )}
      </View>

      {/* Price */}
      {event.final_ticket_price != null && (
        <View style={[eventCardS.priceChip, isFree && eventCardS.priceChipFree]}>
          <Text style={[eventCardS.priceText, isFree && eventCardS.priceTextFree]}>
            {isFree ? 'FREE' : `€${Number(event.final_ticket_price).toFixed(2)}`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const eventCardS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  dateCol: { width: 40, alignItems: 'center', flexShrink: 0 },
  dateDay: { fontSize: 22, fontWeight: '800', color: COLORS.white, lineHeight: 26 },
  dateMonth: { fontSize: 10, fontWeight: '700', color: COLORS.purple, letterSpacing: 0.5 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.md, flexShrink: 0 },
  info: { flex: 1, gap: 2 },
  type: { fontSize: 9, fontWeight: '700', color: COLORS.purple, letterSpacing: 0.8 },
  name: { fontSize: FONT.base, fontWeight: '700', color: COLORS.white },
  date: { fontSize: 12, color: COLORS.muted },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  venue: { fontSize: 11, color: COLORS.mutedDark, flex: 1 },
  priceChip: {
    flexShrink: 0,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.purpleDark,
  },
  priceChipFree: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: COLORS.green },
  priceText: { fontSize: 12, fontWeight: '800', color: COLORS.purple },
  priceTextFree: { color: COLORS.green },
})

// ── Main screen ───────────────────────────────────────────────────────────────
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all',       label: 'All'        },
  { key: 'thisWeek',  label: 'This Week'  },
  { key: 'nextWeek',  label: 'Next Week'  },
  { key: 'thisMonth', label: 'This Month' },
]

export default function AllEventsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activePreset, setActivePreset] = useState<Preset>('all')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo,   setDateTo]   = useState<Date | null>(null)
  const [calOpen,  setCalOpen]  = useState(false)

  const hasCustomRange = dateFrom !== null

  const fetchEvents = useCallback(async (from: Date | null, to: Date | null) => {
    setLoading(true)
    const now = new Date().toISOString()
    let q = supabase
      .from('events')
      .select('*, clubs(club_name, club_address)')
      .eq('event_status', 'published')
      .gte('event_starting_date', from ? from.toISOString() : now)
      .order('event_starting_date', { ascending: true })
      .limit(50)

    if (to) {
      const end = new Date(to); end.setHours(23, 59, 59, 999)
      q = q.lte('event_starting_date', end.toISOString())
    }

    const { data } = await q
    setEvents((data as Event[]) ?? [])
    setLoading(false)
  }, [])

  // Initial load
  useEffect(() => { fetchEvents(null, null) }, [])

  function applyPreset(key: Preset) {
    setActivePreset(key)
    setDateFrom(null)
    setDateTo(null)
    const range = presetRange(key)
    fetchEvents(range?.from ?? null, range?.to ?? null)
  }

  function applyCustomRange(from: Date | null, to: Date | null) {
    setCalOpen(false)
    setDateFrom(from)
    setDateTo(to)
    setActivePreset('all') // clear preset highlight
    fetchEvents(from, to)
  }

  const filterLabel = hasCustomRange ? formatRangeLabel(dateFrom, dateTo) : 'Pick dates'

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Upcoming Events</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter row */}
      <View style={s.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PRESETS}
          keyExtractor={(p) => p.key}
          contentContainerStyle={{ paddingLeft: SPACING.md, gap: SPACING.xs }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.chip, activePreset === item.key && !hasCustomRange && s.chipActive]}
              onPress={() => applyPreset(item.key)}
            >
              <Text style={[s.chipText, activePreset === item.key && !hasCustomRange && s.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={[s.chip, s.chipCalendar, hasCustomRange && s.chipActive]}
              onPress={() => setCalOpen(true)}
            >
              <Ionicons name="calendar-outline" size={14} color={hasCustomRange ? COLORS.white : COLORS.purple} />
              <Text style={[s.chipText, s.chipTextCalendar, hasCustomRange && s.chipTextActive]}>
                {filterLabel}
              </Text>
              {hasCustomRange && (
                <TouchableOpacity
                  hitSlop={6}
                  onPress={() => { setDateFrom(null); setDateTo(null); applyPreset('all') }}
                >
                  <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          }
        />
      </View>

      {/* Result count */}
      <View style={s.countRow}>
        <Text style={s.countText}>
          {loading ? 'Loading…' : `${events.length} event${events.length !== 1 ? 's' : ''} found`}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : events.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🎭</Text>
          <Text style={s.emptyTitle}>No events found</Text>
          <Text style={s.emptySubtitle}>Try a different date range or check back soon.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => applyPreset('all')}>
            <Text style={s.emptyBtnText}>Show all events</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.event_id}
          renderItem={({ item }) => <EventListCard event={item} />}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xl + 20 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}

      <CalendarPicker
        visible={calOpen}
        selectedFrom={dateFrom}
        selectedTo={dateTo}
        onApply={applyCustomRange}
        onClose={() => setCalOpen(false)}
      />
    </View>
  )
}

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.white },

  filterRow: { paddingVertical: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purpleDark },
  chipCalendar: { borderColor: COLORS.purple, borderStyle: 'dashed' },
  chipText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.muted },
  chipTextActive: { color: COLORS.white },
  chipTextCalendar: { color: COLORS.purple },

  countRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs },
  countText: { fontSize: 12, color: COLORS.mutedDark, fontWeight: '500' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.white },
  emptySubtitle: { fontSize: FONT.sm, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: SPACING.xs, backgroundColor: COLORS.purpleDark, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.pill },
  emptyBtnText: { fontSize: FONT.base, fontWeight: '700', color: COLORS.white },
})
