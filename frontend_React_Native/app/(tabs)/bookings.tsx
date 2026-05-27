import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, Image, Modal, ScrollView,
  Share, Pressable, Platform, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Reservation } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { isTableReservationType, reservationRowGatePayloads, canonicalReservationRowId, looksLikeReservationUuid } from '@/lib/gateQrPayload'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function isPast(iso: string) {
  return new Date(iso) < new Date()
}

function statusColor(s: string) {
  if (s === 'confirmed') return COLORS.green
  if (s === 'cancelled') return COLORS.red
  if (s === 'completed') return COLORS.mutedDark
  return COLORS.purple
}

// ── QR Detail Bottom Sheet ────────────────────────────────────────────────────
function QRSheet({ reservation, onClose }: { reservation: Reservation | null; onClose: () => void }) {
  if (!reservation) return null
  const res = reservation
  const ev = res.events as any
  const isTable = isTableReservationType(res.type)
  const past = ev?.event_starting_date ? isPast(ev.event_starting_date) : false
  const effectiveStatus = past && res.status === 'confirmed' ? 'completed' : res.status

  const gatePayloads = reservationRowGatePayloads(res)
  const qrUrls = !past && gatePayloads.length
    ? gatePayloads.map(
        (data) =>
          `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=000000&margin=16`,
      )
    : []

  async function handleShare() {
    try {
      await Share.share({ message: `My ticket to ${ev?.event_name ?? 'the event'} — Booking ID: ${res.reservation_id}` })
    } catch {}
  }

  return (
    <Modal visible={!!reservation} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
            {/* Title */}
            <Text style={styles.sheetEventName}>{ev?.event_name ?? 'Event'}</Text>

            {/* Meta */}
            <View style={styles.sheetMeta}>
              {ev?.event_starting_date && (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
                  <Text style={styles.sheetMetaText}>
                    {formatDateLong(ev.event_starting_date)} · {formatTime(ev.event_starting_date)}
                  </Text>
                </View>
              )}
              {ev?.clubs?.club_address && (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.muted} />
                  <Text style={styles.sheetMetaText}>{ev.clubs.club_address}</Text>
                </View>
              )}
            </View>

            {/* Badges */}
            <View style={styles.sheetBadgeRow}>
              <View style={[
                styles.sheetBadge,
                {
                  backgroundColor: isTable ? 'rgba(167,139,250,0.15)' : 'rgba(16,185,129,0.15)',
                  borderColor: isTable ? COLORS.purple : COLORS.green,
                },
              ]}>
                <Ionicons
                  name={isTable ? 'restaurant-outline' : 'ticket-outline'}
                  size={13}
                  color={isTable ? COLORS.purple : COLORS.green}
                />
                <Text style={[styles.sheetBadgeText, { color: isTable ? COLORS.purple : COLORS.green }]}>
                  {isTable ? 'Table Reservation' : 'General Entry'}
                </Text>
              </View>
              <View style={[styles.sheetStatusBadge, { borderColor: statusColor(effectiveStatus) }]}>
                <Text style={[styles.sheetStatusText, { color: statusColor(effectiveStatus) }]}>
                  {effectiveStatus}
                </Text>
              </View>
            </View>

            {/* QR or past notice */}
            {qrUrls.length > 0 ? (
              <View style={styles.qrWrap}>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                  {qrUrls.map((uri) => (
                    <View key={uri} style={{ width: 280, alignItems: 'center' }}>
                      <Image source={{ uri }} style={styles.qrImage} resizeMode="contain" />
                    </View>
                  ))}
                </ScrollView>
                <Text style={styles.qrCaption}>
                  {qrUrls.length > 1 ? 'Swipe for each ticket · ' : ''}
                  Show this QR code at the entrance
                </Text>
              </View>
            ) : (
              <View style={styles.qrPast}>
                <Ionicons name={past ? 'checkmark-done-circle-outline' : 'qr-code-outline'} size={52} color={COLORS.mutedDark} />
                <Text style={styles.qrPastTitle}>{past ? 'Event has ended' : 'QR unavailable'}</Text>
                <Text style={styles.qrPastSub}>
                  {past ? 'This event has already taken place.' : 'Booking ID: ' + res.reservation_id}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.sheetActions}>
              {!past && (
                <TouchableOpacity style={styles.sheetActionBtn}>
                  <Ionicons name="download-outline" size={18} color={COLORS.white} />
                  <Text style={styles.sheetActionText}>Download</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.sheetActionBtn}>
                <Ionicons name="wallet-outline" size={18} color={COLORS.white} />
                <Text style={styles.sheetActionText}>{past ? 'View Receipt' : 'Add to Wallet'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.sheetShareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={17} color={COLORS.muted} />
              <Text style={styles.sheetShareText}>Share with Friends</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Ticket row ────────────────────────────────────────────────────────────────
function TicketCard({
  reservation,
  onPress,
  onDelete,
}: {
  reservation: Reservation
  onPress: () => void
  onDelete: () => void
}) {
  const ev = reservation.events as any
  const isTable = reservation.type === 'table'
  const past = ev?.event_starting_date ? isPast(ev.event_starting_date) : false
  const effectiveStatus = past && reservation.status === 'confirmed' ? 'completed' : reservation.status

  function confirmDelete() {
    Alert.alert(
      'Remove booking',
      'Remove this booking from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onDelete },
      ],
    )
  }

  return (
    <View style={[styles.ticketRow, past && styles.ticketRowPast]}>
      {/* Thumbnail */}
      {ev?.event_image ? (
        <Image source={{ uri: ev.event_image }} style={[styles.thumb, past && styles.thumbPast]} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, past && styles.thumbPast]}>
          <Ionicons name={isTable ? 'restaurant-outline' : 'musical-notes'} size={18} color={COLORS.border} />
        </View>
      )}

      {/* Info */}
      <TouchableOpacity style={styles.ticketInfo} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.ticketName, past && styles.ticketNamePast]} numberOfLines={1}>
          {ev?.event_name ?? '—'}
        </Text>
        {ev?.clubs?.club_address && (
          <Text style={styles.ticketVenue} numberOfLines={1}>{ev.clubs.club_address}</Text>
        )}
        {ev?.event_starting_date && (
          <View style={styles.ticketDateRow}>
            <Ionicons name="calendar-outline" size={11} color={COLORS.mutedDark} />
            <Text style={styles.ticketDate}>{formatShort(ev.event_starting_date)}</Text>
            <Text style={styles.ticketSep}>·</Text>
            <Ionicons name="time-outline" size={11} color={COLORS.mutedDark} />
            <Text style={styles.ticketDate}>{formatTime(ev.event_starting_date)}</Text>
          </View>
        )}
        {/* Status pill */}
        <View style={[styles.statusPill, { borderColor: statusColor(effectiveStatus) }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(effectiveStatus) }]} />
          <Text style={[styles.statusText, { color: statusColor(effectiveStatus) }]}>
            {effectiveStatus}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Right: view / delete */}
      <View style={styles.ticketActions}>
        {past ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete} hitSlop={6}>
            <Ionicons name="trash-outline" size={17} color={COLORS.red} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
            <Text style={styles.viewBtnText}>View</Text>
            <Ionicons name="chevron-forward" size={13} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Reservation | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!user) { setLoading(false); return }
      setLoading(true)
      supabase
        .from('reservations')
        .select('*, events(event_name, event_starting_date, event_image, clubs(club_address)), payments(payment_id)')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setReservations((data as Reservation[]) ?? [])
          setLoading(false)
        })
    }, [user]),
  )

  async function handleDelete(reservationId: string) {
    if (looksLikeReservationUuid(reservationId)) {
      await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .or(`reservation_id.eq.${reservationId},id.eq.${reservationId}`)
    } else {
      await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('reservation_id', reservationId)
    }
    setReservations((prev) => prev.filter((r) => canonicalReservationRowId(r) !== reservationId))
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <Ionicons name="ticket-outline" size={52} color={COLORS.mutedDark} />
        <Text style={styles.emptyTitle}>Not logged in</Text>
        <Text style={styles.emptySub}>Sign in to see your tickets</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.ctaBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Split into upcoming vs past (client-side, based on event date)
  const upcoming = reservations.filter((r) => {
    const ev = r.events as any
    if (!ev?.event_starting_date) return true
    return !isPast(ev.event_starting_date)
  })
  const past = reservations.filter((r) => {
    const ev = r.events as any
    if (!ev?.event_starting_date) return false
    return isPast(ev.event_starting_date)
  })

  // Build sections for SectionList
  const sections = [
    {
      title: 'Upcoming',
      subtitle: 'Your confirmed bookings',
      data: upcoming.length > 0 ? upcoming : ['__empty_upcoming__' as any],
      isEmpty: upcoming.length === 0,
    },
    ...(past.length > 0
      ? [{
          title: 'Past',
          subtitle: 'Events you attended',
          data: past,
          isEmpty: false,
        }]
      : []),
  ]

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>No sleep till sunrise</Text>
        <Text style={styles.headerTitle}>Your Nights</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : reservations.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="ticket-outline" size={52} color={COLORS.mutedDark} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySub}>Buy a ticket or reserve a table to get started</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(tabs)/search')}>
            <Text style={styles.ctaBtnText}>Browse Events</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) =>
            typeof item === 'string' ? item : canonicalReservationRowId(item as Reservation)
          }
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSub}>{section.subtitle}</Text>
              </View>
              {section.title === 'Past' && (
                <Text style={styles.sectionHint}>Tap 🗑 to remove</Text>
              )}
            </View>
          )}
          renderItem={({ item, section }) => {
            if (typeof item === 'string') {
              // empty upcoming placeholder
              return (
                <View style={styles.emptySection}>
                  <Ionicons name="calendar-outline" size={28} color={COLORS.mutedDark} />
                  <Text style={styles.emptySectionText}>No upcoming bookings</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
                    <Text style={styles.emptySectionLink}>Browse events →</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            const r = item as Reservation
            return (
              <TicketCard
                reservation={r}
                onPress={() => setSelected(r)}
                onDelete={() => handleDelete(canonicalReservationRowId(r))}
              />
            )
          }}
          SectionSeparatorComponent={() => <View style={{ height: SPACING.xs }} />}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        />
      )}

      <QRSheet reservation={selected} onClose={() => setSelected(null)} />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerSub: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '500' },
  headerTitle: { color: COLORS.white, fontSize: FONT.xl + 2, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },

  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  emptySub: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
  ctaBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4, paddingHorizontal: SPACING.xl,
  },
  ctaBtnText: { color: COLORS.ctaText, fontWeight: '800', fontSize: FONT.base },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  sectionSub: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  sectionHint: { color: COLORS.mutedDark, fontSize: 11 },

  // Empty section
  emptySection: {
    alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.xl, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptySectionText: { color: COLORS.muted, fontSize: FONT.sm },
  emptySectionLink: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

  // Ticket rows
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  ticketRowPast: { opacity: 0.7 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.md, flexShrink: 0 },
  thumbPast: { opacity: 0.6 },
  thumbFallback: { backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center' },
  ticketInfo: { flex: 1, gap: 3 },
  ticketName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  ticketNamePast: { color: COLORS.muted },
  ticketVenue: { color: COLORS.muted, fontSize: FONT.sm },
  ticketDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  ticketDate: { color: COLORS.mutedDark, fontSize: 11 },
  ticketSep: { color: COLORS.mutedDark, fontSize: 11 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  ticketActions: { alignItems: 'center', justifyContent: 'center', paddingRight: SPACING.xs },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  viewBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  // QR Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4, borderTopRightRadius: RADIUS.xl + 4,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 24 : 8),
    maxHeight: '92%', borderTopWidth: 1, borderColor: COLORS.border,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md,
  },
  sheetClose: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center',
  },
  sheetEventName: {
    color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: SPACING.sm, marginTop: SPACING.xs,
  },
  sheetMeta: { gap: 6, marginBottom: SPACING.md },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetMetaText: { color: COLORS.muted, fontSize: FONT.sm },
  sheetBadgeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  sheetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm + 2, paddingVertical: 5,
  },
  sheetBadgeText: { fontSize: FONT.sm, fontWeight: '700' },
  sheetStatusBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm + 2, paddingVertical: 5 },
  sheetStatusText: { fontSize: FONT.sm, fontWeight: '600', textTransform: 'capitalize' },
  qrWrap: {
    alignItems: 'center', backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  qrImage: { width: 220, height: 220 },
  qrCaption: { color: '#555', fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: 'center' },
  qrPast: {
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.lg,
    padding: SPACING.xl, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  qrPastTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  qrPastSub: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
  sheetActions: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  sheetActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sheetActionText: { color: COLORS.white, fontWeight: '600', fontSize: FONT.sm },
  sheetShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  sheetShareText: { color: COLORS.muted, fontWeight: '600', fontSize: FONT.sm },
})
