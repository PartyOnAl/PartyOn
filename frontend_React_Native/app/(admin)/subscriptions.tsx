import { useCallback, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { usePlatformSettings } from '@/lib/platformSettings'
import {
  subscriptionPlanLabel,
  subscriptionPrice,
  subscriptionPriceSuffix,
} from '@/lib/subscriptions'
import { dbDateToDdMmYyyy } from '@/lib/eventDates'

type ClubFee = {
  club_id: string
  club_name: string
  club_status: string
  manager_id: string | null
  subscription_type: string | null
  subscription_due_date: string | null
  subscription_price: number | null
  commission_ticket_rate: number | null
  commission_table_rate: number | null
}

function money(value: number, maximumFractionDigits = 0) {
  return `€${value.toLocaleString(undefined, { maximumFractionDigits })}`
}

function currentPrice(club: ClubFee, settings: ReturnType<typeof usePlatformSettings>['settings']) {
  if (club.subscription_price !== null && club.subscription_price !== undefined) return Number(club.subscription_price)
  return subscriptionPrice(settings, club.subscription_type)
}

function monthlyEquivalent(club: ClubFee, settings: ReturnType<typeof usePlatformSettings>['settings']) {
  const price = currentPrice(club, settings)
  return subscriptionPlanLabel(club.subscription_type) === '3-Month' ? price / 3 : price
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export default function AdminSubscriptionsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { settings } = usePlatformSettings()
  const [clubs, setClubs] = useState<ClubFee[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadClubs()
    }, []),
  )

  async function loadClubs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clubs')
      .select('club_id, club_name, club_status, manager_id, subscription_type, subscription_due_date, subscription_price, commission_ticket_rate, commission_table_rate')
      .order('club_name', { ascending: true })

    if (error) Alert.alert('Could not load subscriptions', error.message)
    setClubs(((data ?? []) as ClubFee[]).filter(club => club.club_status !== 'rejected'))
    setLoading(false)
  }

  const totals = useMemo(() => {
    const active = clubs.filter(club => club.club_status === 'approved')
    const mrr = active.reduce((sum, club) => sum + monthlyEquivalent(club, settings), 0)
    const overdue = active.filter(club => {
      const days = daysUntil(club.subscription_due_date)
      return days !== null && days <= 0
    }).length
    const customFees = active.filter(club =>
      club.subscription_price !== null ||
      club.commission_ticket_rate !== null ||
      club.commission_table_rate !== null,
    ).length
    return { active: active.length, mrr, overdue, customFees }
  }, [clubs, settings])

  function openEdit(club: ClubFee) {
    router.push(`/(admin)/subscription-detail/${club.club_id}` as any)
  }

  async function resetClubFees(club: ClubFee) {
    Alert.alert(
      'Reset personalized fees',
      `Reset ${club.club_name} to platform defaults for subscription price and commissions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clubs')
              .update({
                subscription_price: null,
                commission_ticket_rate: null,
                commission_table_rate: null,
              })
              .eq('club_id', club.club_id)
            if (error) Alert.alert('Could not reset', error.message)
            else loadClubs()
          },
        },
      ],
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Subscriptions & Fees</Text>
          <Text style={s.subtitle}>Personalize subscription and commission fees per club</Text>
        </View>
        <TouchableOpacity style={s.backBtn} onPress={loadClubs}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        {[
          { label: 'Clubs', value: String(totals.active), color: COLORS.purple },
          { label: 'MRR', value: money(totals.mrr, 0), color: COLORS.green },
          { label: 'Overdue', value: String(totals.overdue), color: COLORS.red },
          { label: 'Custom', value: String(totals.customFees), color: '#f59e0b' },
        ].map(item => (
          <View key={item.label} style={s.statCard}>
            <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {clubs.map(club => {
            const price = currentPrice(club, settings)
            const mrr = monthlyEquivalent(club, settings)
            const days = daysUntil(club.subscription_due_date)
            const overdue = days !== null && days <= 0
            const custom = club.subscription_price !== null || club.commission_ticket_rate !== null || club.commission_table_rate !== null
            return (
              <TouchableOpacity key={club.club_id} style={s.clubCard} activeOpacity={0.86} onPress={() => openEdit(club)}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.clubName}>{club.club_name}</Text>
                    <Text style={s.clubMeta}>
                      {subscriptionPlanLabel(club.subscription_type)} · {money(price, 2)} / {subscriptionPriceSuffix(club.subscription_type)}
                    </Text>
                    <Text style={s.tapHint}>Tap card to personalize subscription and fees</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: overdue ? COLORS.red + '22' : COLORS.green + '22' }]}>
                    <Text style={[s.statusText, { color: overdue ? COLORS.red : COLORS.green }]}>
                      {overdue ? 'Overdue' : days === null ? 'Unset' : 'Active'}
                    </Text>
                  </View>
                </View>

                <View style={s.feeGrid}>
                  <FeeCell label="Monthly value" value={money(mrr, 2)} />
                  <FeeCell label="Ticket fee" value={`${club.commission_ticket_rate ?? settings.commission_ticket}%`} />
                  <FeeCell label="Table fee" value={`${club.commission_table_rate ?? settings.commission_table}%`} />
                  <FeeCell label="Due date" value={club.subscription_due_date ? dbDateToDdMmYyyy(club.subscription_due_date) : 'Unset'} danger={overdue} />
                </View>

                <View style={s.actions}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(club)}>
                    <Ionicons name="create-outline" size={14} color={COLORS.purple} />
                    <Text style={s.actionText}>Manage fees</Text>
                  </TouchableOpacity>
                  {custom ? (
                    <TouchableOpacity style={s.actionBtn} onPress={() => resetClubFees(club)}>
                      <Ionicons name="refresh-outline" size={14} color={COLORS.red} />
                      <Text style={[s.actionText, { color: COLORS.red }]}>Reset</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

    </View>
  )
}

function FeeCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={s.feeCell}>
      <Text style={s.feeLabel}>{label}</Text>
      <Text style={[s.feeValue, danger && { color: COLORS.red }]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  statValue: { fontSize: FONT.md, fontWeight: '900' },
  statLabel: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  list: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  clubCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  clubName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '900' },
  clubMeta: { color: COLORS.mutedDark, fontSize: 12, marginTop: 3 },
  tapHint: { color: COLORS.purple, fontSize: 11, fontWeight: '800', marginTop: 5 },
  statusPill: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '900' },
  feeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  feeCell: {
    width: '47.5%',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  feeLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '700' },
  feeValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '900', marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  actionText: { color: COLORS.purple, fontSize: 12, fontWeight: '900' },
})
