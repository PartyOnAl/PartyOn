import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DashEvent = { event_id: string; event_name: string; event_starting_date: string | null; final_ticket_price: number | null; event_status: string }
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
  const [subscriptionType, setSubscriptionType]       = useState<string>('trial')

  // Keep chart static (would need analytics endpoint for real data)
  const weeklyData = [18, 30, 22, 40, 35, 55, 75]
  const maxVal = Math.max(...weeklyData)

  const fetchData = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }

    const clubId = profile.club_id

    const now = new Date().toISOString()

    const [eventsRes, tablesRes, eventIdsRes, disputesRes, clubRes, promosRes] = await Promise.all([
      // Upcoming published events only (not past)
      supabase
        .from('events')
        .select('event_id,event_name,event_starting_date,final_ticket_price,event_status')
        .eq('club_id', clubId)
        .eq('event_status', 'published')
        .gte('event_starting_date', now)
        .order('event_starting_date', { ascending: true })
        .limit(5),

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
        .select('subscription_type, subscription_due_date')
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

    if (eventsRes.data) setUpcomingEvents(eventsRes.data as DashEvent[])
    if (tablesRes.count !== null) setTableCount(tablesRes.count)
    if (disputesRes.count !== null) setOpenDisputes(disputesRes.count)
    if (clubRes.data) {
      setSubscriptionType(clubRes.data.subscription_type ?? 'trial')
      setSubscriptionDueDate(clubRes.data.subscription_due_date ?? null)
    }
    if (promosRes.data) setActivePromotions(promosRes.data as DashPromotion[])

    // Fetch recent reservations for club's events
    const eventIds = (eventIdsRes.data ?? []).map((e: { event_id: string }) => e.event_id)
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
        .order('created_at', { ascending: false })
        .limit(3)

      if (reservData) setRecentReservations(reservData as DashReservation[])
      if (count !== null) setTotalReservations(count)
    }

    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useEffect(() => { fetchData() }, [fetchData])
  const onRefresh = () => { setRefreshing(true); fetchData() }

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
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
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
          <TouchableOpacity style={s.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Dashboard Overview</Text>
        <Text style={s.pageSubtitle}>Track your club's performance</Text>

        {/* Subscription banner */}
        {subBannerColor !== null && (
          <TouchableOpacity
            style={[s.subBanner, { backgroundColor: subBannerColor + '18', borderColor: subBannerColor + '55' }]}
            onPress={() => router.push('/(manager)/(manager-tabs)/more' as any)}
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
                  : `${subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)} plan • Tap to manage`}
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
          <View style={s.statCard}>
            <View style={s.statHeader}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.purple} />
            </View>
            <Text style={s.statNum}>{upcomingEvents.length}</Text>
            <Text style={s.statLabel}>Upcoming</Text>
          </View>
          <View style={s.statCard}>
            <View style={s.statHeader}>
              <Ionicons name="restaurant-outline" size={16} color={COLORS.cta} />
            </View>
            <Text style={s.statNum}>{tableCount}</Text>
            <Text style={s.statLabel}>Tables</Text>
          </View>
          <View style={s.statCard}>
            <View style={s.statHeader}>
              <Ionicons name="receipt-outline" size={16} color={COLORS.green} />
            </View>
            <Text style={s.statNum}>{totalReservations}</Text>
            <Text style={s.statLabel}>Reservations</Text>
          </View>
        </View>

        {/* Bar chart (static illustration) */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Weekly Activity</Text>
            <Text style={s.chartNote}>Illustrative</Text>
          </View>
          <Text style={s.chartSub}>Ticket sales by day</Text>
          <View style={s.chart}>
            {weeklyData.map((val, i) => (
              <View key={i} style={s.barCol}>
                <View style={s.barTrack}>
                  <View style={[s.bar, {
                    height: `${(val / maxVal) * 100}%`,
                    backgroundColor: i === weeklyData.length - 1 ? COLORS.purpleDark : 'rgba(255,255,255,0.12)',
                  }]} />
                </View>
                <Text style={s.barLabel}>{weekDays[i]}</Text>
              </View>
            ))}
          </View>
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
              <View key={ev.event_id} style={s.eventRow}>
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
              </View>
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
  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  statsRow:   { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard:   { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  statHeader: { marginBottom: SPACING.sm },
  statNum:    { color: COLORS.white, fontSize: 28, fontWeight: '700', marginBottom: 4 },
  statLabel:  { color: COLORS.mutedDark, fontSize: 11 },

  section:       { marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  viewAll:       { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '500' },
  chartNote:     { color: COLORS.mutedDark, fontSize: 11, fontStyle: 'italic' },
  chartSub:      { color: COLORS.mutedDark, fontSize: 12, marginBottom: SPACING.sm },

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
  expireBadge: { backgroundColor: COLORS.red + '22', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  expireText:  { color: COLORS.red, fontSize: 10, fontWeight: '700' },
  activeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },

  reservRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.purpleDark + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { color: COLORS.purple, fontSize: 16, fontWeight: '700' },
  reservAmount: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  statusBadge:  { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  statusText:   { fontSize: 10, fontWeight: '600' },
})
