import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Share,
  Image, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { supabase } from '@/lib/supabase'
import type { Attendee } from '@/lib/types'
import { downloadTicketPdf } from '@/lib/ticketPdf'
import {
  DEFAULT_RESERVATION_HOLD_MINUTES,
  normalizeReservationHoldMinutes,
  reservationHoldPolicyText,
} from '@/lib/reservationPolicy'
import { apiGet } from '@/lib/api'

/** Build a QR-code image URL from any string (payment ID, reservation ref, etc.) */
function qrFor(code: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(code)}&bgcolor=ffffff&color=000000`
}

export default function PurchasedTicketScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  /**
   * Params accepted:
   *   reservationId  – Supabase reservation UUID (always present)
   *   batchId        – Stripe batch UUID; when present, QR codes come from
   *                    the backend payment IDs in that batch (one per ticket).
   *                    When absent, falls back to attendee qr_codes from Supabase.
   *   qrCode         – single QR fallback for table reservations
   *   eventName      – display name
   *   ticketTypeName – display label
   *   quantity       – number of tickets / people
   *   total          – amount paid in euros (string)
   *   isReservation  – "true" | "false"
   */
  const params = useLocalSearchParams<{
    reservationId: string
    batchId: string
    qrCode: string
    eventName: string
    ticketTypeName: string
    quantity: string
    total: string
    isReservation: string
  }>()

  const isReservation = params.isReservation === 'true'
  const hasBatch = Boolean(params.batchId)

  // ── Stripe-batch QR codes (one per payment record) ──────────────────────
  const [batchQrCodes, setBatchQrCodes] = useState<string[]>([])
  const [batchLoading, setBatchLoading] = useState(hasBatch)
  const [currentQrIndex, setCurrentQrIndex] = useState(0)

  useEffect(() => {
    if (!hasBatch) return
    let cancelled = false
    setBatchLoading(true)

    apiGet<string[]>(`/payment/ids?batch_id=${encodeURIComponent(params.batchId)}`)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          console.warn('Could not fetch payment IDs:', error)
          setBatchQrCodes([])
        } else {
          setBatchQrCodes(data.filter(Boolean))
        }
        setBatchLoading(false)
      })

    return () => { cancelled = true }
  }, [params.batchId, hasBatch])

  // ── Attendee QR codes (legacy / fallback for non-batch ticket purchases) ─
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)

  useEffect(() => {
    // Skip when batch mode is active or it's a table reservation
    if (hasBatch || isReservation || !params.reservationId) {
      setAttendees([])
      return
    }
    let cancelled = false
    supabase
      .from('attendees')
      .select('*')
      .eq('reservation_id', params.reservationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setAttendees((data as Attendee[]) ?? [])
      })
    return () => { cancelled = true }
  }, [params.reservationId, isReservation, hasBatch])

  // ── Reservation-hold policy (table reservations only) ────────────────────
  const [reservationHoldMinutes, setReservationHoldMinutes] = useState(
    DEFAULT_RESERVATION_HOLD_MINUTES,
  )

  useEffect(() => {
    if (!isReservation || !params.reservationId) return
    let cancelled = false
    supabase
      .from('reservations')
      .select('events(clubs(*))')
      .eq('reservation_id', params.reservationId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        const ev = Array.isArray((data as any)?.events)
          ? (data as any).events[0]
          : (data as any)?.events
        const club = Array.isArray(ev?.clubs) ? ev.clubs[0] : ev?.clubs
        setReservationHoldMinutes(
          normalizeReservationHoldMinutes(club?.reservation_hold_minutes),
        )
      })
    return () => { cancelled = true }
  }, [params.reservationId, isReservation])

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleShare() {
    try {
      await Share.share({
        message: `I just got ${isReservation ? 'a table reservation' : 'my ticket'} for ${params.eventName} via PartyOn! 🎉`,
      })
    } catch {}
  }

  async function handleDownloadPdf() {
    const effectiveAttendees = hasBatch
      ? batchQrCodes.map((id, i) => ({ id, name: `Ticket ${i + 1}`, qr_code: id } as any))
      : (attendees ?? [])

    if (!isReservation && !hasBatch && attendees === null) {
      Alert.alert('Preparing ticket', 'Please wait for the ticket QR codes to finish loading.')
      return
    }
    try {
      await downloadTicketPdf({
        reservationId: params.reservationId,
        eventName: params.eventName,
        ticketTypeName: params.ticketTypeName,
        quantity: params.quantity,
        total: params.total,
        isReservation,
        qrCode: params.qrCode ?? batchQrCodes[0] ?? '',
        attendees: effectiveAttendees,
        status: 'Confirmed',
      })
    } catch (e: any) {
      Alert.alert('PDF unavailable', e?.message ?? 'Could not create the ticket PDF.')
    }
  }

  // ── QR rendering helpers ─────────────────────────────────────────────────

  /** Batch mode: one QR per Stripe payment ID */
  function renderBatchQrs() {
    if (batchLoading) {
      return (
        <View style={[styles.qrSection, { paddingVertical: SPACING.xl }]}>
          <ActivityIndicator color={COLORS.purple} />
          <Text style={[styles.qrLabel, { marginTop: SPACING.sm }]}>Loading tickets…</Text>
        </View>
      )
    }

    if (batchQrCodes.length === 0) {
      return (
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>Tickets confirmed</Text>
          <Text style={styles.qrCodeText}>{params.batchId}</Text>
        </View>
      )
    }

    const total = batchQrCodes.length
    const code = batchQrCodes[currentQrIndex]

    return (
      <View style={styles.qrSection}>
        <Text style={styles.qrLabel}>
          {total === 1 ? 'Scan at the door' : `${total} tickets — swipe to see each QR`}
        </Text>

        {/* QR image */}
        <Image
          source={{ uri: qrFor(code) }}
          style={styles.qrImage}
          resizeMode="contain"
        />
        <Text style={styles.qrCodeText} selectable numberOfLines={1}>{code}</Text>

        {/* Navigation arrows for multiple tickets */}
        {total > 1 && (
          <>
            <View style={styles.qrNavRow}>
              <TouchableOpacity
                style={[styles.qrNavBtn, currentQrIndex === 0 && styles.qrNavBtnDisabled]}
                onPress={() => setCurrentQrIndex(i => Math.max(0, i - 1))}
                disabled={currentQrIndex === 0}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.white} />
              </TouchableOpacity>

              <Text style={styles.qrCounter}>
                {currentQrIndex + 1} / {total}
              </Text>

              <TouchableOpacity
                style={[styles.qrNavBtn, currentQrIndex === total - 1 && styles.qrNavBtnDisabled]}
                onPress={() => setCurrentQrIndex(i => Math.min(total - 1, i + 1))}
                disabled={currentQrIndex === total - 1}
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {/* Dot indicators */}
            <View style={styles.qrDots}>
              {batchQrCodes.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.qrDot, i === currentQrIndex && styles.qrDotActive]}
                  onPress={() => setCurrentQrIndex(i)}
                />
              ))}
            </View>
          </>
        )}
      </View>
    )
  }

  /** Legacy/fallback: QR codes from attendees table */
  function renderAttendeeQrs() {
    if (isReservation) {
      return params.qrCode ? (
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>Show at the door</Text>
          <Image
            source={{ uri: qrFor(params.qrCode) }}
            style={styles.qrImage}
            resizeMode="contain"
          />
          <Text style={styles.qrCodeText} selectable numberOfLines={1}>{params.qrCode}</Text>
        </View>
      ) : (
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>Booking ID</Text>
          <Text style={styles.qrCodeText} selectable>{params.reservationId}</Text>
        </View>
      )
    }

    if (attendees === null) {
      return (
        <View style={[styles.qrSection, { paddingVertical: SPACING.xl }]}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      )
    }

    if (attendees.length > 0) {
      return (
        <View style={styles.qrSection}>
          <Text style={styles.qrLabel}>
            {attendees.length === 1
              ? 'Scan at the door'
              : `${attendees.length} tickets — one QR per guest`}
          </Text>
          {attendees.map((a, i) => (
            <View key={a.id} style={[styles.attendeeQr, i > 0 && styles.attendeeQrDivider]}>
              <View style={styles.attendeeQrHeader}>
                <View style={styles.attendeeIndex}>
                  <Text style={styles.attendeeIndexText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendeeName} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.attendeeRole}>{i === 0 ? 'Buyer' : 'Guest'}</Text>
                </View>
              </View>
              <Image
                source={{ uri: qrFor(a.qr_code) }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.qrCodeText} selectable numberOfLines={1}>{a.qr_code}</Text>
            </View>
          ))}
        </View>
      )
    }

    return params.qrCode ? (
      <View style={styles.qrSection}>
        <Text style={styles.qrLabel}>Scan at the door</Text>
        <Image
          source={{ uri: qrFor(params.qrCode) }}
          style={styles.qrImage}
          resizeMode="contain"
        />
        <Text style={styles.qrCodeText} selectable numberOfLines={1}>{params.qrCode}</Text>
      </View>
    ) : (
      <View style={styles.qrSection}>
        <Text style={styles.qrLabel}>Booking ID</Text>
        <Text style={styles.qrCodeText} selectable>{params.reservationId}</Text>
      </View>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Success header */}
        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>
            {isReservation ? "You're Reserved!" : "You're In!"}
          </Text>
          <Text style={styles.successSub}>
            {isReservation
              ? 'Your table reservation is confirmed.'
              : 'Your ticket is confirmed.'}
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

          {isReservation && (
            <View style={styles.holdPolicyBox}>
              <Ionicons name="time-outline" size={16} color={COLORS.pink} />
              <Text style={styles.holdPolicyText}>
                {reservationHoldPolicyText(reservationHoldMinutes)}
              </Text>
            </View>
          )}

          {/* Tear line */}
          <View style={styles.tearLine}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.tearDot} />
            ))}
          </View>

          {/* QR codes section */}
          {hasBatch ? renderBatchQrs() : renderAttendeeQrs()}
        </View>

        {/* Stripe-payment note */}
        {hasBatch && (
          <View style={styles.stripeNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.green} />
            <Text style={styles.stripeNoteText}>
              Payment verified by Stripe · Each QR admits one person
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDownloadPdf} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/bookings')}
            activeOpacity={0.8}
          >
            <Ionicons name="ticket-outline" size={20} color={COLORS.purple} />
            <Text style={styles.actionBtnText}>My Nights</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.savedNote}>
          Your {isReservation ? 'reservation' : 'ticket'} is saved in My Nights.
        </Text>
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => router.replace('/(tabs)/search')}
          activeOpacity={0.85}
        >
          <Text style={styles.browseBtnText}>Browse More Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.85}
        >
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
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  successTitle: { color: COLORS.white, fontSize: FONT.xxl, fontWeight: '800', marginBottom: SPACING.xs },
  successSub: { color: COLORS.muted, fontSize: FONT.base },
  ticketCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: SPACING.md,
  },
  ticketEvent: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', padding: SPACING.md, paddingBottom: 4 },
  ticketType: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  ticketMeta: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, gap: SPACING.lg },
  ticketMetaItem: {},
  ticketMetaLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ticketMetaValue: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginTop: 2 },
  holdPolicyBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
    backgroundColor: 'rgba(244,114,182,0.10)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.25)',
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  holdPolicyText: { flex: 1, color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },
  tearLine: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, marginVertical: SPACING.xs },
  tearDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  qrSection: { alignItems: 'center', padding: SPACING.md },
  qrLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  qrImage: { width: 180, height: 180, backgroundColor: '#fff', borderRadius: RADIUS.sm, padding: 4 },
  qrCodeText: { color: COLORS.mutedDark, fontSize: 10, marginTop: SPACING.sm, maxWidth: 240, textAlign: 'center' },
  // Batch QR navigation
  qrNavRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginTop: SPACING.sm },
  qrNavBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qrNavBtnDisabled: { opacity: 0.3 },
  qrCounter: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  qrDots: { flexDirection: 'row', gap: 6, marginTop: SPACING.sm },
  qrDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.border },
  qrDotActive: { backgroundColor: COLORS.purple, width: 16 },
  // Attendee QRs
  attendeeQr: { alignItems: 'center', width: '100%', paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  attendeeQrDivider: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.md },
  attendeeQrHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'stretch', marginBottom: SPACING.sm },
  attendeeIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: COLORS.purple, alignItems: 'center', justifyContent: 'center' },
  attendeeIndexText: { color: COLORS.purple, fontSize: 12, fontWeight: '800' },
  attendeeName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  attendeeRole: { color: COLORS.mutedDark, fontSize: 11, marginTop: 1 },
  // Stripe note
  stripeNote: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: SPACING.md },
  stripeNoteText: { color: COLORS.green, fontSize: FONT.sm },
  // Actions
  actions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, padding: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  savedNote: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginBottom: SPACING.md },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, paddingTop: SPACING.sm,
  },
  browseBtn: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  browseBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.sm },
  homeBtn: {
    backgroundColor: COLORS.purple, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
  },
  homeBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },
})
