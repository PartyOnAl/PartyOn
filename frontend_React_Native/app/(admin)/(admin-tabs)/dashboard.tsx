import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const { width: SW } = Dimensions.get('window')

type Stats = {
  monthlyRevenue: number
  revenueGrowth: number
  totalUsers: number
  userGrowth: number
  activeClubs: number
  totalEvents: number
  eventGrowth: number
  totalBookings: number
}

type TopClub = { club_id: string; club_name: string; rating: number; ratingCount: number }
type TopEvent = { event_id: string; event_name: string; total: number; tickets: number }

// Simple sparkline bar chart
function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: (v / max) * 40,
            backgroundColor: i === values.length - 1 ? COLORS.purple : 'rgba(167,139,250,0.35)',
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  )
}

function StatCard({
  label, value, sub, subColor, icon, onPress,
}: {
  label: string; value: string; sub?: string; subColor?: string; icon: keyof typeof Ionicons.glyphMap
  onPress?: () => void
}) {
  const Wrap = onPress ? TouchableOpacity : View
  return (
    <Wrap style={s.statCard} onPress={onPress} activeOpacity={0.82}>
      <View style={s.statIcon}>
        <Ionicons name={icon} size={16} color={COLORS.purple} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={[s.statSub, { color: subColor ?? COLORS.green }]}>{sub}</Text> : null}
    </Wrap>
  )
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [topClubs, setTopClubs] = useState<TopClub[]>([])
  const [topEvents, setTopEvents] = useState<TopEvent[]>([])
  const [chartValues, setChartValues] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [pendingFeaturedCount, setPendingFeaturedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadDashboard()
    }, []),
  )

  async function loadDashboard() {
    setLoading(true)
    try {
      const [clubStatsRes, clubsRes, eventsRes, bookingsRes, featuredPendingRes] = await Promise.all([
        supabase.from('clubs').select('club_id, created_at', { count: 'exact' }).not('manager_id', 'is', null),
        supabase.from('clubs').select('club_id', { count: 'exact' }).eq('club_status', 'approved'),
        supabase.from('events').select('event_id, created_at', { count: 'exact' }).eq('event_status', 'published'),
        supabase.from('reservations').select('reservation_id', { count: 'exact' }),
        supabase.from('events').select('event_id', { count: 'exact', head: true }).eq('featured_request_status', 'pending_review'),
      ])
      setPendingFeaturedCount(featuredPendingRes.count ?? 0)

      // Top clubs by rating: aggregate ratings → events → clubs
      const [ratingsRes, allEventsRes, allClubsRes, ticketRes] = await Promise.all([
        supabase.from('event_ratings').select('rating, event_id'),
        supabase.from('events').select('event_id, club_id, event_name, final_ticket_price'),
        supabase.from('clubs').select('club_id, club_name').eq('club_status', 'approved'),
        supabase.from('reservations')
          .select('event_id, nr_of_people')
          .eq('type', 'ticket')
          .eq('status', 'confirmed'),
      ])

      const eventsArr = allEventsRes.data ?? []
      const clubsArr = allClubsRes.data ?? []
      const ratingsArr = ratingsRes.data ?? []
      const ticketsArr = ticketRes.data ?? []

      const eventToClub: Record<string, string> = {}
      const eventNameMap: Record<string, string> = {}
      const eventPriceMap: Record<string, number> = {}
      for (const e of eventsArr as any[]) {
        eventToClub[e.event_id] = e.club_id
        eventNameMap[e.event_id] = e.event_name
        eventPriceMap[e.event_id] = Number(e.final_ticket_price ?? 0)
      }
      const clubNameMap: Record<string, string> = {}
      for (const c of clubsArr as any[]) clubNameMap[c.club_id] = c.club_name

      // Aggregate ratings per club
      const clubAgg: Record<string, { sum: number; count: number }> = {}
      for (const r of ratingsArr as any[]) {
        const cid = eventToClub[r.event_id]
        if (!cid || !clubNameMap[cid]) continue
        if (!clubAgg[cid]) clubAgg[cid] = { sum: 0, count: 0 }
        clubAgg[cid].sum += Number(r.rating ?? 0)
        clubAgg[cid].count++
      }
      const clubs: TopClub[] = Object.entries(clubAgg)
        .map(([cid, a]) => ({
          club_id: cid,
          club_name: clubNameMap[cid] ?? '—',
          rating: a.count > 0 ? a.sum / a.count : 0,
          ratingCount: a.count,
        }))
        .sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount)
        .slice(0, 5)
      setTopClubs(clubs)

      // Aggregate tickets sold per event
      const eventAgg: Record<string, number> = {}
      for (const r of ticketsArr as any[]) {
        if (!r.event_id) continue
        eventAgg[r.event_id] = (eventAgg[r.event_id] ?? 0) + (r.nr_of_people ?? 1)
      }
      const events: TopEvent[] = Object.entries(eventAgg)
        .map(([eid, tickets]) => ({
          event_id: eid,
          event_name: eventNameMap[eid] ?? '—',
          tickets,
          total: Math.round(tickets * (eventPriceMap[eid] ?? 0)),
        }))
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 5)
      setTopEvents(events)

      // Platform revenue is only the commission collected, not the full ticket/table price.
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const prevSince = new Date()
      prevSince.setDate(prevSince.getDate() - 60)
      const { data: monthPayments } = await supabase
        .from('payments')
        .select('payment_date, commission_amount, amount')
        .eq('status', 'completed')
        .gte('payment_date', prevSince.toISOString())

      const currentRows = (monthPayments ?? []).filter((p: any) => new Date(p.payment_date ?? 0) >= since)
      const previousRows = (monthPayments ?? []).filter((p: any) => {
        const d = new Date(p.payment_date ?? 0)
        return d >= prevSince && d < since
      })
      const sumCommission = (rows: any[]) => rows.reduce((sum, p) => sum + Number(p.commission_amount ?? 0), 0)
      const monthlyRevenue = sumCommission(currentRows)
      const previousRevenue = sumCommission(previousRows)
      const revenueGrowth = previousRevenue > 0
        ? Math.round(((monthlyRevenue - previousRevenue) / previousRevenue) * 100)
        : monthlyRevenue > 0 ? 100 : 0

      const chartStart = new Date()
      chartStart.setHours(0, 0, 0, 0)
      chartStart.setDate(chartStart.getDate() - 6)
      const chartBuckets = new Array(7).fill(0) as number[]
      for (const p of currentRows as any[]) {
        const d = new Date(p.payment_date ?? 0)
        d.setHours(0, 0, 0, 0)
        const idx = Math.floor((d.getTime() - chartStart.getTime()) / 86400000)
        if (idx >= 0 && idx <= 6) chartBuckets[idx] += Number(p.commission_amount ?? 0)
      }
      setChartValues(chartBuckets)
      const growthFromRows = (rows: any[], dateKey = 'created_at') => {
        const current = rows.filter(row => new Date(row[dateKey] ?? 0) >= since).length
        const previous = rows.filter(row => {
          const d = new Date(row[dateKey] ?? 0)
          return d >= prevSince && d < since
        }).length
        return previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0
      }

      setStats({
        monthlyRevenue,
        revenueGrowth,
        totalUsers: clubStatsRes.count ?? 0,
        userGrowth: growthFromRows(clubStatsRes.data ?? []),
        activeClubs: clubsRes.count ?? 0,
        totalEvents: eventsRes.count ?? 0,
        eventGrowth: growthFromRows(eventsRes.data ?? []),
        totalBookings: bookingsRes.count ?? 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.brand}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
          <Text style={s.headerSub}>Platform Admin</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={loadDashboard}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Monitor line */}
        <Text style={s.monitorLine}>Monitor PartyOn ecosystem  •  Updated just now</Text>

        {/* Revenue hero */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Monthly Revenue</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Text style={s.heroValue}>€{stats?.monthlyRevenue.toLocaleString()}</Text>
            <View style={s.growthBadge}>
              <Ionicons name="trending-up" size={12} color={COLORS.green} />
              <Text style={s.growthText}>+{stats?.revenueGrowth}%</Text>
            </View>
          </View>
          <MiniBarChart values={chartValues} />
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <StatCard
            icon="people-outline"
            label="Total Users"
            value={(stats?.totalUsers ?? 0).toLocaleString()}
            sub={`+${stats?.userGrowth}%`}
            onPress={() => router.push('/(admin)/(admin-tabs)/users')}
          />
          <StatCard
            icon="business-outline"
            label="Active Clubs"
            value={String(stats?.activeClubs ?? 0)}
            sub="Live"
            subColor={COLORS.purple}
            onPress={() => router.push('/(admin)/(admin-tabs)/clubs')}
          />
          <StatCard
            icon="calendar-outline"
            label="Total Events"
            value={String(stats?.totalEvents ?? 0)}
            sub={`+${stats?.eventGrowth}%`}
            onPress={() => router.push('/(admin)/events')}
          />
          <StatCard
            icon="ticket-outline"
            label="Total Bookings"
            value={(stats?.totalBookings ?? 0).toLocaleString()}
            onPress={() => router.push('/(admin)/(admin-tabs)/revenue')}
          />
        </View>

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.card}>
            <TouchableOpacity
              style={s.actionRow}
              onPress={() => router.push('/(admin)/add-club')}
            >
              <View style={s.actionLeft}>
                <View style={[s.actionIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.purple} />
                </View>
                <View>
                  <Text style={s.actionTitle}>Add New Club</Text>
                  <Text style={s.actionSub}>Create club and assign manager</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.actionRow}
              onPress={() => router.push('/(admin)/(admin-tabs)/clubs')}
            >
              <View style={s.actionLeft}>
                <View style={[s.actionIcon, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
                  <Ionicons name="business-outline" size={18} color={COLORS.purple} />
                </View>
                <View>
                  <Text style={s.actionTitle}>Club Management</Text>
                  <Text style={s.actionSub}>{stats?.activeClubs} active clubs</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.actionRow}
              onPress={() => router.push('/(admin)/featured-events')}
            >
              <View style={s.actionLeft}>
                <View style={[s.actionIcon, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
                  <Ionicons name="star-outline" size={18} color={COLORS.cta} />
                </View>
                <View>
                  <Text style={s.actionTitle}>Featured Approvals</Text>
                  <Text style={s.actionSub}>
                    {pendingFeaturedCount > 0
                      ? `${pendingFeaturedCount} request${pendingFeaturedCount !== 1 ? 's' : ''} waiting`
                      : 'No pending featured requests'}
                  </Text>
                </View>
              </View>
              {pendingFeaturedCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{pendingFeaturedCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.actionRow}
              onPress={() => router.push('/(admin)/(admin-tabs)/revenue')}
            >
              <View style={s.actionLeft}>
                <View style={[s.actionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <Ionicons name="stats-chart-outline" size={18} color={COLORS.green} />
                </View>
                <View>
                  <Text style={s.actionTitle}>Revenue Report</Text>
                  <Text style={s.actionSub}>New details</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Performing Clubs */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Top Performing Clubs</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/(admin-tabs)/clubs')}>
              <Text style={s.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            {topClubs.length === 0 ? (
              <View style={{ padding: SPACING.md, alignItems: 'center' }}>
                <Text style={s.listSub}>No ratings yet</Text>
              </View>
            ) : topClubs.map((club, i) => (
              <View key={club.club_id}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity style={s.listRow} onPress={() => router.push(`/(admin)/club-detail/${club.club_id}`)} activeOpacity={0.82}>
                  <View style={s.rankCircle}>
                    <Text style={s.rankText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listTitle} numberOfLines={1}>{club.club_name}</Text>
                    <Text style={s.listSub}>
                      {club.ratingCount} rating{club.ratingCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="star" size={13} color={COLORS.cta} />
                      <Text style={s.listValue}>{club.rating.toFixed(1)}</Text>
                    </View>
                    <Text style={s.listRating}>out of 5</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Top Events */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Top Events</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/events')}>
              <Text style={s.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={s.card}>
            {topEvents.length === 0 ? (
              <View style={{ padding: SPACING.md, alignItems: 'center' }}>
                <Text style={s.listSub}>No tickets sold yet</Text>
              </View>
            ) : topEvents.map((ev, i) => (
              <View key={ev.event_id}>
                {i > 0 && <View style={s.divider} />}
                <TouchableOpacity style={s.listRow} onPress={() => router.push('/(admin)/events')} activeOpacity={0.82}>
                  <View style={[s.rankCircle, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
                    <Text style={[s.rankText, { color: COLORS.purple }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listTitle} numberOfLines={1}>{ev.event_name}</Text>
                    <Text style={s.listSub}>{ev.tickets.toLocaleString()} ticket{ev.tickets !== 1 ? 's' : ''} sold</Text>
                  </View>
                  <Text style={s.listValue}>€{ev.total.toLocaleString()}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  brand: { fontSize: FONT.xl, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginTop: 1 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  monitorLine: {
    color: COLORS.mutedDark, fontSize: 12,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },

  heroCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 8,
  },
  heroLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '500' },
  heroValue: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '900', letterSpacing: -1 },
  growthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 4,
  },
  growthText: { color: COLORS.green, fontSize: 12, fontWeight: '700' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: (SW - SPACING.md * 2 - SPACING.sm) / 2,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 4,
  },
  statIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  statLabel: { color: COLORS.mutedDark, fontSize: 12 },
  statSub: { fontSize: 12, fontWeight: '600' },

  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  seeAll: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  actionIcon: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  actionSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
  badge: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.pill,
    minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  listRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  rankCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(245,166,35,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: COLORS.cta, fontSize: 13, fontWeight: '800' },
  listTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  listSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
  listValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  listRating: { color: COLORS.mutedDark, fontSize: 12 },
})
