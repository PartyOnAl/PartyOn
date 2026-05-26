import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Linking, TextInput, Modal, Pressable, Platform, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { MANAGER_DASHBOARD, replaceManagerRoute } from '@/lib/managerNavigation'

type DisputeStatus = 'open' | 'in_progress' | 'resolved' | 'rejected' | 'cancelled'
type DisputePriority = 'low' | 'medium' | 'high'

type Dispute = {
  id: string
  subject: string
  description: string
  priority: DisputePriority
  status: DisputeStatus
  manager_notes: string | null
  created_at: string
  updated_at: string | null
  reservation_id: string | null
  event_name: string | null
  user_name: string | null
  user_email: string | null
  user_phone: string | null
}

const PRIORITY_COLORS: Record<DisputePriority, string> = {
  low: COLORS.green,
  medium: '#f59e0b',
  high: COLORS.red,
}

const STATUS_COLORS: Record<DisputeStatus, string> = {
  open: COLORS.red,
  in_progress: '#f59e0b',
  resolved: COLORS.green,
  rejected: COLORS.mutedDark,
  cancelled: COLORS.mutedDark,
}

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const CUSTOMER_MESSAGE_BY_STATUS: Record<DisputeStatus, string> = {
  open: 'Thanks for raising this. We have received your dispute and will review it shortly.',
  in_progress: 'We are reviewing your dispute now. A manager will contact you soon if we need anything else.',
  resolved: 'Your dispute has been reviewed and marked as resolved. Thank you for your patience.',
  rejected: 'Your dispute has been reviewed and closed. The venue was not able to approve this claim.',
  cancelled: 'This dispute was cancelled by the customer before review.',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Notes Modal ───────────────────────────────────────────────────────────────
function NotesModal({
  dispute,
  onClose,
  onSaved,
}: {
  dispute: Dispute | null
  onClose: () => void
  onSaved: (id: string, notes: string | null, status: DisputeStatus, updatedAt: string) => void
}) {
  const [notes, setNotes] = useState(dispute?.manager_notes ?? '')
  const [status, setStatus] = useState<DisputeStatus>(dispute?.status ?? 'open')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setNotes(dispute?.manager_notes ?? '')
    setStatus(dispute?.status ?? 'open')
  }, [dispute?.id, dispute?.manager_notes, dispute?.status])

  if (!dispute) return null
  const d = dispute

  const STATUSES: DisputeStatus[] = ['open', 'in_progress', 'resolved', 'rejected', 'cancelled']
  const suggestedMessage = CUSTOMER_MESSAGE_BY_STATUS[status]

  async function save() {
    setLoading(true)
    const updatedAt = new Date().toISOString()
    const newNotes = notes.trim() || null
    const payload: Record<string, unknown> = { status, updated_at: updatedAt }
    if (newNotes !== null) payload.manager_notes = newNotes
    const { error } = await supabase
      .from('disputes')
      .update(payload)
      .eq('id', d.id)
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    onSaved(d.id, newNotes ?? d.manager_notes, status, updatedAt)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.modal} onPress={() => {}}>
            <View style={s.modalHandle} />
            <TouchableOpacity style={s.modalClose} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.muted} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.modalScrollContent}
            >
              <Text style={s.modalTitle}>Update Dispute</Text>
              <Text style={s.modalSub} numberOfLines={1}>{dispute.subject}</Text>

              <Text style={s.fieldLabel}>Status</Text>
              <View style={s.statusRow}>
                {STATUSES.map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.statusChip,
                      status === st && { backgroundColor: STATUS_COLORS[st] + '25', borderColor: STATUS_COLORS[st] },
                    ]}
                    onPress={() => setStatus(st)}
                  >
                    <Text style={[s.statusChipText, status === st && { color: STATUS_COLORS[st] }]}>
                      {STATUS_LABELS[st]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[s.statusPreview, { borderColor: STATUS_COLORS[status] + '35', backgroundColor: STATUS_COLORS[status] + '10' }]}>
                <Ionicons name="notifications-outline" size={15} color={STATUS_COLORS[status]} />
                <Text style={s.statusPreviewText}>{suggestedMessage}</Text>
              </View>

              <Text style={s.fieldLabel}>Message to Customer</Text>
              <TextInput
                style={s.notesInput}
                placeholder={suggestedMessage}
                placeholderTextColor={COLORS.mutedDark}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                selectionColor={COLORS.purple}
              />
              <View style={s.templateRow}>
                <TouchableOpacity style={s.templateChip} onPress={() => setNotes(suggestedMessage)}>
                  <Ionicons name="sparkles-outline" size={13} color={COLORS.purple} />
                  <Text style={s.templateChipText}>Use suggested message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.templateChip} onPress={() => setNotes('We are checking this with our venue team and will update you as soon as we have an answer.')}>
                  <Ionicons name="time-outline" size={13} color={COLORS.purple} />
                  <Text style={s.templateChipText}>Reviewing</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.notesHint}>This message is visible to the customer and triggers their dispute update notification.</Text>

              <TouchableOpacity style={s.saveBtn} onPress={save} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const STATUS_ORDER: Record<DisputeStatus, number> = { open: 0, in_progress: 1, resolved: 2, rejected: 3, cancelled: 4 }

export default function DisputesScreen({ showBackButton = true }: { showBackButton?: boolean } = {}) {
  const router = useRouter()
  const { profile } = useAuth()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [filterStatus, setFilterStatus] = useState<DisputeStatus | 'all'>('all')

  const loadDisputes = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    setLoading(true)

    const { data, error } = await supabase
      .from('disputes')
      .select(`
        id, subject, description, priority, status, manager_notes, created_at, updated_at, reservation_id,
        events:event_id ( event_name ),
        profiles:user_id ( name, surname, email, phone_number )
      `)
      .eq('club_id', profile.club_id)
      .is('manager_deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      Alert.alert('Error', error.message)
      setLoading(false)
      return
    }

    const items: Dispute[] = ((data ?? []) as any[]).map(d => {
      const ev = Array.isArray(d.events) ? d.events[0] : d.events
      const usr = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles
      return {
        id: d.id,
        subject: d.subject,
        description: d.description,
        priority: d.priority,
        status: d.status,
        manager_notes: d.manager_notes,
        created_at: d.created_at,
        updated_at: d.updated_at ?? d.created_at,
        reservation_id: d.reservation_id,
        event_name: ev?.event_name ?? null,
        user_name: [usr?.name, usr?.surname].filter(Boolean).join(' ') || null,
        user_email: usr?.email ?? null,
        user_phone: usr?.phone_number ?? null,
      }
    })

    items.sort((a, b) => {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (sd !== 0) return sd
      return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()
    })

    setDisputes(items)
    setLoading(false)
  }, [profile?.club_id])

  useFocusEffect(
    useCallback(() => {
      loadDisputes()
    }, [loadDisputes]),
  )

  function handleSaved(id: string, notes: string | null, status: DisputeStatus, updatedAt: string) {
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, manager_notes: notes, status, updated_at: updatedAt } : d))
  }

  function handleDelete(dispute: Dispute) {
    Alert.alert('Archive Dispute', `Archive "${dispute.subject}"? It will be hidden from your list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('disputes').update({ manager_deleted_at: new Date().toISOString() }).eq('id', dispute.id)
          if (error) { Alert.alert('Error', error.message); return }
          setDisputes(prev => prev.filter(d => d.id !== dispute.id))
        },
      },
    ])
  }

  async function quickResolve(dispute: Dispute) {
    Alert.alert('Resolve Dispute', 'Mark this dispute as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        onPress: async () => {
          const updatedAt = new Date().toISOString()
          const { error } = await supabase
            .from('disputes')
            .update({ status: 'resolved', updated_at: updatedAt })
            .eq('id', dispute.id)
          if (error) { Alert.alert('Error', error.message); return }
          setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'resolved', updated_at: updatedAt } : d))
        },
      },
    ])
  }

  async function quickStartProgress(dispute: Dispute) {
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from('disputes')
      .update({ status: 'in_progress', updated_at: updatedAt })
      .eq('id', dispute.id)
    if (error) { Alert.alert('Error', error.message); return }
    setDisputes(prev => prev.map(d => d.id === dispute.id ? { ...d, status: 'in_progress', updated_at: updatedAt } : d))
  }

  const counts = {
    all: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    in_progress: disputes.filter(d => d.status === 'in_progress').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
    cancelled: disputes.filter(d => d.status === 'cancelled').length,
  }

  const filtered = filterStatus === 'all' ? disputes : disputes.filter(d => d.status === filterStatus)

  const FILTER_TABS: { key: DisputeStatus | 'all'; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'open', label: `Open (${counts.open})` },
    { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
    { key: 'resolved', label: `Resolved (${counts.resolved})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
    { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          {showBackButton ? (
            <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_DASHBOARD)} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>Party<Text style={{ color: COLORS.purple }}>On</Text></Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
          <TouchableOpacity style={s.backBtn} onPress={loadDisputes}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Disputes & Issues</Text>
        <Text style={s.pageSubtitle}>Manage customer complaints and requests</Text>

        {/* Stats */}
        <View style={s.totalCard}>
          <View style={[s.totalIcon, { backgroundColor: COLORS.red + '22' }]}>
            <Ionicons name="warning-outline" size={22} color={COLORS.red} />
          </View>
          <View>
            <Text style={s.totalNum}>{counts.all}</Text>
            <Text style={s.totalLabel}>Total Disputes</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          {[
            [counts.open, COLORS.red, 'Open'],
            [counts.in_progress, '#f59e0b', 'In Progress'],
            [counts.resolved, COLORS.green, 'Resolved'],
          ].map(([num, color, label]) => (
            <View key={label as string} style={s.statItem}>
              <Text style={[s.statNum, { color: color as string }]}>{num}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: SPACING.md }}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.xs }}
        >
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.filterTab, filterStatus === tab.key && s.filterTabActive]}
              onPress={() => setFilterStatus(tab.key)}
            >
              <Text style={[s.filterTabText, filterStatus === tab.key && s.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={COLORS.purple} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.mutedDark} />
            <Text style={s.emptyText}>No disputes in this category</Text>
          </View>
        ) : (
          filtered.map(d => {
            const pc = PRIORITY_COLORS[d.priority]
            const sc = STATUS_COLORS[d.status]
            return (
              <TouchableOpacity
                key={d.id}
                style={s.disputeCard}
                onPress={() => setSelected(d)}
                activeOpacity={0.84}
              >
                {/* Top badges */}
                <View style={s.disputeTop}>
                  <View style={[s.priorityBadge, { backgroundColor: pc + '22' }]}>
                    <View style={[s.priorityDot, { backgroundColor: pc }]} />
                    <Text style={[s.priorityText, { color: pc }]}>
                      {d.priority.charAt(0).toUpperCase() + d.priority.slice(1)} Priority
                    </Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc + '22' }]}>
                    <Text style={[s.statusText, { color: sc }]}>{STATUS_LABELS[d.status]}</Text>
                  </View>
                </View>

                {/* User contact card */}
                <View style={s.contactCard}>
                  <View style={s.userRow}>
                    <View style={s.avatarCircle}>
                      <Text style={s.avatarText}>{(d.user_name ?? d.user_email ?? '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{d.user_name ?? 'Unknown User'}</Text>
                      <Text style={s.dateText}>Filed {formatDate(d.created_at)}</Text>
                    </View>
                  </View>
                  <View style={s.contactBtns}>
                    {d.user_email ? (
                      <TouchableOpacity
                        style={s.contactPill}
                        onPress={(e) => {
                          e.stopPropagation()
                          Linking.openURL(`mailto:${d.user_email}?subject=Re: ${encodeURIComponent(d.subject)}`)
                        }}
                      >
                        <Ionicons name="mail-outline" size={14} color={COLORS.purple} />
                        <Text style={s.contactPillText} numberOfLines={1}>{d.user_email}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {d.user_phone ? (
                      <TouchableOpacity
                        style={[s.contactPill, s.contactPillGreen]}
                        onPress={(e) => {
                          e.stopPropagation()
                          Linking.openURL(`tel:${d.user_phone}`)
                        }}
                      >
                        <Ionicons name="call-outline" size={14} color={COLORS.green} />
                        <Text style={[s.contactPillText, { color: COLORS.green }]}>{d.user_phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!d.user_email && !d.user_phone ? (
                      <Text style={s.noContactText}>No contact info available</Text>
                    ) : null}
                  </View>
                </View>

                {/* Issue */}
                <View>
                  <Text style={s.issueTitle}>{d.subject}</Text>
                  <Text style={s.issueDetail}>{d.description}</Text>
                </View>

                {/* Event */}
                {d.event_name ? (
                  <View style={s.issueMeta}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.mutedDark} />
                    <Text style={s.metaText}>{d.event_name}</Text>
                  </View>
                ) : null}

                {/* Manager notes */}
                {d.manager_notes ? (
                  <View style={s.notesBox}>
                    <Text style={s.notesLabel}>Manager notes</Text>
                    <Text style={s.notesText}>{d.manager_notes}</Text>
                  </View>
                ) : null}

                {/* Actions */}
                <View style={s.disputeActions}>
                  {d.status === 'open' ? (
                    <TouchableOpacity style={s.progressBtn} onPress={(e) => { e.stopPropagation(); quickStartProgress(d) }}>
                      <Ionicons name="time-outline" size={15} color={COLORS.cta} />
                      <Text style={s.progressBtnText}>Start Review</Text>
                    </TouchableOpacity>
                  ) : null}
                  {d.status !== 'resolved' && d.status !== 'rejected' && d.status !== 'cancelled' ? (
                    <TouchableOpacity style={s.resolveBtn} onPress={(e) => { e.stopPropagation(); quickResolve(d) }}>
                      <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                      <Text style={s.resolveBtnText}>Resolve</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={s.notesBtn} onPress={(e) => { e.stopPropagation(); setSelected(d) }}>
                    <Ionicons name="create-outline" size={15} color={COLORS.purple} />
                    <Text style={s.notesBtnText}>Update</Text>
                  </TouchableOpacity>
                  {(d.status === 'resolved' || d.status === 'rejected' || d.status === 'cancelled') ? (
                    <TouchableOpacity style={s.deleteBtn} onPress={(e) => { e.stopPropagation(); handleDelete(d) }}>
                      <Ionicons name="trash-outline" size={15} color={COLORS.red} />
                      <Text style={s.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <NotesModal
        dispute={selected}
        onClose={() => setSelected(null)}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  appName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  sub: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  pageTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  totalCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  totalIcon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  totalNum: { color: COLORS.white, fontSize: 28, fontWeight: '700' },
  totalLabel: { color: COLORS.mutedDark, fontSize: FONT.sm },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: COLORS.mutedDark, fontSize: 12 },

  filterTab: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterTabActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  filterTabText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  filterTabTextActive: { color: COLORS.white },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.base },

  disputeCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  disputeTop: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 12, fontWeight: '600' },
  statusBadge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },

  contactCard: {
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)',
    padding: SPACING.sm, gap: SPACING.sm,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.purpleDark + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: COLORS.purple, fontSize: 15, fontWeight: '700' },
  userName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  dateText: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  contactBtns: { gap: SPACING.xs },
  contactPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2,
  },
  contactPillGreen: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  contactPillText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', flex: 1 },
  noContactText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontStyle: 'italic' },

  issueTitle: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '600', marginBottom: 4 },
  issueDetail: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 18 },
  issueMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: COLORS.mutedDark, fontSize: 12 },

  notesBox: {
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
    padding: SPACING.sm,
  },
  notesLabel: { color: COLORS.purple, fontSize: 11, fontWeight: '600', marginBottom: 3 },
  notesText: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 18 },

  disputeActions: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  progressBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.cta + '14', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.cta + '35' },
  progressBtnText: { color: COLORS.cta, fontSize: FONT.sm, fontWeight: '600' },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm, paddingVertical: 10 },
  resolveBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },
  notesBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  notesBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.red + '11', borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.red + '44' },
  deleteBtnText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  contactBtnText: { color: COLORS.muted, fontSize: FONT.sm },

  // Modal
  keyboardAvoid: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modal: {
    maxHeight: '88%',
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4, borderTopRightRadius: RADIUS.xl + 4,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 24 : 8),
    borderTopWidth: 1, borderColor: COLORS.border,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  modalClose: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center' },
  modalScrollContent: { paddingBottom: SPACING.md },
  modalTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: 4, marginTop: SPACING.xs },
  modalSub: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.lg },
  fieldLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', marginBottom: SPACING.xs },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  statusChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgInput,
  },
  statusChipText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  statusPreview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.sm,
    padding: SPACING.sm, marginBottom: SPACING.md,
  },
  statusPreviewText: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 18, flex: 1 },
  notesInput: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.white, fontSize: FONT.base,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm, minHeight: 100, textAlignVertical: 'top',
  },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.xs },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
    backgroundColor: 'rgba(139,92,246,0.10)',
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 1,
  },
  templateChipText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  notesHint: { color: COLORS.mutedDark, fontSize: 11, lineHeight: 16, marginBottom: SPACING.lg },
  saveBtn: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.lg, paddingVertical: SPACING.md + 2, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT.base },
})
