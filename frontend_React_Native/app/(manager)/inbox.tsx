import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

type NotificationType =
  | 'reservation_new'
  | 'reservation_cancelled'
  | 'dispute_new'
  | 'dispute_update'
  | 'promotion_expiring'
  | 'subscription_due'
  | 'event_published'
  | 'payment_received'
  | 'generic'

type Notification = {
  id: string
  recipient_profile_id: string
  club_id: string | null
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, any> | null
  read_at: string | null
  created_at: string
}

const PAGE_SIZE = 50

const ICON_BY_TYPE: Record<NotificationType, { name: any; color: string; bg: string }> = {
  reservation_new:       { name: 'receipt-outline',       color: COLORS.green,  bg: COLORS.green + '22' },
  reservation_cancelled: { name: 'close-circle-outline',  color: COLORS.red,    bg: COLORS.red + '22' },
  dispute_new:           { name: 'warning-outline',       color: COLORS.red,    bg: COLORS.red + '22' },
  dispute_update:        { name: 'alert-circle-outline',  color: COLORS.cta,    bg: COLORS.cta + '22' },
  promotion_expiring:    { name: 'pricetag-outline',      color: COLORS.cta,    bg: COLORS.cta + '22' },
  subscription_due:      { name: 'card-outline',          color: COLORS.purple, bg: COLORS.purple + '22' },
  event_published:       { name: 'calendar-outline',      color: COLORS.purple, bg: COLORS.purple + '22' },
  payment_received:      { name: 'cash-outline',          color: COLORS.green,  bg: COLORS.green + '22' },
  generic:               { name: 'notifications-outline', color: COLORS.muted,  bg: COLORS.bgCard2 },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)   return 'just now'
  if (min < 60)  return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7)   return `${day}d`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function ManagerNotificationsScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [items, setItems]           = useState<Notification[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]       = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchPage = useCallback(async (offset: number) => {
    if (!profile?.id) return { rows: [] as Notification[], done: true }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      Alert.alert('Error', error.message)
      return { rows: [] as Notification[], done: true }
    }
    const rows = (data ?? []) as Notification[]
    return { rows, done: rows.length < PAGE_SIZE }
  }, [profile?.id])

  const initialLoad = useCallback(async () => {
    setLoading(true)
    const { rows, done } = await fetchPage(0)
    setItems(rows)
    setHasMore(!done)
    setLoading(false)
  }, [fetchPage])

  useEffect(() => { initialLoad() }, [initialLoad])

  useEffect(() => {
    if (!profile?.id) return
    const channelName = `notifications:inbox:${profile.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_profile_id=eq.${profile.id}`,
        },
        (payload) => {
          setItems(prev => [payload.new as Notification, ...prev])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    const { rows, done } = await fetchPage(0)
    setItems(rows)
    setHasMore(!done)
    setRefreshing(false)
  }

  const onEndReached = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { rows, done } = await fetchPage(items.length)
    setItems(prev => [...prev, ...rows])
    setHasMore(!done)
    setLoadingMore(false)
  }

  async function markAllRead() {
    if (!profile?.id) return
    setMarkingAll(true)
    const nowIso = new Date().toISOString()
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: nowIso }))
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('recipient_profile_id', profile.id)
      .is('read_at', null)
    if (error) Alert.alert('Error', error.message)
    setMarkingAll(false)
  }

  async function markRead(n: Notification) {
    if (n.read_at) return
    const nowIso = new Date().toISOString()
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: nowIso } : x))
    await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('id', n.id)
  }

  function onPressItem(n: Notification) {
    markRead(n)
    const d = n.data ?? {}
    switch (n.type) {
      case 'reservation_new':
      case 'reservation_cancelled':
        router.push('/(manager)/(manager-tabs)/reservations' as any)
        break
      case 'event_published':
        if (d.event_id) router.push({ pathname: '/(manager)/edit-event', params: { id: String(d.event_id) } })
        else router.push('/(manager)/(manager-tabs)/events')
        break
      case 'dispute_new':
      case 'dispute_update':
        router.push('/(manager)/disputes')
        break
      case 'promotion_expiring':
        router.push('/(manager)/promotions' as any)
        break
      case 'subscription_due':
        router.push('/(manager)/(manager-tabs)/more')
        break
      default:
        break
    }
  }

  const unreadCount = items.filter(n => !n.read_at).length

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll} hitSlop={8}>
            <Text style={s.markAll}>{markingAll ? '...' : 'Mark all read'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={items.length === 0 ? s.emptyContainer : s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>{"You're all caught up"}</Text>
            <Text style={s.emptySubtitle}>New reservations, disputes and reminders will appear here.</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? (
          <View style={{ paddingVertical: SPACING.md }}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : null}
        renderItem={({ item }) => {
          const meta = ICON_BY_TYPE[item.type] ?? ICON_BY_TYPE.generic
          const unread = !item.read_at
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onPressItem(item)}
              style={[s.row, unread && s.rowUnread]}
            >
              <View style={[s.iconCircle, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.name} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  <Text style={[s.title, unread && s.titleUnread]} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.time}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.body ? <Text style={s.body} numberOfLines={2}>{item.body}</Text> : null}
              </View>
              {unread && <View style={s.unreadDot} />}
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  markAll:     { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  listContent:    { paddingVertical: SPACING.sm },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },

  empty:         { alignItems: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowUnread: { backgroundColor: COLORS.purple + '0E' },

  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 3 },
  title:       { color: COLORS.muted, fontSize: FONT.sm + 1, fontWeight: '600', flex: 1 },
  titleUnread: { color: COLORS.white, fontWeight: '700' },
  time:        { color: COLORS.mutedDark, fontSize: 11 },
  body:        { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 18 },

  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.purple, marginTop: 8, marginLeft: SPACING.xs,
  },
})
