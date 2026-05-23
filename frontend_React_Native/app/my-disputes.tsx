import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, RefreshControl,
  Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { markDisputesSeen } from '@/lib/disputesBadge'

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled'
type DisputePriority = 'low' | 'medium' | 'high'
type DisputeFilter = DisputeStatus | 'all'

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
  user_cleared_at?: string | null
}

const STATUS_META: Record<DisputeStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  open:        { label: 'Open',        color: COLORS.red,       icon: 'alert-circle-outline' },
  in_progress: { label: 'In Progress', color: '#f59e0b',        icon: 'time-outline' },
  resolved:    { label: 'Resolved',    color: COLORS.green,     icon: 'checkmark-circle-outline' },
  rejected:    { label: 'Rejected',    color: COLORS.mutedDark, icon: 'close-circle-outline' },
  cancelled:   { label: 'Cancelled',   color: COLORS.mutedDark, icon: 'ban-outline' },
}

const PRIORITY_META: Record<DisputePriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: COLORS.green },
  medium: { label: 'Medium', color: '#f59e0b' },
  high:   { label: 'High',   color: COLORS.red },
}

const STATUS_HELP: Record<DisputeStatus, string> = {
  open: 'Your dispute has been sent to the venue team.',
  in_progress: 'A manager is reviewing this and should update you soon.',
  resolved: 'The venue marked this dispute as resolved.',
  rejected: 'The venue closed this dispute without accepting the claim.',
  cancelled: 'You cancelled this dispute before the venue started reviewing it.',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function mapDisputeRow(d: any): Dispute {
  const ev = Array.isArray(d.events) ? d.events[0] : d.events
  return {
    id: d.id,
    subject: d.subject,
    description: d.description,
    priority: d.priority,
    status: d.status,
    manager_notes: d.manager_notes,
    created_at: d.created_at,
    updated_at: d.updated_at ?? d.created_at,
    event_name: ev?.event_name ?? null,
    user_cleared_at: d.user_cleared_at ?? null,
  }
}

// ── Dispute card ──────────────────────────────────────────────────────────────
function DisputeCard({
  dispute,
  onEdit,
  onCancel,
  onClear,
}: {
  dispute: Dispute
  onEdit: (dispute: Dispute) => void
  onCancel: (dispute: Dispute) => void
  onClear: (dispute: Dispute) => void
}) {
  const sm = STATUS_META[dispute.status]
  const pm = PRIORITY_META[dispute.priority]
  const canEdit = dispute.status === 'open'
  const canCancel = dispute.status === 'open'
  const canClear = dispute.status === 'resolved' || dispute.status === 'rejected' || dispute.status === 'cancelled'

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

      <View style={[card.statusMessage, { borderColor: sm.color + '35', backgroundColor: sm.color + '10' }]}>
        <Ionicons name={sm.icon} size={14} color={sm.color} />
        <Text style={card.statusMessageText}>{STATUS_HELP[dispute.status]}</Text>
      </View>

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

      {(canEdit || canCancel || canClear) ? (
        <View style={card.actions}>
          {canEdit ? (
            <TouchableOpacity style={card.editBtn} onPress={() => onEdit(dispute)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={14} color={COLORS.purple} />
              <Text style={card.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          {canCancel ? (
            <TouchableOpacity style={card.cancelBtn} onPress={() => onCancel(dispute)} activeOpacity={0.8}>
              <Ionicons name="ban-outline" size={14} color={COLORS.red} />
              <Text style={card.cancelBtnText}>Cancel dispute</Text>
            </TouchableOpacity>
          ) : null}
          {canClear ? (
            <TouchableOpacity style={card.clearBtn} onPress={() => onClear(dispute)} activeOpacity={0.8}>
              <Ionicons name="archive-outline" size={14} color={COLORS.muted} />
              <Text style={card.clearBtnText}>Clear from list</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
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
  statusMessage: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: RADIUS.sm, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2,
  },
  statusMessageText: { color: COLORS.muted, fontSize: 12, lineHeight: 17, flex: 1 },
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
  actions: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)', backgroundColor: 'rgba(139,92,246,0.10)',
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 3,
  },
  editBtnText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.red + '45', backgroundColor: COLORS.red + '12',
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 3,
  },
  cancelBtnText: { color: COLORS.red, fontSize: 12, fontWeight: '700' },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.bgCard,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 3,
  },
  clearBtnText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
})

function EditDisputeModal({
  dispute,
  userId,
  onClose,
  onSaved,
}: {
  dispute: Dispute | null
  userId?: string
  onClose: () => void
  onSaved: (updated: Dispute) => void
}) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<DisputePriority>('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSubject(dispute?.subject ?? '')
    setDescription(dispute?.description ?? '')
    setPriority(dispute?.priority ?? 'medium')
  }, [dispute?.id, dispute?.subject, dispute?.description, dispute?.priority])

  if (!dispute) return null
  const current = dispute

  const PRIORITIES: DisputePriority[] = ['low', 'medium', 'high']

  async function save() {
    if (!userId) return
    if (current.status !== 'open') {
      Alert.alert('Already under review', 'This dispute can no longer be edited because the manager has started reviewing it.')
      onClose()
      return
    }
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Please add both a subject and a description.')
      return
    }

    setSaving(true)
    const updatedAt = new Date().toISOString()
    const payload = {
      subject: subject.trim(),
      description: description.trim(),
      priority,
      updated_at: updatedAt,
    }
    const { error } = await supabase
      .from('disputes')
      .update(payload)
      .eq('id', current.id)
      .eq('user_id', userId)
      .eq('status', 'open')
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    onSaved({ ...current, ...payload })
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={modal.overlay} onPress={onClose}>
          <Pressable style={modal.sheet} onPress={() => {}}>
            <View style={modal.handle} />
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.muted} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={modal.title}>Edit Dispute</Text>
              <Text style={modal.subtitle}>You can edit this until a manager starts reviewing it.</Text>

              <Text style={modal.label}>Priority</Text>
              <View style={modal.priorityRow}>
                {PRIORITIES.map(key => {
                  const meta = PRIORITY_META[key]
                  const active = priority === key
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[modal.priorityBtn, active && { borderColor: meta.color, backgroundColor: meta.color + '20' }]}
                      onPress={() => setPriority(key)}
                    >
                      <Text style={[modal.priorityText, active && { color: meta.color }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={modal.label}>Subject</Text>
              <TextInput
                style={modal.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="What happened?"
                placeholderTextColor={COLORS.mutedDark}
                selectionColor={COLORS.purple}
              />

              <Text style={modal.label}>Description</Text>
              <TextInput
                style={[modal.input, modal.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add the details the manager should review..."
                placeholderTextColor={COLORS.mutedDark}
                multiline
                selectionColor={COLORS.purple}
              />

              <TouchableOpacity style={modal.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={modal.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4,
    borderTopRightRadius: RADIUS.xl + 4,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 24 : 8),
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  closeBtn: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: 4, marginTop: SPACING.xs },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 19, marginBottom: SPACING.lg, paddingRight: SPACING.xl },
  label: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700', marginBottom: SPACING.xs },
  priorityRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  priorityBtn: { flex: 1, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgInput, paddingVertical: SPACING.sm, alignItems: 'center' },
  priorityText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  input: { backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, color: COLORS.white, fontSize: FONT.base, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, marginBottom: SPACING.md },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.lg, paddingVertical: SPACING.md + 2, alignItems: 'center', marginTop: SPACING.xs },
  saveBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyDisputesScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<DisputeFilter>('all')
  const [editing, setEditing] = useState<Dispute | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }

    const filtered = await supabase
      .from('disputes')
      .select('id,subject,description,priority,status,manager_notes,created_at,updated_at,user_cleared_at,events:event_id(event_name)')
      .eq('user_id', user.id)
      .is('user_cleared_at', null)
      .is('manager_deleted_at', null)
      .order('updated_at', { ascending: false, nullsFirst: false })

    const result = filtered.error
      ? await supabase
        .from('disputes')
        .select('id,subject,description,priority,status,manager_notes,created_at,updated_at,events:event_id(event_name)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false, nullsFirst: false })
      : filtered

    if (result.error) {
      Alert.alert('Could not load disputes', result.error.message)
      setLoading(false)
      return
    }
    const items: Dispute[] = ((result.data ?? []) as any[]).map(mapDisputeRow)
    setDisputes(items)
    setLoading(false)
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      markDisputesSeen()
      setLoading(true)
      load()
    }, [load]),
  )

  useEffect(() => {
    if (!user?.id) return

    const channelName = `disputes:user:${user.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disputes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, user?.id])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  function handleSaved(updated: Dispute) {
    setDisputes(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  function cancelDispute(dispute: Dispute) {
    if (!user?.id || dispute.status !== 'open') return
    Alert.alert(
      'Cancel dispute',
      'Cancel this open dispute? The venue will see that it was cancelled and it can no longer be edited.',
      [
        { text: 'Keep open', style: 'cancel' },
        {
          text: 'Cancel dispute',
          style: 'destructive',
          onPress: async () => {
            const updatedAt = new Date().toISOString()
            const { error } = await supabase
              .from('disputes')
              .update({ status: 'cancelled', updated_at: updatedAt })
              .eq('id', dispute.id)
              .eq('user_id', user.id)
              .eq('status', 'open')
            if (error) { Alert.alert('Could not cancel dispute', error.message); return }
            setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'cancelled', updated_at: updatedAt } : d))
          },
        },
      ],
    )
  }

  function clearDispute(dispute: Dispute) {
    if (!user?.id || (dispute.status !== 'resolved' && dispute.status !== 'rejected' && dispute.status !== 'cancelled')) return
    Alert.alert(
      'Clear dispute',
      'Remove this finished dispute from your list? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('disputes')
              .update({ user_cleared_at: new Date().toISOString() })
              .eq('id', dispute.id)
              .eq('user_id', user.id)
              .in('status', ['resolved', 'rejected', 'cancelled'])
            if (error) { Alert.alert('Error', error.message); return }
            setDisputes(prev => prev.filter(d => d.id !== dispute.id))
          },
        },
      ],
    )
  }

  // Counts per status for the summary bar
  const counts = disputes.reduce(
    (acc, d) => { acc[d.status] = (acc[d.status] ?? 0) + 1; return acc },
    {} as Record<string, number>,
  )
  const filteredDisputes = filterStatus === 'all'
    ? disputes
    : disputes.filter(d => d.status === filterStatus)
  const activeCount = (counts.open ?? 0) + (counts.in_progress ?? 0)
  const FILTER_TABS: { key: DisputeFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: disputes.length },
    { key: 'open', label: 'Open', count: counts.open ?? 0 },
    { key: 'in_progress', label: 'In progress', count: counts.in_progress ?? 0 },
    { key: 'resolved', label: 'Resolved', count: counts.resolved ?? 0 },
    { key: 'rejected', label: 'Rejected', count: counts.rejected ?? 0 },
    { key: 'cancelled', label: 'Cancelled', count: counts.cancelled ?? 0 },
  ]

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
          <View style={s.overviewCard}>
            <View style={s.overviewIcon}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.overviewTitle}>
                {activeCount > 0 ? `${activeCount} active update${activeCount === 1 ? '' : 's'}` : 'All caught up'}
              </Text>
              <Text style={s.overviewSub}>
                Manager replies and status changes appear here as soon as they are sent.
              </Text>
            </View>
          </View>

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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterContent}
          >
            {FILTER_TABS.map(tab => {
              const active = filterStatus === tab.key
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[s.filterTab, active && s.filterTabActive]}
                  onPress={() => setFilterStatus(tab.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterText, active && s.filterTextActive]}>
                    {tab.label} {tab.count}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {filteredDisputes.length === 0 ? (
            <View style={s.filteredEmpty}>
              <Ionicons name="file-tray-outline" size={32} color={COLORS.mutedDark} />
              <Text style={s.filteredEmptyText}>No disputes in this filter</Text>
            </View>
          ) : (
            filteredDisputes.map(d => (
              <DisputeCard key={d.id} dispute={d} onEdit={setEditing} onCancel={cancelDispute} onClear={clearDispute} />
            ))
          )}
        </ScrollView>
      )}
      <EditDisputeModal
        dispute={editing}
        userId={user?.id}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
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

  overviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    padding: SPACING.md,
  },
  overviewIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  overviewTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  overviewSub: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: 2 },

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
  filterContent: { gap: SPACING.xs, paddingVertical: SPACING.xs },
  filterTab: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
  },
  filterTabActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: COLORS.white },
  filteredEmpty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xl, gap: SPACING.sm,
  },
  filteredEmptyText: { color: COLORS.mutedDark, fontSize: FONT.sm },

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
