import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { getJson } from '@/lib/partyonApi'
import {
  looksLikeReservationUuid,
  reservationGatePayload,
  ticketGatePayload,
  uuidFromReservationQrPayload,
} from '@/lib/gateQrPayload'

function oneQueryParam<T>(v: T | T[] | undefined): T | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

export default function PurchasedTicketScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{
    reservationId?: string
    gatePayload?: string
    reference?: string
    qrCode?: string
    eventName?: string
    ticketTypeName?: string
    quantity?: string
    total?: string
    isReservation?: string
    payment_id?: string
    eventId?: string
  }>()

  const isReservation = params.isReservation === 'true'
  const batchId = oneQueryParam(params.payment_id)
  const needsPaymentIds = !isReservation && !!batchId
  const [paymentIds, setPaymentIds] = useState<string[]>([])
  const [loadingIds, setLoadingIds] = useState(needsPaymentIds)
  const [paymentIdsFailed, setPaymentIdsFailed] = useState(false)
  const [qrIndex, setQrIndex] = useState(0)

  useEffect(() => {
    if (isReservation || !batchId) {
      setPaymentIds([])
      setLoadingIds(false)
      setPaymentIdsFailed(false)
      return
    }
    let alive = true
    setLoadingIds(true)
    setPaymentIdsFailed(false)
    void getJson<string[]>(`/payment/ids?batch_id=${encodeURIComponent(batchId)}`).then(
      ({ data, error }) => {
        if (!alive) return
        setLoadingIds(false)
        if (error || !data?.length) {
          setPaymentIds([])
          setPaymentIdsFailed(true)
          return
        }
        setPaymentIds(data.filter((x): x is string => typeof x === 'string' && x.length > 0))
        setPaymentIdsFailed(false)
      },
    )
    return () => {
      alive = false
    }
  }, [isReservation, batchId])

  const ticketQrPayloads = useMemo(() => {
    if (isReservation) return []
    return paymentIds
      .map((id) => ticketGatePayload(id))
      .filter((x): x is string => !!x)
  }, [isReservation, paymentIds])

  const reservationQrData = useMemo(() => {
    if (!isReservation) return null
    const rid = oneQueryParam(params.reservationId)?.trim()
    const gate = oneQueryParam(params.gatePayload)?.trim()
    const qr = oneQueryParam(params.qrCode)?.trim()
    // If `reservationId` is the row UUID, always encode that — ignore `qrCode` when it is only the DB default uuid.
    if (looksLikeReservationUuid(rid)) {
      return `reservation:${rid}`
    }
    return reservationGatePayload(rid || undefined, gate || qr || null)
  }, [isReservation, params.reservationId, params.gatePayload, params.qrCode])

  /** Human-facing id (row PK), not the full gate string or raw `qr_code`. */
  const reservationDisplayUuid = useMemo(() => {
    if (!isReservation) return null
    const rid = oneQueryParam(params.reservationId)?.trim()
    if (looksLikeReservationUuid(rid)) return rid
    return uuidFromReservationQrPayload(reservationQrData)
  }, [isReservation, params.reservationId, reservationQrData])

  const qrUriList = useMemo(() => {
    const payloads = isReservation
      ? reservationQrData
        ? [reservationQrData]
        : []
      : ticketQrPayloads
    return payloads.map(
      (data) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=000000`,
    )
  }, [isReservation, reservationQrData, ticketQrPayloads])

  const cardWidth = Math.min(width - SPACING.md * 2, 360)

  useEffect(() => {
    setQrIndex(0)
  }, [ticketQrPayloads.length])

  const displayPayload = ticketQrPayloads[qrIndex] ?? null

  async function handleShare() {
    try {
      const msg = isReservation
        ? `Table reservation for ${params.eventName} on PartyOn — ref ${params.reference ?? reservationDisplayUuid ?? oneQueryParam(params.reservationId)}`
        : `I'm going to ${params.eventName} with PartyOn!`
      await Share.share({ message: msg })
    } catch {}
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>
            {isReservation ? "You're reserved!" : "You're in!"}
          </Text>
          <Text style={styles.successSub}>
            {isReservation
              ? 'Your table request is saved. Show the QR at the door.'
              : 'Payment completed. Show your ticket QR at the door.'}
          </Text>
        </View>

        <View style={[styles.ticketCard, { maxWidth: cardWidth, alignSelf: 'center' }]}>
          <Text style={styles.ticketEvent} numberOfLines={2}>
            {params.eventName}
          </Text>
          <Text style={styles.ticketType}>{params.ticketTypeName}</Text>

          <View style={styles.ticketMeta}>
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>{isReservation ? 'People' : 'Quantity'}</Text>
              <Text style={styles.ticketMetaValue}>{params.quantity}</Text>
            </View>
            {!isReservation && Number(params.total ?? 0) > 0 && (
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>Paid</Text>
                <Text style={styles.ticketMetaValue}>€{Number(params.total).toFixed(2)}</Text>
              </View>
            )}
            {isReservation && (
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>Reference</Text>
                <Text style={styles.ticketMetaValue} numberOfLines={1}>
                  {params.reference ?? '—'}
                </Text>
              </View>
            )}
            {isReservation && reservationDisplayUuid ? (
              <View style={styles.ticketMetaItem}>
                <Text style={styles.ticketMetaLabel}>Reservation ID</Text>
                <Text style={styles.ticketMetaValue} numberOfLines={2} selectable>
                  {reservationDisplayUuid}
                </Text>
              </View>
            ) : null}
            <View style={styles.ticketMetaItem}>
              <Text style={styles.ticketMetaLabel}>Status</Text>
              <Text style={[styles.ticketMetaValue, { color: isReservation ? COLORS.purple : COLORS.green }]}>
                {isReservation ? 'Pending' : 'Paid'}
              </Text>
            </View>
          </View>

          <View style={styles.tearLine}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.tearDot} />
            ))}
          </View>

          {!isReservation && loadingIds ? (
            <View style={styles.qrSection}>
              <ActivityIndicator color={COLORS.purple} />
              <Text style={styles.qrHint}>Loading ticket codes…</Text>
            </View>
          ) : !isReservation && batchId && !loadingIds && paymentIdsFailed ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Ticket QR</Text>
              <Text style={styles.qrHint}>
                We could not load your ticket codes from the server. Open My bookings or My Nights and use the QR on your ticket there.
              </Text>
            </View>
          ) : qrUriList.length > 0 ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Scan at the door</Text>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardWidth}
                decelerationRate="fast"
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / Math.max(1, cardWidth),
                  )
                  setQrIndex(Math.max(0, Math.min(idx, qrUriList.length - 1)))
                }}
                style={{ width: cardWidth, alignSelf: 'center' }}
              >
                {qrUriList.map((uri) => (
                  <View key={uri} style={{ width: cardWidth, alignItems: 'center' }}>
                    <Image source={{ uri }} style={styles.qrImage} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
              {qrUriList.length > 1 ? (
                <Text style={styles.qrHint}>
                  Swipe for each ticket · {qrIndex + 1} / {qrUriList.length}
                </Text>
              ) : null}
              {!isReservation && displayPayload ? (
                <Text style={styles.qrCodeText} selectable numberOfLines={2}>
                  {displayPayload}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Booking</Text>
              <Text style={styles.qrCodeText} selectable>
                {oneQueryParam(params.reservationId) ?? batchId ?? '—'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/bookings')} activeOpacity={0.8}>
            <Ionicons name="ticket-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>My bookings</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.savedNote}>
          {isReservation
            ? 'Reservation is in the Bookings tab. You may need venue confirmation before arrival.'
            : 'Tickets are saved under Bookings.'}
        </Text>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)/search')} activeOpacity={0.85}>
          <Text style={styles.browseBtnText}>Browse events</Text>
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
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  successTitle: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '800', marginBottom: SPACING.xs },
  successSub: { color: COLORS.muted, fontSize: FONT.base, textAlign: 'center', paddingHorizontal: SPACING.md },
  ticketCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    width: '100%',
  },
  ticketEvent: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', padding: SPACING.md, paddingBottom: 4 },
  ticketType: {
    color: COLORS.purple,
    fontSize: FONT.sm,
    fontWeight: '600',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  ticketMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.lg,
  },
  ticketMetaItem: { minWidth: 72 },
  ticketMetaLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ticketMetaValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginTop: 2 },
  tearLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  tearDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  qrSection: { alignItems: 'center', padding: SPACING.md },
  qrLabel: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  qrImage: { width: 200, height: 200, backgroundColor: '#fff', borderRadius: RADIUS.sm },
  qrHint: { color: COLORS.muted, fontSize: FONT.sm, marginTop: SPACING.sm },
  qrCodeText: { color: COLORS.mutedDark, fontSize: 11, marginTop: SPACING.sm, maxWidth: 280, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  savedNote: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginBottom: SPACING.md },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  browseBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  browseBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.sm },
  homeBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  homeBtnText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },
})
