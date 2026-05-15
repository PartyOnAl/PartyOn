import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Event } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function EventCard({ event, onToggleFeatured }: { event: Event; onToggleFeatured: (id: string, current: boolean) => void }) {
  const isFeatured = event.is_featured ?? false

  return (
    <View style={fe.eventCard}>
      <View style={fe.cardTop}>
        {/* Featured badge */}
        {isFeatured && (
          <View style={fe.featuredBadge}>
            <Ionicons name="star" size={11} color={COLORS.cta} />
            <Text style={fe.featuredBadgeText}>Featured</Text>
          </View>
        )}
        {/* Status badge */}
        <View style={[fe.statusBadge, { backgroundColor: event.event_status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.15)' }]}>
          <Text style={[fe.statusText, { color: event.event_status === 'published' ? COLORS.green : COLORS.muted }]}>
            {event.event_status}
          </Text>
        </View>
      </View>

      <Text style={fe.eventName} numberOfLines={2}>{event.event_name}</Text>

      <View style={fe.meta}>
        <View style={fe.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.mutedDark} />
          <Text style={fe.metaText}>{formatDate(event.event_starting_date)}</Text>
        </View>
        {event.clubs?.club_name && (
          <View style={fe.metaItem}>
            <Ionicons name="business-outline" size={12} color={COLORS.mutedDark} />
            <Text style={fe.metaText} numberOfLines={1}>{event.clubs.club_name}</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={fe.statsRow}>
        <View style={fe.statItem}>
          <Text style={fe.statVal}>{event.event_capacity?.toLocaleString() ?? '—'}</Text>
          <Text style={fe.statLbl}>Capacity</Text>
        </View>
        <View style={[fe.statItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border }]}>
          <Text style={fe.statVal}>€{event.final_ticket_price ?? event.ticket_price ?? '—'}</Text>
          <Text style={fe.statLbl}>Ticket Price</Text>
        </View>
        <View style={fe.statItem}>
          <Text style={[fe.statVal, { color: isFeatured ? COLORS.cta : COLORS.mutedDark }]}>
            {isFeatured ? 'Active' : 'Off'}
          </Text>
          <Text style={fe.statLbl}>Featured</Text>
        </View>
      </View>

      {/* Toggle action */}
      <TouchableOpacity
        style={[fe.toggleBtn, { backgroundColor: isFeatured ? 'rgba(239,68,68,0.15)' : 'rgba(245,166,35,0.15)' }]}
        onPress={() => onToggleFeatured(event.event_id, isFeatured)}
      >
        <Ionicons
          name={isFeatured ? 'star' : 'star-outline'}
          size={15}
          color={isFeatured ? COLORS.red : COLORS.cta}
        />
        <Text style={[fe.toggleBtnText, { color: isFeatured ? COLORS.red : COLORS.cta }]}>
          {isFeatured ? 'Remove Featured Status' : 'Mark as Featured'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export default function FeaturedEventsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | 'featured'>('all')

  const stats = {
    totalImpressions: 69120,
    totalClicks: 5100,
    totalBookings: 674,
    avgCTR: 7.38,
  }

  useFocusEffect(
    useCallback(() => {
      loadEvents()
    }, []),
  )

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*, clubs(club_name, club_id)')
      .in('event_status', ['published', 'draft'])
      .order('is_featured', { ascending: false })
      .order('event_starting_date', { ascending: true })

    setEvents((data as Event[]) ?? [])
    setLoading(false)
  }

  async function toggleFeatured(eventId: string, current: boolean) {
    const action = current ? 'remove from featured' : 'mark as featured'
    Alert.alert(
      'Featured Status',
      `Are you sure you want to ${action} this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: current ? 'Remove' : 'Feature',
          onPress: async () => {
            await supabase.from('events').update({ is_featured: !current }).eq('event_id', eventId)
            loadEvents()
          },
        },
      ],
    )
  }

  const displayed = activeFilter === 'featured' ? events.filter(e => e.is_featured) : events

  return (
    <View style={[fe.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={fe.topBar}>
        <TouchableOpacity style={fe.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={fe.topBarTitle}>Featured Events</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={fe.pageTitle}>Featured Events</Text>
          <Text style={fe.pageSub}>Manage homepage featured events and promotions</Text>
        </View>

        {/* Analytics stats */}
        <View style={fe.statsGrid}>
          {[
            { icon: 'eye-outline' as const, label: 'Total Impressions', val: stats.totalImpressions.toLocaleString() },
            { icon: 'hand-left-outline' as const, label: 'Total Clicks', val: stats.totalClicks.toLocaleString() },
            { icon: 'ticket-outline' as const, label: 'Total Bookings', val: stats.totalBookings.toString() },
            { icon: 'trending-up-outline' as const, label: 'Avg. CTR', val: `${stats.avgCTR}%` },
          ].map(item => (
            <View key={item.label} style={fe.statCard}>
              <Ionicons name={item.icon} size={16} color={COLORS.purple} />
              <Text style={fe.statCardVal}>{item.val}</Text>
              <Text style={fe.statCardLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <View style={fe.filterRow}>
          {([['all', 'All Events'], ['featured', 'Featured Only']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[fe.filterTab, activeFilter === key && fe.filterTabActive]}
              onPress={() => setActiveFilter(key)}
            >
              <Text style={[fe.filterTabText, activeFilter === key && fe.filterTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
        ) : (
          <View style={{ paddingHorizontal: SPACING.md, gap: SPACING.md }}>
            {displayed.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60, gap: SPACING.md }}>
                <Ionicons name="star-outline" size={48} color={COLORS.mutedDark} />
                <Text style={{ color: COLORS.mutedDark, fontSize: FONT.base }}>
                  {activeFilter === 'featured' ? 'No featured events yet' : 'No events found'}
                </Text>
              </View>
            ) : (
              displayed.map(ev => (
                <EventCard key={ev.event_id} event={ev} onToggleFeatured={toggleFeatured} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const fe = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  pageTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  pageSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SPACING.md, gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm + 4, gap: 4,
  },
  statCardVal: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginTop: 4 },
  statCardLabel: { color: COLORS.mutedDark, fontSize: 12 },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md, gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  filterTabText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  filterTabTextActive: { color: COLORS.white },

  eventCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', gap: 8 },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  featuredBadgeText: { color: COLORS.cta, fontSize: 11, fontWeight: '700' },
  statusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  meta: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { flex: 1, padding: SPACING.sm, alignItems: 'center' },
  statVal: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  statLbl: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
  },
  toggleBtnText: { fontSize: FONT.sm, fontWeight: '700' },
})
