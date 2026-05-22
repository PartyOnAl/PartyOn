import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, ScrollView, Modal, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Event } from '@/lib/types'
import { isEventUpcomingOrLive } from '@/lib/eventDates'

type Preset = 'all' | 'today' | 'week' | 'month'
type Status = 'all' | 'published' | 'draft' | 'completed' | 'cancelled'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
]

const STATUSES: { key: Status; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
const CAL_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const CAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fallbackColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromKey(key: string, endOfDay = false) {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (endOfDay) date.setHours(23, 59, 59, 999)
  else date.setHours(0, 0, 0, 0)
  return date
}

function eventDateKey(iso: string) {
  return dateKey(new Date(iso))
}

function formatDateKey(key: string) {
  return dateFromKey(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function selectedDateLabel(keys: string[]) {
  if (keys.length === 0) return 'Custom dates'
  const sorted = [...keys].sort()
  if (sorted.length === 1) return formatDateKey(sorted[0])
  return `${sorted.length} dates`
}

function presetRange(key: Preset) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  if (key === 'today') return { from: start, to: end }
  if (key === 'week') {
    const day = start.getDay()
    const diffToMon = day === 0 ? -6 : 1 - day
    const from = new Date(start)
    from.setDate(start.getDate() + diffToMon)
    const to = new Date(from)
    to.setDate(from.getDate() + 6)
    to.setHours(23, 59, 59, 999)
    return { from, to }
  }
  if (key === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  }
  return { from: null, to: null }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusColor(status: string) {
  if (status === 'published') return COLORS.green
  if (status === 'draft') return COLORS.mutedDark
  if (status === 'completed') return COLORS.purple
  if (status === 'cancelled') return COLORS.red
  return COLORS.muted
}

function MultiDatePicker({
  visible,
  selectedKeys,
  onApply,
  onClose,
}: {
  visible: boolean
  selectedKeys: string[]
  onApply: (keys: string[]) => void
  onClose: () => void
}) {
  const today = new Date()
  const initial = selectedKeys[0] ? dateFromKey(selectedKeys[0]) : today
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
  const [draft, setDraft] = useState<string[]>(selectedKeys)

  useEffect(() => {
    if (!visible) return
    const base = selectedKeys[0] ? dateFromKey(selectedKeys[0]) : new Date()
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1))
    setDraft(selectedKeys)
  }, [selectedKeys, visible])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function toggleDay(day: number) {
    const key = dateKey(new Date(year, month, day))
    setDraft(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cal.overlay} onPress={onClose}>
        <Pressable style={cal.sheet} onPress={() => {}}>
          <View style={cal.handle} />
          <Text style={cal.title}>Select dates</Text>
          <Text style={cal.subtitle}>Tap one or more dates, then apply.</Text>

          <View style={cal.nav}>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month - 1, 1))} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={cal.navTitle}>{CAL_MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month + 1, 1))} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={cal.dayHeaders}>
            {CAL_DAYS.map((day, index) => <Text key={`${day}-${index}`} style={cal.dayHeader}>{day}</Text>)}
          </View>

          <View style={cal.grid}>
            {cells.map((day, index) => {
              const key = day ? dateKey(new Date(year, month, day)) : ''
              const selected = !!day && draft.includes(key)
              const isToday = !!day && key === dateKey(today)
              return (
                <TouchableOpacity
                  key={index}
                  style={[cal.cell, selected && cal.cellSelected, isToday && !selected && cal.cellToday]}
                  onPress={() => day && toggleDay(day)}
                  activeOpacity={day ? 0.75 : 1}
                  disabled={!day}
                >
                  <Text style={[cal.cellText, selected && cal.cellTextSelected, isToday && !selected && cal.cellTextToday]}>
                    {day ?? ''}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={cal.summary}>
            <Text style={cal.summaryText}>
              {draft.length === 0 ? 'No dates selected' : `${draft.length} date${draft.length !== 1 ? 's' : ''} selected`}
            </Text>
            {draft.length > 0 ? (
              <TouchableOpacity onPress={() => setDraft([])} hitSlop={8}>
                <Text style={cal.clearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={cal.actions}>
            <TouchableOpacity style={cal.cancelBtn} onPress={onClose}>
              <Text style={cal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cal.applyBtn}
              onPress={() => onApply([...draft].sort())}
            >
              <Text style={cal.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function EventCard({ event }: { event: Event }) {
  const router = useRouter()
  const color = statusColor(event.event_status)
  const price = event.final_ticket_price ?? event.ticket_price

  return (
    <TouchableOpacity style={s.card} onPress={() => router.push(`/event/${event.event_id}`)} activeOpacity={0.84}>
      {event.event_image ? (
        <Image source={{ uri: event.event_image }} style={s.thumb} resizeMode="cover" />
      ) : (
        <View style={[s.thumb, { backgroundColor: fallbackColor(event.event_id) }]}>
          <Ionicons name="calendar-outline" size={24} color={COLORS.white} />
        </View>
      )}
      <View style={s.cardBody}>
        <View style={s.badgeRow}>
          <View style={[s.statusBadge, { borderColor: color, backgroundColor: color + '22' }]}>
            <Text style={[s.statusText, { color }]}>{event.event_status}</Text>
          </View>
          {event.is_featured ? (
            <View style={s.featuredBadge}>
              <Ionicons name="star" size={10} color={COLORS.cta} />
              <Text style={s.featuredText}>Featured</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.eventName} numberOfLines={2}>{event.event_name}</Text>
        <View style={s.metaRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.mutedDark} />
          <Text style={s.metaText}>{formatDate(event.event_starting_date)} · {formatTime(event.event_starting_date)}</Text>
        </View>
        {event.clubs?.club_name ? (
          <View style={s.metaRow}>
            <Ionicons name="business-outline" size={12} color={COLORS.mutedDark} />
            <Text style={s.metaText} numberOfLines={1}>{event.clubs.club_name}</Text>
          </View>
        ) : null}
        <View style={s.statsRow}>
          <Text style={s.statText}>{event.event_capacity?.toLocaleString() ?? '-'} capacity</Text>
          <Text style={s.statText}>{price == null ? '-' : `€${Number(price).toFixed(2)}`}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function AdminEventsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('all')
  const [status, setStatus] = useState<Status>('all')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const hasCustomDateSearch = selectedDates.length > 0

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const presetDates = presetRange(preset)
    const customFrom = hasCustomDateSearch ? dateFromKey([...selectedDates].sort()[0]) : null
    const customTo = hasCustomDateSearch ? dateFromKey([...selectedDates].sort()[selectedDates.length - 1], true) : null
    const fromDate = customFrom ?? presetDates.from
    const toDate = customTo ?? presetDates.to

    let q = supabase
      .from('events')
      .select('*, clubs(club_name, club_id)')
      .order('event_starting_date', { ascending: true })
      .limit(200)

    if (status !== 'all') q = q.eq('event_status', status)
    if (fromDate) q = q.gte('event_starting_date', fromDate.toISOString())
    else if (!hasCustomDateSearch) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      q = q.gte('event_starting_date', today.toISOString())
    }
    if (toDate) q = q.lte('event_starting_date', toDate.toISOString())

    const { data } = await q
    const rows = ((data as Event[]) ?? [])
    const selectedSet = new Set(selectedDates)
    const scopedRows = hasCustomDateSearch
      ? rows.filter(event => selectedSet.has(eventDateKey(event.event_starting_date)))
      : rows.filter(event => isEventUpcomingOrLive(event))
    setEvents(scopedRows)
    setLoading(false)
  }, [hasCustomDateSearch, preset, selectedDates, status])

  useEffect(() => { loadEvents() }, [loadEvents])

  function applyPreset(next: Preset) {
    setPreset(next)
    setSelectedDates([])
  }

  function clearDates() {
    setPreset('all')
    setSelectedDates([])
  }

  const rangeLabel = selectedDateLabel(selectedDates)

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Events</Text>
          <Text style={s.subtitle}>Filter platform events by date and status</Text>
        </View>
      </View>

      <View style={s.filterBlock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {PRESETS.map(item => (
            <TouchableOpacity key={item.key} style={[s.chip, preset === item.key && s.chipActive]} onPress={() => applyPreset(item.key)}>
              <Text style={[s.chipText, preset === item.key && s.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.chip, hasCustomDateSearch && s.chipActive]} onPress={() => setPickerOpen(true)}>
            <Ionicons name="calendar-outline" size={14} color={hasCustomDateSearch ? COLORS.white : COLORS.purple} />
            <Text style={[s.chipText, s.customChipText, hasCustomDateSearch && s.chipTextActive]}>{rangeLabel}</Text>
            {hasCustomDateSearch ? (
              <TouchableOpacity hitSlop={8} onPress={clearDates}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {STATUSES.map(item => (
            <TouchableOpacity key={item.key} style={[s.statusChip, status === item.key && s.statusChipActive]} onPress={() => setStatus(item.key)}>
              <Text style={[s.statusChipText, status === item.key && s.statusChipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={s.countRow}>
        <Text style={s.countText}>{loading ? 'Loading...' : `${events.length} event${events.length !== 1 ? 's' : ''} found`}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
      ) : events.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="calendar-clear-outline" size={48} color={COLORS.mutedDark} />
          <Text style={s.emptyTitle}>No events found</Text>
          <Text style={s.emptySub}>Try another date range or status filter.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.event_id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xl }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <MultiDatePicker
        visible={pickerOpen}
        selectedKeys={selectedDates}
        onClose={() => setPickerOpen(false)}
        onApply={(keys) => {
          setPreset('all')
          setSelectedDates(keys)
          setPickerOpen(false)
        }}
      />
    </View>
  )
}

const cal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginTop: 4, marginBottom: SPACING.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  dayHeaders: { flexDirection: 'row', marginBottom: SPACING.xs },
  dayHeader: { flex: 1, color: COLORS.mutedDark, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  cellSelected: { backgroundColor: COLORS.purple },
  cellToday: { borderWidth: 1, borderColor: COLORS.purple },
  cellText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  cellTextSelected: { color: COLORS.white, fontWeight: '800' },
  cellTextToday: { color: COLORS.purple, fontWeight: '800' },
  summary: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  summaryText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  clearText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: COLORS.muted, fontSize: FONT.base, fontWeight: '700' },
  applyBtn: {
    flex: 2,
    minHeight: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
})

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  filterBlock: { paddingVertical: SPACING.sm, gap: SPACING.sm },
  chipRow: { paddingHorizontal: SPACING.md, gap: SPACING.xs },
  chip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  chipText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  chipTextActive: { color: COLORS.white },
  customChipText: { color: COLORS.purple },
  statusChip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusChipActive: { borderColor: COLORS.purple, backgroundColor: 'rgba(139,92,246,0.18)' },
  statusChipText: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700' },
  statusChipTextActive: { color: COLORS.white },
  countRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs },
  countText: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  thumb: {
    width: 78,
    height: 96,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statusBadge: { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(245,166,35,0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  featuredText: { color: COLORS.cta, fontSize: 10, fontWeight: '800' },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  emptySub: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center' },
})
