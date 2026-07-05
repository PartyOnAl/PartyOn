import { Modal, Pressable, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { PlatformSettings } from '@/lib/platformSettings'
import { normalizeSubscriptionPlan } from '@/lib/subscriptions'

type Props = {
  visible: boolean
  onClose: () => void
  settings: Pick<PlatformSettings, 'monthly_club_fee' | 'three_month_club_fee' | 'trial_period_days'>
  /** Current clubs.subscription_type — shown as badge */
  currentPlanType?: string | null
  onManageBilling?: () => void
}

export function SubscriptionOffersModal({
  visible,
  onClose,
  settings,
  currentPlanType,
  onManageBilling,
}: Props) {
  const cur = normalizeSubscriptionPlan(currentPlanType)

  const offers: {
    kind: string
    title: string
    priceLine: string
    detail: string
  }[] = [
    {
      kind: 'monthly',
      title: 'Monthly',
      priceLine: `\u20ac${settings.monthly_club_fee.toFixed(0)} / month`,
      detail: 'Charged monthly. Flexible — switch or cancel according to PartyOn terms.',
    },
    {
      kind: 'three_monthly',
      title: '3-Month',
      priceLine: `\u20ac${settings.three_month_club_fee.toFixed(0)} / 3 months`,
      detail: `Three months together. ${settings.monthly_club_fee > 0 ? `Equivalent to \u20ac${(settings.three_month_club_fee / 3).toFixed(0)} / month.` : 'Set by PartyOn admin.'}`,
    },
    {
      kind: 'trial',
      title: 'Trial period',
      priceLine: `${settings.trial_period_days} days`,
      detail: 'New venues may start on a trial. Your active plan is set by PartyOn administration.',
    },
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Subscription options</Text>
          <Text style={s.subtitle}>
            Standard rates configured by PartyOn admin. Your club uses the plan shown on your account.
          </Text>

          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {offers.map(offer => {
              const isCurrent =
                (offer.kind === 'monthly' && cur === 'monthly') ||
                (offer.kind === 'three_monthly' && cur === 'three_monthly')
              return (
                <View key={offer.kind} style={[s.card, isCurrent && s.cardHighlight]}>
                  <View style={s.cardTop}>
                    <Text style={s.cardTitle}>{offer.title}</Text>
                    {isCurrent ? (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.price}>{offer.priceLine}</Text>
                  <Text style={s.detail}>{offer.detail}</Text>
                </View>
              )
            })}
          </ScrollView>

          <Text style={s.footnote}>
            To change billing cycle or negotiate a custom arrangement, contact support. Managers cannot self-switch plan type in-app.
          </Text>

          {onManageBilling ? (
            <TouchableOpacity style={s.primaryBtn} onPress={onManageBilling} activeOpacity={0.88}>
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>Billing & invoices</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={s.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl + 12,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)', marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  subtitle: {
    color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 20, marginTop: SPACING.xs, marginBottom: SPACING.md,
  },
  list: { marginBottom: SPACING.sm },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHighlight: { borderColor: COLORS.purple + '55', backgroundColor: COLORS.purple + '14' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  badge: { backgroundColor: COLORS.green + '33', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  badgeText: { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  price: { color: COLORS.purple, fontSize: FONT.lg, fontWeight: '800', marginTop: SPACING.xs },
  detail: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 20, marginTop: SPACING.xs },
  footnote: {
    color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: SPACING.xs,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.purple, borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.md,
  },
  primaryBtnText: { color: '#fff', fontSize: FONT.md, fontWeight: '700' },
  closeBtn: { alignSelf: 'center', paddingVertical: SPACING.sm, marginTop: SPACING.xs },
  closeBtnText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
})
