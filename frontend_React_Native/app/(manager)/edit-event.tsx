import { useEffect, useRef, useState } from 'react'
import DatePickerModal from '@/components/DatePickerModal'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { dbDateToDdMmYyyy, ddMmYyyyToIsoDate } from '@/lib/eventDates'
import { MANAGER_EVENTS, replaceManagerRoute } from '@/lib/managerNavigation'

const EVENT_TYPES = ['Party', 'DJ Night', 'Concert', 'Live Music', 'Festival', 'Private Event', 'Other']
type EventStatus  = 'draft' | 'published' | 'cancelled' | 'completed'

const STATUS_COLOR: Record<EventStatus, string> = {
  draft:     COLORS.cta,
  published: COLORS.green,
  cancelled: COLORS.red,
  completed: COLORS.muted,
}



export default function EditEventScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const params = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker,   setShowEndPicker]   = useState(false)

  // Form state
  const [coverImage, setCoverImage]       = useState<string | null>(null)
  const [name, setName]                   = useState('')
  const [eventType, setEventType]         = useState('')
  const [description, setDescription]     = useState('')
  const [specialGuests, setSpecialGuests] = useState('')
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [eventHours, setEventHours]       = useState('')
  const [capacity, setCapacity]           = useState('')
  const [ticketPrice, setTicketPrice]     = useState('')
  const [discount, setDiscount]           = useState('')
  const [isFeatured, setIsFeatured]       = useState(false)
  const [featuredRequestStatus, setFeaturedRequestStatus] = useState<string>('none')
  const [featuredRejectionReason, setFeaturedRejectionReason] = useState<string | null>(null)
  const [eventStatus, setEventStatus]     = useState<EventStatus>('draft')
  const [bookingType, setBookingType]     = useState<'ticket' | 'reservation'>('ticket')

  // Refs so handleSave always reads the latest values even across re-renders
  const nameRef         = useRef(name)
  const eventTypeRef    = useRef(eventType)
  const descriptionRef  = useRef(description)
  const specialGuestsRef= useRef(specialGuests)
  const startDateRef    = useRef(startDate)
  const endDateRef      = useRef(endDate)
  const eventHoursRef   = useRef(eventHours)
  const capacityRef     = useRef(capacity)
  const ticketPriceRef  = useRef(ticketPrice)
  const discountRef     = useRef(discount)
  const coverImageRef   = useRef(coverImage)
  const bookingTypeRef  = useRef(bookingType)

  // Keep refs in sync with state so handleSave always reads latest values
  function syncAndSetName(v: string)          { nameRef.current = v;          setName(v) }
  function syncAndSetEventType(v: string)     { eventTypeRef.current = v;     setEventType(v) }
  function syncAndSetDescription(v: string)   { descriptionRef.current = v;   setDescription(v) }
  function syncAndSetSpecialGuests(v: string) { specialGuestsRef.current = v; setSpecialGuests(v) }
  function syncAndSetStartDate(v: string)     { startDateRef.current = v;     setStartDate(v) }
  function syncAndSetEndDate(v: string)       { endDateRef.current = v;       setEndDate(v) }
  function syncAndSetEventHours(v: string)    { eventHoursRef.current = v;    setEventHours(v) }
  function syncAndSetCapacity(v: string)      { capacityRef.current = v;      setCapacity(v) }
  function syncAndSetTicketPrice(v: string)   { ticketPriceRef.current = v;   setTicketPrice(v) }
  function syncAndSetDiscount(v: string)      { discountRef.current = v;      setDiscount(v) }
  function syncAndSetCoverImage(v: string | null) { coverImageRef.current = v; setCoverImage(v) }
  function syncAndSetBookingType(v: 'ticket' | 'reservation') { bookingTypeRef.current = v; setBookingType(v) }

  const finalPrice = (() => {
    const base = parseFloat(ticketPrice) || 0
    const disc = parseFloat(discount) || 0
    if (base <= 0) return ''
    return (base - (base * disc) / 100).toFixed(2)
  })()

  // ── Load existing event ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setLoading(false); return }
    supabase
      .from('events')
      .select('*')
      .eq('event_id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Error', 'Could not load event.')
          replaceManagerRoute(router, MANAGER_EVENTS)
          return
        }
        syncAndSetCoverImage(data.event_image ?? null)
        syncAndSetName(data.event_name ?? '')
        syncAndSetEventType(data.event_type ?? '')
        syncAndSetDescription(data.event_description ?? '')
        syncAndSetSpecialGuests(data.special_guests ?? '')
        syncAndSetStartDate(dbDateToDdMmYyyy(data.event_starting_date))
        syncAndSetEndDate(dbDateToDdMmYyyy(data.event_ending_date))
        syncAndSetEventHours(data.event_hours ?? '')
        syncAndSetCapacity(data.event_capacity != null ? String(data.event_capacity) : '')
        syncAndSetTicketPrice(data.ticket_price != null ? String(data.ticket_price) : '')
        syncAndSetDiscount(data.ticket_discount != null ? String(data.ticket_discount) : '')
        setIsFeatured(data.is_featured ?? false)
        setFeaturedRequestStatus(data.featured_request_status ?? 'none')
        setFeaturedRejectionReason(data.featured_rejection_reason ?? null)
        syncAndSetBookingType(data.reservation_only ? 'reservation' : 'ticket')
        setEventStatus((data.event_status as EventStatus) ?? 'draft')
        setLoading(false)
      })
  }, [id, router])

  // ── Image picker ──────────────────────────────────────────────────────────
  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const asset    = result.assets[0]
      const ext      = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `event-${profile?.club_id}-${Date.now()}.${ext}`

      const response    = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName)
      syncAndSetCoverImage(urlData.publicUrl)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(overrideStatus?: EventStatus) {
    // Read from refs — guaranteed to have the latest typed values
    const currentName        = nameRef.current
    const currentEventType   = eventTypeRef.current
    const currentDescription = descriptionRef.current
    const currentGuests      = specialGuestsRef.current
    const currentStartDate   = startDateRef.current
    const currentEndDate     = endDateRef.current
    const currentHours       = eventHoursRef.current
    const currentCapacity    = capacityRef.current
    const currentTicketPrice = ticketPriceRef.current
    const currentDiscount    = discountRef.current
    const currentImage       = coverImageRef.current
    const currentBooking     = bookingTypeRef.current

    if (!currentName.trim()) { Alert.alert('Validation', 'Event name is required.'); return }
    if (!id)                  { Alert.alert('Error', 'No event ID found.'); return }

    const isoStart = ddMmYyyyToIsoDate(currentStartDate)
    if (!isoStart) {
      Alert.alert('Validation', 'Start date is invalid. Use the calendar to pick a date.')
      return
    }
    const isoEnd = currentEndDate.trim() ? ddMmYyyyToIsoDate(currentEndDate) : null
    if (currentEndDate.trim() && !isoEnd) {
      Alert.alert('Validation', 'End date is invalid. Use the calendar to pick a date.')
      return
    }

    const isReservation = currentBooking === 'reservation'
    const base  = isReservation || currentTicketPrice === '' ? null : parseFloat(currentTicketPrice)
    const disc  = isReservation || currentDiscount    === '' ? null : parseFloat(currentDiscount)
    const final = !isReservation && base != null && base > 0
      ? parseFloat((base - (base * (disc ?? 0)) / 100).toFixed(2))
      : null
    const status = overrideStatus ?? eventStatus

    setSaving(true)
    try {
      const payload = {
        event_name:          currentName.trim(),
        event_type:          currentEventType || null,
        event_description:   currentDescription.trim() || null,
        special_guests:      currentGuests.trim() || null,
        event_starting_date: isoStart,
        event_ending_date:   isoEnd,
        event_hours:         currentHours.trim() || null,
        event_capacity:      currentCapacity !== '' ? parseInt(currentCapacity) : null,
        ticket_price:        base,
        ticket_discount:     disc,
        final_ticket_price:  final,
        reservation_only:    isReservation,
        event_image:         currentImage,
        event_status:        status,
        updated_at:          new Date().toISOString(),
      }

      const { data: updated, error } = await supabase
        .from('events')
        .update(payload)
        .eq('event_id', id)
        .select('event_id, ticket_price, final_ticket_price')

      if (error) throw error

      if (!updated || updated.length === 0) {
        Alert.alert('Permission Denied', 'Your account does not have permission to edit this event.')
        return
      }

      const label = status === 'published' ? 'Event Published!' : status === 'draft' ? 'Draft Saved' : 'Event Updated'
      Alert.alert(label, 'Your changes have been saved.', [
        { text: 'OK', onPress: () => replaceManagerRoute(router, MANAGER_EVENTS) },
      ])
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update event.')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_EVENTS)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
          {/* Current status badge */}
          <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[eventStatus] + '22' }]}>
            <Text style={[s.statusText, { color: STATUS_COLOR[eventStatus] }]}>
              {eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1)}
            </Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Edit Event</Text>
        <Text style={s.pageSubtitle}>Update your event details</Text>

        {/* Cover Image */}
        <SectionLabel>Cover Image</SectionLabel>
        <TouchableOpacity style={s.imageBox} onPress={handlePickImage} activeOpacity={0.8}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={s.coverImg} contentFit="cover" />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="cloud-upload-outline" size={36} color={COLORS.mutedDark} />
              <Text style={s.imagePlaceholderText}>Tap to upload cover image</Text>
            </View>
          )}
          {uploading && (
            <View style={s.uploadOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={s.uploadingText}>Uploading…</Text>
            </View>
          )}
        </TouchableOpacity>
        {coverImage && (
          <TouchableOpacity style={s.changeImgBtn} onPress={handlePickImage} disabled={uploading}>
            <Ionicons name="image-outline" size={15} color={COLORS.white} />
            <Text style={s.changeImgText}>Change Image</Text>
          </TouchableOpacity>
        )}

        {/* Basic Info */}
        <SectionLabel>Event Information</SectionLabel>

        <FieldLabel>Event Name *</FieldLabel>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={syncAndSetName}
          placeholder="e.g. Saturday Night Fever"
          placeholderTextColor={COLORS.mutedDark}
        />

        <FieldLabel>Event Type</FieldLabel>
        <View style={s.pillRow}>
          {EVENT_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[s.pill, eventType === t && s.pillActive]}
              onPress={() => syncAndSetEventType(t)}
            >
              <Text style={[s.pillText, eventType === t && s.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel>Description</FieldLabel>
        <TextInput
          style={[s.input, s.textarea]}
          value={description}
          onChangeText={syncAndSetDescription}
          placeholder="Tell attendees what to expect…"
          placeholderTextColor={COLORS.mutedDark}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <FieldLabel>Special Guests</FieldLabel>
        <TextInput
          style={s.input}
          value={specialGuests}
          onChangeText={syncAndSetSpecialGuests}
          placeholder="DJ John, Artist Name…"
          placeholderTextColor={COLORS.mutedDark}
        />

        {/* Date & Time */}
        <SectionLabel>Date & Time</SectionLabel>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Start Date</FieldLabel>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={startDate ? COLORS.white : COLORS.mutedDark} />
              <Text style={[s.dateBtnText, !startDate && s.datePlaceholder]}>
                {startDate || 'DD/MM/YYYY'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>End Date</FieldLabel>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={endDate ? COLORS.white : COLORS.mutedDark} />
              <Text style={[s.dateBtnText, !endDate && s.datePlaceholder]}>
                {endDate || 'DD/MM/YYYY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <DatePickerModal
          visible={showStartPicker}
          value={startDate}
          label="Select Start Date"
          onClose={() => setShowStartPicker(false)}
          onSelect={d => { syncAndSetStartDate(d); setShowStartPicker(false) }}
        />
        <DatePickerModal
          visible={showEndPicker}
          value={endDate}
          label="Select End Date"
          onClose={() => setShowEndPicker(false)}
          onSelect={d => { syncAndSetEndDate(d); setShowEndPicker(false) }}
        />

        <FieldLabel>Event Hours</FieldLabel>
        <TextInput
          style={s.input}
          value={eventHours}
          onChangeText={syncAndSetEventHours}
          placeholder="22:00 – 05:00"
          placeholderTextColor={COLORS.mutedDark}
        />

        {/* Booking model */}
        <SectionLabel>Booking Model</SectionLabel>
        <View style={s.choiceRow}>
          <TouchableOpacity
            style={[s.choiceCard, bookingType === 'ticket' && s.choiceCardActive]}
            onPress={() => syncAndSetBookingType('ticket')}
            activeOpacity={0.85}
          >
            <Ionicons name="ticket-outline" size={22} color={bookingType === 'ticket' ? COLORS.purple : COLORS.muted} />
            <Text style={[s.choiceTitle, bookingType === 'ticket' && s.choiceTitleActive]}>Ticketed</Text>
            <Text style={s.choiceSub}>Guests pay per ticket. QR code per attendee.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.choiceCard, bookingType === 'reservation' && s.choiceCardActive]}
            onPress={() => syncAndSetBookingType('reservation')}
            activeOpacity={0.85}
          >
            <Ionicons name="restaurant-outline" size={22} color={bookingType === 'reservation' ? COLORS.purple : COLORS.muted} />
            <Text style={[s.choiceTitle, bookingType === 'reservation' && s.choiceTitleActive]}>Reservation</Text>
            <Text style={s.choiceSub}>Free table reservations, paid in venue.</Text>
          </TouchableOpacity>
        </View>

        {/* Tickets / Capacity */}
        <SectionLabel>{bookingType === 'ticket' ? 'Tickets & Capacity' : 'Capacity'}</SectionLabel>

        {bookingType === 'ticket' ? (
          <>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Capacity</FieldLabel>
                <TextInput
                  style={s.input}
                  value={capacity}
                  onChangeText={syncAndSetCapacity}
                  placeholder="500"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Ticket Price (€)</FieldLabel>
                <TextInput
                  style={s.input}
                  value={ticketPrice}
                  onChangeText={syncAndSetTicketPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Discount (%)</FieldLabel>
                <TextInput
                  style={s.input}
                  value={discount}
                  onChangeText={syncAndSetDiscount}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Final Price (€)</FieldLabel>
                <View style={[s.input, s.readonlyField]}>
                  <Text style={finalPrice ? s.readonlyText : s.readonlyPlaceholder}>
                    {finalPrice || '–'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            <FieldLabel>Capacity</FieldLabel>
            <TextInput
              style={s.input}
              value={capacity}
              onChangeText={syncAndSetCapacity}
              placeholder="500"
              placeholderTextColor={COLORS.mutedDark}
              keyboardType="numeric"
            />
            <View style={s.reserveNotice}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.green} />
              <Text style={s.reserveNoticeText}>Guests will reserve a table for free; payment is handled at the venue.</Text>
            </View>
          </>
        )}

        {/* Featured placement */}
        <SectionLabel>Featured placement</SectionLabel>
        <View style={s.featureInfoBox}>
          <Ionicons
            name={isFeatured ? 'star' : 'star-outline'}
            size={18}
            color={isFeatured ? COLORS.cta : COLORS.mutedDark}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>
              {isFeatured ? 'Approved featured event' : featuredRequestStatus === 'pending_review' ? 'Waiting for admin approval' : 'Not featured'}
            </Text>
            <Text style={s.toggleSublabel}>
              Request paid featured placement from Event Management after saving.
            </Text>
            {featuredRequestStatus === 'rejected' && featuredRejectionReason ? (
              <Text style={s.rejectionText}>Admin note: {featuredRejectionReason}</Text>
            ) : null}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          {eventStatus !== 'draft' && (
            <TouchableOpacity
              style={[s.draftBtn, saving && { opacity: 0.6 }]}
              onPress={() => handleSave('draft')}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <><Ionicons name="save-outline" size={16} color={COLORS.white} /><Text style={s.draftBtnText}>Revert to Draft</Text></>
              }
            </TouchableOpacity>
          )}
          {eventStatus === 'draft' && (
            <TouchableOpacity
              style={[s.draftBtn, saving && { opacity: 0.6 }]}
              onPress={() => handleSave('draft')}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <><Ionicons name="save-outline" size={16} color={COLORS.white} /><Text style={s.draftBtnText}>Save Draft</Text></>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.publishBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSave('published')}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="rocket-outline" size={16} color="#fff" /><Text style={s.publishBtnText}>
                  {eventStatus === 'published' ? 'Save Changes' : 'Publish'}
                </Text></>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={sl.text}>{children}</Text>
}
const sl = StyleSheet.create({
  text: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.lg, marginBottom: SPACING.sm },
})

function FieldLabel({ children }: { children: string }) {
  return <Text style={fl.text}>{children}</Text>
}
const fl = StyleSheet.create({
  text: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
})

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:  { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:     { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  statusBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: '700' },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.sm },

  imageBox: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.border, height: 180, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  coverImg:            { width: '100%', height: '100%' },
  imagePlaceholder:    { alignItems: 'center', gap: SPACING.sm },
  imagePlaceholderText:{ color: COLORS.mutedDark, fontSize: FONT.sm },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  uploadingText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },
  changeImgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, padding: SPACING.sm + 4,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  changeImgText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '500' },

  input: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4, color: COLORS.white, fontSize: FONT.base,
    marginBottom: SPACING.md,
  },
  textarea: { minHeight: 100, paddingTop: SPACING.sm + 4 },
  row2: { flexDirection: 'row', gap: SPACING.sm },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4, marginBottom: SPACING.md,
  },
  dateBtnText:    { color: COLORS.white, fontSize: FONT.base, flex: 1 },
  datePlaceholder:{ color: COLORS.mutedDark },

  readonlyField:       { justifyContent: 'center' },
  readonlyText:        { color: COLORS.purple, fontSize: FONT.base, fontWeight: '700' },
  readonlyPlaceholder: { color: COLORS.mutedDark, fontSize: FONT.base },

  pillRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  pill:          { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  pillActive:    { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  pillText:      { color: COLORS.muted, fontSize: FONT.sm },
  pillTextActive:{ color: '#fff', fontWeight: '600' },

  toggleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.md },
  featureInfoBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cta + '44', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.md },
  toggleLabel:   { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '500' },
  toggleSublabel:{ color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  rejectionText: { color: COLORS.red, fontSize: 12, marginTop: 4 },

  actionRow:    { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  draftBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, paddingVertical: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  draftBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },
  publishBtn:   { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  publishBtnText:{ color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  choiceRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  choiceCard:       { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6 },
  choiceCardActive: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.08)' },
  choiceTitle:      { color: COLORS.muted, fontSize: FONT.base, fontWeight: '700' },
  choiceTitleActive:{ color: COLORS.white },
  choiceSub:        { color: COLORS.mutedDark, fontSize: 12, lineHeight: 16 },
  reserveNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    marginBottom: SPACING.md,
  },
  reserveNoticeText: { color: COLORS.green, fontSize: FONT.sm, flex: 1, lineHeight: FONT.sm * 1.4 },
})
