import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type ManagerTab = 'all' | 'approved' | 'pending' | 'suspended'

const MANAGER_TABS: { key: ManagerTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
]

type ClubManager = {
  club_id: string
  club_name: string
  club_address: string | null
  club_status: string
  club_image: string | null
  manager_id: string | null
  manager_name: string | null
  manager_surname: string | null
  manager_email: string | null
  manager_phone: string | null
  event_count: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: COLORS.green,
  rejected: COLORS.red,
  suspended: COLORS.mutedDark,
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? COLORS.mutedDark
}

const AVATAR_COLORS = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function avatarColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function managerInitials(mgr: ClubManager) {
  const n = (mgr.manager_name ?? '?')[0] ?? '?'
  const s = (mgr.manager_surname ?? '')[0] ?? ''
  return (n + s).toUpperCase()
}

function ManagerCard({ item }: { item: ClubManager }) {
  const hasManager = !!item.manager_id

  return (
    <View style={ms.card}>
      {/* Club header */}
      <View style={ms.cardHeader}>
        <View style={ms.clubAvatarWrap}>
          {item.club_image ? (
            <Image source={{ uri: item.club_image }} style={ms.clubAvatar} resizeMode="cover" />
          ) : (
            <View style={[ms.clubAvatar, { backgroundColor: '#1f1f2e', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business" size={22} color={COLORS.purple} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={ms.clubName} numberOfLines={1}>{item.club_name}</Text>
            <View style={[ms.statusPill, { borderColor: statusColor(item.club_status) }]}>
              <View style={[ms.statusDot, { backgroundColor: statusColor(item.club_status) }]} />
              <Text style={[ms.statusText, { color: statusColor(item.club_status) }]}>
                {item.club_status.charAt(0).toUpperCase() + item.club_status.slice(1)}
              </Text>
            </View>
          </View>
          {item.club_address ? (
            <View style={ms.metaRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.mutedDark} />
              <Text style={ms.metaText} numberOfLines={1}>{item.club_address}</Text>
            </View>
          ) : null}
          <View style={ms.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.mutedDark} />
            <Text style={ms.metaText}>{item.event_count} event{item.event_count !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={ms.divider} />

      {/* Manager section */}
      {hasManager ? (
        <View style={ms.managerRow}>
          <View style={[ms.managerAvatar, { backgroundColor: avatarColor(item.manager_id!) }]}>
            <Text style={ms.managerAvatarText}>{managerInitials(item)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ms.managerName}>
              {[item.manager_name, item.manager_surname].filter(Boolean).join(' ') || 'Unknown Manager'}
            </Text>
            <Text style={ms.managerRole}>Club Manager</Text>
          </View>
        </View>
      ) : (
        <View style={ms.noManagerRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.mutedDark} />
          <Text style={ms.noManagerText}>No manager assigned</Text>
        </View>
      )}

      {/* Contact actions */}
      {hasManager && (item.manager_email || item.manager_phone) ? (
        <View style={ms.contactRow}>
          {item.manager_email ? (
            <TouchableOpacity
              style={ms.contactBtn}
              onPress={() => Linking.openURL(`mailto:${item.manager_email}`)}
            >
              <Ionicons name="mail-outline" size={14} color={COLORS.purple} />
              <Text style={ms.contactBtnText} numberOfLines={1}>{item.manager_email}</Text>
            </TouchableOpacity>
          ) : null}
          {item.manager_phone ? (
            <TouchableOpacity
              style={[ms.contactBtn, ms.contactBtnPhone]}
              onPress={() => Linking.openURL(`tel:${item.manager_phone}`)}
            >
              <Ionicons name="call-outline" size={14} color={COLORS.green} />
              <Text style={[ms.contactBtnText, { color: COLORS.green }]}>{item.manager_phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export default function ClubManagersScreen() {
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<ManagerTab>('all')
  const [clubs, setClubs] = useState<ClubManager[]>([])
  const [counts, setCounts] = useState({ all: 0, approved: 0, pending: 0, suspended: 0 })
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadManagers()
    }, []),
  )

  async function loadManagers() {
    setLoading(true)

    const { data: clubData } = await supabase
      .from('clubs')
      .select(`
        club_id, club_name, club_address, club_status, club_image, manager_id,
        profiles:manager_id ( name, surname, email, phone_number )
      `)
      .order('club_name')

    const { data: eventCounts } = await supabase
      .from('events')
      .select('club_id')

    const countMap: Record<string, number> = {}
    for (const e of (eventCounts ?? [])) {
      countMap[e.club_id] = (countMap[e.club_id] ?? 0) + 1
    }

    const items: ClubManager[] = ((clubData ?? []) as any[]).map(c => {
      const mgr = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
      return {
        club_id: c.club_id,
        club_name: c.club_name,
        club_address: c.club_address ?? null,
        club_status: c.club_status,
        club_image: c.club_image ?? null,
        manager_id: c.manager_id ?? null,
        manager_name: mgr?.name ?? null,
        manager_surname: mgr?.surname ?? null,
        manager_email: mgr?.email ?? null,
        manager_phone: mgr?.phone_number ?? null,
        event_count: countMap[c.club_id] ?? 0,
      }
    })

    setCounts({
      all: items.length,
      approved: items.filter(c => c.club_status === 'approved').length,
      pending: items.filter(c => c.club_status === 'pending').length,
      suspended: items.filter(c => c.club_status === 'suspended').length,
    })
    setClubs(items)
    setLoading(false)
  }

  const filtered = activeTab === 'all' ? clubs : clubs.filter(c => c.club_status === activeTab)

  return (
    <View style={[ms.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ms.header}>
        <View>
          <Text style={ms.brand}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
          <Text style={ms.headerSub}>Platform Admin</Text>
        </View>
        <TouchableOpacity style={ms.refreshBtn} onPress={loadManagers}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <View style={ms.titleBar}>
        <Text style={ms.title}>Club Managers</Text>
        <Text style={ms.titleSub}>Contact and manage club operators</Text>
      </View>

      {/* Stats */}
      <View style={ms.statRow}>
        {[
          { label: 'Total', val: counts.all, color: COLORS.purple },
          { label: 'Active', val: counts.approved, color: COLORS.green },
          { label: 'Pending', val: counts.pending, color: '#f59e0b' },
          { label: 'Suspended', val: counts.suspended, color: COLORS.mutedDark },
        ].map(item => (
          <View key={item.label} style={ms.statChip}>
            <Text style={[ms.statChipVal, { color: item.color }]}>{item.val}</Text>
            <Text style={ms.statChipLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={ms.tabs}>
        {MANAGER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[ms.tab, activeTab === tab.key && ms.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[ms.tabText, activeTab === tab.key && ms.tabTextActive]} numberOfLines={1}>
              {tab.label}
              {tab.key !== 'all' ? ` (${counts[tab.key] ?? 0})` : ` (${counts.all})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md, paddingBottom: 32 }}
        >
          {filtered.length === 0 ? (
            <View style={ms.empty}>
              <Ionicons name="people-outline" size={48} color={COLORS.mutedDark} />
              <Text style={ms.emptyText}>No clubs in this category</Text>
            </View>
          ) : (
            filtered.map(item => <ManagerCard key={item.club_id} item={item} />)
          )}
        </ScrollView>
      )}
    </View>
  )
}

const ms = StyleSheet.create({
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
  titleBar: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  titleSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },

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
    borderWidth: 1, borderColor: COLORS.border,
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

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  clubAvatarWrap: { flexShrink: 0 },
  clubAvatar: { width: 52, height: 52, borderRadius: RADIUS.md },
  clubName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', flex: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },

  divider: { height: 1, backgroundColor: COLORS.border },

  managerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  managerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  managerAvatarText: { color: '#fff', fontSize: FONT.sm, fontWeight: '800' },
  managerName: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  managerRole: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },

  noManagerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 4 },
  noManagerText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  contactRow: { gap: SPACING.xs },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)',
  },
  contactBtnPhone: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  contactBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', flex: 1 },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.base },
})
