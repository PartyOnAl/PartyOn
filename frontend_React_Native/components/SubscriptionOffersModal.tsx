import { useEffect, useState } from 'react'
import { Alert, Linking, Modal, Pressable, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { PlatformSettings } from '@/lib/platformSettings'
import { normalizeSubscriptionPlan } from '@/lib/subscriptions'
import { supabase } from '@/lib/supabase'

type Props = {
  visible: boolean
  onClose: () => void
  settings: Pick<PlatformSettings, 'monthly_club_fee' | 'three_month_club_fee' | 'trial_period_days'>
  currentPlanType?: string | null
  currentPlanPrice?: number | string | null
  onManageBilling?: () => void
  adminContactEmail?: string
}

type OfferKind = 'monthly' | 'three_monthly' | 'contact_admin'

type Offer = {
  kind: OfferKind
  title: string
  priceLine: string
  detail: string
  icon: keyof typeof Ionicons.glyphMap
}

export function SubscriptionOffersModal({
  visible,
  onClose,
  settings,
  currentPlanType,
  currentPlanPrice,
  onManageBilling,
  adminContactEmail = 'support@partyon.com',
}: Props) {
  const cur = normalizeSubscriptionPlan(currentPlanType)
  const parsedCurrentPlanPrice = currentPlanPrice !== null && currentPlanPrice !== undefined && currentPlanPrice !== ''
    ? Number(currentPlanPrice)
    : null
  const currentOverridePrice = parsedCurrentPlanPrice !== null && Number.isFinite(parsedCurrentPlanPrice)
    ? parsedCurrentPlanPrice
    : null
  const [liveSettings, setLiveSettings] = useState(settings)
  const [loadingPrices, setLoadingPrices] = useState(false)

  useEffect(() => {
    setLiveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    async function loadPlanPrices() {
      setLoadingPrices(true)
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['monthly_club_fee', 'three_month_club_fee', 'annual_club_fee', 'trial_period_days'])

      if (!cancelled && data) {
        const next = { ...settings }
        for (const row of data as { key: string; value: string }[]) {
          const parsed = Number(row.value)
          if (!Number.isFinite(parsed)) continue
          if (row.key === 'monthly_club_fee') next.monthly_club_fee = parsed
          if (row.key === 'three_month_club_fee' || row.key === 'annual_club_fee') next.three_month_club_fee = parsed
          if (row.key === 'trial_period_days') next.trial_period_days = parsed
        }
        setLiveSettings(next)
      }

      if (!cancelled) setLoadingPrices(false)
    }

    loadPlanPrices()
    return () => { cancelled = true }
  }, [settings, visible])

  const monthlyPrice = cur === 'monthly' && currentOverridePrice !== null
    ? currentOverridePrice
    : liveSettings.monthly_club_fee
  const threeMonthPrice = cur === 'three_monthly' && currentOverridePrice !== null
    ? currentOverridePrice
    : liveSettings.three_month_club_fee

  const offers: Offer[] = [
    {
      kind: 'monthly',
      title: 'Monthly',
      priceLine: `€${monthlyPrice.toFixed(0)} / month`,
      detail: cur === 'monthly' && currentOverridePrice !== null
        ? 'Your current monthly billing amount for this club.'
        : 'Charged monthly. Flexible billing for venues that prefer a shorter cycle.',
      icon: 'calendar-outline',
    },
    {
      kind: 'three_monthly',
      title: '3-Month',
      priceLine: `€${threeMonthPrice.toFixed(0)} / 3 months`,
      detail: cur === 'three_monthly' && currentOverridePrice !== null
        ? `Your current 3-month billing amount for this club. Equivalent to €${(threeMonthPrice / 3).toFixed(0)} / month.`
        : `Three months together. ${liveSettings.monthly_club_fee > 0 ? `Equivalent to €${(threeMonthPrice / 3).toFixed(0)} / month.` : 'Set by PartyOn admin.'}`,
      icon: 'layers-outline',
    },
    {
      kind: 'contact_admin',
      title: 'Need another plan?',
      priceLine: adminContactEmail,
      detail: 'Contact PartyOn admin for more information about custom plans, trial availability, or billing questions.',
      icon: 'headset-outline',
    },
  ]

  function openMail(subject: string, body?: string) {
    const url = `mailto:${adminContactEmail}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`
    Linking.openURL(url)
  }

  function handleOfferPress(offer: Offer) {
    const isCurrent =
      (offer.kind === 'monthly' && cur === 'monthly') ||
      (offer.kind === 'three_monthly' && cur === 'three_monthly')

    if (offer.kind === 'contact_admin') {
      openMail('Subscription plan information')
      return
    }

    if (isCurrent) {
      Alert.alert('Current plan', `Your club is already on the ${offer.title} plan.`)
      return
    }

    const subject = `Request to switch to ${offer.title} subscription`
    const body = [
      'Hello PartyOn admin,',
      '',
      `I would like to switch my club subscription to the ${offer.title} plan (${offer.priceLine}).`,
      'Please confirm the billing change and next steps.',
    ].join('\n')

    Alert.alert(
      `Switch to ${offer.title}?`,
      `Plan changes are confirmed by PartyOn admin. Send a request now for ${offer.priceLine}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact Admin', onPress: () => openMail(subject, body) },
      ],
    )
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Subscription options</Text>
          <Text style={s.subtitle}>
            Tap an option to request a billing-cycle change. PartyOn admin confirms plan changes before billing updates.
          </Text>
          {loadingPrices ? (
            <Text style={s.loadingPrices}>Refreshing latest plan prices...</Text>
          ) : null}

          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {offers.map(offer => {
              const isCurrent =
                (offer.kind === 'monthly' && cur === 'monthly') ||
                (offer.kind === 'three_monthly' && cur === 'three_monthly')
              return (
                <TouchableOpacity
                  key={offer.kind}
                  style={[s.card, isCurrent && s.cardHighlight]}
                  activeOpacity={0.84}
                  onPress={() => handleOfferPress(offer)}
                >
                  <View style={s.cardTop}>
                    <View style={s.cardTitleRow}>
                      <View style={s.offerIcon}>
                        <Ionicons name={offer.icon} size={16} color={COLORS.purple} />
                      </View>
                      <Text style={s.cardTitle}>{offer.title}</Text>
                    </View>
                    {isCurrent ? (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>Current</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                    )}
                  </View>
                  <Text style={s.price}>{offer.priceLine}</Text>
                  <Text style={s.detail}>{offer.detail}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <Text style={s.footnote}>
            Admin contact: {adminContactEmail}. Managers can request a plan change here; final approval and billing updates are handled by PartyOn admin.
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
  loadingPrices: { color: COLORS.purple, fontSize: 12, fontWeight: '700', marginBottom: SPACING.sm },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  offerIcon: { width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: COLORS.purple + '18', alignItems: 'center', justifyContent: 'center' },
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
