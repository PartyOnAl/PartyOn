import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const { width: SW } = Dimensions.get('window')

type Transaction = {
  id: string
  club_name: string
  date: string
  type: string
  amount: number
  commission: number
  status: 'completed' | 'pending' | 'failed'
}

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values)
  const chartH = 80
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: chartH + 24 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View
              style={{
                width: '100%',
                height: max > 0 ? (v / max) * chartH : 2,
                backgroundColor: i === 0 ? COLORS.purple : 'rgba(167,139,250,0.4)',
                borderRadius: RADIUS.sm,
              }}
            />
            <Text style={{ color: COLORS.mutedDark, fontSize: 10, marginTop: 4 }}>{labels[i]}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const STATUS_COLOR: Record<string, string> = {
  completed: COLORS.green,
  pending: '#f59e0b',
  failed: COLORS.red,
}

function TransactionCard({ tx }: { tx: Transaction }) {
  return (
    <View style={rv.txCard}>
      <View style={rv.txHeader}>
        <View style={{ flex: 1 }}>
          <Text style={rv.txName}>{tx.club_name}</Text>
          <Text style={rv.txDate}>{tx.date}</Text>
        </View>
        <View style={[rv.statusBadge, { backgroundColor: STATUS_COLOR[tx.status] + '22' }]}>
          <Text style={[rv.statusText, { color: STATUS_COLOR[tx.status] }]}>
            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={rv.txTypeBadge}>
        <Text style={rv.txTypeText}>{tx.type}</Text>
      </View>
      <View style={rv.txFooter}>
        <View>
          <Text style={rv.txFooterLabel}>Amount</Text>
          <Text style={rv.txAmount}>€{tx.amount.toLocaleString()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={rv.txFooterLabel}>Commission</Text>
          <Text style={[rv.txCommission, { color: tx.commission > 0 ? COLORS.green : COLORS.mutedDark }]}>
            +€{tx.commission.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  )
}

type CommissionRates = {
  ticket: string
  table: string
  monthly: string
  featured: string
}

export default function RevenueScreen() {
  const insets = useSafeAreaInsets()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [platformRevenue, setPlatformRevenue] = useState(0)
  const [totalCommission, setTotalCommission] = useState(0)
  const [breakdown, setBreakdown] = useState<{ labels: string[]; values: number[] }>({ labels: ['Tickets', 'Tables'], values: [0, 0] })
  const [topClubs, setTopClubs] = useState<{ club_name: string; commission: number; gross: number }[]>([])
  const [rates, setRates] = useState<CommissionRates>({ ticket: '15', table: '15', monthly: '70', featured: '200' })

  useFocusEffect(
    useCallback(() => {
      loadRevenue()
    }, []),
  )

  async function loadRevenue() {
    setLoading(true)
    const [paymentsRes, summariesRes, settingsRes, recentRes] = await Promise.all([
      supabase.from('payments')
        .select('gross_amount, commission_amount, net_amount, payment_type, status')
        .eq('status', 'completed'),
      supabase.from('club_commission_summary')
        .select('club_name, commission_collected, gross_revenue')
        .order('commission_collected', { ascending: false })
        .limit(5),
      supabase.from('platform_settings')
        .select('key, value')
        .in('key', ['commission_ticket', 'commission_table', 'monthly_club_fee', 'featured_slot_fee']),
      supabase.from('payments')
        .select('payment_id, amount, gross_amount, commission_amount, payment_type, status, payment_date, reservations(events(clubs(club_name)))')
        .eq('status', 'completed')
        .order('payment_date', { ascending: false })
        .limit(10),
    ])

    const rows = paymentsRes.data ?? []
    const gross = rows.reduce((s, r: any) => s + Number(r.gross_amount ?? 0), 0)
    const comm  = rows.reduce((s, r: any) => s + Number(r.commission_amount ?? 0), 0)
    const grossTickets = rows.filter((r: any) => r.payment_type === 'ticket').reduce((s, r: any) => s + Number(r.gross_amount ?? 0), 0)
    const grossTables  = rows.filter((r: any) => r.payment_type === 'table').reduce((s, r: any) => s + Number(r.gross_amount ?? 0), 0)

    setTotalRevenue(gross)
    setTotalCommission(comm)
    setPlatformRevenue(comm)
    setBreakdown({ labels: ['Tickets', 'Tables'], values: [grossTickets, grossTables] })

    setTopClubs((summariesRes.data ?? []).map((c: any) => ({
      club_name: c.club_name,
      commission: Number(c.commission_collected ?? 0),
      gross: Number(c.gross_revenue ?? 0),
    })))

    const settingsMap: Record<string, string> = {}
    ;(settingsRes.data ?? []).forEach((r: any) => { settingsMap[r.key] = r.value })
    setRates({
      ticket: settingsMap.commission_ticket ?? '15',
      table: settingsMap.commission_table ?? '15',
      monthly: settingsMap.monthly_club_fee ?? '70',
      featured: settingsMap.featured_slot_fee ?? '200',
    })

    setTransactions((recentRes.data ?? []).map((p: any) => ({
      id: p.payment_id,
      club_name: p.reservations?.events?.clubs?.club_name ?? '—',
      date: new Date(p.payment_date ?? Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }),
      type: p.payment_type === 'table' ? 'Table' : 'Ticket',
      amount: Number(p.gross_amount ?? p.amount ?? 0),
      commission: Number(p.commission_amount ?? 0),
      status: 'completed',
    })))

    setLoading(false)
  }

  return (
    <View style={[rv.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
        {/* Title */}
        <View style={{ paddingHorizontal: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={rv.title}>Revenue & Payments</Text>
          <Text style={rv.titleSub}>Track platform revenue and commissions</Text>
        </View>

        {/* Hero */}
        <View style={rv.heroCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={rv.heroLabel}>Total Revenue</Text>
              <Text style={rv.heroValue}>€{totalRevenue.toLocaleString()}</Text>
            </View>
            <View style={rv.growthBadge}>
              <Ionicons name="trending-up" size={12} color={COLORS.green} />
              <Text style={rv.growthText}>+13%</Text>
            </View>
          </View>
          <View style={rv.subCards}>
            <View style={rv.subCard}>
              <Ionicons name="card-outline" size={16} color={COLORS.purple} />
              <Text style={rv.subCardLabel}>Platform Revenue</Text>
              <Text style={rv.subCardValue}>€{platformRevenue.toLocaleString()}</Text>
            </View>
            <View style={rv.subCard}>
              <Ionicons name="cash-outline" size={16} color={COLORS.green} />
              <Text style={rv.subCardLabel}>Total Commission</Text>
              <Text style={rv.subCardValue}>€{totalCommission.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Revenue Breakdown */}
        <View style={rv.section}>
          <Text style={rv.sectionTitle}>Gross Revenue Breakdown</Text>
          <View style={rv.card}>
            <View style={{ padding: SPACING.md }}>
              <BarChart values={breakdown.values} labels={breakdown.labels} />
            </View>
          </View>
        </View>

        {/* Top earning clubs by commission */}
        {topClubs.length > 0 && (
          <View style={rv.section}>
            <Text style={rv.sectionTitle}>Top Clubs by Commission</Text>
            <View style={rv.card}>
              {topClubs.map((c, i) => (
                <View key={c.club_name + i}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: COLORS.border }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: SPACING.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.white, fontSize: FONT.base, fontWeight: '600' }}>{c.club_name}</Text>
                      <Text style={{ color: COLORS.mutedDark, fontSize: 12, marginTop: 2 }}>Gross €{c.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                    <Text style={{ color: COLORS.green, fontSize: FONT.md, fontWeight: '800' }}>+€{c.commission.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent Transactions */}
        <View style={rv.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
            <Text style={rv.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
              <Text style={{ color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' }}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.purple} />
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {transactions.map(tx => (
                <TransactionCard key={tx.id} tx={tx} />
              ))}
            </View>
          )}
        </View>

        {/* Commission Rates */}
        <View style={rv.section}>
          <Text style={rv.sectionTitle}>Commission Rates</Text>
          <View style={rv.card}>
            {[
              { label: 'Ticket Commission', value: `${rates.ticket}%`, sub: 'Per ticket sale' },
              { label: 'Table Commission', value: `${rates.table}%`, sub: 'Per table reservation' },
              { label: 'Monthly Subscription', value: `€${rates.monthly}`, sub: 'Per club/month' },
              { label: 'Featured Event', value: `€${rates.featured}`, sub: 'Per featured slot' },
            ].map((item, i, arr) => (
              <View key={item.label}>
                {i > 0 && <View style={{ height: 1, backgroundColor: COLORS.border }} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md }}>
                  <View>
                    <Text style={{ color: COLORS.white, fontSize: FONT.base, fontWeight: '600' }}>{item.label}</Text>
                    <Text style={{ color: COLORS.mutedDark, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
                  </View>
                  <Text style={{ color: COLORS.purple, fontSize: FONT.md, fontWeight: '800' }}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
  heroLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '500' },
  heroValue: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  growthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  growthText: { color: COLORS.green, fontSize: 12, fontWeight: '700' },
  subCards: { flexDirection: 'row', gap: SPACING.sm },
  subCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard2,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.sm + 2,
    gap: 4,
  },
  subCardLabel: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  subCardValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },

  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },

  txCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  txHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  txName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  txDate: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  txTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  txTypeText: { color: COLORS.purple, fontSize: 12, fontWeight: '600' },
  txFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  txFooterLabel: { color: COLORS.mutedDark, fontSize: 12 },
  txAmount: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: 2 },
  txCommission: { fontSize: FONT.base, fontWeight: '700', marginTop: 2 },
})
