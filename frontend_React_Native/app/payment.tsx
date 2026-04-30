import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

export default function PaymentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    eventId: string; eventName: string; ticketTypeId: string
    ticketTypeName: string; price: string; isReservation: string
  }>()

  const isReservation = params.isReservation === 'true'
  const pricePerTicket = Number(params.price ?? 0)
  const [quantity, setQuantity] = useState(1)
  const [nrOfPeople, setNrOfPeople] = useState(2)
  const [updates, setUpdates] = useState(false)

  const total = isReservation ? 0 : pricePerTicket * quantity
  const SERVICE_FEE = isReservation ? 0 : total * 0.05

  function handleContinue() {
    router.push({
      pathname: '/payment-method',
      params: {
        eventId: params.eventId,
        eventName: params.eventName,
        ticketTypeId: params.ticketTypeId ?? '',
        ticketTypeName: isReservation ? 'Table Reservation' : (params.ticketTypeName ?? 'General Admission'),
        quantity: String(isReservation ? nrOfPeople : quantity),
        total: String((total + SERVICE_FEE).toFixed(2)),
        isReservation: String(isReservation),
      },
    })
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isReservation ? 'Reserve Table' : 'Buy Ticket'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Event summary */}
        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>Event</Text>
          <Text style={styles.eventName} numberOfLines={2}>{params.eventName}</Text>
          {!isReservation && (
            <Text style={styles.ticketType}>{params.ticketTypeName}</Text>
          )}
        </View>

        {/* Quantity / people */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isReservation ? 'Number of People' : 'Quantity'}</Text>

          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={[styles.qtyBtn, (isReservation ? nrOfPeople : quantity) <= 1 && styles.qtyBtnDisabled]}
              disabled={(isReservation ? nrOfPeople : quantity) <= 1}
              onPress={() => isReservation ? setNrOfPeople((n) => Math.max(1, n - 1)) : setQuantity((q) => Math.max(1, q - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{isReservation ? nrOfPeople : quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => isReservation ? setNrOfPeople((n) => n + 1) : setQuantity((q) => q + 1)}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {!isReservation && (
            <>
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
                <Text style={styles.totalValue}>€{(total + SERVICE_FEE).toFixed(2)}</Text>
              </View>
            </>
          )}

          {isReservation && (
            <View style={styles.freeNotice}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.green} />
              <Text style={styles.freeNoticeText}>This venue accepts free reservations — no payment required.</Text>
            </View>
          )}
        </View>

        {/* Updates opt-in */}
        <TouchableOpacity style={styles.optinRow} onPress={() => setUpdates((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, updates && styles.checkboxActive]}>
            {updates && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.optinText}>Get updates from this organizer about future events</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{isReservation ? 'Confirm Reservation' : 'Continue to Payment'}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
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
  eventCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  eventLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  eventName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  ticketType: { color: COLORS.purple, fontSize: FONT.sm, marginTop: 4 },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: SPACING.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyValue: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', minWidth: 40, textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  lineLabel: { color: COLORS.muted, fontSize: FONT.base },
  lineValue: { color: COLORS.white, fontSize: FONT.base },
  totalLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  totalValue: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '800' },
  freeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: SPACING.md, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  freeNoticeText: { color: COLORS.green, fontSize: FONT.sm, flex: 1 },
  optinRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  checkboxActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  optinText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, paddingTop: SPACING.sm },
  cta: { backgroundColor: COLORS.cta, borderRadius: RADIUS.md, padding: SPACING.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  ctaText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },
})
