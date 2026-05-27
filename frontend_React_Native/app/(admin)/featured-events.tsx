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

type FeaturedStatus = 'pending_review' | 'approved' | 'rejected' | 'none' | 'cancelled'

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Unset'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function money(value: number | null | undefined) {
  return `€${Number(value ?? 0).toFixed(0)}`
}

function statusMeta(status: FeaturedStatus | null | undefined, isFeatured: boolean | null | undefined) {
  if (status === 'approved' || isFeatured) return { label: 'Approved', color: COLORS.green }
  if (status === 'pending_review') return { label: 'Pending review', color: COLORS.cta }
  if (status === 'rejected') return { label: 'Rejected', color: COLORS.red }
  return { label: 'Not requested', color: COLORS.mutedDark }
}

function EventCard({
  event,
  onApprove,
  onReject,
  onRemove,
}: {
  event: Event
  onApprove: (event: Event) => void
  onReject: (event: Event) => void
  onRemove: (event: Event) => void
}) {
  const status = (event.featured_request_status ?? 'none') as FeaturedStatus
  const meta = statusMeta(status, event.is_featured)

  return (
    <View style={fe.eventCard}>
      <View style={fe.cardTop}>
        <View style={[fe.statusBadge, { backgroundColor: meta.color + '22' }]}>
          <Text style={[fe.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {event.featured_fee_paid ? (
          <View style={fe.paidBadge}>
            <Ionicons name="card-outline" size={11} color={COLORS.green} />
            <Text style={fe.paidText}>Paid {money(event.featured_fee_amount)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={fe.eventName} numberOfLines={2}>{event.event_name}</Text>

      <View style={fe.meta}>
        <View style={fe.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.mutedDark} />
          <Text style={fe.metaText}>{formatDate(event.event_starting_date)}</Text>
        </View>
        {event.clubs?.club_name ? (
          <View style={fe.metaItem}>
            <Ionicons name="business-outline" size={12} color={COLORS.mutedDark} />
            <Text style={fe.metaText} numberOfLines={1}>{event.clubs.club_name}</Text>
          </View>
        ) : null}
        {event.featured_requested_at ? (
          <View style={fe.metaItem}>
            <Ionicons name="time-outline" size={12} color={COLORS.mutedDark} />
            <Text style={fe.metaText}>Requested {formatDate(event.featured_requested_at)}</Text>
          </View>
        ) : null}
      </View>

      <View style={fe.statsRow}>
        <View style={fe.statItem}>
          <Text style={fe.statVal}>{event.event_capacity?.toLocaleString() ?? '-'}</Text>
          <Text style={fe.statLbl}>Capacity</Text>
        </View>
        <View style={[fe.statItem, fe.statBorder]}>
          <Text style={fe.statVal}>{money(event.final_ticket_price ?? event.ticket_price)}</Text>
          <Text style={fe.statLbl}>Ticket</Text>
        </View>
        <View style={fe.statItem}>
          <Text style={fe.statVal}>{money(event.featured_fee_amount)}</Text>
          <Text style={fe.statLbl}>Feature fee</Text>
        </View>
      </View>

      {status === 'pending_review' ? (
        <View style={fe.actionRow}>
          <TouchableOpacity style={fe.rejectBtn} onPress={() => onReject(event)} activeOpacity={0.82}>
            <Ionicons name="close-circle-outline" size={15} color={COLORS.red} />
            <Text style={fe.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fe.approveBtn} onPress={() => onApprove(event)} activeOpacity={0.82}>
            <Ionicons name="star" size={15} color="#fff" />
            <Text style={fe.approveText}>Approve Featured</Text>
          </TouchableOpacity>
        </View>
      ) : event.is_featured ? (
        <TouchableOpacity style={fe.removeBtn} onPress={() => onRemove(event)} activeOpacity={0.82}>
          <Ionicons name="star-outline" size={15} color={COLORS.red} />
          <Text style={fe.removeText}>Remove from featured</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

export default function FeaturedEventsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

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
      .in('featured_request_status', ['pending_review', 'approved', 'rejected'])
      .order('featured_requested_at', { ascending: false, nullsFirst: false })
      .order('event_starting_date', { ascending: true })

    setEvents((data as Event[]) ?? [])
    setLoading(false)
  }

  async function updateFeatured(event: Event, status: FeaturedStatus) {
    const nowIso = new Date().toISOString()
    const payload = status === 'approved'
      ? {
        featured_request_status: 'approved',
        is_featured: true,
        featured_reviewed_at: nowIso,
        featured_rejection_reason: null,
      }
      : status === 'rejected'
        ? {
          featured_request_status: 'rejected',
          is_featured: false,
          featured_reviewed_at: nowIso,
          featured_rejection_reason: 'Not approved for homepage placement.',
        }
        : {
          featured_request_status: 'cancelled',
          is_featured: false,
          featured_reviewed_at: nowIso,
        }

    const { error } = await supabase.from('events').update(payload).eq('event_id', event.event_id)
    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    loadEvents()
  }

  function approve(event: Event) {
    Alert.alert('Approve Featured Event', `Approve "${event.event_name}" for the user homepage?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => updateFeatured(event, 'approved') },
    ])
  }

  function reject(event: Event) {
    Alert.alert('Reject Featured Request', `Reject "${event.event_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => updateFeatured(event, 'rejected') },
    ])
  }

  function remove(event: Event) {
    Alert.alert('Remove Featured Event', `Remove "${event.event_name}" from the user homepage?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => updateFeatured(event, 'cancelled') },
    ])
  }

  const pending = events.filter(e => e.featured_request_status === 'pending_review')
  const approved = events.filter(e => e.featured_request_status === 'approved' || e.is_featured)
  const rejected = events.filter(e => e.featured_request_status === 'rejected')
  const displayed = activeFilter === 'pending'
    ? pending
    : activeFilter === 'approved'
      ? approved
      : activeFilter === 'rejected'
        ? rejected
        : events
  const paidTotal = events
    .filter(e => e.featured_fee_paid)
    .reduce((sum, event) => sum + Number(event.featured_fee_amount ?? 0), 0)

  return (
    <View style={[fe.container, { paddingTop: insets.top }]}>
      <View style={fe.topBar}>
        <TouchableOpacity style={fe.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={fe.topBarTitle}>Featured Events</Text>
        <TouchableOpacity style={fe.backBtn} onPress={loadEvents}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={fe.pageTitle}>Featured Requests</Text>
          <Text style={fe.pageSub}>Approve paid manager requests before they reach the user homepage.</Text>
        </View>

        <View style={fe.statsGrid}>
          {[
            { icon: 'hourglass-outline' as const, label: 'Pending', val: String(pending.length), filter: 'pending' as const },
            { icon: 'star-outline' as const, label: 'Approved', val: String(approved.length), filter: 'approved' as const },
            { icon: 'cash-outline' as const, label: 'Paid fees', val: money(paidTotal), filter: 'all' as const },
            { icon: 'close-circle-outline' as const, label: 'Rejected', val: String(rejected.length), filter: 'rejected' as const },
          ].map(item => (
            <TouchableOpacity key={item.label} style={fe.statCard} activeOpacity={0.82} onPress={() => setActiveFilter(item.filter)}>
              <Ionicons name={item.icon} size={16} color={COLORS.purple} />
              <Text style={fe.statCardVal}>{item.val}</Text>
              <Text style={fe.statCardLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={fe.filterRow}>
          {([
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ['all', 'All'],
          ] as const).map(([key, label]) => (
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
              <View style={fe.empty}>
                <Ionicons name="star-outline" size={48} color={COLORS.mutedDark} />
                <Text style={fe.emptyText}>No featured requests here</Text>
              </View>
            ) : (
              displayed.map(ev => (
                <EventCard key={ev.event_id} event={ev} onApprove={approve} onReject={reject} onRemove={remove} />
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
  cardTop: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.green + '18' },
  paidText: { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  meta: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border },
  statItem: { flex: 1, padding: SPACING.sm, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
  statVal: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  statLbl: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2, backgroundColor: COLORS.purple },
  approveText: { color: '#fff', fontSize: FONT.sm, fontWeight: '800' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2, backgroundColor: COLORS.red + '18', borderWidth: 1, borderColor: COLORS.red + '44' },
  rejectText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '800' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2, backgroundColor: COLORS.red + '18', borderWidth: 1, borderColor: COLORS.red + '44' },
  removeText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.base },
})
