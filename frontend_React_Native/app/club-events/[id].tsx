import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Event, Club } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { isEventUpcomingOrLive } from '@/lib/eventDates'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
}
function formatDay(iso: string) {
  return new Date(iso).getDate().toString()
}

export default function ClubEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [club, setClub] = useState<Club | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    if (!id) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [clubRes, evRes] = await Promise.all([
      supabase.from('clubs').select('club_id,club_name,club_image').eq('club_id', id).single(),
      supabase.from('events').select('*')
        .eq('club_id', id)
        .eq('event_status', 'published')
        .gte('event_starting_date', today.toISOString())
        .order('event_starting_date', { ascending: true }),
    ])
    setClub(clubRes.data as Club)
    setEvents(((evRes.data as Event[]) ?? []).filter(ev => isEventUpcomingOrLive(ev)))
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [id]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [id])

  function renderEvent({ item: ev }: { item: Event }) {
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => router.push(`/event/${ev.event_id}`)}
        activeOpacity={0.75}
      >
        {/* Date column */}
        <View style={s.dateCol}>
          <Text style={s.dateMonth}>{formatMonth(ev.event_starting_date)}</Text>
          <Text style={s.dateDay}>{formatDay(ev.event_starting_date)}</Text>
        </View>

        {/* Thumbnail */}
        {ev.event_image ? (
          <Image source={{ uri: ev.event_image }} style={s.thumb} resizeMode="cover" />
        ) : (
          <View style={[s.thumb, s.thumbFallback]}>
            <Ionicons name="musical-notes-outline" size={20} color={COLORS.mutedDark} />
          </View>
        )}

        {/* Info */}
        <View style={s.info}>
          <Text style={s.eventName} numberOfLines={1}>{ev.event_name}</Text>
          <View style={s.metaRow}>
            <Ionicons name="time-outline" size={11} color={COLORS.mutedDark} />
            <Text style={s.metaText}>{formatTime(ev.event_starting_date)}</Text>
          </View>
          {ev.final_ticket_price != null ? (
            <View style={s.pricePill}>
              <Text style={s.priceText}>€{Number(ev.final_ticket_price).toFixed(2)}</Text>
            </View>
          ) : ev.reservation_only ? (
            <View style={[s.pricePill, s.freePill]}>
              <Text style={[s.priceText, { color: COLORS.green }]}>Free</Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {club?.club_name ?? 'Events'}
          </Text>
          <Text style={s.headerSub}>Upcoming events</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={ev => ev.event_id}
          renderItem={renderEvent}
          contentContainerStyle={events.length === 0 ? s.emptyContainer : { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={56} color={COLORS.mutedDark} />
              <Text style={s.emptyTitle}>No upcoming events</Text>
              <Text style={s.emptySub}>Check back soon for new events from this club.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: SPACING.xs + 2 }} />}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  headerSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: SPACING.sm + 2,
  },

  dateCol: {
    width: 40,
    alignItems: 'center',
    flexShrink: 0,
  },
  dateMonth: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDay: {
    color: COLORS.white,
    fontSize: FONT.xl,
    fontWeight: '900',
    lineHeight: FONT.xl + 2,
  },

  thumb: {
    width: 58, height: 58,
    borderRadius: RADIUS.md,
    flexShrink: 0,
  },
  thumbFallback: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: { flex: 1, gap: 4 },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12 },

  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freePill: { backgroundColor: 'rgba(16,185,129,0.12)' },
  priceText: { color: COLORS.purple, fontSize: 11, fontWeight: '800' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  emptySub: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
})
