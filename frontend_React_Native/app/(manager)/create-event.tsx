import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import DatePickerModal from '@/components/DatePickerModal'

const EVENT_TYPES = ['Party', 'DJ Night', 'Concert', 'Live Music', 'Festival', 'Private Event', 'Other']

export default function CreateEventScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)

  // Cover image
  const [coverImage, setCoverImage] = useState<string | null>(null)

  // Basic info
  const [name, setName]             = useState('')
  const [eventType, setEventType]   = useState('')
  const [description, setDescription] = useState('')
  const [specialGuests, setSpecialGuests] = useState('')

  // Date & time
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [eventHours, setEventHours] = useState('')

  // Booking model
  const [bookingType, setBookingType] = useState<'ticket' | 'reservation'>('ticket')

  // Tickets
  const [capacity, setCapacity]     = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [discount, setDiscount]     = useState('')

  // Flags
  const [isFeatured, setIsFeatured] = useState(false)

  // Calendar pickers
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker,   setShowEndPicker]   = useState(false)

  const finalPrice = (() => {
    const base = parseFloat(ticketPrice) || 0
    const disc = parseFloat(discount) || 0
    if (base <= 0) return ''
    const result = base - (base * disc) / 100
    return result.toFixed(2)
  })()

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const asset  = result.assets[0]
      const ext    = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `event-${profile?.club_id}-${Date.now()}.${ext}`

      const response    = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName)
      setCoverImage(urlData.publicUrl)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  function validate() {
    if (!name.trim())      { Alert.alert('Validation', 'Event name is required.'); return false }
    if (!eventType)        { Alert.alert('Validation', 'Please select an event type.'); return false }
    if (!startDate.trim()) { Alert.alert('Validation', 'Start date is required.'); return false }
    return true
  }

  async function handleSubmit(status: 'draft' | 'published') {
    if (!validate()) return
    if (!profile?.club_id) { Alert.alert('Error', 'No club associated with your account.'); return }

    setSaving(true)
    try {
      const isReservation = bookingType === 'reservation'
      const base = isReservation ? 0 : (parseFloat(ticketPrice) || 0)
      const disc = isReservation ? 0 : (parseFloat(discount) || 0)
      const final = !isReservation && base > 0 ? parseFloat((base - (base * disc) / 100).toFixed(2)) : 0

      const { error } = await supabase.from('events').insert({
        club_id:             profile.club_id,
        event_name:          name.trim(),
        event_type:          eventType,
        event_description:   description.trim() || null,
        special_guests:      specialGuests.trim() || null,
        event_starting_date: startDate.trim() || null,
        event_ending_date:   endDate.trim() || null,
        event_hours:         eventHours.trim() || null,
        event_capacity:      capacity ? parseInt(capacity) : null,
        ticket_price:        isReservation ? null : (base || null),
        ticket_discount:     isReservation ? null : (disc || null),
        final_ticket_price:  isReservation ? null : (final || null),
        reservation_only:    isReservation,
        event_image:         coverImage,
        is_featured:         isFeatured,
        event_status:        status,
        created_by:          profile.id ?? null,
      })

      if (error) throw error

      Alert.alert(
        status === 'published' ? 'Event Published!' : 'Draft Saved',
        status === 'published'
          ? 'Your event is now live.'
          : 'Your event has been saved as a draft.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>PartyOn</Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Create Event</Text>
        <Text style={s.pageSubtitle}>Fill in the details to publish or draft your event</Text>

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
          onChangeText={setName}
          placeholder="e.g. Saturday Night Fever"
          placeholderTextColor={COLORS.mutedDark}
        />

        <FieldLabel>Event Type *</FieldLabel>
        <View style={s.pillRow}>
          {EVENT_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[s.pill, eventType === t && s.pillActive]}
              onPress={() => setEventType(t)}
            >
              <Text style={[s.pillText, eventType === t && s.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FieldLabel>Description</FieldLabel>
        <TextInput
          style={[s.input, s.textarea]}
          value={description}
          onChangeText={setDescription}
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
          onChangeText={setSpecialGuests}
          placeholder="DJ John, Artist Name…"
          placeholderTextColor={COLORS.mutedDark}
        />

        {/* Date & Time */}
        <SectionLabel>Date & Time</SectionLabel>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Start Date *</FieldLabel>
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
          onSelect={d => { setStartDate(d); setShowStartPicker(false) }}
        />
        <DatePickerModal
          visible={showEndPicker}
          value={endDate}
          label="Select End Date"
          onClose={() => setShowEndPicker(false)}
          onSelect={d => { setEndDate(d); setShowEndPicker(false) }}
        />

        <FieldLabel>Event Hours</FieldLabel>
        <TextInput
          style={s.input}
          value={eventHours}
          onChangeText={setEventHours}
          placeholder="22:00 – 05:00"
          placeholderTextColor={COLORS.mutedDark}
        />

        {/* Booking model */}
        <SectionLabel>Booking Model</SectionLabel>
        <View style={s.choiceRow}>
          <TouchableOpacity
            style={[s.choiceCard, bookingType === 'ticket' && s.choiceCardActive]}
            onPress={() => setBookingType('ticket')}
            activeOpacity={0.85}
          >
            <Ionicons name="ticket-outline" size={22} color={bookingType === 'ticket' ? COLORS.purple : COLORS.muted} />
            <Text style={[s.choiceTitle, bookingType === 'ticket' && s.choiceTitleActive]}>Ticketed</Text>
            <Text style={s.choiceSub}>Guests pay per ticket. QR code per attendee.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.choiceCard, bookingType === 'reservation' && s.choiceCardActive]}
            onPress={() => setBookingType('reservation')}
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
                  onChangeText={setCapacity}
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
                  onChangeText={setTicketPrice}
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
                  onChangeText={setDiscount}
                  placeholder="0"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>Final Price (€)</FieldLabel>
                <View style={[s.input, s.readonlyField]}>
                  <Text style={finalPrice ? s.readonlyText : s.readonlyPlaceholder}>
                    {finalPrice ? finalPrice : '–'}
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
              onChangeText={setCapacity}
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

        {/* Flags */}
        <SectionLabel>Options</SectionLabel>
        <View style={s.toggleRow}>
          <View>
            <Text style={s.toggleLabel}>Feature this event</Text>
            <Text style={s.toggleSublabel}>Appears in the featured section</Text>
          </View>
          <Switch
            value={isFeatured}
            onValueChange={setIsFeatured}
            trackColor={{ false: COLORS.border, true: COLORS.purpleDark }}
            thumbColor={isFeatured ? COLORS.purple : COLORS.muted}
          />
        </View>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.draftBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSubmit('draft')}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <><Ionicons name="save-outline" size={16} color={COLORS.white} /><Text style={s.draftBtnText}>Save Draft</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.publishBtn, saving && { opacity: 0.6 }]}
            onPress={() => handleSubmit('published')}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="rocket-outline" size={16} color="#fff" /><Text style={s.publishBtnText}>Publish</Text></>
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

  header:  { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:     { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

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

  readonlyField: { justifyContent: 'center' },
  readonlyText:  { color: COLORS.purple, fontSize: FONT.base, fontWeight: '700' },
  readonlyPlaceholder: { color: COLORS.mutedDark, fontSize: FONT.base },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  pill: {
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  pillText:   { color: COLORS.muted, fontSize: FONT.sm },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  toggleLabel:    { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '500' },
  toggleSublabel: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  draftBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  draftBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  publishBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
  },
  publishBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  choiceRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  choiceCard: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  choiceCardActive: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.08)' },
  choiceTitle:    { color: COLORS.muted, fontSize: FONT.base, fontWeight: '700' },
  choiceTitleActive: { color: COLORS.white },
  choiceSub:      { color: COLORS.mutedDark, fontSize: 12, lineHeight: 16 },
  reserveNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    marginBottom: SPACING.md,
  },
  reserveNoticeText: { color: COLORS.green, fontSize: FONT.sm, flex: 1, lineHeight: FONT.sm * 1.4 },
})
