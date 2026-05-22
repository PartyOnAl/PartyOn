import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { MANAGER_DASHBOARD, replaceManagerRoute } from '@/lib/managerNavigation'

const { width: SCREEN_W } = Dimensions.get('window')
const CHART_W = SCREEN_W - SPACING.md * 2 - SPACING.md * 2  // card padding

type Period = '7d' | '30d' | '90d' | 'all'

type EventStat = {
  event_id: string
  event_name: string
  event_starting_date: string | null
  tickets: number
  reservations: number
  revenue: number
  commission: number
  payout: number
  pending: number
  confirmed: number
  cancelled: number
}

type Overview = {
  totalReservations: number
  totalTickets: number
  totalRevenue: number
  confirmed: number
  pending: number
  cancelled: number
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 days', '30d': '30 days', '90d': '90 days', all: 'All time',
}

function periodCutoff(p: Period): string | null {
  if (p === 'all') return null
  const days = p === '7d' ? 7 : p === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function fmt(n: number) {
  return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${n.toFixed(0)}`
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, color, valueFormatter }: {
  data: { label: string; value: number }[]
  color: string
  valueFormatter?: (v: number) => string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const BAR_H = 28
  const GAP = 10
  return (
    <View style={{ gap: GAP }}>
      {data.map((d, i) => {
        const pct = d.value / max
        const barW = Math.max(pct * (CHART_W - 90), d.value > 0 ? 4 : 0)
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Text style={bc.barLabel} numberOfLines={1}>{d.label}</Text>
            <View style={{ flex: 1, height: BAR_H, justifyContent: 'center' }}>
              <View style={[bc.barBg, { height: BAR_H }]}>
                <View style={[bc.barFill, { width: barW, backgroundColor: color, height: BAR_H }]} />
              </View>
            </View>
            <Text style={bc.barValue}>{valueFormatter ? valueFormatter(d.value) : d.value}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Sparkline (simple area line using SVG-free approach) ──────────────────────
function MiniLineChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const H = 56
  const W = CHART_W
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * H,
  }))

  // Render as a series of connected View segments approximating a line
  const segments = pts.slice(0, -1).map((p, i) => {
    const next = pts[i + 1]
    const dx = next.x - p.x
    const dy = next.y - p.y
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return { x: p.x, y: p.y, len, angle }
  })

  return (
    <View style={{ height: H, width: W, overflow: 'hidden' }}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: seg.x,
            top: seg.y,
            width: seg.len,
            height: 2,
            backgroundColor: color,
            transformOrigin: '0 50%',
            transform: [{ rotate: `${seg.angle}deg` }],
          }}
        />
      ))}
      {pts.map((p, i) => (
        <View
          key={`dot-${i}`}
          style={{
            position: 'absolute',
            left: p.x - 3,
            top: p.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusBar({ confirmed, pending, cancelled }: { confirmed: number; pending: number; cancelled: number }) {
  const total = confirmed + pending + cancelled || 1
  const cPct = (confirmed / total) * 100
  const pPct = (pending / total) * 100
  const xPct = (cancelled / total) * 100
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
        {cPct > 0 && <View style={{ flex: cPct, backgroundColor: COLORS.green, borderRadius: 5 }} />}
        {pPct > 0 && <View style={{ flex: pPct, backgroundColor: COLORS.cta, borderRadius: 5 }} />}
        {xPct > 0 && <View style={{ flex: xPct, backgroundColor: COLORS.red + '99', borderRadius: 5 }} />}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
        {[
          { label: 'Confirmed', count: confirmed, color: COLORS.green },
          { label: 'Pending',   count: pending,   color: COLORS.cta   },
          { label: 'Cancelled', count: cancelled, color: COLORS.red   },
        ].map(({ label, count, color }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: COLORS.muted, fontSize: 12 }}>{label} </Text>
            <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: '700' }}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<Overview>({ totalReservations: 0, totalTickets: 0, totalRevenue: 0, confirmed: 0, pending: 0, cancelled: 0 })
  const [eventStats, setEventStats] = useState<EventStat[]>([])
  const [commission, setCommission] = useState({ gross: 0, fee: 0, net: 0, ticketRate: 15, tableRate: 15 })

  const load = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    setLoading(true)

    try {
      const cutoff = periodCutoff(period)
      const [clubRes, settingsRes] = await Promise.all([
        supabase.from('clubs').select('commission_ticket_rate, commission_table_rate').eq('club_id', profile.club_id).single(),
        supabase.from('platform_settings').select('key, value').in('key', ['commission_ticket', 'commission_table']),
      ])

      const settingsMap: Record<string, string> = {}
      ;(settingsRes.data ?? []).forEach((r: any) => { settingsMap[r.key] = r.value })
      const ticketRate = Number(clubRes.data?.commission_ticket_rate ?? settingsMap.commission_ticket ?? 15)
      const tableRate = Number(clubRes.data?.commission_table_rate ?? settingsMap.commission_table ?? 15)

      let evQ = supabase
        .from('events')
        .select('event_id, event_name, event_starting_date, event_status')
        .eq('club_id', profile.club_id)
        .order('event_starting_date', { ascending: false })
      if (cutoff) evQ = evQ.gte('event_starting_date', cutoff)
      const { data: events, error: eventsError } = await evQ
      if (eventsError) throw eventsError

      const eventIds = (events ?? []).map((e: any) => e.event_id)
      if (eventIds.length === 0) {
        setOverview({ totalReservations: 0, totalTickets: 0, totalRevenue: 0, confirmed: 0, pending: 0, cancelled: 0 })
        setEventStats([])
        setCommission({ gross: 0, fee: 0, net: 0, ticketRate, tableRate })
        return
      }

      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('reservation_id, event_id, type, status, nr_of_people, created_at')
        .in('event_id', eventIds)
      if (reservationsError) throw reservationsError

      const resIds = (reservations ?? []).map((r: any) => r.reservation_id)
      let payments: any[] = []
      if (resIds.length > 0) {
        const { data: p, error: paymentsError } = await supabase
          .from('payments')
          .select('reservation_id, amount, gross_amount, commission_amount, net_amount, payment_type, status, payment_date')
          .in('reservation_id', resIds)
          .eq('status', 'completed')
        if (paymentsError) throw paymentsError
        payments = p ?? []
      }

      const eventMap: Record<string, EventStat> = {}
      for (const ev of events ?? []) {
        eventMap[ev.event_id] = {
          event_id: ev.event_id,
          event_name: ev.event_name,
          event_starting_date: ev.event_starting_date,
          tickets: 0, reservations: 0, revenue: 0, commission: 0, payout: 0,
          pending: 0, confirmed: 0, cancelled: 0,
        }
      }

      const reservationById: Record<string, any> = {}
      for (const r of reservations ?? []) {
        reservationById[r.reservation_id] = r
        const es = eventMap[r.event_id]
        if (!es) continue
        es.reservations++
        if (r.type === 'ticket') es.tickets += (r.nr_of_people ?? 1)
        if (r.status === 'confirmed') es.confirmed++
        else if (r.status === 'pending') es.pending++
        else if (r.status === 'cancelled') es.cancelled++
      }

      for (const p of payments) {
        const reservation = reservationById[p.reservation_id]
        const es = reservation ? eventMap[reservation.event_id] : null
        if (!es) continue
        const gross = Number(p.gross_amount ?? p.amount ?? 0)
        const type = p.payment_type ?? reservation.type
        const fallbackRate = type === 'table' ? tableRate : ticketRate
        const fee = Number(p.commission_amount ?? 0) || (gross * fallbackRate) / 100
        const net = Number(p.net_amount ?? 0) || Math.max(gross - fee, 0)
        es.revenue += Number.isFinite(gross) ? gross : 0
        es.commission += Number.isFinite(fee) ? fee : 0
        es.payout += Number.isFinite(net) ? net : 0
      }

      const stats = Object.values(eventMap)
        .sort((a, b) => (b.revenue + b.tickets + b.reservations) - (a.revenue + a.tickets + a.reservations))

      const gross = stats.reduce((s, e) => s + e.revenue, 0)
      const fee = stats.reduce((s, e) => s + e.commission, 0)
      const net = stats.reduce((s, e) => s + e.payout, 0)

      setCommission({ gross, fee, net, ticketRate, tableRate })
      setOverview({
        totalReservations: (reservations ?? []).filter((r: any) => r.status !== 'cancelled').length,
        totalTickets: (reservations ?? []).filter((r: any) => r.type === 'ticket' && r.status === 'confirmed')
          .reduce((s: number, r: any) => s + (r.nr_of_people ?? 1), 0),
        totalRevenue: gross,
        confirmed: (reservations ?? []).filter((r: any) => r.status === 'confirmed').length,
        pending: (reservations ?? []).filter((r: any) => r.status === 'pending').length,
        cancelled: (reservations ?? []).filter((r: any) => r.status === 'cancelled').length,
      })
      setEventStats(stats)
    } catch (err) {
      console.warn('Analytics load failed', err)
      setOverview({ totalReservations: 0, totalTickets: 0, totalRevenue: 0, confirmed: 0, pending: 0, cancelled: 0 })
      setEventStats([])
    } finally {
      setLoading(false)
    }
  }, [profile?.club_id, period])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const topByTickets = eventStats.slice(0, 6).map(e => ({
    label: e.event_name.length > 14 ? e.event_name.slice(0, 14) + '…' : e.event_name,
    value: e.tickets,
  }))
  const topByRevenue = eventStats
    .filter(e => e.revenue > 0)
    .slice(0, 6)
    .map(e => ({
      label: e.event_name.length > 14 ? e.event_name.slice(0, 14) + '…' : e.event_name,
      value: e.revenue,
    }))
  const topByReservations = eventStats.slice(0, 6).map(e => ({
    label: e.event_name.length > 14 ? e.event_name.slice(0, 14) + '…' : e.event_name,
    value: e.reservations,
  }))

  // Revenue sparkline — one point per event (sorted by date asc)
  const sparkValues = [...eventStats]
    .sort((a, b) => (a.event_starting_date ?? '').localeCompare(b.event_starting_date ?? ''))
    .map(e => e.revenue)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_DASHBOARD)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Analytics</Text>
        <Text style={s.pageSubtitle}>Performance overview for your venue</Text>

        {/* Period selector */}
        <View style={s.periodRow}>
          {(['7d', '30d', '90d', 'all'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodTab, period === p && s.periodTabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[s.periodText, period === p && s.periodTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.loader}><ActivityIndicator color={COLORS.purple} size="large" /></View>
        ) : (
          <>
            {/* KPI cards */}
            <View style={s.kpiGrid}>
              <View style={[s.kpiCard, { borderColor: COLORS.purple + '44' }]}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.purple} />
                <Text style={s.kpiValue}>{overview.totalReservations}</Text>
                <Text style={s.kpiLabel}>Active Bookings</Text>
              </View>
              <View style={[s.kpiCard, { borderColor: COLORS.cta + '44' }]}>
                <Ionicons name="ticket-outline" size={18} color={COLORS.cta} />
                <Text style={s.kpiValue}>{overview.totalTickets}</Text>
                <Text style={s.kpiLabel}>Tickets Sold</Text>
              </View>
              <View style={[s.kpiCard, { borderColor: COLORS.green + '44' }]}>
                <Ionicons name="cash-outline" size={18} color={COLORS.green} />
                <Text style={s.kpiValue}>{fmt(overview.totalRevenue)}</Text>
                <Text style={s.kpiLabel}>Revenue</Text>
              </View>
              <View style={[s.kpiCard, { borderColor: COLORS.mutedDark + '44' }]}>
                <Ionicons name="layers-outline" size={18} color={COLORS.muted} />
                <Text style={s.kpiValue}>{eventStats.length}</Text>
                <Text style={s.kpiLabel}>Events</Text>
              </View>
            </View>

            {/* Commission & Payout */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View>
                  <Text style={s.cardTitle}>Commission & Payout</Text>
                  <Text style={s.cardSubtitle}>Platform fee on completed payments</Text>
                </View>
                <Text style={[s.kpiValue, { color: COLORS.green }]}>{fmt(commission.net)}</Text>
              </View>
              <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.muted, fontSize: FONT.sm }}>Gross collected</Text>
                  <Text style={{ color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' }}>€{commission.gross.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.muted, fontSize: FONT.sm }}>Platform commission</Text>
                  <Text style={{ color: COLORS.red, fontSize: FONT.sm, fontWeight: '700' }}>−€{commission.fee.toFixed(2)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.white, fontSize: FONT.base, fontWeight: '700' }}>Your payout</Text>
                  <Text style={{ color: COLORS.green, fontSize: FONT.base, fontWeight: '800' }}>€{commission.net.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
                  <View style={{ flex: 1, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.mutedDark, fontSize: 11 }}>Ticket rate</Text>
                    <Text style={{ color: COLORS.purple, fontSize: FONT.md, fontWeight: '800', marginTop: 2 }}>{commission.ticketRate}%</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ color: COLORS.mutedDark, fontSize: 11 }}>Table rate</Text>
                    <Text style={{ color: COLORS.purple, fontSize: FONT.md, fontWeight: '800', marginTop: 2 }}>{commission.tableRate}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Status breakdown */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Booking Status</Text>
              <Text style={s.cardSubtitle}>Confirmed · Pending · Cancelled</Text>
              <View style={{ marginTop: SPACING.md }}>
                <StatusBar
                  confirmed={overview.confirmed}
                  pending={overview.pending}
                  cancelled={overview.cancelled}
                />
              </View>
            </View>

            {/* Revenue sparkline */}
            {sparkValues.length > 1 && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.cardTitle}>Revenue Trend</Text>
                    <Text style={s.cardSubtitle}>Per event (chronological)</Text>
                  </View>
                  <Text style={[s.kpiValue, { color: COLORS.green }]}>{fmt(overview.totalRevenue)}</Text>
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <MiniLineChart values={sparkValues} color={COLORS.green} />
                </View>
              </View>
            )}

            {/* Tickets per event */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Tickets Sold per Event</Text>
              <Text style={s.cardSubtitle}>{topByTickets.length > 0 ? `Top ${topByTickets.length} events` : 'No events in this period'}</Text>
              <View style={{ marginTop: SPACING.md }}>
                {topByTickets.length > 0 ? (
                  <BarChart data={topByTickets} color={COLORS.cta} />
                ) : (
                  <Text style={s.emptyCardText}>No ticket data yet.</Text>
                )}
              </View>
            </View>

            {/* Reservations per event */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Reservations per Event</Text>
              <Text style={s.cardSubtitle}>All bookings (tables + tickets)</Text>
              <View style={{ marginTop: SPACING.md }}>
                {topByReservations.length > 0 ? (
                  <BarChart data={topByReservations} color={COLORS.purple} />
                ) : (
                  <Text style={s.emptyCardText}>No reservation data yet.</Text>
                )}
              </View>
            </View>

            {/* Revenue per event */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Revenue per Event</Text>
                <Text style={s.cardSubtitle}>Completed ticket payments</Text>
                <View style={{ marginTop: SPACING.md }}>
                  <BarChart data={topByRevenue} color={COLORS.green} valueFormatter={v => `€${v.toFixed(0)}`} />
                </View>
            </View>

            {/* Event leaderboard */}
            <Text style={s.sectionLabel}>TOP EVENTS</Text>
            <View style={s.leaderCard}>
              {eventStats.length === 0 ? (
                <Text style={s.emptyCardText}>No events found for this period.</Text>
              ) : eventStats.slice(0, 5).map((e, i) => (
                <View key={e.event_id}>
                  <TouchableOpacity
                    style={s.leaderRow}
                    onPress={() => router.push({ pathname: '/(manager)/edit-event', params: { id: e.event_id } })}
                    activeOpacity={0.8}
                  >
                    <View style={[s.rank, i === 0 && { backgroundColor: COLORS.cta + '22' }]}>
                      <Text style={[s.rankText, i === 0 && { color: COLORS.cta }]}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.leaderName} numberOfLines={1}>{e.event_name}</Text>
                      <Text style={s.leaderDate}>
                        {e.event_starting_date ? new Date(e.event_starting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '–'}
                      </Text>
                    </View>
                    <View style={s.leaderStats}>
                      <View style={s.leaderStat}>
                        <Ionicons name="ticket-outline" size={12} color={COLORS.cta} />
                        <Text style={s.leaderStatVal}>{e.tickets}</Text>
                      </View>
                      <View style={s.leaderStat}>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.purple} />
                        <Text style={s.leaderStatVal}>{e.reservations}</Text>
                      </View>
                      {e.revenue > 0 && (
                        <View style={s.leaderStat}>
                          <Ionicons name="cash-outline" size={12} color={COLORS.green} />
                          <Text style={s.leaderStatVal}>{fmt(e.revenue)}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  {i < Math.min(eventStats.length, 5) - 1 && <View style={s.div} />}
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '900', letterSpacing: -0.5 },
  sub:     { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600', marginTop: 1 },
  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.md },

  periodRow:        { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  periodTab:        { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  periodTabActive:  { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  periodText:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  periodTextActive: { color: COLORS.white, fontWeight: '700' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:  { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
  emptyCardText: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 20, paddingVertical: SPACING.sm },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  kpiCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md,
    gap: SPACING.xs,
  },
  kpiValue: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  kpiLabel: { color: COLORS.mutedDark, fontSize: 12 },

  card: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  cardSubtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  sectionLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: SPACING.sm, marginTop: SPACING.xs },
  leaderCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md },
  leaderRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, gap: SPACING.sm },
  rank:       { width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  rankText:   { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  leaderName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  leaderDate: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
  leaderStats:   { flexDirection: 'row', gap: SPACING.sm },
  leaderStat:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  leaderStatVal: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  div: { height: 1, backgroundColor: COLORS.border },
})

const bc = StyleSheet.create({
  barLabel: { color: COLORS.muted, fontSize: 12, width: 80, textAlign: 'right', flexShrink: 0 },
  barBg:    { flex: 1, backgroundColor: COLORS.bgCard2, borderRadius: 4, overflow: 'hidden' },
  barFill:  { borderRadius: 4 },
  barValue: { color: COLORS.white, fontSize: 12, fontWeight: '700', width: 42, textAlign: 'right', flexShrink: 0 },
})
