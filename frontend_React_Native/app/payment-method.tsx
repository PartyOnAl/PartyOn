import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { reservationGatePayload } from '@/lib/gateQrPayload'

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}

export default function PaymentMethodScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    eventId: string; eventName: string; ticketTypeId: string
    ticketTypeName: string; quantity: string; total: string; isReservation: string
  }>()

  const isReservation = params.isReservation === 'true'
  const total = Number(params.total ?? 0)

  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    if (!isReservation) {
      if (cardNumber.replace(/\s/g, '').length < 16) { Alert.alert('Invalid card', 'Please enter a 16-digit card number.'); return }
      if (expiry.replace(/\s/g, '').replace('/', '').length < 4) { Alert.alert('Invalid expiry', 'Please enter a valid expiry date.'); return }
      if (cvc.length < 3) { Alert.alert('Invalid CVC', 'Please enter a valid CVC.'); return }
      if (!name.trim()) { Alert.alert('Name required', 'Please enter the name on your card.'); return }
    }

    setLoading(true)
    try {
      // Create reservation in Supabase
      const { data: res, error: resErr } = await supabase.from('reservations').insert({
        user_id: user?.id,
        event_id: params.eventId,
        ticket_type_id: params.ticketTypeId || null,
        type: isReservation ? 'table' : 'ticket',
        status: 'confirmed',
        nr_of_people: Number(params.quantity ?? 1),
      }).select().single()

      if (resErr) throw resErr

      const resRow = res as {
        reservation_id?: string
        id?: string
        qr_code?: string | null
      }
      const resId = String(resRow.reservation_id ?? resRow.id ?? '').trim()

      // Create payment record (unless free reservation)
      if (!isReservation && total > 0) {
        await supabase.from('payments').insert({
          reservation_id: resId,
          user_id: user?.id,
          amount: total,
          status: 'completed',
        })
      }

      const gate = reservationGatePayload(resId, resRow.qr_code ?? null)

      router.replace({
        pathname: '/purchased-ticket',
        params: {
          reservationId: resId,
          gatePayload: gate ?? undefined,
          qrCode: resRow.qr_code ?? '',
          eventName: params.eventName,
          ticketTypeName: params.ticketTypeName,
          quantity: params.quantity,
          total: params.total,
          isReservation: params.isReservation,
        },
      })
    } catch (e: any) {
      Alert.alert('Payment failed', e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <Text style={styles.summaryEvent} numberOfLines={2}>{params.eventName}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{params.ticketTypeName}</Text>
            <Text style={styles.summaryValue}>×{params.quantity}</Text>
          </View>
          {!isReservation && (
            <>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>€{total.toFixed(2)}</Text>
              </View>
            </>
          )}
          {isReservation && (
            <View style={[styles.summaryRow, { marginTop: SPACING.xs }]}>
              <Text style={styles.summaryLabel}>Payment</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>Free</Text>
            </View>
          )}
        </View>

        {/* Card form (only for paid tickets) */}
        {!isReservation && (
          <View style={styles.card}>
            <View style={styles.secureRow}>
              <Ionicons name="lock-closed" size={14} color={COLORS.green} />
              <Text style={styles.secureText}>Secure payment powered by Stripe</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Card Number</Text>
              <TextInput
                style={styles.input}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={COLORS.mutedDark}
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                keyboardType="number-pad"
                maxLength={19}
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, styles.flex]}>
                <Text style={styles.label}>Expiry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM / YY"
                  placeholderTextColor={COLORS.mutedDark}
                  value={expiry}
                  onChangeText={(v) => setExpiry(formatExpiry(v))}
                  keyboardType="number-pad"
                  maxLength={7}
                />
              </View>
              <View style={[styles.field, styles.flex, { marginLeft: SPACING.sm }]}>
                <Text style={styles.label}>CVC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor={COLORS.mutedDark}
                  value={cvc}
                  onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Name on Card</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.mutedDark}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        {isReservation && (
          <View style={styles.freeNotice}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
            <Text style={styles.freeNoticeText}>This venue accepts free table reservations. Tap Confirm to complete your booking.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
              <Text style={styles.payBtnText}>{isReservation ? 'Confirm Reservation' : `Pay €${total.toFixed(2)}`}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  flex: { flex: 1 },
  summaryCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  summaryTitle: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  summaryEvent: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  summaryLabel: { color: COLORS.muted, fontSize: FONT.base },
  summaryValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  totalValue: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '800' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  secureText: { color: COLORS.green, fontSize: FONT.sm },
  field: { marginBottom: SPACING.md },
  fieldRow: { flexDirection: 'row' },
  label: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.bgInput, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, color: COLORS.white, fontSize: FONT.base },
  freeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  freeNoticeText: { color: COLORS.green, fontSize: FONT.base, flex: 1, lineHeight: FONT.base * 1.5 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, paddingTop: SPACING.sm },
  payBtn: { backgroundColor: COLORS.cta, borderRadius: RADIUS.md, padding: SPACING.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  payBtnText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },
})
