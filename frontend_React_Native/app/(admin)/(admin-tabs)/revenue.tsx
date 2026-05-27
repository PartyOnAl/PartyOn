import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { subscriptionPlanLabel, subscriptionPrice, subscriptionPriceSuffix } from '@/lib/subscriptions'

type RevenueLine = {
  id: string
  club_id: string | null
  club_name: string
  date: string
  type: 'Ticket commission' | 'Table commission' | 'Subscription due' | 'Featured event fee'
  platformAmount: number
  referenceAmount: number
  status: 'completed' | 'due' | 'overdue'
}

type ClubSubscription = {
  club_id: string
  club_name: string
  subscription_type: string | null
  subscription_due_date: string | null
  subscription_price: number | null
  club_status: string
}

type ClubEarning = {
  club_id: string
  club_name: string
  platform: number
  commission: number
  subscriptionMrr: number
}

type SourceTotals = {
  ticketCommission: number
  tableCommission: number
  subscriptionMrr: number
  subscriptionDue: number
  overdueSubscriptions: number
  activeSubscriptions: number
  featuredFees: number
}

type DailyPoint = {
  label: string
  commission: number
  subscriptions: number
}

type Rates = {
  ticket: string
  table: string
  monthly: number
  threeMonth: number
  featured: string
}

const STATUS_COLOR: Record<RevenueLine['status'], string> = {
  completed: COLORS.green,
  due: '#f59e0b',
  overdue: COLORS.red,
}

function money(value: number, maximumFractionDigits = 0) {
  return `€${value.toLocaleString(undefined, { maximumFractionDigits })}`
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Unset'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

function planPrice(club: ClubSubscription, rates: Rates) {
  if (club.subscription_price !== null && club.subscription_price !== undefined) return Number(club.subscription_price)
  return subscriptionPrice({ monthly_club_fee: rates.monthly, three_month_club_fee: rates.threeMonth }, club.subscription_type)
}

function planMonthlyEquivalent(club: ClubSubscription, rates: Rates) {
  const price = planPrice(club, rates)
  return subscriptionPlanLabel(club.subscription_type) === '3-Month' ? price / 3 : price
}

function SourceChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map(p => p.commission + p.subscriptions))
  return (
    <View style={rv.chart}>
      {points.map(point => {
        const commissionHeight = Math.max(2, (point.commission / max) * 92)
        const subscriptionHeight = Math.max(point.subscriptions > 0 ? 2 : 0, (point.subscriptions / max) * 92)
        return (
          <View key={point.label} style={rv.chartCol}>
            <View style={rv.barTrack}>
              {point.subscriptions > 0 ? <View style={[rv.barSubscription, { height: subscriptionHeight }]} /> : null}
              {point.commission > 0 ? <View style={[rv.barCommission, { height: commissionHeight }]} /> : null}
            </View>
            <Text style={rv.chartLabel}>{point.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function RevenueLineCard({ line }: { line: RevenueLine }) {
  const color = STATUS_COLOR[line.status]
  return (
    <TouchableOpacity
      style={rv.lineCard}
      activeOpacity={0.82}
      onPress={() => Alert.alert(
        line.club_name,
        `${line.type}\nPartyOn amount: ${money(line.platformAmount, 2)}\nReference amount: ${money(line.referenceAmount, 2)}\nDate: ${line.date}`,
      )}
    >
      <View style={rv.lineHeader}>
        <View style={{ flex: 1 }}>
          <Text style={rv.lineClub}>{line.club_name}</Text>
          <Text style={rv.lineDate}>{line.date}</Text>
        </View>
        <View style={[rv.statusBadge, { backgroundColor: color + '22' }]}>
          <Text style={[rv.statusText, { color }]}>{line.status}</Text>
        </View>
      </View>
      <View style={rv.lineFooter}>
        <View style={rv.lineType}>
          <Ionicons
            name={line.type === 'Subscription due' ? 'card-outline' : 'cash-outline'}
            size={13}
            color={COLORS.purple}
          />
          <Text style={rv.lineTypeText}>{line.type}</Text>
        </View>
        <Text style={[rv.lineAmount, { color }]}>{money(line.platformAmount, 2)}</Text>
      </View>
    </TouchableOpacity>
  )
}

function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={rv.sheetOverlay} onPress={onClose}>
        <Pressable style={rv.sheet} onPress={() => {}}>
          <View style={rv.sheetHandle} />
          <View style={rv.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={rv.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={rv.sheetSub}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={rv.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function RevenueScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState<RevenueLine[]>([])
  const [points, setPoints] = useState<DailyPoint[]>([])
  const [sources, setSources] = useState<SourceTotals>({
    ticketCommission: 0,
    tableCommission: 0,
    subscriptionMrr: 0,
    subscriptionDue: 0,
    overdueSubscriptions: 0,
    activeSubscriptions: 0,
    featuredFees: 0,
  })
  const [topClubs, setTopClubs] = useState<ClubEarning[]>([])
  const [rates, setRates] = useState<Rates>({ ticket: '5', table: '8', monthly: 70, threeMonth: 200, featured: '200' })
  const [sourceSheet, setSourceSheet] = useState<{ title: string; subtitle: string; lines: RevenueLine[] } | null>(null)
  const [topOpen, setTopOpen] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadRevenue()
    }, []),
  )

  async function loadRevenue() {
    setLoading(true)

    const [paymentsRes, clubsRes, featuredRes, settingsRes] = await Promise.all([
      supabase.from('payments')
        .select('payment_id, amount, gross_amount, commission_amount, payment_type, status, payment_date, reservations(events(clubs(club_id, club_name)))')
        .eq('status', 'completed'),
      supabase.from('clubs')
        .select('club_id, club_name, club_status, subscription_type, subscription_due_date, subscription_price')
        .eq('club_status', 'approved'),
      supabase.from('events')
        .select('event_id, event_name, club_id, featured_fee_amount, featured_paid_at, featured_fee_paid, featured_request_status, clubs(club_id, club_name)')
        .eq('featured_fee_paid', true),
      supabase.from('platform_settings')
        .select('key, value')
        .in('key', ['commission_ticket', 'commission_table', 'monthly_club_fee', 'three_month_club_fee', 'annual_club_fee', 'featured_slot_fee']),
    ])

    const settingsMap: Record<string, string> = {}
    ;(settingsRes.data ?? []).forEach((row: any) => { settingsMap[row.key] = row.value })
    const nextRates: Rates = {
      ticket: settingsMap.commission_ticket ?? '5',
      table: settingsMap.commission_table ?? '8',
      monthly: Number(settingsMap.monthly_club_fee ?? 70),
      threeMonth: Number(settingsMap.three_month_club_fee ?? settingsMap.annual_club_fee ?? 200),
      featured: settingsMap.featured_slot_fee ?? '200',
    }
    setRates(nextRates)

    const payments = paymentsRes.data ?? []
    const clubs = ((clubsRes.data ?? []) as ClubSubscription[])
    const featuredRequests = (featuredRes.data ?? []) as any[]
    const ticketCommission = payments
      .filter((row: any) => row.payment_type === 'ticket')
      .reduce((sum, row: any) => sum + Number(row.commission_amount ?? 0), 0)
    const tableCommission = payments
      .filter((row: any) => row.payment_type === 'table')
      .reduce((sum, row: any) => sum + Number(row.commission_amount ?? 0), 0)

    const now = new Date()
    const dueWindowEnd = new Date()
    dueWindowEnd.setDate(now.getDate() + 30)

    let subscriptionMrr = 0
    let subscriptionDue = 0
    let overdueSubscriptions = 0
    const clubAgg: Record<string, ClubEarning> = {}

    for (const club of clubs) {
      const mrr = planMonthlyEquivalent(club, nextRates)
      const price = planPrice(club, nextRates)
      subscriptionMrr += mrr
      if (!clubAgg[club.club_id]) clubAgg[club.club_id] = { club_id: club.club_id, club_name: club.club_name, platform: 0, commission: 0, subscriptionMrr: 0 }
      clubAgg[club.club_id].subscriptionMrr += mrr
      clubAgg[club.club_id].platform += mrr

      if (club.subscription_due_date) {
        const due = new Date(club.subscription_due_date)
        if (due <= dueWindowEnd) subscriptionDue += price
        if (due < now) overdueSubscriptions += price
      }
    }

    const paymentLines: RevenueLine[] = []
    for (const payment of payments as any[]) {
      const event = Array.isArray(payment.reservations?.events) ? payment.reservations.events[0] : payment.reservations?.events
      const club = Array.isArray(event?.clubs) ? event.clubs[0] : event?.clubs
      const key = club?.club_id ?? club?.club_name ?? 'unknown'
      if (!clubAgg[key]) clubAgg[key] = { club_id: club?.club_id ?? key, club_name: club?.club_name ?? 'Unknown club', platform: 0, commission: 0, subscriptionMrr: 0 }
      const commission = Number(payment.commission_amount ?? 0)
      clubAgg[key].commission += commission
      clubAgg[key].platform += commission

      paymentLines.push({
        id: payment.payment_id,
        club_id: club?.club_id ?? null,
        club_name: club?.club_name ?? 'Unknown club',
        date: formatDate(payment.payment_date),
        type: payment.payment_type === 'table' ? 'Table commission' : 'Ticket commission',
        platformAmount: commission,
        referenceAmount: Number(payment.gross_amount ?? payment.amount ?? 0),
        status: 'completed',
      })
    }

    const subscriptionLines = clubs
      .filter(club => !!club.subscription_due_date)
      .map(club => {
        const due = new Date(club.subscription_due_date!)
        return {
          id: `sub-${club.club_id}`,
          club_id: club.club_id,
          club_name: club.club_name,
          date: formatDate(club.subscription_due_date),
          type: 'Subscription due' as const,
          platformAmount: planPrice(club, nextRates),
          referenceAmount: planPrice(club, nextRates),
          status: due < now ? 'overdue' as const : 'due' as const,
        }
      })
      .filter(line => new Date(clubs.find(c => `sub-${c.club_id}` === line.id)?.subscription_due_date ?? 0) <= dueWindowEnd)

    let featuredFees = 0
    const featuredLines: RevenueLine[] = featuredRequests.map(event => {
      const club = Array.isArray(event.clubs) ? event.clubs[0] : event.clubs
      const amount = Number(event.featured_fee_amount ?? Number(nextRates.featured) ?? 0)
      featuredFees += amount
      const key = club?.club_id ?? event.club_id ?? 'unknown'
      if (!clubAgg[key]) clubAgg[key] = { club_id: club?.club_id ?? key, club_name: club?.club_name ?? 'Unknown club', platform: 0, commission: 0, subscriptionMrr: 0 }
      clubAgg[key].platform += amount
      return {
        id: `featured-${event.event_id}`,
        club_id: club?.club_id ?? event.club_id ?? null,
        club_name: club?.club_name ?? 'Unknown club',
        date: formatDate(event.featured_paid_at),
        type: 'Featured event fee' as const,
        platformAmount: amount,
        referenceAmount: amount,
        status: 'completed' as const,
      }
    })

    setSources({
      ticketCommission,
      tableCommission,
      subscriptionMrr,
      subscriptionDue,
      overdueSubscriptions,
      activeSubscriptions: clubs.length,
      featuredFees,
    })

    setTopClubs(Object.values(clubAgg).sort((a, b) => b.platform - a.platform))
    setLines([...featuredLines, ...subscriptionLines, ...paymentLines]
      .sort((a, b) => {
        const aTime = a.type === 'Subscription due'
          ? new Date(clubs.find(c => `sub-${c.club_id}` === a.id)?.subscription_due_date ?? 0).getTime()
          : a.type === 'Featured event fee'
            ? new Date(featuredRequests.find(e => `featured-${e.event_id}` === a.id)?.featured_paid_at ?? 0).getTime()
            : new Date((payments as any[]).find(p => p.payment_id === a.id)?.payment_date ?? 0).getTime()
        const bTime = b.type === 'Subscription due'
          ? new Date(clubs.find(c => `sub-${c.club_id}` === b.id)?.subscription_due_date ?? 0).getTime()
          : b.type === 'Featured event fee'
            ? new Date(featuredRequests.find(e => `featured-${e.event_id}` === b.id)?.featured_paid_at ?? 0).getTime()
            : new Date((payments as any[]).find(p => p.payment_id === b.id)?.payment_date ?? 0).getTime()
        return bTime - aTime
      })
      .slice(0, 12))

    const chartStart = new Date()
    chartStart.setHours(0, 0, 0, 0)
    chartStart.setDate(chartStart.getDate() - 13)
    const buckets: Record<string, DailyPoint> = {}
    for (let i = 0; i < 14; i++) {
      const day = new Date(chartStart)
      day.setDate(chartStart.getDate() + i)
      buckets[dayKey(day)] = {
        label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        commission: 0,
        subscriptions: 0,
      }
    }
    for (const payment of payments as any[]) {
      const date = new Date(payment.payment_date ?? 0)
      const key = dayKey(date)
      if (buckets[key]) buckets[key].commission += Number(payment.commission_amount ?? 0)
    }
    for (const club of clubs) {
      if (!club.subscription_due_date) continue
      const key = dayKey(new Date(club.subscription_due_date))
      if (buckets[key]) buckets[key].subscriptions += planPrice(club, nextRates)
    }
    setPoints(Object.values(buckets))

    setLoading(false)
  }

  const totalCommission = sources.ticketCommission + sources.tableCommission
  const snapshot = totalCommission + sources.subscriptionMrr + sources.featuredFees
  const sourceRows = [
    {
      icon: 'ticket-outline' as const,
      label: 'Ticket commission',
      value: money(sources.ticketCommission, 2),
      sub: `${rates.ticket}% on completed ticket payments`,
      onPress: () => setSourceSheet({
        title: 'Ticket commission',
        subtitle: 'Completed ticket payments that generated PartyOn commission.',
        lines: lines.filter(line => line.type === 'Ticket commission'),
      }),
    },
    {
      icon: 'restaurant-outline' as const,
      label: 'Table commission',
      value: money(sources.tableCommission, 2),
      sub: `${rates.table}% on completed table payments`,
      onPress: () => setSourceSheet({
        title: 'Table commission',
        subtitle: 'Completed table payments that generated PartyOn commission.',
        lines: lines.filter(line => line.type === 'Table commission'),
      }),
    },
    {
      icon: 'star-outline' as const,
      label: 'Featured event fees',
      value: money(sources.featuredFees, 2),
      sub: `${money(Number(rates.featured), 2)} per paid feature request`,
      onPress: () => setSourceSheet({
        title: 'Featured event fees',
        subtitle: 'Paid manager requests for homepage featured placement.',
        lines: lines.filter(line => line.type === 'Featured event fee'),
      }),
    },
    {
      icon: 'repeat-outline' as const,
      label: 'Active subscriptions',
      value: String(sources.activeSubscriptions),
      sub: `${money(sources.subscriptionMrr, 2)} monthly run-rate`,
      onPress: () => router.push('/(admin)/subscriptions'),
    },
  ]

  return (
    <View style={[rv.container, { paddingTop: insets.top }]}>
      <View style={rv.header}>
        <View>
          <Text style={rv.brand}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
          <Text style={rv.headerSub}>Platform Admin</Text>
        </View>
        <TouchableOpacity style={rv.refreshBtn} onPress={loadRevenue}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={rv.titleBlock}>
          <Text style={rv.title}>Revenue & Payments</Text>
          <Text style={rv.titleSub}>PartyOn earnings, subscription fees and dues</Text>
        </View>

        <View style={rv.heroCard}>
          <View style={rv.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={rv.heroLabel}>Admin Revenue Snapshot</Text>
              <Text style={rv.heroValue}>{money(snapshot, 2)}</Text>
              <Text style={rv.heroNote}>Completed commissions plus monthly subscription run-rate.</Text>
            </View>
            <View style={rv.liveBadge}>
              <Ionicons name="pulse-outline" size={12} color={COLORS.green} />
              <Text style={rv.liveText}>Live</Text>
            </View>
          </View>

          <View style={rv.kpiGrid}>
            <View style={rv.kpi}>
              <Ionicons name="cash-outline" size={16} color={COLORS.green} />
              <Text style={rv.kpiLabel}>Commission earned</Text>
              <Text style={rv.kpiValue}>{money(totalCommission, 2)}</Text>
            </View>
            <View style={rv.kpi}>
              <Ionicons name="card-outline" size={16} color={COLORS.purple} />
              <Text style={rv.kpiLabel}>Subscription MRR</Text>
              <Text style={rv.kpiValue}>{money(sources.subscriptionMrr, 2)}</Text>
            </View>
            <View style={rv.kpi}>
              <Ionicons name="time-outline" size={16} color="#f59e0b" />
              <Text style={rv.kpiLabel}>Due in 30 days</Text>
              <Text style={rv.kpiValue}>{money(sources.subscriptionDue, 2)}</Text>
            </View>
            <View style={rv.kpi}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.red} />
              <Text style={rv.kpiLabel}>Overdue subs</Text>
              <Text style={rv.kpiValue}>{money(sources.overdueSubscriptions, 2)}</Text>
            </View>
          </View>
        </View>

        <View style={rv.section}>
          <Text style={rv.sectionTitle}>Admin Revenue by Day</Text>
          <View style={rv.card}>
            <SourceChart points={points} />
            <View style={rv.legend}>
              <View style={rv.legendItem}><View style={[rv.legendDot, { backgroundColor: COLORS.green }]} /><Text style={rv.legendText}>Commissions</Text></View>
              <View style={rv.legendItem}><View style={[rv.legendDot, { backgroundColor: COLORS.purple }]} /><Text style={rv.legendText}>Subscriptions due</Text></View>
            </View>
          </View>
        </View>

        <View style={rv.section}>
          <Text style={rv.sectionTitle}>Revenue Sources</Text>
          <View style={rv.card}>
            {sourceRows.map((item, index) => (
              <View key={item.label}>
                {index > 0 && <View style={rv.divider} />}
                <TouchableOpacity style={rv.sourceRow} onPress={item.onPress} activeOpacity={0.82}>
                  <View style={rv.sourceIcon}>
                    <Ionicons name={item.icon} size={16} color={COLORS.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={rv.sourceLabel}>{item.label}</Text>
                    <Text style={rv.sourceSub}>{item.sub}</Text>
                  </View>
                  <Text style={rv.sourceValue}>{item.value}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {topClubs.length > 0 && (
          <View style={rv.section}>
            <View style={rv.sectionHeader}>
              <Text style={rv.sectionTitle}>Top Clubs for PartyOn</Text>
              <TouchableOpacity onPress={() => setTopOpen(true)}>
                <Text style={rv.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={rv.card}>
              {topClubs.slice(0, 5).map((club, index) => (
                <View key={club.club_name + index}>
                  {index > 0 && <View style={rv.divider} />}
                  <View style={rv.clubRow}>
                    <View style={rv.rankCircle}>
                      <Text style={rv.rankText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={rv.clubName}>{club.club_name}</Text>
                      <Text style={rv.clubSub}>
                        {money(club.commission, 2)} commission · {money(club.subscriptionMrr, 2)} MRR
                      </Text>
                    </View>
                    <Text style={rv.clubValue}>{money(club.platform, 2)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={rv.section}>
          <View style={rv.sectionHeader}>
            <Text style={rv.sectionTitle}>Payments & Dues</Text>
            <Text style={rv.sectionMeta}>Latest 12</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={COLORS.purple} />
          ) : lines.length === 0 ? (
            <View style={rv.empty}>
              <Ionicons name="receipt-outline" size={34} color={COLORS.mutedDark} />
              <Text style={rv.emptyText}>No payment activity yet</Text>
            </View>
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {lines.map(line => <RevenueLineCard key={line.id} line={line} />)}
            </View>
          )}
        </View>

        <View style={rv.section}>
          <Text style={rv.sectionTitle}>Current Pricing Rules</Text>
          <View style={rv.card}>
            {[
              { label: 'Ticket commission', value: `${rates.ticket}%`, sub: 'PartyOn fee on ticket payment' },
              { label: 'Table commission', value: `${rates.table}%`, sub: 'PartyOn fee on table payment' },
              { label: 'Monthly subscription', value: money(rates.monthly), sub: `Per club / ${subscriptionPriceSuffix('monthly')}` },
              { label: '3-Month subscription', value: money(rates.threeMonth), sub: `Per club / ${subscriptionPriceSuffix('three_monthly')}` },
              { label: 'Featured slot', value: money(Number(rates.featured)), sub: 'Configured platform fee' },
            ].map((item, index) => (
              <View key={item.label}>
                {index > 0 && <View style={rv.divider} />}
                <View style={rv.rateRow}>
                  <View>
                    <Text style={rv.rateLabel}>{item.label}</Text>
                    <Text style={rv.rateSub}>{item.sub}</Text>
                  </View>
                  <Text style={rv.rateValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Sheet
        visible={!!sourceSheet}
        title={sourceSheet?.title ?? ''}
        subtitle={sourceSheet?.subtitle}
        onClose={() => setSourceSheet(null)}
      >
        {!sourceSheet || sourceSheet.lines.length === 0 ? (
          <View style={rv.sheetEmpty}>
            <Ionicons name="receipt-outline" size={32} color={COLORS.mutedDark} />
            <Text style={rv.emptyText}>No rows for this source yet</Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {sourceSheet.lines.map(line => <RevenueLineCard key={line.id} line={line} />)}
          </View>
        )}
      </Sheet>

      <Sheet
        visible={topOpen}
        title="All Clubs for PartyOn"
        subtitle="Ranked by commission plus subscription monthly run-rate."
        onClose={() => setTopOpen(false)}
      >
        <View style={rv.card}>
          {topClubs.map((club, index) => (
            <View key={club.club_id}>
              {index > 0 && <View style={rv.divider} />}
              <TouchableOpacity
                style={rv.clubRow}
                activeOpacity={0.82}
                onPress={() => {
                  setTopOpen(false)
                  router.push(`/(admin)/subscription-detail/${club.club_id}` as any)
                }}
              >
                <View style={rv.rankCircle}>
                  <Text style={rv.rankText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={rv.clubName}>{club.club_name}</Text>
                  <Text style={rv.clubSub}>{money(club.commission, 2)} commission · {money(club.subscriptionMrr, 2)} MRR</Text>
                </View>
                <Text style={rv.clubValue}>{money(club.platform, 2)}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  )
}

const rv = StyleSheet.create({
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
  titleBlock: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  titleSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  heroCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  heroLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  heroValue: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  heroNote: { color: COLORS.mutedDark, fontSize: 12, marginTop: 4 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  liveText: { color: COLORS.green, fontSize: 12, fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpi: {
    width: '47.5%',
    backgroundColor: COLORS.bgCard2,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm + 2,
    gap: 4,
  },
  kpiLabel: { color: COLORS.mutedDark, fontSize: 12 },
  kpiValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  sectionMeta: { color: COLORS.mutedDark, fontSize: 12, fontWeight: '700' },
  viewAllText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 132, padding: SPACING.md, paddingBottom: SPACING.sm },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  barTrack: { height: 96, width: '100%', justifyContent: 'flex-end', borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.bgCard2 },
  barCommission: { width: '100%', backgroundColor: COLORS.green },
  barSubscription: { width: '100%', backgroundColor: COLORS.purple },
  chartLabel: { color: COLORS.mutedDark, fontSize: 9 },
  legend: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  sourceIcon: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(139,92,246,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  sourceLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  sourceSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  sourceValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '900' },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  rankCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(139,92,246,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { color: COLORS.purple, fontSize: 13, fontWeight: '900' },
  clubName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  clubSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  clubValue: { color: COLORS.green, fontSize: FONT.md, fontWeight: '900' },
  lineCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  lineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  lineClub: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  lineDate: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  lineFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  lineType: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineTypeText: { color: COLORS.purple, fontSize: 12, fontWeight: '800' },
  lineAmount: { fontSize: FONT.base, fontWeight: '900' },
  empty: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.sm },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, gap: SPACING.md },
  rateLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  rateSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  rateValue: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '900' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.md },
  sheetTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '900' },
  sheetSub: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2, lineHeight: 18 },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmpty: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
})
