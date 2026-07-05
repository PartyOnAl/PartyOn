import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Club } from '@/lib/types'
import { subscriptionPlanLabel } from '@/lib/subscriptions'

type Tab = 'approved' | 'rejected' | 'all'

const TABS: { key: Tab; label: string }[] = [
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: COLORS.green,
  rejected: COLORS.red,
  suspended: COLORS.mutedDark,
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? COLORS.mutedDark
}

function ClubCard({ club, onReject, onView, onReinstate }: {
  club: Club
  onReject: () => void
  onView: () => void
  onReinstate?: () => void
}) {
  return (
    <TouchableOpacity style={cs.clubCard} onPress={onView} activeOpacity={0.84}>
      {/* Club header */}
      <View style={cs.clubHeader}>
        <View style={cs.avatarWrap}>
          {club.club_image ? (
            <Image source={{ uri: club.club_image }} style={cs.avatar} resizeMode="cover" />
          ) : (
            <View style={[cs.avatar, { backgroundColor: '#1f1f2e', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business" size={24} color={COLORS.purple} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={cs.clubName} numberOfLines={1}>{club.club_name}</Text>
            <View style={[cs.statusBadge, { borderColor: statusColor(club.club_status) }]}>
              <View style={[cs.statusDot, { backgroundColor: statusColor(club.club_status) }]} />
              <Text style={[cs.statusText, { color: statusColor(club.club_status) }]}>
                {club.club_status.charAt(0).toUpperCase() + club.club_status.slice(1)}
              </Text>
            </View>
          </View>
          {club.club_address && (
            <View style={cs.metaRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.mutedDark} />
              <Text style={cs.metaText} numberOfLines={1}>{club.club_address}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Subscription strip — only for approved clubs */}
      {club.club_status === 'approved' && (() => {
        const due = club.subscription_due_date ? new Date(club.subscription_due_date).getTime() : null
        const paid = due !== null && due >= Date.now()
        const days = due !== null ? Math.ceil((due - Date.now()) / 86400000) : null
        const subColor = paid ? COLORS.green : due !== null ? COLORS.red : COLORS.mutedDark
        const label = paid ? 'Paid' : due !== null ? 'Overdue' : 'Unset'
        return (
          <View style={cs.subStrip}>
            <View style={[cs.subPill, { backgroundColor: subColor + '22', borderColor: subColor }]}>
              <View style={[cs.subDot, { backgroundColor: subColor }]} />
              <Text style={[cs.subPillText, { color: subColor }]}>{label}</Text>
            </View>
            {club.subscription_price !== null && (
              <Text style={cs.subPrice}>€{Number(club.subscription_price).toFixed(0)} · {subscriptionPlanLabel(club.subscription_type)}</Text>
            )}
            {days !== null && (
              <Text style={[cs.subDays, { color: days <= 0 ? COLORS.red : days <= 7 ? COLORS.cta : COLORS.mutedDark }]}>
                {days <= 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
              </Text>
            )}
          </View>
        )
      })()}

      {/* Details */}
      <View style={cs.details}>
        {club.club_email_id && (
          <View style={cs.detailRow}>
            <Ionicons name="mail-outline" size={14} color={COLORS.mutedDark} />
            <Text style={cs.detailText}>{club.club_email_id}</Text>
          </View>
        )}
        {club.club_phone_number && (
          <View style={cs.detailRow}>
            <Ionicons name="call-outline" size={14} color={COLORS.mutedDark} />
            <Text style={cs.detailText}>{club.club_phone_number}</Text>
          </View>
        )}
        {club.club_description && (
          <Text style={cs.desc} numberOfLines={3}>{club.club_description}</Text>
        )}
      </View>

      {/* View Full Details */}
      <TouchableOpacity style={cs.viewBtn} onPress={onView}>
        <Ionicons name="eye-outline" size={14} color={COLORS.purple} />
        <Text style={cs.viewBtnText}>View Full Details</Text>
      </TouchableOpacity>

      {club.club_status === 'suspended' && onReinstate && (
        <View style={cs.actions}>
          <TouchableOpacity style={cs.approveBtn} onPress={onReinstate}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={cs.approveBtnText}>Reinstate</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function ClubApprovalsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [clubs, setClubs] = useState<Club[]>([])
  const [counts, setCounts] = useState({ approved: 0, rejected: 0, all: 0, paid: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useFocusEffect(
    useCallback(() => {
      loadClubs()
    }, []),
  )

  async function loadClubs() {
    setLoading(true)
    const { data: allData } = await supabase.from('clubs').select('*').order('created_at', { ascending: false })
    const all = (allData as Club[]) ?? []
    const now = Date.now()
    const paid = all.filter(c => c.club_status === 'approved' && c.subscription_due_date && new Date(c.subscription_due_date).getTime() >= now).length
    const overdue = all.filter(c => c.club_status === 'approved' && c.subscription_due_date && new Date(c.subscription_due_date).getTime() < now).length
    setCounts({
      approved: all.filter(c => c.club_status === 'approved').length,
      rejected: all.filter(c => c.club_status === 'rejected').length,
      all: all.length,
      paid,
      overdue,
    })
    setClubs(all)
    setLoading(false)
  }

  async function updateStatus(clubId: string, status: 'approved' | 'rejected' | 'suspended', clubName?: string) {
    const labels: Record<string, string> = { approved: 'Approve', rejected: 'Reject', suspended: 'Suspend' }
    Alert.alert(
      `${labels[status]} Club`,
      `Are you sure you want to ${labels[status].toLowerCase()} "${clubName ?? 'this club'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: labels[status],
          style: status === 'approved' ? 'default' : 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('clubs').update({ club_status: status }).eq('club_id', clubId)
            if (error) Alert.alert('Error', error.message)
            else loadClubs()
          },
        },
      ],
    )
  }

  const byTab = activeTab === 'all' ? clubs : clubs.filter(c => c.club_status === activeTab)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? byTab.filter(c =>
        c.club_name.toLowerCase().includes(q)
        || (c.club_email_id ?? '').toLowerCase().includes(q)
        || (c.club_address ?? '').toLowerCase().includes(q),
      )
    : byTab

  return (
    <View style={[cs.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={cs.header}>
        <View>
          <Text style={cs.brand}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
          <Text style={cs.headerSub}>Platform Admin</Text>
        </View>
        <TouchableOpacity style={cs.refreshBtn} onPress={loadClubs}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <View style={cs.titleBar}>
        <View style={{ flex: 1 }}>
          <Text style={cs.title}>Clubs</Text>
          <Text style={cs.titleSub}>Subscriptions, status & management</Text>
        </View>
        <TouchableOpacity style={cs.addBtn} onPress={() => router.push('/(admin)/add-club')} activeOpacity={0.82}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={cs.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={cs.searchWrap}>
        <Ionicons name="search" size={16} color={COLORS.mutedDark} />
        <TextInput
          style={cs.searchInput}
          placeholder="Search clubs by name, email or address"
          placeholderTextColor={COLORS.mutedDark}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={cs.searchClear}>
            <Ionicons name="close-circle" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary stats */}
      <View style={cs.statRow}>
        {[
          { label: 'Approved', val: counts.approved, color: COLORS.green },
          { label: 'Paid', val: counts.paid, color: COLORS.green },
          { label: 'Overdue', val: counts.overdue, color: COLORS.red },
          { label: 'Total', val: counts.all, color: COLORS.purple },
        ].map(item => (
          <View key={item.label} style={cs.statChip}>
            <Text style={[cs.statChipVal, { color: item.color }]}>{item.val}</Text>
            <Text style={cs.statChipLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={cs.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[cs.tab, activeTab === tab.key && cs.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[cs.tabText, activeTab === tab.key && cs.tabTextActive]} numberOfLines={1}>
              {tab.label}
              {tab.key !== 'all' ? ` (${counts[tab.key] ?? 0})` : ` (${counts.all})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md, paddingBottom: 32 }}>
          {filtered.length === 0 ? (
            <View style={cs.empty}>
              <Ionicons name="business-outline" size={48} color={COLORS.mutedDark} />
              <Text style={cs.emptyText}>No clubs in this category</Text>
            </View>
          ) : (
            filtered.map(club => (
              <ClubCard
                key={club.club_id}
                club={club}
                onReject={() => updateStatus(club.club_id, club.club_status === 'approved' ? 'suspended' : 'rejected', club.club_name)}
                onView={() => router.push(`/(admin)/club-detail/${club.club_id}`)}
                onReinstate={() => updateStatus(club.club_id, 'approved', club.club_name)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
  },
  brand: { fontSize: FONT.xl, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  titleBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  titleSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  addBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  searchInput: { flex: 1, color: COLORS.white, fontSize: FONT.sm, paddingVertical: SPACING.sm },
  searchClear: { padding: 2 },

  statRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  statChipVal: { fontSize: FONT.lg, fontWeight: '800' },
  statChipLabel: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: COLORS.purple },
  tabText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: COLORS.white, fontWeight: '700' },

  clubCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  clubHeader: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  avatarWrap: { flexShrink: 0 },
  avatar: { width: 56, height: 56, borderRadius: RADIUS.md },
  clubName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },

  subStrip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingTop: SPACING.xs, paddingBottom: 2,
    flexWrap: 'wrap',
  },
  subPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  subDot: { width: 5, height: 5, borderRadius: 3 },
  subPillText: { fontSize: 11, fontWeight: '700' },
  subPrice: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  subDays: { fontSize: 11, fontWeight: '600' },

  details: { gap: SPACING.xs },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  desc: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: FONT.sm * 1.5, marginTop: 4 },

  viewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    marginTop: 4,
  },
  viewBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: SPACING.sm },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: COLORS.green,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
  },
  approveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: COLORS.red,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
  },
  rejectBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.base },
})
