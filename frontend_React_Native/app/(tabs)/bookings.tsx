import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Modal, ScrollView, KeyboardAvoidingView,
  Share, Pressable, Platform, Alert, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Reservation, Attendee, ClaimedPromotion } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { downloadTicketPdf } from '@/lib/ticketPdf'
import {
  canonicalReservationRowId,
  isTableReservationType,
  reservationGateScanAndDisplay,
  reservationRowGatePayloads,
  ticketGatePayload,
} from '@/lib/gateQrPayload'

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

// ── Star Rating ───────────────────────────────────────────────────────────────
function StarRow({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange?.(n)} disabled={!onChange} hitSlop={4}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={n <= value ? '#f59e0b' : COLORS.mutedDark}
          />
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── Rate Modal ────────────────────────────────────────────────────────────────
function RateModal({
  reservation,
  onClose,
  onSubmitted,
}: {
  reservation: Reservation | null
  onClose: () => void
  onSubmitted: (reservationId: string, rating: number) => void
}) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  if (!reservation) return null
  const res = reservation!
  const ev = res.events as any

  async function submit() {
    if (stars === 0) { Alert.alert('Rate the event', 'Please select a star rating.'); return }
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('event_ratings').upsert({
      user_id: user.id,
      event_id: (res.events as any)?.event_id ?? res.event_id,
      reservation_id: res.reservation_id,
      rating: stars,
      comment: comment.trim() || null,
    }, { onConflict: 'user_id,reservation_id' })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    onSubmitted(res.reservation_id, stars)
    onClose()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Rate this Event</Text>
          <Text style={styles.modalSub}>{ev?.event_name ?? 'Event'}</Text>

          <View style={styles.starsCenter}>
            <StarRow value={stars} onChange={setStars} size={36} />
            <Text style={styles.starLabel}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][stars] ?? ''}
            </Text>
          </View>

          <TextInput
            style={styles.commentInput}
            placeholder="Leave a comment (optional)..."
            placeholderTextColor={COLORS.mutedDark}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            selectionColor={COLORS.purple}
          />

          <TouchableOpacity
            style={[styles.submitBtn, stars === 0 && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || stars === 0}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Submit Rating</Text>
            }
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Dispute Modal ─────────────────────────────────────────────────────────────
function DisputeModal({
  reservation,
  onClose,
  onSubmitted,
}: {
  reservation: Reservation | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  if (!reservation) return null
  const res2 = reservation!
  const ev = res2.events as any

  async function submit() {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Please fill in the subject and description.')
      return
    }
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('disputes').insert({
      user_id: user.id,
      reservation_id: res2.reservation_id,
      event_id: (res2.events as any)?.event_id ?? res2.event_id,
      club_id: (res2.events as any)?.club_id ?? null,
      subject: subject.trim(),
      description: description.trim(),
      priority,
    })
    setLoading(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('Dispute submitted', 'The club manager will review your dispute shortly.')
    onSubmitted()
    onClose()
  }

  const PRIORITIES: { key: 'low' | 'medium' | 'high'; label: string; color: string }[] = [
    { key: 'low', label: 'Low', color: COLORS.green },
    { key: 'medium', label: 'Medium', color: '#f59e0b' },
    { key: 'high', label: 'High', color: COLORS.red },
  ]

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { maxHeight: '88%' }]} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>File a Dispute</Text>
            <Text style={styles.modalSub}>{ev?.event_name ?? 'Event'}</Text>

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.priorityBtn,
                    priority === p.key && { backgroundColor: p.color + '25', borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.key)}
                >
                  <Text style={[styles.priorityText, priority === p.key && { color: p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.textField}
              placeholder="e.g. Overcharged, wrong table..."
              placeholderTextColor={COLORS.mutedDark}
              value={subject}
              onChangeText={setSubject}
              selectionColor={COLORS.purple}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textField, { height: 100, textAlignVertical: 'top', paddingTop: SPACING.sm }]}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={COLORS.mutedDark}
              value={description}
              onChangeText={setDescription}
              multiline
              selectionColor={COLORS.purple}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Submit Dispute</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── QR Detail Bottom Sheet ────────────────────────────────────────────────────
function qrUrlFor(code: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(code)}&bgcolor=ffffff&color=000000&margin=16`
}

function QRSheet({ reservation, onClose }: { reservation: Reservation | null; onClose: () => void }) {
  const [attendees, setAttendees] = useState<Attendee[] | null>(null)
  const reservationId = reservation?.reservation_id
  const reservationType = reservation?.type

  useEffect(() => {
    if (!reservationId || reservationType === 'table') { setAttendees([]); return }
    let cancelled = false
    setAttendees(null)
    supabase.from('attendees')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setAttendees((data as Attendee[]) ?? []) })
    return () => { cancelled = true }
  }, [reservationId, reservationType])

  if (!reservation) return null
  const currentReservation = reservation
  const ev = reservation.events as any
  const isTable = isTableReservationType(reservation.type)
  const past = ev?.event_starting_date ? isPast(ev.event_starting_date) : false
  const effectiveStatus = past && reservation.status === 'confirmed' ? 'completed' : reservation.status

  const rowId = canonicalReservationRowId(reservation as Reservation & { id?: string | null })
  const { scanPayload: tableScanPayload, displayId: tableDisplayId } = isTable
    ? reservationGateScanAndDisplay({
        reservation_id: rowId,
        id: (reservation as Reservation & { id?: string | null }).id,
        qr_code: reservation.qr_code,
      })
    : { scanPayload: null, displayId: null }
  const qrUrl = tableScanPayload && !past ? qrUrlFor(tableScanPayload) : null
  const ticketScanPayloads = !isTable
    ? reservationRowGatePayloads({
        reservation_id: rowId,
        id: (reservation as Reservation & { id?: string | null }).id,
        type: reservation.type,
        qr_code: reservation.qr_code,
        payments: (reservation as { payments?: { payment_id?: string } | { payment_id?: string }[] }).payments,
      })
    : []
  const ticketQrUrl =
    ticketScanPayloads[0] && !past ? qrUrlFor(ticketScanPayloads[0]) : null

  async function handleShare() {
    try {
      await Share.share({ message: `My ticket to ${ev?.event_name ?? 'the event'} — Booking ID: ${reservation!.reservation_id}` })
    } catch {}
  }

  async function handleDownloadPdf() {
    if (!isTable && attendees === null) {
      Alert.alert('Preparing ticket', 'Please wait for the ticket QR codes to finish loading.')
      return
    }
    try {
      const ticketType = (currentReservation as any).ticket_types
      const payments = (currentReservation as any).payments
      const payment = Array.isArray(payments) ? payments[0] : payments
      await downloadTicketPdf({
        reservationId: currentReservation.reservation_id,
        eventName: ev?.event_name ?? 'Event',
        ticketTypeName: isTable ? 'Table Reservation' : (ticketType?.name ?? 'General Entry'),
        quantity: String(currentReservation.nr_of_people ?? 1),
        total: payment?.amount ?? null,
        isReservation: isTable,
        qrCode: isTable ? tableScanPayload : currentReservation.qr_code,
        attendees: attendees ?? [],
        status: effectiveStatus,
        venue: ev?.clubs?.club_address ?? null,
        dateText: ev?.event_starting_date
          ? `${formatDateLong(ev.event_starting_date)} · ${formatTime(ev.event_starting_date)}`
          : null,
      })
    } catch (e: any) {
      Alert.alert('PDF unavailable', e?.message ?? 'Could not create the ticket PDF.')
    }
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
            <Text style={styles.sheetEventName}>{ev?.event_name ?? 'Event'}</Text>

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

            {past ? (
              <View style={styles.qrPast}>
                <Ionicons name="checkmark-done-circle-outline" size={52} color={COLORS.mutedDark} />
                <Text style={styles.qrPastTitle}>Event has ended</Text>
                <Text style={styles.qrPastSub}>This event has already taken place.</Text>
              </View>
            ) : isTable ? (
              qrUrl ? (
                <View style={styles.qrWrap}>
                  <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                  <Text style={styles.qrCaption}>Show this QR code at the entrance</Text>
                  {tableDisplayId ? (
                    <>
                      <Text style={[styles.qrCaption, { marginTop: SPACING.sm, fontWeight: '700' }]}>
                        Reservation ID
                      </Text>
                      <Text style={[styles.qrCaption, { fontSize: 11 }]} selectable numberOfLines={2}>
                        {tableDisplayId}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : (
                <View style={styles.qrPast}>
                  <Ionicons name="qr-code-outline" size={52} color={COLORS.mutedDark} />
                  <Text style={styles.qrPastTitle}>QR unavailable</Text>
                  <Text style={styles.qrPastSub}>
                    Reservation ID: {tableDisplayId ?? rowId ?? reservation.reservation_id}
                  </Text>
                </View>
              )
            ) : attendees === null ? (
              <View style={[styles.qrWrap, { paddingVertical: SPACING.xl }]}>
                <ActivityIndicator color={COLORS.purple} />
              </View>
            ) : attendees.length > 0 ? (
              <View style={styles.qrWrap}>
                <Text style={styles.attendeesHeader}>
                  {attendees.length === 1 ? 'Your QR code' : `${attendees.length} tickets — one QR per guest`}
                </Text>
                {attendees.map((a, i) => (
                  <View key={a.id} style={[styles.attendeeBlock, i > 0 && styles.attendeeBlockDivider]}>
                    <View style={styles.attendeeHeader}>
                      <View style={styles.attendeeIndex}>
                        <Text style={styles.attendeeIndexText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attendeeName} numberOfLines={1}>{a.name}</Text>
                        <Text style={styles.attendeeRole}>{i === 0 ? 'Buyer' : 'Guest'}</Text>
                      </View>
                      {a.checked_in_at && (
                        <View style={styles.checkedPill}>
                          <Ionicons name="checkmark" size={11} color={COLORS.green} />
                          <Text style={styles.checkedText}>Checked in</Text>
                        </View>
                      )}
                    </View>
                    <Image
                      source={{ uri: qrUrlFor(ticketGatePayload(a.qr_code) ?? a.qr_code) }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrCaption} numberOfLines={2} selectable>
                      {ticketGatePayload(a.qr_code) ?? a.qr_code}
                    </Text>
                  </View>
                ))}
              </View>
            ) : ticketQrUrl ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: ticketQrUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.qrCaption}>Show this QR code at the entrance</Text>
                <Text style={[styles.qrCaption, { fontSize: 11 }]} selectable numberOfLines={2}>
                  {ticketScanPayloads[0]}
                </Text>
              </View>
            ) : (
              <View style={styles.qrPast}>
                <Ionicons name="qr-code-outline" size={52} color={COLORS.mutedDark} />
                <Text style={styles.qrPastTitle}>QR unavailable</Text>
                <Text style={styles.qrPastSub}>Booking ID: {rowId || reservation.reservation_id}</Text>
              </View>
            )}

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetActionBtn} onPress={handleDownloadPdf}>
                <Ionicons name="download-outline" size={18} color={COLORS.white} />
                <Text style={styles.sheetActionText}>PDF</Text>
              </TouchableOpacity>
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
  existingRating,
  isPastTab,
  onPress,
  onCancel,
  onRefund,
  onRate,
  onDispute,
}: {
  reservation: Reservation
  existingRating: number
  isPastTab: boolean
  onPress: () => void
  onCancel: () => void
  onRefund: () => void
  onRate: () => void
  onDispute: () => void
}) {
  const ev = reservation.events as any
  const isTable = reservation.type === 'table'
  const effectiveStatus = isPastTab && reservation.status === 'confirmed' ? 'completed' : reservation.status

  return (
    <TouchableOpacity
      style={[styles.ticketCard, isPastTab && styles.ticketCardPast]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Main row */}
      <View style={styles.ticketRow}>
        {ev?.event_image ? (
          <Image source={{ uri: ev.event_image }} style={[styles.thumb, isPastTab && styles.thumbPast]} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, isPastTab && styles.thumbPast]}>
            <Ionicons name={isTable ? 'restaurant-outline' : 'musical-notes'} size={18} color={COLORS.border} />
          </View>
        )}

        <View style={styles.ticketInfo}>
          <Text style={[styles.ticketName, isPastTab && styles.ticketNamePast]} numberOfLines={1}>
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
          <View style={[styles.statusPill, { borderColor: statusColor(effectiveStatus) }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(effectiveStatus) }]} />
            <Text style={[styles.statusText, { color: statusColor(effectiveStatus) }]}>
              {effectiveStatus}
            </Text>
          </View>
        </View>

        <View style={styles.ticketActions}>
          <TouchableOpacity style={styles.viewBtn} onPress={(e) => { e.stopPropagation(); onPress() }}>
            <Text style={styles.viewBtnText}>{isPastTab ? 'Details' : 'View'}</Text>
            <Ionicons name="chevron-forward" size={13} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Upcoming actions: cancel / refund */}
      {!isPastTab && reservation.status !== 'cancelled' && (
        <View style={styles.pastActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={(e) => { e.stopPropagation(); onCancel() }}>
            <Ionicons name="close-circle-outline" size={14} color={COLORS.red} />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          {!isTable && (
            <>
              <View style={styles.pastActionsDivider} />
              <TouchableOpacity style={styles.refundBtn} onPress={(e) => { e.stopPropagation(); onRefund() }}>
                <Ionicons name="card-outline" size={14} color={COLORS.purple} />
                <Text style={styles.refundBtnText}>Refund Ticket</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Past actions: rate + dispute */}
      {isPastTab && (
        <View style={styles.pastActions}>
          {existingRating > 0 ? (
            <View style={styles.ratedRow}>
              <StarRow value={existingRating} size={16} />
              <Text style={styles.ratedLabel}>You rated this</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.rateBtn} onPress={(e) => { e.stopPropagation(); onRate() }}>
              <Ionicons name="star-outline" size={14} color="#f59e0b" />
              <Text style={styles.rateBtnText}>Rate this event</Text>
            </TouchableOpacity>
          )}
          <View style={styles.pastActionsDivider} />
          <TouchableOpacity style={styles.disputeBtn} onPress={(e) => { e.stopPropagation(); onDispute() }}>
            <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
            <Text style={styles.disputeBtnText}>File Dispute</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Claimed Offer Sheet ───────────────────────────────────────────────────────
function ClaimSheet({ claim, onClose, onCancel }: {
  claim: ClaimedPromotion | null
  onClose: () => void
  onCancel: (claim: ClaimedPromotion) => void
}) {
  if (!claim) return null
  const promo = claim.promotions
  const validUntil = promo?.valid_until ? new Date(promo.valid_until) : null
  const expired = !!validUntil && validUntil < new Date()
  const effectiveStatus = expired && claim.status === 'active' ? 'expired' : claim.status
  const code = (claim.redemption_code ?? '').toUpperCase()
  const qrUrl = qrUrlFor(claim.redemption_code)

  async function handleShare() {
    try {
      await Share.share({
        message: `I claimed "${promo?.title ?? 'an offer'}" on PartyOn — Redemption code: ${code}`,
      })
    } catch {}
  }

  const statusColorClaim =
    effectiveStatus === 'active' ? COLORS.green
    : effectiveStatus === 'redeemed' ? COLORS.purple
    : effectiveStatus === 'expired' ? COLORS.mutedDark
    : COLORS.red

  return (
    <Modal visible={!!claim} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
            <Text style={styles.sheetEventName}>{promo?.title ?? 'Offer'}</Text>

            <View style={styles.sheetMeta}>
              {promo?.clubs?.club_name && (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.muted} />
                  <Text style={styles.sheetMetaText}>
                    {promo.clubs.club_name}
                    {promo.clubs.club_address ? ` · ${promo.clubs.club_address}` : ''}
                  </Text>
                </View>
              )}
              {validUntil && (
                <View style={styles.sheetMetaRow}>
                  <Ionicons name="time-outline" size={14} color={COLORS.muted} />
                  <Text style={styles.sheetMetaText}>
                    Valid until {formatShort(validUntil.toISOString())}
                  </Text>
                </View>
              )}
              <View style={styles.sheetMetaRow}>
                <Ionicons name="pricetag-outline" size={14} color={COLORS.muted} />
                <Text style={styles.sheetMetaText}>
                  Claimed on {formatShort(claim.claimed_at)}
                </Text>
              </View>
            </View>

            <View style={styles.sheetBadgeRow}>
              <View style={[
                styles.sheetBadge,
                { backgroundColor: 'rgba(217,70,168,0.15)', borderColor: COLORS.logoPink },
              ]}>
                <Ionicons name="gift-outline" size={13} color={COLORS.logoPink} />
                <Text style={[styles.sheetBadgeText, { color: COLORS.logoPink }]}>
                  {promo?.discount_value ? `${promo.discount_value}% OFF` : 'Promotion'}
                </Text>
              </View>
              <View style={[styles.sheetStatusBadge, { borderColor: statusColorClaim }]}>
                <Text style={[styles.sheetStatusText, { color: statusColorClaim }]}>
                  {effectiveStatus}
                </Text>
              </View>
            </View>

            {effectiveStatus === 'expired' ? (
              <View style={styles.qrPast}>
                <Ionicons name="time-outline" size={52} color={COLORS.mutedDark} />
                <Text style={styles.qrPastTitle}>This offer has expired</Text>
                <Text style={styles.qrPastSub}>Code: {code}</Text>
              </View>
            ) : effectiveStatus === 'redeemed' ? (
              <View style={styles.qrPast}>
                <Ionicons name="checkmark-done-circle-outline" size={52} color={COLORS.purple} />
                <Text style={styles.qrPastTitle}>Already redeemed</Text>
                <Text style={styles.qrPastSub}>
                  {claim.redeemed_at ? `Redeemed on ${formatShort(claim.redeemed_at)}` : 'This offer has been used'}
                </Text>
              </View>
            ) : (
              <View style={styles.qrWrap}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.qrCaption}>Show this code at the door to redeem</Text>
                <View style={styles.codePill}>
                  <Text style={styles.codePillText} selectable>{code}</Text>
                </View>
              </View>
            )}

            {promo?.description && (
              <View style={styles.offerAboutBox}>
                <Text style={styles.offerAboutTitle}>About this offer</Text>
                <Text style={styles.offerAboutText}>{promo.description}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.sheetShareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={17} color={COLORS.muted} />
              <Text style={styles.sheetShareText}>Share with Friends</Text>
            </TouchableOpacity>

            {effectiveStatus === 'active' && (
              <TouchableOpacity
                style={[styles.sheetShareBtn, { marginTop: SPACING.sm, borderColor: 'rgba(239,68,68,0.35)' }]}
                onPress={() => onCancel(claim)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={17} color={COLORS.red} />
                <Text style={[styles.sheetShareText, { color: COLORS.red }]}>Cancel Claim</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Claimed Offer Card ────────────────────────────────────────────────────────
function ClaimedOfferCard({ claim, onPress }: { claim: ClaimedPromotion; onPress: () => void }) {
  const promo = claim.promotions
  const validUntil = promo?.valid_until ? new Date(promo.valid_until) : null
  const expired = !!validUntil && validUntil < new Date()
  const effectiveStatus = expired && claim.status === 'active' ? 'expired' : claim.status

  const statusColorClaim =
    effectiveStatus === 'active' ? COLORS.green
    : effectiveStatus === 'redeemed' ? COLORS.purple
    : effectiveStatus === 'expired' ? COLORS.mutedDark
    : COLORS.red

  const isInactive = effectiveStatus !== 'active'

  return (
    <View style={[styles.ticketCard, isInactive && styles.ticketCardPast]}>
      <View style={styles.ticketRow}>
        {promo?.image_url ? (
          <Image source={{ uri: promo.image_url }} style={[styles.thumb, isInactive && styles.thumbPast]} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, isInactive && styles.thumbPast]}>
            <Ionicons name="pricetag-outline" size={18} color={COLORS.border} />
          </View>
        )}

        <TouchableOpacity style={styles.ticketInfo} onPress={onPress} activeOpacity={0.75}>
          <Text style={[styles.ticketName, isInactive && styles.ticketNamePast]} numberOfLines={1}>
            {promo?.title ?? 'Offer'}
          </Text>
          {promo?.clubs?.club_name && (
            <Text style={styles.ticketVenue} numberOfLines={1}>
              {promo.clubs.club_name}
              {promo.clubs.club_address ? ` · ${promo.clubs.club_address}` : ''}
            </Text>
          )}
          <View style={styles.ticketDateRow}>
            <Ionicons name="pricetag-outline" size={11} color={COLORS.mutedDark} />
            <Text style={styles.ticketDate}>
              {promo?.discount_value ? `${promo.discount_value}% OFF` : 'Promotion'}
            </Text>
            {validUntil && (
              <>
                <Text style={styles.ticketSep}>·</Text>
                <Ionicons name="time-outline" size={11} color={COLORS.mutedDark} />
                <Text style={styles.ticketDate}>Until {formatShort(validUntil.toISOString())}</Text>
              </>
            )}
          </View>
          <View style={[styles.statusPill, { borderColor: statusColorClaim }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColorClaim }]} />
            <Text style={[styles.statusText, { color: statusColorClaim }]}>
              {effectiveStatus}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.ticketActions}>
          <TouchableOpacity style={styles.viewBtn} onPress={onPress}>
            <Text style={styles.viewBtnText}>{effectiveStatus === 'active' ? 'Show' : 'Details'}</Text>
            <Ionicons name="chevron-forward" size={13} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ section?: string }>()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [claims, setClaims] = useState<ClaimedPromotion[]>([])
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'reservations' | 'offers'>(
    params.section === 'offers' ? 'offers' : 'reservations',
  )
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [selectedClaim, setSelectedClaim] = useState<ClaimedPromotion | null>(null)
  const [rateTarget, setRateTarget] = useState<Reservation | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<Reservation | null>(null)

  useEffect(() => {
    if (params.section === 'offers') setSection('offers')
    else if (params.section === 'reservations') setSection('reservations')
  }, [params.section])

  useFocusEffect(
    useCallback(() => {
      if (!user) { setLoading(false); return }
      setLoading(true)
      Promise.all([
        supabase
          .from('reservations')
          .select('*, events(event_id, event_name, event_starting_date, event_image, club_id, clubs(club_address)), ticket_types(name,price), payments(payment_id,amount,status)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('event_ratings')
          .select('reservation_id, rating')
          .eq('user_id', user.id),
        supabase
          .from('claimed_promotions')
          .select('*, promotions(promotion_id, title, description, category, discount_value, valid_from, valid_until, image_url, clubs(club_name, club_address, club_id))')
          .eq('user_id', user.id)
          .order('claimed_at', { ascending: false }),
      ]).then(([resRes, ratRes, claimsRes]) => {
        setReservations((resRes.data as Reservation[]) ?? [])
        const map: Record<string, number> = {}
        for (const r of (ratRes.data ?? [])) map[r.reservation_id] = r.rating
        setRatings(map)
        setClaims((claimsRes.data as ClaimedPromotion[]) ?? [])
        setLoading(false)
      })
    }, [user]),
  )

  async function handleCancelClaim(claim: ClaimedPromotion) {
    Alert.alert(
      'Cancel claim',
      'You can claim this offer again later if it is still active. Continue?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel claim', style: 'destructive', onPress: async () => {
            const { error } = await supabase
              .from('claimed_promotions')
              .delete()
              .eq('id', claim.id)
            if (error) { Alert.alert('Error', error.message); return }
            setClaims((prev) => prev.filter((c) => c.id !== claim.id))
            setSelectedClaim(null)
          },
        },
      ],
    )
  }

  async function handleCancel(reservationId: string) {
    Alert.alert('Cancel booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking', style: 'destructive', onPress: async () => {
          await supabase.from('reservations').update({ status: 'cancelled' }).eq('reservation_id', reservationId)
          setReservations((prev) => prev.map((r) =>
            r.reservation_id === reservationId ? { ...r, status: 'cancelled' } : r,
          ))
        },
      },
    ])
  }

  async function handleRefund(reservation: Reservation) {
    Alert.alert(
      'Refund Ticket',
      'Your ticket will be cancelled and a refund will be processed within 5–7 business days.',
      [
        { text: 'Keep ticket', style: 'cancel' },
        {
          text: 'Confirm Refund', style: 'destructive', onPress: async () => {
            await supabase.from('reservations').update({ status: 'cancelled' }).eq('reservation_id', reservation.reservation_id)
            await supabase.from('payments').update({ status: 'refund_pending' }).eq('reservation_id', reservation.reservation_id)
            setReservations((prev) => prev.map((r) =>
              r.reservation_id === reservation.reservation_id ? { ...r, status: 'cancelled' } : r,
            ))
            Alert.alert('Refund requested', 'Your refund request has been submitted and will be processed within 5–7 business days.')
          },
        },
      ],
    )
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

  const upcomingList = reservations.filter((r) => {
    if (r.status === 'cancelled') return false
    const ev = r.events as any
    if (!ev?.event_starting_date) return true
    return !isPast(ev.event_starting_date)
  })

  const pastList = reservations.filter((r) => {
    const ev = r.events as any
    if (!ev?.event_starting_date) return false
    return isPast(ev.event_starting_date)
  })

  const activeList = activeTab === 'upcoming' ? upcomingList : pastList

  // ── Offers (claimed promotions) split by status ──
  const activeClaims = claims.filter((c) => {
    if (c.status !== 'active') return false
    const validUntil = c.promotions?.valid_until
    if (!validUntil) return true
    return new Date(validUntil) >= new Date()
  })
  const pastClaims = claims.filter((c) => !activeClaims.includes(c))

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerSub}>No sleep till sunrise</Text>
        <Text style={styles.headerTitle}>Your Nights</Text>
      </View>

      {/* Top section toggle: Reservations / Offers */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segment, section === 'reservations' && styles.segmentActive]}
          onPress={() => setSection('reservations')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="ticket-outline"
            size={15}
            color={section === 'reservations' ? COLORS.white : COLORS.muted}
          />
          <Text style={[styles.segmentText, section === 'reservations' && styles.segmentTextActive]}>
            Reservations{reservations.length > 0 ? ` (${reservations.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, section === 'offers' && styles.segmentActive]}
          onPress={() => setSection('offers')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="pricetag-outline"
            size={15}
            color={section === 'offers' ? COLORS.white : COLORS.muted}
          />
          <Text style={[styles.segmentText, section === 'offers' && styles.segmentTextActive]}>
            Offers{claims.length > 0 ? ` (${claims.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {section === 'reservations' ? (
        <>
          {/* Filter tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                Upcoming{upcomingList.length > 0 ? ` (${upcomingList.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'past' && styles.tabActive]}
              onPress={() => setActiveTab('past')}
            >
              <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                Past{pastList.length > 0 ? ` (${pastList.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
          ) : activeList.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} size={52} color={COLORS.mutedDark} />
              <Text style={styles.emptyTitle}>{activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'upcoming' ? 'Buy a ticket or reserve a table to get started' : 'Events you attend will appear here'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(tabs)/search')}>
                  <Text style={styles.ctaBtnText}>Browse Events</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm }}
              showsVerticalScrollIndicator={false}
            >
              {activeList.map((r) => (
                <TicketCard
                  key={r.reservation_id}
                  reservation={r}
                  existingRating={ratings[r.reservation_id] ?? 0}
                  isPastTab={activeTab === 'past'}
                  onPress={() => setSelected(r)}
                  onCancel={() => handleCancel(r.reservation_id)}
                  onRefund={() => handleRefund(r)}
                  onRate={() => setRateTarget(r)}
                  onDispute={() => setDisputeTarget(r)}
                />
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        // ── Offers section ──
        loading ? (
          <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
        ) : claims.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="pricetag-outline" size={52} color={COLORS.mutedDark} />
            <Text style={styles.emptyTitle}>No claimed offers</Text>
            <Text style={styles.emptySub}>Offers you claim will appear here with a code to show at the door.</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/promotions')}>
              <Text style={styles.ctaBtnText}>Browse Promotions</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm }}
            showsVerticalScrollIndicator={false}
          >
            {activeClaims.length > 0 && (
              <>
                <Text style={styles.offersSectionTitle}>Active ({activeClaims.length})</Text>
                {activeClaims.map((c) => (
                  <ClaimedOfferCard
                    key={c.id}
                    claim={c}
                    onPress={() => setSelectedClaim(c)}
                  />
                ))}
              </>
            )}
            {pastClaims.length > 0 && (
              <>
                <Text style={[styles.offersSectionTitle, { marginTop: SPACING.md }]}>
                  Past ({pastClaims.length})
                </Text>
                {pastClaims.map((c) => (
                  <ClaimedOfferCard
                    key={c.id}
                    claim={c}
                    onPress={() => setSelectedClaim(c)}
                  />
                ))}
              </>
            )}
          </ScrollView>
        )
      )}

      <QRSheet reservation={selected} onClose={() => setSelected(null)} />

      <ClaimSheet
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
        onCancel={handleCancelClaim}
      />

      <RateModal
        reservation={rateTarget}
        onClose={() => setRateTarget(null)}
        onSubmitted={(reservationId, rating) => {
          setRatings(prev => ({ ...prev, [reservationId]: rating }))
        }}
      />

      <DisputeModal
        reservation={disputeTarget}
        onClose={() => setDisputeTarget(null)}
        onSubmitted={() => {}}
      />
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

  segmentWrap: {
    flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: 3,
  },
  segment: {
    flex: 1, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm - 2, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  segmentActive: { backgroundColor: COLORS.purpleDark },
  segmentText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  segmentTextActive: { color: COLORS.white },

  offersSectionTitle: {
    color: COLORS.mutedDark, fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.2,
    marginTop: SPACING.xs, marginBottom: SPACING.xs,
  },

  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: 3,
  },
  tab: { flex: 1, paddingVertical: SPACING.xs + 3, borderRadius: RADIUS.sm - 2, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.purple },
  tabText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },

  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  emptySub: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
  ctaBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4, paddingHorizontal: SPACING.xl,
  },
  ctaBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },


  // Ticket card
  ticketCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  ticketCardPast: { opacity: 0.85 },
  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm,
  },
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

  // Past actions row
  pastActions: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  rateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm,
  },
  rateBtnText: { color: '#f59e0b', fontSize: FONT.sm, fontWeight: '600' },
  ratedRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: SPACING.sm,
  },
  ratedLabel: { color: COLORS.mutedDark, fontSize: FONT.sm },
  pastActionsDivider: { width: 1, height: '60%', backgroundColor: COLORS.border },
  disputeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm,
  },
  disputeBtnText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm,
  },
  cancelBtnText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },
  refundBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm,
  },
  refundBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },

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
  codePill: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    backgroundColor: '#0d0d14',
    borderRadius: RADIUS.pill,
  },
  codePillText: {
    color: '#fff', fontSize: FONT.md, fontWeight: '900',
    letterSpacing: 3, fontVariant: ['tabular-nums'],
  },
  offerAboutBox: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.md, gap: 4,
  },
  offerAboutTitle: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  offerAboutText: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },
  attendeesHeader: { color: '#222', fontSize: FONT.sm, fontWeight: '700', marginBottom: SPACING.sm, textAlign: 'center' },
  attendeeBlock: { alignItems: 'center', alignSelf: 'stretch', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  attendeeBlockDivider: { borderTopWidth: 1, borderTopColor: '#e5e5e5', marginTop: SPACING.md, paddingTop: SPACING.md },
  attendeeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'stretch', marginBottom: SPACING.sm, paddingHorizontal: SPACING.sm },
  attendeeIndex: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: COLORS.purple, alignItems: 'center', justifyContent: 'center' },
  attendeeIndexText: { color: COLORS.purple, fontSize: 11, fontWeight: '800' },
  attendeeName: { color: '#111', fontSize: FONT.base, fontWeight: '700' },
  attendeeRole: { color: '#666', fontSize: 11, marginTop: 1 },
  checkedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)' },
  checkedText: { color: COLORS.green, fontSize: 10, fontWeight: '700' },
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

  // Rate/Dispute modals
  modalTitle: {
    color: COLORS.white, fontSize: FONT.xl, fontWeight: '800',
    marginBottom: 4, marginTop: SPACING.xs,
  },
  modalSub: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.lg },
  starsCenter: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  starLabel: { color: '#f59e0b', fontSize: FONT.base, fontWeight: '700', minHeight: 22 },
  commentInput: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.white, fontSize: FONT.base,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg, minHeight: 80, textAlignVertical: 'top',
  },
  fieldLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', marginBottom: SPACING.xs },
  textField: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    color: COLORS.white, fontSize: FONT.base,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  priorityRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  priorityBtn: {
    flex: 1, paddingVertical: SPACING.sm, alignItems: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgInput,
  },
  priorityText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  submitBtn: {
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.md + 2,
    alignItems: 'center', marginTop: SPACING.sm,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: FONT.base },
})
