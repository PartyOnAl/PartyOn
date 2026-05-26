import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { usePlatformSettings } from '@/lib/platformSettings'
import { supabase } from '@/lib/supabase'
import { SubscriptionOffersModal } from '@/components/SubscriptionOffersModal'
import {
  effectiveSubscriptionPrice,
  subscriptionPeriodDays,
  subscriptionPlanLabel,
} from '@/lib/subscriptions'

type SubInfo = {
  subscription_type: 'monthly' | 'three_monthly' | 'annual' | string
  subscription_due_date: string | null
  subscription_price: number | null
  club_name: string | null
}

type InvoiceRow = {
  id: string
  periodStart: Date
  periodEnd: Date
  amount: number
  status: 'paid' | 'current' | 'upcoming'
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
}

function formatDate(d: Date | string | null) {
  if (!d) return '–'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function shortClubId(clubId: string | null | undefined) {
  if (!clubId) return 'CLUB'
  return clubId.replace(/-/g, '').slice(0, 6).toUpperCase()
}

function ymKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}${m}`
}

function buildInvoices(sub: SubInfo, clubId: string | null | undefined, amount: number, periods = 12): InvoiceRow[] {
  if (!sub.subscription_due_date) return []

  const now = new Date()
  const stepDays = subscriptionPeriodDays(sub.subscription_type)
  const rows: InvoiceRow[] = []
  const clubShort = shortClubId(clubId)

  // Upcoming row = the period that ENDS on subscription_due_date
  const upcomingEnd = new Date(sub.subscription_due_date)
  const upcomingStart = new Date(upcomingEnd)
  upcomingStart.setDate(upcomingStart.getDate() - stepDays)

  rows.push({
    id: `INV-${clubShort}-${ymKey(upcomingEnd)}`,
    periodStart: upcomingStart,
    periodEnd: upcomingEnd,
    amount,
    status: now < upcomingStart ? 'upcoming' : (now < upcomingEnd ? 'current' : 'paid'),
  })

  // Walk backwards N periods
  let cursorEnd = new Date(upcomingStart)
  for (let i = 0; i < periods; i++) {
    const periodEnd = new Date(cursorEnd)
    const periodStart = new Date(periodEnd)
    periodStart.setDate(periodStart.getDate() - stepDays)

    const inThisPeriod = now >= periodStart && now < periodEnd
    rows.push({
      id: `INV-${clubShort}-${ymKey(periodEnd)}`,
      periodStart,
      periodEnd,
      amount,
      status: inThisPeriod ? 'current' : 'paid',
    })

    cursorEnd = periodStart
  }

  return rows
}

export default function BillingHistoryScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { settings, reload: reloadPlatformSettings } = usePlatformSettings()

  const [loading, setLoading] = useState(true)
  const [sub, setSub]         = useState<SubInfo | null>(null)
  const [offersModal, setOffersModal] = useState(false)

  const fetchSub = useCallback(async () => {
    if (!profile?.club_id) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('clubs')
      .select('subscription_type, subscription_due_date, subscription_price, club_name')
      .eq('club_id', profile.club_id)
      .single()
    if (!error && data) {
      setSub(data as SubInfo)
    }
    setLoading(false)
  }, [profile?.club_id])

  useFocusEffect(useCallback(() => {
    fetchSub()
    reloadPlatformSettings()
  }, [fetchSub, reloadPlatformSettings]))

  const fee = effectiveSubscriptionPrice(settings, sub?.subscription_type, sub?.subscription_price)
  const cycleLabel = subscriptionPlanLabel(sub?.subscription_type)
  const days = getDaysUntilDue(sub?.subscription_due_date ?? null)
  const isOverdue = days !== null && days <= 0
  const isDueSoon = days !== null && days > 0 && days <= 14
  const statusColor = isOverdue ? COLORS.red
    : isDueSoon ? (days! <= 7 ? '#f97316' : '#eab308')
    : COLORS.green
  const statusLabel = isOverdue ? 'Overdue'
    : isDueSoon ? `Due in ${days} day${days !== 1 ? 's' : ''}`
    : days !== null ? 'Active'
    : '—'

  const invoices = sub ? buildInvoices(sub, profile?.club_id, fee, 12) : []

  function handleInvoiceTap(inv: InvoiceRow) {
    const period = `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
    Alert.alert(
      `Invoice ${inv.id}`,
      `Period: ${period}\nAmount: €${inv.amount.toFixed(2)}\nStatus: ${inv.status.toUpperCase()}\n\nDetailed PDF invoices coming soon.`,
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Billing History</Text>
        <Text style={s.pageSubtitle}>Your subscription invoices and payments</Text>

        {!sub || !sub.subscription_due_date ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={36} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>No billing data yet</Text>
            <Text style={s.emptyText}>
              {`Your club subscription details haven't been set up. Once you start a plan, invoices will appear here.`}
            </Text>
            <TouchableOpacity style={s.comparePlansBtn} onPress={() => setOffersModal(true)} activeOpacity={0.88}>
              <Ionicons name="layers-outline" size={16} color={COLORS.white} />
              <Text style={s.comparePlansBtnText}>View subscription options</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Current Plan card */}
            <TouchableOpacity
              style={s.planCard}
              activeOpacity={0.84}
              onPress={() => setOffersModal(true)}
            >
              <View style={s.planTop}>
                <View style={s.iconWrap}>
                  <Ionicons name="card-outline" size={18} color={COLORS.muted} />
                </View>
                <View style={[s.statusPill, { backgroundColor: statusColor + '22' }]}>
                  <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[s.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              <Text style={s.planName}>
                {subscriptionPlanLabel(sub.subscription_type)} Plan
              </Text>
              <Text style={s.planLabel}>Club Subscription</Text>

              <View style={s.divider} />

              <View style={s.row}>
                <Text style={s.rowLabel}>Next due date</Text>
                <Text style={s.rowValue}>{formatDate(sub.subscription_due_date)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Billing cycle</Text>
                <Text style={s.rowValue}>{cycleLabel} · €{fee.toFixed(0)}</Text>
              </View>
              {sub.club_name ? (
                <View style={s.row}>
                  <Text style={s.rowLabel}>Billed to</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{sub.club_name}</Text>
                </View>
              ) : null}
              <Text style={s.planHint}>Tap for monthly / 3-month options and admin contact</Text>
            </TouchableOpacity>

            {/* Invoices list */}
            <Text style={s.sectionTitle}>Invoices</Text>
            <View style={s.listCard}>
              {invoices.map((inv, idx) => {
                const tone = inv.status === 'paid' ? COLORS.green
                  : inv.status === 'current' ? COLORS.purple
                  : '#eab308'
                const toneLabel = inv.status === 'paid' ? 'Paid'
                  : inv.status === 'current' ? 'Current'
                  : 'Upcoming'
                return (
                  <View key={inv.id}>
                    {idx > 0 && <View style={s.rowDivider} />}
                    <TouchableOpacity
                      style={s.invRow}
                      activeOpacity={0.7}
                      onPress={() => handleInvoiceTap(inv)}
                    >
                      <View style={s.invLeft}>
                        <View style={[s.invIcon, { backgroundColor: tone + '1f' }]}>
                          <Ionicons name="receipt-outline" size={16} color={tone} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invId}>{inv.id}</Text>
                          <Text style={s.invDate}>{formatDate(inv.periodEnd)}</Text>
                        </View>
                      </View>
                      <View style={s.invRight}>
                        <Text style={s.invAmount}>€{inv.amount.toFixed(2)}</Text>
                        <View style={[s.invBadge, { backgroundColor: tone + '22' }]}>
                          <Text style={[s.invBadgeText, { color: tone }]}>{toneLabel}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>

            <Text style={s.footnote}>
              Invoices are generated from your subscription cycle. Tap a row for details.
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <SubscriptionOffersModal
        visible={offersModal}
        onClose={() => setOffersModal(false)}
        settings={settings}
        currentPlanType={sub?.subscription_type ?? null}
        currentPlanPrice={sub?.subscription_price ?? null}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  header:   { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName:  { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  sub:      { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  planCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  iconWrap: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard2,
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  planName:  { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginTop: SPACING.sm },
  planLabel: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  divider:   { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  rowLabel:  { color: COLORS.mutedDark, fontSize: FONT.sm },
  rowValue:  { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600', maxWidth: '60%' },
  planHint:  { color: COLORS.muted, fontSize: 11, marginTop: SPACING.md, fontStyle: 'italic' },

  sectionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: SPACING.sm },

  listCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  invRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4,
  },
  invLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  invRight: { alignItems: 'flex-end', gap: 4 },
  invIcon:  { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  invId:    { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },
  invDate:  { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  invAmount:{ color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  invBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill },
  invBadgeText: { fontSize: 10, fontWeight: '700' },

  footnote: { color: COLORS.mutedDark, fontSize: 11, textAlign: 'center', marginTop: SPACING.xs },

  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.xs },
  emptyText:  { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
  comparePlansBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.purple, paddingHorizontal: SPACING.md + 6, paddingVertical: 11,
    borderRadius: RADIUS.md, marginTop: SPACING.sm,
  },
  comparePlansBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
})
