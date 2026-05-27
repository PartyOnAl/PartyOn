import { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'
type DisputePriority = 'low' | 'medium' | 'high'

type Dispute = {
  id: string
  subject: string
  description: string
  priority: DisputePriority
  status: DisputeStatus
  manager_notes: string | null
  created_at: string
  updated_at: string
  event_name: string | null
}

const STATUS_META: Record<DisputeStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  open:        { label: 'Open',        color: COLORS.red,       icon: 'alert-circle-outline' },
  in_progress: { label: 'In Progress', color: '#f59e0b',        icon: 'time-outline' },
  resolved:    { label: 'Resolved',    color: COLORS.green,     icon: 'checkmark-circle-outline' },
  rejected:    { label: 'Rejected',    color: COLORS.mutedDark, icon: 'close-circle-outline' },
}

const PRIORITY_META: Record<DisputePriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: COLORS.green },
  medium: { label: 'Medium', color: '#f59e0b' },
  high:   { label: 'High',   color: COLORS.red },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Dispute card ──────────────────────────────────────────────────────────────
function DisputeCard({ dispute }: { dispute: Dispute }) {
  const sm = STATUS_META[dispute.status]
  const pm = PRIORITY_META[dispute.priority]

  return (
    <View style={card.container}>
      {/* Top row: status icon + subject + status badge */}
      <View style={card.topRow}>
        <View style={[card.statusIconWrap, { backgroundColor: sm.color + '18' }]}>
          <Ionicons name={sm.icon} size={18} color={sm.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={card.subject} numberOfLines={1}>{dispute.subject}</Text>
          {dispute.event_name ? (
            <Text style={card.eventName} numberOfLines={1}>{dispute.event_name}</Text>
          ) : null}
        </View>
        <View style={[card.statusBadge, { backgroundColor: sm.color + '18', borderColor: sm.color + '40' }]}>
          <Text style={[card.statusBadgeText, { color: sm.color }]}>{sm.label}</Text>
        </View>
      </View>

      {/* Description preview */}
      <Text style={card.description} numberOfLines={2}>{dispute.description}</Text>

      {/* Manager note */}
      {dispute.manager_notes ? (
        <View style={card.noteBox}>
          <View style={card.noteHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={COLORS.purple} />
            <Text style={card.noteLabel}>Manager response</Text>
          </View>
          <Text style={card.noteText}>{dispute.manager_notes}</Text>
        </View>
      ) : (
        <View style={card.awaitingBox}>
          <Ionicons name="hourglass-outline" size={13} color={COLORS.mutedDark} />
          <Text style={card.awaitingText}>Awaiting manager response</Text>
        </View>
      )}

      {/* Footer */}
      <View style={card.footer}>
        <View style={[card.priorityPill, { backgroundColor: pm.color + '18' }]}>
          <View style={[card.priorityDot, { backgroundColor: pm.color }]} />
          <Text style={[card.priorityText, { color: pm.color }]}>{pm.label} priority</Text>
        </View>
        <Text style={card.date}>Updated {formatDate(dispute.updated_at ?? dispute.created_at)}</Text>
      </View>
    </View>
  )
}

const card = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  statusIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  subject: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  eventName: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  description: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 19 },
  noteBox: {
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    gap: 5,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.purple,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteLabel: { color: COLORS.purple, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText: { color: COLORS.white, fontSize: FONT.sm, lineHeight: 19 },
  awaitingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  awaitingText: { color: COLORS.mutedDark, fontSize: 12, fontStyle: 'italic' },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  priorityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3,
  },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  date: { color: COLORS.mutedDark, fontSize: 11 },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyDisputesScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    if (!user) return
    const { data, error } = await supabase
      .from('disputes')
      .select('id,subject,description,priority,status,manager_notes,created_at,events:event_id(event_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) { setLoading(false); return }
    const items: Dispute[] = ((data ?? []) as any[]).map(d => {
      const ev = Array.isArray(d.events) ? d.events[0] : d.events
      return {
        id: d.id,
        subject: d.subject,
        description: d.description,
        priority: d.priority,
        status: d.status,
        manager_notes: d.manager_notes,
        created_at: d.created_at,
        updated_at: d.created_at,
        event_name: ev?.event_name ?? null,
      }
    })
    setDisputes(items)
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [user]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [user])

  // Counts per status for the summary bar
  const counts = disputes.reduce(
    (acc, d) => { acc[d.status] = (acc[d.status] ?? 0) + 1; return acc },
    {} as Record<string, number>,
  )

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>My Disputes</Text>
          <Text style={s.headerSub}>Track your submissions & manager replies</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      ) : disputes.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="shield-checkmark-outline" size={56} color={COLORS.mutedDark} />
          <Text style={s.emptyTitle}>No disputes yet</Text>
          <Text style={s.emptySub}>
            You can file a dispute from a past ticket on the{'\n'}Tickets screen.
          </Text>
          <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/(tabs)/bookings')}>
            <Text style={s.ctaBtnText}>Go to Tickets</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
        >
          {/* Summary chips */}
          <View style={s.summaryRow}>
            {(Object.entries(STATUS_META) as [DisputeStatus, typeof STATUS_META[DisputeStatus]][])
              .filter(([key]) => counts[key])
              .map(([key, meta]) => (
                <View key={key} style={[s.summaryChip, { borderColor: meta.color + '50', backgroundColor: meta.color + '12' }]}>
                  <View style={[s.summaryDot, { backgroundColor: meta.color }]} />
                  <Text style={[s.summaryText, { color: meta.color }]}>
                    {counts[key]} {meta.label}
                  </Text>
                </View>
              ))
            }
          </View>

          {disputes.map(d => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.xl },

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

  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs + 2,
    marginBottom: SPACING.xs,
  },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryDot: { width: 6, height: 6, borderRadius: 3 },
  summaryText: { fontSize: 12, fontWeight: '700' },

  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  emptySub: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
  ctaBtn: {
    marginTop: SPACING.xs,
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xl,
  },
  ctaBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.base },
})
