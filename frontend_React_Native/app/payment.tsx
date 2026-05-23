import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { usePlatformSettings } from '@/lib/platformSettings'
import { useAuth } from '@/lib/AuthContext'

export default function PaymentScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { settings } = usePlatformSettings()
  const { profile } = useAuth()

  const params = useLocalSearchParams<{
    eventId: string; eventName: string; ticketTypeId: string
    ticketTypeName: string; price: string; isReservation: string; clubPhone: string
  }>()

  const isReservation = params.isReservation === 'true'
  const clubPhone = params.clubPhone ?? ''
  const pricePerTicket = Number(params.price ?? 0)
  const MAX_TICKETS = 5
  const MAX_GUESTS_ONLINE = 8
  const [quantity, setQuantity] = useState(1)
  const [nrOfPeople, setNrOfPeople] = useState(2)
  const [updates, setUpdates] = useState(false)

  const buyerName = useMemo(() => {
    const full = [profile?.name, profile?.surname].filter(Boolean).join(' ').trim()
    return full || profile?.username || profile?.email?.split('@')[0] || 'Me'
  }, [profile])

  // Attendee names: index 0 is the buyer (locked to their profile name).
  // Indices 1..quantity-1 are guests the buyer needs to name.
  const [attendeeNames, setAttendeeNames] = useState<string[]>([buyerName])

  useEffect(() => {
    setAttendeeNames(prev => {
      const next = Array.from({ length: quantity }, (_, i) =>
        i === 0 ? buyerName : prev[i] ?? '',
      )
      return next
    })
  }, [quantity, buyerName])

  function setAttendeeName(i: number, v: string) {
    setAttendeeNames(prev => prev.map((n, idx) => (idx === i ? v : n)))
  }

  const subtotal = isReservation ? 0 : pricePerTicket * quantity
  const vatAmount = (!isReservation && settings.vat_enabled && subtotal > 0)
    ? subtotal * (settings.vat_rate / 100)
    : 0
  const processingFee = (!isReservation && subtotal > 0)
    ? (subtotal + vatAmount) * (settings.stripe_fee_percent / 100) + settings.stripe_fee_fixed
    : 0
  const grandTotal = subtotal + vatAmount + processingFee

  function handleContinue() {
    if (!isReservation && quantity > 1) {
      const guestNames = attendeeNames.slice(1).map(n => n.trim())
      if (guestNames.some(n => n.length === 0)) {
        Alert.alert('Add guest names', 'Please enter the name of every additional ticket holder.')
        return
      }
    }
    const finalNames = isReservation
      ? []
      : [buyerName, ...attendeeNames.slice(1).map(n => n.trim())].slice(0, quantity)
    router.push({
      pathname: '/payment-method',
      params: {
        eventId: params.eventId,
        eventName: params.eventName,
        ticketTypeId: params.ticketTypeId ?? '',
        ticketTypeName: isReservation ? 'Table Reservation' : (params.ticketTypeName ?? 'General Admission'),
        quantity: String(isReservation ? nrOfPeople : quantity),
        total: String(grandTotal.toFixed(2)),
        isReservation: String(isReservation),
        attendees: JSON.stringify(finalNames),
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isReservation ? 'Reserve Table' : 'Buy Ticket'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: insets.bottom + 180 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
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
              style={[styles.qtyBtn, (!isReservation && quantity >= MAX_TICKETS) && styles.qtyBtnDisabled]}
              disabled={!isReservation && quantity >= MAX_TICKETS}
              onPress={() => isReservation ? setNrOfPeople((n) => n + 1) : setQuantity((q) => Math.min(q + 1, MAX_TICKETS))}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          {!isReservation && quantity >= MAX_TICKETS && (
            <View style={styles.limitNotice}>
              <Ionicons name="information-circle-outline" size={15} color={COLORS.muted} />
              <Text style={styles.limitNoticeText}>Maximum {MAX_TICKETS} tickets per order</Text>
            </View>
          )}
          {isReservation && nrOfPeople > MAX_GUESTS_ONLINE && (
            <View style={styles.largeGroupNotice}>
              <Ionicons name="people-outline" size={16} color="#f472b6" />
              <Text style={styles.largeGroupText}>
                For groups larger than {MAX_GUESTS_ONLINE}, please contact the venue directly to arrange your reservation.
              </Text>
            </View>
          )}

          {!isReservation && (
            <>
              <View style={styles.divider} />
              <View style={styles.lineItem}>
                <Text style={styles.lineLabel}>Price per ticket</Text>
                <Text style={styles.lineValue}>€{pricePerTicket.toFixed(2)}</Text>
              </View>
              {quantity > 1 && (
                <View style={styles.lineItem}>
                  <Text style={styles.lineLabel}>Subtotal ({quantity}×)</Text>
                  <Text style={styles.lineValue}>€{subtotal.toFixed(2)}</Text>
                </View>
              )}
              {settings.vat_enabled && vatAmount > 0 && (
                <View style={styles.lineItem}>
                  <Text style={styles.lineLabel}>VAT ({settings.vat_rate}%)</Text>
                  <Text style={styles.lineValue}>€{vatAmount.toFixed(2)}</Text>
                </View>
              )}
              {processingFee > 0 && (
                <View style={styles.lineItem}>
                  <Text style={styles.lineLabel}>
                    Service fee ({settings.stripe_fee_percent}% + €{settings.stripe_fee_fixed.toFixed(2)})
                  </Text>
                  <Text style={styles.lineValue}>€{processingFee.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.lineItem}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>€{grandTotal.toFixed(2)}</Text>
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

        {/* Attendee names — only when buying multiple tickets */}
        {!isReservation && quantity > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ticket Holders</Text>
            <Text style={styles.attendeeHint}>
              Each ticket gets its own QR. Add the name of every guest so they can be admitted at the door.
            </Text>
            {attendeeNames.map((value, i) => (
              <View key={i} style={styles.attendeeField}>
                <View style={styles.attendeeBadge}>
                  <Text style={styles.attendeeBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendeeLabel}>
                    {i === 0 ? 'Ticket 1 — You' : `Ticket ${i + 1} — Guest`}
                  </Text>
                  <TextInput
                    style={[styles.attendeeInput, i === 0 && styles.attendeeInputDisabled]}
                    value={value}
                    onChangeText={t => setAttendeeName(i, t)}
                    placeholder={i === 0 ? buyerName : 'Full name'}
                    placeholderTextColor={COLORS.mutedDark}
                    editable={i !== 0}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>
            ))}
          </View>
        )}

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
        {isReservation && nrOfPeople > MAX_GUESTS_ONLINE ? (
          clubPhone ? (
            <TouchableOpacity
              style={styles.ctaPhone}
              onPress={() => Linking.openURL(`tel:${clubPhone}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.ctaText}>Call venue to reserve</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.cta, { opacity: 0.4 }]}>
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.ctaText}>Contact venue directly</Text>
            </View>
          )
        ) : (
          <TouchableOpacity style={styles.cta} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{isReservation ? 'Confirm Reservation' : 'Continue to Payment'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
    </KeyboardAvoidingView>
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
  lineLabel: { color: COLORS.muted, fontSize: FONT.base, flex: 1 },
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
  cta: { backgroundColor: COLORS.purple, borderRadius: RADIUS.md, padding: SPACING.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  ctaPhone: { backgroundColor: '#16a34a', borderRadius: RADIUS.md, padding: SPACING.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  ctaText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },
  limitNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, justifyContent: 'center' },
  limitNoticeText: { color: COLORS.muted, fontSize: FONT.sm },
  largeGroupNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: SPACING.md, backgroundColor: 'rgba(244,114,182,0.08)', borderRadius: RADIUS.sm, padding: SPACING.sm, borderWidth: 1, borderColor: 'rgba(244,114,182,0.25)' },
  largeGroupText: { color: '#f472b6', fontSize: FONT.sm, flex: 1, lineHeight: FONT.sm * 1.5 },
  attendeeHint: { color: COLORS.muted, fontSize: FONT.sm, marginTop: -SPACING.sm, marginBottom: SPACING.md, lineHeight: FONT.sm * 1.4 },
  attendeeField: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm },
  attendeeBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: COLORS.purple, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  attendeeBadgeText: { color: COLORS.purple, fontSize: 11, fontWeight: '800' },
  attendeeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  attendeeInput: { backgroundColor: COLORS.bgInput, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.md, color: COLORS.white, fontSize: FONT.base },
  attendeeInputDisabled: { opacity: 0.6 },
})
