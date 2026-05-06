import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

export default function PurchasedTicketScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    reservationId: string; qrCode: string; eventName: string
    ticketTypeName: string; quantity: string; total: string; isReservation: string
  }>()

  const isReservation = params.isReservation === 'true'
  const qrUrl = params.qrCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(params.qrCode)}&bgcolor=ffffff&color=000000`
    : null

  async function handleShare() {
    try {
      await Share.share({
        message: `I just got ${isReservation ? 'a table reservation' : 'my ticket'} for ${params.eventName} via PartyOn! 🎉`,
      })
    } catch {}
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Success header */}
        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>
            {isReservation ? "You're Reserved!" : "You're In!"}
          </Text>
          <Text style={styles.successSub}>
            {isReservation ? 'Your table reservation is confirmed.' : 'Your ticket is confirmed.'}
          </Text>
        </View>

        {/* Ticket card */}
        <View style={styles.ticketCard}>
          <Text style={styles.ticketEvent} numberOfLines={2}>{params.eventName}</Text>
          <Text style={styles.ticketType}>{params.ticketTypeName}</Text>

          <View style={styles.ticketMeta}>
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>{isReservation ? 'People' : 'Quantity'}</Text>
              <Text style={styles.ticketMetaValue}>{params.quantity}</Text>
            </View>
            {!isReservation && Number(params.total) > 0 && (
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>Paid</Text>
                <Text style={styles.ticketMetaValue}>€{Number(params.total).toFixed(2)}</Text>
              </View>
            )}
            {isReservation && (
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>Cost</Text>
                <Text style={[styles.ticketMetaValue, { color: COLORS.green }]}>Free</Text>
              </View>
            )}
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>Status</Text>
              <Text style={[styles.ticketMetaValue, { color: COLORS.green }]}>Confirmed</Text>
            </View>
          </View>

          {/* Tear line */}
          <View style={styles.tearLine}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.tearDot} />
            ))}
          </View>

          {/* QR Code */}
          {qrUrl ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Scan at the door</Text>
              <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              <Text style={styles.qrCodeText} selectable numberOfLines={1}>{params.qrCode}</Text>
            </View>
          ) : (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Booking ID</Text>
              <Text style={styles.qrCodeText} selectable>{params.reservationId}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/bookings')} activeOpacity={0.8}>
            <Ionicons name="ticket-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>My Tickets</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.savedNote}>
          Your {isReservation ? 'reservation' : 'ticket'} is saved in the Tickets tab.
        </Text>
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)/search')} activeOpacity={0.85}>
          <Text style={styles.browseBtnText}>Browse More Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <Ionicons name="home" size={18} color="#fff" />
          <Text style={styles.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  successSection: { alignItems: 'center', paddingVertical: SPACING.xl },
  checkCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  successTitle: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '800', marginBottom: SPACING.xs },
  successSub: { color: COLORS.muted, fontSize: FONT.base },
  ticketCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  ticketEvent: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', padding: SPACING.md, paddingBottom: 4 },
  ticketType: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  ticketMeta: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, gap: SPACING.lg },
  ticketMetaItem: {},
  ticketMetaLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ticketMetaValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginTop: 2 },
  tearLine: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, marginVertical: SPACING.xs },
  tearDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  qrSection: { alignItems: 'center', padding: SPACING.md },
  qrLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  qrImage: { width: 180, height: 180, backgroundColor: '#fff', borderRadius: RADIUS.sm, padding: 4 },
  qrCodeText: { color: COLORS.mutedDark, fontSize: 10, marginTop: SPACING.sm, maxWidth: 240, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  actionBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  savedNote: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginBottom: SPACING.md },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, paddingTop: SPACING.sm },
  browseBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  browseBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.sm },
  homeBtn: { backgroundColor: COLORS.cta, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  homeBtnText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },
})
