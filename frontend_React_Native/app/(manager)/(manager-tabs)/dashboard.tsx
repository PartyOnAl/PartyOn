import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { isEventUpcomingOrLive } from '@/lib/eventDates'
import { usePlatformSettings } from '@/lib/platformSettings'
import { SubscriptionOffersModal } from '@/components/SubscriptionOffersModal'
import { subscriptionPlanLabel } from '@/lib/subscriptions'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type WeeklyMetric = 'reservations' | 'sales'

type DashEvent = {
  event_id: string
  event_name: string
  event_starting_date: string | null
  event_ending_date: string | null
  event_hours: string | null
  final_ticket_price: number | null
  event_status: string
}
type DashPromotion = {
  promotion_id: string; title: string; category: string | null
  discount_value: number | null; discounted_price: number | null
  valid_until: string | null; status: string
}
type DashReservation = {
  reservation_id: string; type: string; status: string; created_at: string | null
  events:    { event_name: string } | null
  profiles:  { name: string | null; surname: string | null } | null
  tables: { minimum_spend: number | null; table_number: string } | null
  final_ticket_price?: number | null
  nr_of_people?: number | null
}

export default function DashboardScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { settings } = usePlatformSettings()

  const [offersModal, setOffersModal] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Real data
  const [upcomingEvents, setUpcomingEvents]         = useState<DashEvent[]>([])
  const [activePromotions, setActivePromotions]     = useState<DashPromotion[]>([])
  const [recentReservations, setRecentReservations] = useState<DashReservation[]>([])
  const [tableCount, setTableCount]                 = useState(0)
  const [totalReservations, setTotalReservations]   = useState(0)
  const [openDisputes, setOpenDisputes]             = useState(0)
  const [subscriptionDueDate, setSubscriptionDueDate] = useState<string | null>(null)
  const [subscriptionType, setSubscriptionType]       = useState<string>('monthly')
  const [subscriptionPrice, setSubscriptionPrice]     = useState<number | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  // Weekly chart - real data, last 7 days rolling
  const [weeklyReservations, setWeeklyReservations] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [weeklySales, setWeeklySales]               = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [weeklyLabels, setWeeklyLabels]             = useState<string[]>(['', '', '', '', '', '', ''])
  const [weeklyMetric, setWeeklyMetric]             = useState<WeeklyMetric>('reservations')

  const activeWeekly = weeklyMetric === 'sales' ? weeklySales : weeklyReservations
  const maxVal       = Math.max(...activeWeekly, 1)
  const weeklyTotal  = activeWeekly.reduce((a, b) => a + b, 0)

  const fetchData = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }

    const clubId = profile.club_id

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [eventsRes, tablesRes, eventIdsRes, disputesRes, clubRes, promosRes] = await Promise.all([
      // Candidate published events; filter upcoming/live client-side using hours & end dates
      supabase
        .from('events')
        .select('event_id,event_name,event_starting_date,event_ending_date,event_hours,final_ticket_price,event_status')
        .eq('club_id', clubId)
        .eq('event_status', 'published')
        .gte('event_starting_date', today.toISOString())
        .order('event_starting_date', { ascending: true })
        .limit(12),

      // Table count
      supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId),

      // Get event IDs to fetch reservations
      supabase
        .from('events')
        .select('event_id')
        .eq('club_id', clubId),

      // Open + in_progress disputes for this club
      supabase
        .from('disputes')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .in('status', ['open', 'in_progress']),

      // Subscription info
      supabase
        .from('clubs')
        .select('subscription_type, subscription_due_date, subscription_price')
        .eq('club_id', clubId)
        .single(),

      // Active promotions
      supabase
        .from('promotions')
        .select('promotion_id,title,category,discount_value,discounted_price,valid_until,status')
        .eq('club_id', clubId)
        .in('status', ['active', 'approved'])
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    if (eventsRes.data) {
      setUpcomingEvents(
        (eventsRes.data as DashEvent[])
          .filter(ev => isEventUpcomingOrLive(ev))
          .slice(0, 5),
      )
    }
    if (tablesRes.count !== null) setTableCount(tablesRes.count)
    if (disputesRes.count !== null) setOpenDisputes(disputesRes.count)
    if (clubRes.data) {
      setSubscriptionType(clubRes.data.subscription_type ?? 'monthly')
      setSubscriptionDueDate(clubRes.data.subscription_due_date ?? null)
      setSubscriptionPrice(clubRes.data.subscription_price ?? null)
    }
    if (promosRes.data) setActivePromotions(promosRes.data as DashPromotion[])

    const eventIds = (eventIdsRes.data ?? []).map((e: { event_id: string }) => e.event_id)
    // Recent reservation queue: newest first (client sort + over-fetch avoids DB ordering quirks)
    if (eventIds.length > 0) {
      const { data: reservData, count } = await supabase
        .from('reservations')
        .select(`
          reservation_id, type, status, created_at, nr_of_people,
          events(event_name, final_ticket_price),
          profiles(name, surname),
          tables(minimum_spend, table_number)
        `, { count: 'exact' })
        .in('event_id', eventIds)
        .limit(40)

      if (reservData) {
        const sorted = [...(reservData as unknown as DashReservation[])].sort((a, b) => {
          const tb = b.created_at != null ? new Date(b.created_at).getTime() : Number.NEGATIVE_INFINITY
          const ta = a.created_at != null ? new Date(a.created_at).getTime() : Number.NEGATIVE_INFINITY
          if (tb !== ta) return tb - ta
          return String(b.reservation_id).localeCompare(String(a.reservation_id))
        })
        setRecentReservations(sorted.slice(0, 3))
      } else setRecentReservations([])
      if (count !== null) setTotalReservations(count)
    } else {
      setRecentReservations([])
      setTotalReservations(0)
    }

    // Weekly activity: last 7 days rolling, reservations + sales
    const since = new Date(today)
    since.setDate(since.getDate() - 6)

    const labels: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      labels.push(DAY_SHORT[d.getDay()])
    }
    setWeeklyLabels(labels)

    const resvBuckets  = new Array(7).fill(0) as number[]
    const salesBuckets = new Array(7).fill(0) as number[]

    if (eventIds.length > 0) {
      const { data: weekResv } = await supabase
        .from('reservations')
        .select('created_at, payments(amount, status)')
        .in('event_id', eventIds)
        .gte('created_at', since.toISOString())

      ;(weekResv ?? []).forEach((r: any) => {
        if (!r.created_at) return
        const day = new Date(r.created_at); day.setHours(0, 0, 0, 0)
        const idx = Math.floor((day.getTime() - since.getTime()) / 86400000)
        if (idx < 0 || idx > 6) return
        resvBuckets[idx] += 1
        const pays: any[] = Array.isArray(r.payments) ? r.payments : (r.payments ? [r.payments] : [])
        pays.forEach(p => {
          if (p?.status === 'completed' && typeof p.amount === 'number') {
            salesBuckets[idx] += p.amount
          }
        })
      })
    }

    setWeeklyReservations(resvBuckets)
    setWeeklySales(salesBuckets.map(v => Math.round(v * 100) / 100))

    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchData() }, [fetchData])
  const onRefresh = () => { setRefreshing(true); fetchData() }

  // Unread notification count + realtime updates
  useEffect(() => {
    if (!profile?.id) return

    const refreshUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_profile_id', profile.id)
        .is('read_at', null)
      if (count !== null) setUnreadNotifications(count)
    }
    refreshUnread()

    const channelName = `notifications:badge:${profile.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_profile_id=eq.${profile.id}`,
        },
        () => { refreshUnread() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  function getStatusColor(status: string) {
    return { confirmed: COLORS.green, pending: COLORS.cta, cancelled: COLORS.red, completed: COLORS.muted }[status] ?? COLORS.muted
  }

  function formatEventDate(d: string | null) {
    if (!d) return '–'
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  }

  function getReservName(r: DashReservation) {
    if (!r.profiles) return 'Guest'
    return [r.profiles.name, r.profiles.surname].filter(Boolean).join(' ') || 'Guest'
  }

  function getReservDetail(r: DashReservation) {
    const typePart = r.type === 'ticket' ? 'Ticket' : 'Table'
    const evPart   = r.events?.event_name ?? (r.tables ? `Table ${r.tables.table_number}` : '')
    return evPart ? `${typePart} • ${evPart}` : typePart
  }

  function getDaysUntilDue(dueDate: string | null): number | null {
    if (!dueDate) return null
    const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
    return diff
  }

  const daysUntilDue = getDaysUntilDue(subscriptionDueDate)
  const subBannerColor = daysUntilDue === null ? null
    : daysUntilDue <= 0 ? COLORS.red
    : daysUntilDue <= 7 ? '#f97316'
    : daysUntilDue <= 14 ? '#eab308'
    : null

  function getReservAmount(r: DashReservation) {
    if (r.type === 'table' && r.tables?.minimum_spend) return `€${r.tables.minimum_spend}`
    const price = (r as any).events?.final_ticket_price
    if (price && r.nr_of_people) return `€${(price * r.nr_of_people).toFixed(2)}`
    if (price) return `€${price.toFixed(2)}`
    return '–'
  }

  const ACCENT_COLORS = [COLORS.cta, COLORS.purple, COLORS.green, COLORS.red, COLORS.pink]

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.managerLabel}>Manager • {profile?.name ?? 'Manager'}</Text>
          </View>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push('/(manager)/inbox' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.muted} />
            {unreadNotifications > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>
                  {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Dashboard Overview</Text>
        <Text style={s.pageSubtitle}>{"Track your club's performance"}</Text>

        {/* Subscription banner */}
        {subBannerColor !== null && (
          <TouchableOpacity
            style={[s.subBanner, { backgroundColor: subBannerColor + '18', borderColor: subBannerColor + '55' }]}
            onPress={() => setOffersModal(true)}
            activeOpacity={0.8}
          >
            <View style={[s.subBannerIcon, { backgroundColor: subBannerColor + '22' }]}>
              <Ionicons name="card-outline" size={18} color={subBannerColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.subBannerTitle, { color: COLORS.white }]}>
                {daysUntilDue! <= 0
                  ? 'Subscription overdue — renew now'
                  : `Subscription due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`}
              </Text>
              <Text style={[s.subBannerSub, { color: subBannerColor }]}>
                {daysUntilDue! <= 0
                  ? 'Service may be disrupted. Tap to renew.'
                  : `${subscriptionPlanLabel(subscriptionType)} plan • Tap for all offers`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={subBannerColor} />
          </TouchableOpacity>
        )}

        {/* Disputes alert banner */}
        {openDisputes > 0 && (
          <TouchableOpacity style={s.disputesBanner} onPress={() => router.push('/(manager)/disputes')} activeOpacity={0.8}>
            <View style={s.disputesBannerIcon}>
              <Ionicons name="warning" size={18} color={COLORS.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.disputesBannerTitle}>
                {openDisputes} open dispute{openDisputes !== 1 ? 's' : ''} need attention
              </Text>
              <Text style={s.disputesBannerSub}>Tap to review and respond</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.red} />
          </TouchableOpacity>
        )}

        {/* Stats row */}
        <View style={s.statsRow}>
          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(manager)/(manager-tabs)/events')}
          >
            <View style={s.statHeader}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.purple} />
              <Ionicons name="chevron-forward" size={14} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={s.statNum}>{upcomingEvents.length}</Text>
            <Text style={s.statLabel}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(manager)/(manager-tabs)/tables')}
          >
            <View style={s.statHeader}>
              <Ionicons name="restaurant-outline" size={16} color={COLORS.cta} />
              <Ionicons name="chevron-forward" size={14} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={s.statNum}>{tableCount}</Text>
            <Text style={s.statLabel}>Tables</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.statCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(manager)/(manager-tabs)/reservations' as any)}
          >
            <View style={s.statHeader}>
              <Ionicons name="receipt-outline" size={16} color={COLORS.green} />
              <Ionicons name="chevron-forward" size={14} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={s.statNum}>{totalReservations}</Text>
            <Text style={s.statLabel}>Reservations</Text>
          </TouchableOpacity>
        </View>

        {/* Bar chart - real last-7-days data */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Weekly Activity</Text>
            <View style={s.metricToggle}>
              <TouchableOpacity
                style={[s.metricPill, weeklyMetric === 'reservations' && s.metricPillActive]}
                onPress={() => setWeeklyMetric('reservations')}
                activeOpacity={0.85}
              >
                <Text style={[s.metricPillText, weeklyMetric === 'reservations' && s.metricPillTextActive]}>Reservations</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.metricPill, weeklyMetric === 'sales' && s.metricPillActive]}
                onPress={() => setWeeklyMetric('sales')}
                activeOpacity={0.85}
              >
                <Text style={[s.metricPillText, weeklyMetric === 'sales' && s.metricPillTextActive]}>Sales (€)</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={s.chartSub}>
            {weeklyMetric === 'sales' ? 'Completed payments by day' : 'New reservations by day'}
          </Text>

          {weeklyTotal === 0 ? (
            <View style={s.chartEmpty}>
              <Ionicons name="bar-chart-outline" size={28} color={COLORS.mutedDark} />
              <Text style={s.chartEmptyText}>No activity yet this week</Text>
            </View>
          ) : (
            <>
              <View style={s.chart}>
                {activeWeekly.map((val, i) => (
                  <View key={i} style={s.barCol}>
                    <View style={s.barTrack}>
                      <View style={[s.bar, {
                        height: `${(val / maxVal) * 100}%`,
                        backgroundColor: i === activeWeekly.length - 1 ? COLORS.purpleDark : 'rgba(255,255,255,0.12)',
                      }]} />
                    </View>
                    <Text style={s.barLabel}>{weeklyLabels[i] || ''}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.chartTotal}>
                Total: {weeklyMetric === 'sales' ? `€${weeklyTotal.toFixed(2)}` : `${weeklyTotal} reservation${weeklyTotal !== 1 ? 's' : ''}`}
              </Text>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.quickCard}>
            <TouchableOpacity style={s.actionRow} onPress={() => router.push('/(manager)/create-event')}>
              <View style={[s.actionIcon, { backgroundColor: COLORS.purpleDark + '33' }]}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.purple} />
              </View>
              <Text style={s.actionLabel}>Create Event</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => router.push('/(manager)/promotions' as any)}>
              <View style={[s.actionIcon, { backgroundColor: COLORS.cta + '22' }]}>
                <Ionicons name="pricetag-outline" size={20} color={COLORS.cta} />
              </View>
              <Text style={s.actionLabel}>Add Promotion</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => router.push('/(manager)/(manager-tabs)/tables')}>
              <View style={[s.actionIcon, { backgroundColor: COLORS.purpleDark + '33' }]}>
                <Ionicons name="restaurant-outline" size={20} color={COLORS.purple} />
              </View>
              <Text style={s.actionLabel}>Manage Tables</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => router.push('/(manager)/(manager-tabs)/reservations')}>
              <View style={[s.actionIcon, { backgroundColor: COLORS.purpleDark + '33' }]}>
                <Ionicons name="receipt-outline" size={20} color={COLORS.purple} />
              </View>
              <Text style={s.actionLabel}>View Reservations</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => router.push('/(manager)/disputes')}>
              <View style={[s.actionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Ionicons name="warning-outline" size={20} color={COLORS.red} />
              </View>
              <Text style={s.actionLabel}>Disputes & Issues</Text>
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {openDisputes > 0 && (
                  <View style={s.disputeBadge}>
                    <Text style={s.disputeBadgeText}>{openDisputes}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Events */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push('/(manager)/(manager-tabs)/events')}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {upcomingEvents.length === 0 ? (
            <View style={s.emptyInline}>
              <Text style={s.emptyInlineText}>No published events yet.</Text>
              <TouchableOpacity onPress={() => router.push('/(manager)/create-event')}>
                <Text style={s.emptyInlineLink}>Create one →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            upcomingEvents.map((ev, i) => (
              <TouchableOpacity
                key={ev.event_id}
                style={s.eventRow}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(manager)/edit-event', params: { id: ev.event_id } })}
              >
                <View style={[s.eventThumb, { backgroundColor: ACCENT_COLORS[i % ACCENT_COLORS.length] + '33' }]}>
                  <Ionicons name="musical-notes" size={18} color={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.eventName} numberOfLines={1}>{ev.event_name}</Text>
                  <Text style={s.eventDate}>
                    {formatEventDate(ev.event_starting_date)}
                    {ev.final_ticket_price ? ` • €${ev.final_ticket_price.toFixed(2)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Active Promotions */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Active Promotions</Text>
            <TouchableOpacity onPress={() => router.push('/(manager)/promotions' as any)}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {activePromotions.length === 0 ? (
            <View style={s.emptyInline}>
              <Text style={s.emptyInlineText}>No active promotions.</Text>
              <TouchableOpacity onPress={() => router.push('/(manager)/promotions' as any)}>
                <Text style={s.emptyInlineLink}>Create one →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activePromotions.map(p => {
              const expiringSoon = p.valid_until &&
                new Date(p.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
              return (
                <TouchableOpacity
                  key={p.promotion_id}
                  style={s.promoRow}
                  onPress={() => router.push('/(manager)/promotions' as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.promoIcon}>
                    <Ionicons name="pricetag-outline" size={18} color={COLORS.cta} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.promoTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={s.promoMeta}>
                      {p.category ?? 'General'}
                      {p.discount_value != null ? ` • ${p.discount_value}% off` : ''}
                      {p.discounted_price != null ? ` • €${p.discounted_price}` : ''}
                    </Text>
                  </View>
                  {expiringSoon && (
                    <View style={s.expireBadge}>
                      <Text style={s.expireText}>Ending soon</Text>
                    </View>
                  )}
                  {!expiringSoon && (
                    <View style={s.activeDot} />
                  )}
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* Recent Reservations */}
        <View style={[s.section, { marginBottom: 32 }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Reservations</Text>
            <TouchableOpacity onPress={() => router.push('/(manager)/(manager-tabs)/reservations')}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentReservations.length === 0 ? (
            <View style={s.emptyInline}>
              <Ionicons name="receipt-outline" size={16} color={COLORS.mutedDark} />
              <Text style={s.emptyInlineText}>No reservations yet.</Text>
            </View>
          ) : (
            recentReservations.map(r => (
              <View key={r.reservation_id} style={s.reservRow}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarText}>{getReservName(r)[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.eventName}>{getReservName(r)}</Text>
                  <Text style={s.eventDate} numberOfLines={1}>{getReservDetail(r)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.reservAmount}>{getReservAmount(r)}</Text>
                  <View style={[s.statusBadge, { backgroundColor: getStatusColor(r.status) + '22' }]}>
                    <Text style={[s.statusText, { color: getStatusColor(r.status) }]}>{r.status}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <SubscriptionOffersModal
        visible={offersModal}
        onClose={() => setOffersModal(false)}
        settings={settings}
        currentPlanType={subscriptionType}
        currentPlanPrice={subscriptionPrice}
        onManageBilling={() => {
          setOffersModal(false)
          router.push('/(manager)/billing-history' as any)
        }}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.bg },
  scroll:{ flex: 1, paddingHorizontal: SPACING.md },
  center:{ flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  appName:      { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  managerLabel: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  bellBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  bellBadge:    {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  statsRow:   { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard:   { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  statNum:    { color: COLORS.white, fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statLabel:  { color: COLORS.mutedDark, fontSize: 11 },

  section:       { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  viewAll:       { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '500' },
  chartSub:      { color: COLORS.mutedDark, fontSize: 12, marginBottom: SPACING.sm },
  chartTotal:    { color: COLORS.muted, fontSize: 11, marginTop: SPACING.sm, textAlign: 'right' },

  metricToggle:      { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.pill, padding: 3, borderWidth: 1, borderColor: COLORS.border },
  metricPill:        { paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.pill },
  metricPillActive:  { backgroundColor: COLORS.purpleDark },
  metricPillText:    { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600' },
  metricPillTextActive: { color: COLORS.white },

  chartEmpty:     { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.lg, gap: SPACING.xs },
  chartEmptyText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  chart:    { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol:   { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar:      { width: '100%', borderRadius: 4 },
  barLabel: { color: COLORS.mutedDark, fontSize: 9 },

  subBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  subBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  subBannerTitle: { fontSize: FONT.sm + 1, fontWeight: '700' },
  subBannerSub:   { fontSize: 11, marginTop: 2, opacity: 0.9 },

  disputesBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  disputesBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  disputesBannerTitle: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '700' },
  disputesBannerSub:   { color: COLORS.red, fontSize: 11, marginTop: 2, opacity: 0.8 },

  disputeBadge: {
    backgroundColor: COLORS.red, borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  disputeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  quickCard:   { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  actionRow:   { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  actionIcon:  { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  divider:     { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  eventRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  eventThumb: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  eventName:  { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '600', marginBottom: 3 },
  eventDate:  { color: COLORS.mutedDark, fontSize: 12 },

  emptyInline:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  emptyInlineText: { color: COLORS.mutedDark, fontSize: FONT.sm },
  emptyInlineLink: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  promoRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  promoIcon:   { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.cta + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  promoTitle:  { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '600', marginBottom: 3 },
  promoMeta:   { color: COLORS.mutedDark, fontSize: 12 },
  expireBadge: { backgroundColor: COLORS.pink + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  expireText:  { color: COLORS.pink, fontSize: 10, fontWeight: '700' },
  activeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },

  reservRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.purpleDark + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { color: COLORS.purple, fontSize: 16, fontWeight: '700' },
  reservAmount: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  statusBadge:  { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  statusText:   { fontSize: 10, fontWeight: '600' },
})
