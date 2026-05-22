import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, CreditCard, ChevronRight } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { COLORS } from '@/lib/theme'

const HOLD_SECONDS = 4 * 60 + 45 // 4 min 45 sec

export default function CheckoutScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    reservationId: string; eventName: string; venueName: string;
    date: string; ticketName: string; qty: string; amount: string;
    discountAmount: string; discountPct: string;
  }>()
  const [timeLeft, setTimeLeft] = useState(HOLD_SECONDS)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m} minutes, ${sec.toString().padStart(2, '0')} seconds`
  }

  const qty = parseInt(params.qty ?? '1')
  const originalPrice = parseFloat(params.amount ?? '0')
  const discountAmt = parseFloat(params.discountAmount ?? '0')
  const total = originalPrice - discountAmt

  async function payNow() {
    setLoading(true)
    try {
      // Update payment status
      await supabase.from('payments')
        .update({ status: 'completed' })
        .eq('reservation_id', params.reservationId)
      await supabase.from('reservations')
        .update({ status: 'confirmed' })
        .eq('reservation_id', params.reservationId)
      router.replace({
        pathname: '/confirmation',
        params: {
          reservationId: params.reservationId,
          eventName: params.eventName,
          venueName: params.venueName,
          date: params.date,
          ticketName: params.ticketName,
          qty: params.qty,
        }
      })
    } catch (e: any) {
      Alert.alert('Payment failed', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>{params.eventName}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Order summary */}
        <Text style={s.sectionLabel}>Order summary</Text>

        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryQty}>{qty}</Text>
            <Text style={s.summaryItem}>{params.ticketName ?? 'General Entry'}</Text>
            <Text style={s.summaryPrice}>€{originalPrice.toFixed(2)}</Text>
          </View>
          {discountAmt > 0 && (
            <View style={[s.summaryRow, { marginTop: 8 }]}>
              <Text style={s.discountLabel}>Discount ({params.discountPct}%)</Text>
              <Text style={s.discountAmt}>-€{discountAmt.toFixed(2)}</Text>
            </View>
          )}
          <View style={s.summaryDivider} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmt}>€{total.toFixed(2)}</Text>
          </View>
          <Text style={s.feeNote}>Includes platform service fee</Text>
        </View>

        {/* Payment */}
        <View style={s.paymentCard}>
          <View style={s.paymentRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CreditCard size={18} color="#aaa" />
              <Text style={s.paymentLabel}>Payment</Text>
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={s.cardLabel}>Card</Text>
              <ChevronRight size={16} color="#555" />
            </TouchableOpacity>
          </View>
          <View style={s.paymentDivider} />
          <View style={s.paymentRow}>
            <Text style={s.totalLabel}>Total</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.totalAmt}>€{total.toFixed(2)}</Text>
              <View style={s.infoDot}><Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>i</Text></View>
            </View>
          </View>
        </View>

        {/* Pay button */}
        <TouchableOpacity style={[s.payBtn, loading && { opacity: 0.7 }]} onPress={payNow} disabled={loading || timeLeft === 0}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.payBtnText}>PAY NOW</Text>
          }
        </TouchableOpacity>

        {/* Timer */}
        {timeLeft > 0 ? (
          <Text style={s.timerText}>Tickets held for {formatTime(timeLeft)}</Text>
        ) : (
          <Text style={[s.timerText, { color: '#ef4444' }]}>Hold expired. Please start again.</Text>
        )}

        {/* Legal */}
        <Text style={s.legal}>
          {`By purchasing you'll receive an account, agree to our general `}
          <Text style={s.legalLink}>Terms of Use</Text>,{' '}
          <Text style={s.legalLink}>Privacy Policy</Text> and the{' '}
          <Text style={s.legalLink}>Ticket Purchase Terms</Text>.
          We process your personal data in accordance with our Privacy Policy.
        </Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#161616', borderWidth: 1, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionLabel: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  summaryCard: { backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1e1e1e', padding: 18, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryQty: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 24 },
  summaryItem: { flex: 1, color: '#fff', fontSize: 15 },
  summaryPrice: { color: '#fff', fontSize: 15, fontWeight: '700' },
  discountLabel: { flex: 1, color: COLORS.purple, fontSize: 14 },
  discountAmt: { color: COLORS.purple, fontSize: 14, fontWeight: '700' },
  summaryDivider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#555', fontSize: 14 },
  totalAmt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  feeNote: { color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 },
  paymentCard: { backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1e1e1e', padding: 18, marginBottom: 20 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paymentLabel: { color: '#aaa', fontSize: 14 },
  cardLabel: { color: '#fff', fontSize: 14 },
  paymentDivider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 14 },
  infoDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.purple, alignItems: 'center', justifyContent: 'center' },
  payBtn: { backgroundColor: COLORS.purple, borderRadius: 30, height: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  timerText: { color: '#555', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  legal: { color: '#333', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  legalLink: { color: '#555', textDecorationLine: 'underline' },
})