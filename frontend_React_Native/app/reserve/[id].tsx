import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Club, Event } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type TableKind = 'standard' | 'vip'

type ClubTableRow = {
  id: string
  type: string | null
  table_status: string | null
  position: string | null
  minimum_spend: string | number | null
}

function eventNeedsTicket(ev: Event): boolean {
  const price = Number(ev.final_ticket_price ?? ev.ticket_price ?? 0)
  return price > 0
}

function generateReservationReference() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `RES-${yyyy}-${mm}${dd}-${rand}`
}

function isVipTableDbType(type: string | null): boolean {
  if (!type) return false
  const t = type.toLowerCase().trim()
  return t.includes('vip') || t === 'vip_table'
}

function normalizeTableRowStatus(raw: string | null): 'available' | 'reserved' | 'occupied' {
  const t = (raw ?? 'available').toLowerCase().trim()
  if (t === 'reserved' || t === 'booked') return 'reserved'
  if (t === 'occupied' || t === 'seated' || t === 'in_use') return 'occupied'
  return 'available'
}

function tableRowFloorUiOccupied(position: string | null): boolean {
  if (!position?.trim()) return false
  try {
    const o = JSON.parse(position) as { floor_ui_status?: string }
    const s = o?.floor_ui_status != null ? String(o.floor_ui_status).toLowerCase().trim() : ''
    return s === 'occupied'
  } catch {
    return false
  }
}

function isDbTableAvailable(row: ClubTableRow): boolean {
  if (tableRowFloorUiOccupied(row.position)) return false
  return normalizeTableRowStatus(row.table_status) === 'available'
}

function slotsFromEvent(ev: Event): string[] {
  const d = new Date(ev.event_starting_date)
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = d.getHours() * 60 + d.getMinutes()
    const out: string[] = []
    for (let i = 0; i < 6; i++) {
      const t = (start + i * 60) % (24 * 60)
      out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`)
    }
    return [...new Set(out)]
  }
  return ['20:00', '21:00', '22:00', '23:00']
}

function dateFromEvent(ev: Event): string {
  const d = new Date(ev.event_starting_date)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export default function ReserveTableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, loading: authLoading } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  const [people, setPeople] = useState(2)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [tableType, setTableType] = useState<TableKind>('standard')
  const [clubTables, setClubTables] = useState<ClubTableRow[]>([])
  const [clubTablesQueried, setClubTablesQueried] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  const clubId = (event?.club_id ?? '').trim()
  const vipSelectable = useMemo(() => {
    if (!clubId || !clubTablesQueried) return false
    const vipRows = clubTables.filter((r) => isVipTableDbType(r.type))
    return vipRows.some(isDbTableAvailable)
  }, [clubId, clubTables, clubTablesQueried])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace({ pathname: '/(auth)/login', params: { from: `/reserve/${id ?? ''}` } })
    }
  }, [authLoading, user, id, router])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let alive = true
    void supabase
      .from('events')
      .select('*, clubs(*)')
      .eq('event_id', id)
      .single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) {
          setEvent(null)
          setLoading(false)
          return
        }
        const ev = data as Event
        setEvent(ev)
        if (eventNeedsTicket(ev)) {
          router.replace({
            pathname: '/payment',
            params: {
              eventId: ev.event_id,
              eventName: ev.event_name,
              ticketTypeId: '',
              ticketTypeName: 'General Admission',
              price: String(ev.final_ticket_price ?? ev.ticket_price ?? 0),
              isReservation: 'false',
            },
          })
          return
        }
        const slots = slotsFromEvent(ev)
        setSelectedSlot((prev) => (prev && slots.includes(prev) ? prev : slots[0] || ''))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, router])

  useEffect(() => {
    if (!clubId) {
      setClubTables([])
      setClubTablesQueried(true)
      return
    }
    let alive = true
    setClubTablesQueried(false)
    void supabase
      .from('tables')
      .select('id, type, table_status, position, minimum_spend')
      .eq('club_id', clubId)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setClubTables([])
        else setClubTables((data ?? []) as ClubTableRow[])
        setClubTablesQueried(true)
      })
    return () => {
      alive = false
    }
  }, [clubId])

  useEffect(() => {
    if (tableType === 'vip' && !vipSelectable) setTableType('standard')
  }, [tableType, vipSelectable])

  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email || '')
  }, [user, step])

  async function submitReservation() {
    if (!event || !user) return
    if (!fullName.trim() || !email.includes('@') || !phone.trim()) {
      Alert.alert('Missing info', 'Please enter your full name, email, and phone.')
      return
    }
    setSubmitting(true)
    const reference = generateReservationReference()
    const nowIso = new Date().toISOString()
    const selectedDate = dateFromEvent(event)
    const mergedNotes = [
      `Guest: ${fullName.trim()} · ${email.trim()} · ${phone.trim()}`,
      `Table type: ${tableType === 'vip' ? 'VIP' : 'Standard'}`,
      specialRequests.trim() ? `Special requests: ${specialRequests.trim()}` : null,
    ]
      .filter(Boolean)
      .join(' | ')
    const reservationRowType = tableType === 'vip' ? 'vip_table' : 'standard_table'

    const modernPayload = {
      user_id: user.id,
      event_id: event.event_id,
      number_of_people: people,
      time_slot: selectedSlot,
      special_requests: mergedNotes || null,
      status: 'pending',
      reservation_reference: reference,
      created_at: nowIso,
      updated_at: nowIso,
      table_type: tableType,
    }

    let inserted: { reservation_id?: string; id?: string; created_at?: string | null } | null = null
    try {
      const { data: modernRow, error: modernError } = await supabase
        .from('reservations')
        .insert(modernPayload)
        .select('reservation_id,id,created_at')
        .maybeSingle()

      if (!modernError && modernRow) {
        const rid =
          (modernRow as { reservation_id?: string; id?: string }).reservation_id ??
          (modernRow as { reservation_id?: string; id?: string }).id
        inserted = {
          reservation_id: rid,
          id: rid,
          created_at: (modernRow as { created_at?: string | null }).created_at ?? nowIso,
        }
      } else {
        const legacyPayload: Record<string, unknown> = {
          user_id: user.id,
          event_id: event.event_id,
          nr_of_people: people,
          expected_arrival_time: selectedSlot,
          notes: mergedNotes || null,
          status: 'pending',
          type: reservationRowType,
          qr_code: reference,
          reservation_date: `${selectedDate}T00:00:00.000Z`,
          created_at: nowIso,
          table_type: tableType,
        }
        let { data: legacyData, error: legacyError } = await supabase
          .from('reservations')
          .insert(legacyPayload)
          .select('reservation_id,created_at')
          .single()
        if (legacyError) {
          delete legacyPayload.table_type
          const retry1 = await supabase
            .from('reservations')
            .insert(legacyPayload)
            .select('reservation_id,created_at')
            .single()
          legacyData = retry1.data
          legacyError = retry1.error
        }
        if (legacyError) {
          const fallback: Record<string, unknown> = { ...legacyPayload, type: 'table' }
          delete fallback.table_type
          const retry2 = await supabase
            .from('reservations')
            .insert(fallback)
            .select('reservation_id,created_at')
            .single()
          legacyData = retry2.data
          legacyError = retry2.error
        }
        if (legacyError || !legacyData) {
          throw new Error(legacyError?.message || modernError?.message || 'Could not save reservation.')
        }
        inserted = legacyData as { reservation_id?: string; id?: string; created_at?: string | null }
      }

      const reservationUuid = (inserted?.reservation_id || inserted?.id || '').trim()
      const gatePayload = reservationUuid ? `reservation:${reservationUuid}` : reference
      if (reservationUuid) {
        const gateQr = `reservation:${reservationUuid}`
        const { error: qrErr } = await supabase
          .from('reservations')
          .update({ qr_code: gateQr })
          .eq('reservation_id', reservationUuid)
        if (qrErr) {
          await supabase.from('reservations').update({ qr_code: gateQr }).eq('id', reservationUuid)
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace({
        pathname: '/purchased-ticket',
        params: {
          reservationId: reservationUuid || reference,
          gatePayload,
          reference,
          ...(reservationUuid ? {} : { qrCode: gatePayload }),
          eventName: event.event_name,
          ticketTypeName: 'Table reservation',
          quantity: String(people),
          total: '0',
          isReservation: 'true',
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reservation failed.'
      Alert.alert('Could not reserve', msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading || !id) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Event not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const slots = slotsFromEvent(event)
  const club = event.clubs as Club | undefined

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (step === 2 ? setStep(1) : router.back())} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reserve a table</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eventName} numberOfLines={2}>
            {event.event_name}
          </Text>
          {club?.club_name ? (
            <Text style={styles.sub}>{club.club_name}</Text>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.section}>Guests</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setPeople((p) => Math.max(1, p - 1))}
                  disabled={people <= 1}
                >
                  <Ionicons name="remove" size={20} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.qtyVal}>{people}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setPeople((p) => Math.min(20, p + 1))}>
                  <Ionicons name="add" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Table</Text>
              <View style={styles.row2}>
                <TouchableOpacity
                  style={[styles.choice, tableType === 'standard' && styles.choiceOn]}
                  onPress={() => setTableType('standard')}
                >
                  <Text style={styles.choiceText}>Standard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choice, tableType === 'vip' && styles.choiceOn]}
                  onPress={() => vipSelectable && setTableType('vip')}
                  disabled={!vipSelectable}
                >
                  <Text style={[styles.choiceText, !vipSelectable && { opacity: 0.4 }]}>VIP</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Arrival time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
                {slots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slot, selectedSlot === slot && styles.slotOn]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={styles.slotText}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.section}>Requests (optional)</Text>
              <TextInput
                style={styles.inputMultiline}
                placeholder="Birthday, dietary notes…"
                placeholderTextColor={COLORS.mutedDark}
                value={specialRequests}
                onChangeText={setSpecialRequests}
                multiline
              />
            </>
          ) : (
            <>
              <Text style={styles.section}>Your details</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={COLORS.mutedDark}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.mutedDark}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor={COLORS.mutedDark}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </>
          )}
        </ScrollView>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.sm }]}>
          {step === 1 ? (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => {
                if (!selectedSlot) {
                  Alert.alert('Time slot', 'Please choose an arrival time.')
                  return
                }
                setStep(2)
              }}
            >
              <Text style={styles.ctaText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.ctaText} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cta}
              onPress={() => void submitReservation()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.ctaText} />
              ) : (
                <>
                  <Text style={styles.ctaText}>Confirm reservation</Text>
                  <Ionicons name="checkmark" size={20} color={COLORS.ctaText} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  muted: { color: COLORS.muted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  eventName: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginBottom: 4 },
  sub: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.md },
  section: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.sm,
  },
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
  qtyVal: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', minWidth: 36, textAlign: 'center' },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  choice: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
  },
  choiceOn: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.12)' },
  choiceText: { color: COLORS.white, fontWeight: '700' },
  slotRow: { gap: SPACING.sm, paddingVertical: 4 },
  slot: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  slotOn: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.15)' },
  slotText: { color: COLORS.white, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  inputMultiline: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.white,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  backBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.purple,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
})
