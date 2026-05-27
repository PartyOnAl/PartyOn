import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as Haptics from 'expo-haptics'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { postJson } from '@/lib/partyonApi'

WebBrowser.maybeCompleteAuthSession()

export default function PaymentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    eventId: string
    eventName: string
    ticketTypeId: string
    ticketTypeName: string
    price: string
  }>()

  const pricePerTicket = Number(params.price ?? 0)
  const [quantity, setQuantity] = useState(1)
  const [updates, setUpdates] = useState(false)
  const [paying, setPaying] = useState(false)

  const total = pricePerTicket * quantity
  const SERVICE_FEE = total * 0.05
  const grandTotal = total + SERVICE_FEE

  async function openStripeCheckout() {
    if (!params.eventId) {
      Alert.alert('Missing event', 'Could not start checkout.')
      return
    }
    const unitCents = Math.max(50, Math.round(pricePerTicket * 100))
    const returnUrl = Linking.createURL('/purchased-ticket')
    let successUrl = Linking.createURL('purchased-ticket', {
      queryParams: {
        eventId: params.eventId,
        quantity: String(quantity),
        payment_id: '__BATCH_ID__',
        ticketTypeName: params.ticketTypeName ?? 'General Admission',
        eventName: params.eventName ?? 'Event',
        total: String(grandTotal.toFixed(2)),
      },
    })
    if (!successUrl.includes('checkout_session_id')) {
      successUrl += `${successUrl.includes('?') ? '&' : '?'}checkout_session_id={CHECKOUT_SESSION_ID}`
    }
    const cancelUrl = Linking.createURL('/(tabs)')

    setPaying(true)
    try {
      const { data, error } = await postJson<{ url?: string }>('/event/pay', {
        amount: unitCents,
        quantity,
        events: { event_id: params.eventId },
        stripe_success_url: successUrl,
        stripe_cancel_url: cancelUrl,
      })
      if (error || !data?.url) {
        Alert.alert('Checkout', error ?? 'Could not start payment.')
        return
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl)
      if (result.type === 'success' && result.url) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        const parsed = Linking.parse(result.url)
        const q = parsed.queryParams ?? {}
        router.replace({
          pathname: '/purchased-ticket',
          params: {
            eventId: String(q.eventId ?? params.eventId),
            quantity: String(q.quantity ?? quantity),
            payment_id: String(q.payment_id ?? ''),
            ticketTypeName: String(q.ticketTypeName ?? params.ticketTypeName ?? ''),
            eventName: String(q.eventName ?? params.eventName ?? ''),
            total: String(q.total ?? grandTotal.toFixed(2)),
            isReservation: 'false',
          },
        })
        return
      }
      if (result.type === 'cancel') {
        Alert.alert('Cancelled', 'You can try again when you are ready.')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment could not start.'
      Alert.alert('Error', msg)
    } finally {
      setPaying(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy ticket</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>Event</Text>
          <Text style={styles.eventName} numberOfLines={2}>
            {params.eventName}
          </Text>
          <Text style={styles.ticketType}>{params.ticketTypeName}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quantity</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
              disabled={quantity <= 1}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 1)}>
              <Ionicons name="add" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Price per ticket</Text>
            <Text style={styles.lineValue}>€{pricePerTicket.toFixed(2)}</Text>
          </View>
          <View style={styles.lineItem}>
            <Text style={styles.lineLabel}>Service fee (5%)</Text>
            <Text style={styles.lineValue}>€{SERVICE_FEE.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.lineItem}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>€{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.optinRow} onPress={() => setUpdates((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, updates && styles.checkboxActive]}>
            {updates && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.optinText}>Get updates from this organizer about future events</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Secure checkout opens in your browser (Stripe). You will return to PartyOn when payment completes.
        </Text>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => void openStripeCheckout()}
          disabled={paying || pricePerTicket <= 0}
          activeOpacity={0.85}
        >
          {paying ? (
            <ActivityIndicator color={COLORS.ctaText} />
          ) : (
            <>
              <Text style={styles.ctaText}>Continue to payment</Text>
              <Ionicons name="open-outline" size={18} color={COLORS.ctaText} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  eventCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  eventName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  ticketType: { color: COLORS.purple, fontSize: FONT.sm, marginTop: 4 },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: SPACING.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyValue: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  lineLabel: { color: COLORS.muted, fontSize: FONT.base },
  lineValue: { color: COLORS.white, fontSize: FONT.base },
  totalLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  totalValue: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '800' },
  optinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  optinText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  legal: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 20, marginTop: SPACING.sm },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  cta: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    padding: SPACING.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  ctaText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },
})
