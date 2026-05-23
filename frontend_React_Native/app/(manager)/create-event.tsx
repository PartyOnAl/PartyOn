import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import DatePickerModal from '@/components/DatePickerModal'
import TimePickerModal from '@/components/TimePickerModal'
import { MANAGER_EVENTS, replaceManagerRoute } from '@/lib/managerNavigation'

const EVENT_TYPES = ['Party', 'DJ Night', 'Concert', 'Live Music', 'Festival', 'Private Event', 'Other']

const STEPS = ['Basics', 'Schedule', 'Pricing', 'Review'] as const
type StepIdx = 0 | 1 | 2 | 3

// Convert DD/MM/YYYY (picker display) → YYYY-MM-DD (Postgres date format).
function toIsoDate(s: string): string | null {
  const trimmed = s.trim()
  if (!trimmed) return null
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const day   = parseInt(dd, 10)
  const month = parseInt(mm, 10)
  const year  = parseInt(yyyy, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return `${yyyy}-${mm}-${dd}`
}

// Compose ISO datetime (DD/MM/YYYY + HH:MM) -> full timestamptz string.
function composeIsoDateTime(displayDate: string, time: string): string | null {
  const iso = toIsoDate(displayDate)
  if (!iso) return null
  const t = /^(\d{2}):(\d{2})$/.exec(time || '')
  const hh = t ? t[1] : '00'
  const mm = t ? t[2] : '00'
  return `${iso}T${hh}:${mm}:00`
}

function parseDDMMYYYY(s: string): Date | null {
  const iso = toIsoDate(s)
  if (!iso) return null
  return new Date(iso + 'T00:00:00')
}

export default function CreateEventScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [step, setStep]             = useState<StepIdx>(0)
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [userTouched, setUserTouched] = useState(false)
  const [defaultsBannerVisible, setDefaultsBannerVisible] = useState(false)

  // Cover image
  const [coverImage, setCoverImage] = useState<string | null>(null)

  // Basic info
  const [name, setName]                   = useState('')
  const [eventType, setEventType]         = useState('')
  const [description, setDescription]     = useState('')
  const [specialGuests, setSpecialGuests] = useState('')

  // Date & time
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [startTime, setStartTime] = useState('22:00')
  const [endTime, setEndTime]     = useState('05:00')

  // Booking model
  const [bookingType, setBookingType] = useState<'ticket' | 'reservation'>('ticket')

  // Tickets
  const [capacity, setCapacity]         = useState('')
  const [ticketPrice, setTicketPrice]   = useState('')
  const [discount, setDiscount]         = useState('')
  const [finalPriceInput, setFinalPriceInput] = useState('')
  // `finalPriceSource` tracks which field was last edited so we auto-derive the other.
  const finalPriceSource = useRef<'discount' | 'final'>('discount')

  // Pickers
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker,   setShowEndDatePicker]   = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker,   setShowEndTimePicker]   = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Pre-fill from last event ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function loadDefaults() {
      if (!profile?.club_id || userTouched) return
      const { data } = await supabase
        .from('events')
        .select('event_type, event_capacity, ticket_price, ticket_discount, reservation_only')
        .eq('club_id', profile.club_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || !data || userTouched) return
      let applied = false
      if (data.event_type)                            { setEventType(data.event_type);                             applied = true }
      if (data.event_capacity != null)                { setCapacity(String(data.event_capacity));                  applied = true }
      if (data.ticket_price != null)                  { setTicketPrice(String(data.ticket_price));                 applied = true }
      if (data.ticket_discount != null)               { setDiscount(String(data.ticket_discount));                 applied = true }
      if (typeof data.reservation_only === 'boolean') { setBookingType(data.reservation_only ? 'reservation' : 'ticket'); applied = true }
      if (applied) setDefaultsBannerVisible(true)
    }
    loadDefaults()
    return () => { cancelled = true }
  }, [profile?.club_id, userTouched])

  // Mark user-touched on any meaningful change so we don't clobber edits with defaults.
  function touch<T>(setter: (v: T) => void) {
    return (v: T) => { setUserTouched(true); setter(v) }
  }

  // ── Bidirectional discount <-> final price ─────────────────────────────────
  const computedFinal = useMemo(() => {
    const base = parseFloat(ticketPrice) || 0
    if (base <= 0) return ''
    if (finalPriceSource.current === 'final') {
      const f = parseFloat(finalPriceInput)
      if (!isFinite(f)) return ''
      return f.toFixed(2)
    }
    const d = Math.min(100, Math.max(0, parseFloat(discount) || 0))
    return (base - (base * d) / 100).toFixed(2)
  }, [ticketPrice, discount, finalPriceInput])

  // If discount was last edited, mirror computed final into the user-visible input
  useEffect(() => {
    if (finalPriceSource.current === 'discount') setFinalPriceInput(computedFinal)
  }, [computedFinal])

  // If final was last edited, back-derive discount %
  function onChangeFinal(v: string) {
    setUserTouched(true)
    finalPriceSource.current = 'final'
    setFinalPriceInput(v)
    const base = parseFloat(ticketPrice) || 0
    const f    = parseFloat(v)
    if (base > 0 && isFinite(f)) {
      const d = Math.max(0, Math.min(100, ((base - f) / base) * 100))
      setDiscount(d === 0 ? '0' : d.toFixed(2).replace(/\.?0+$/, ''))
    }
  }

  function onChangeDiscount(v: string) {
    setUserTouched(true)
    finalPriceSource.current = 'discount'
    const clamped = v === '' ? '' : String(Math.max(0, Math.min(100, parseFloat(v) || 0)))
    setDiscount(clamped)
  }

  const savedAmount = (() => {
    const base = parseFloat(ticketPrice) || 0
    const f    = parseFloat(computedFinal) || 0
    if (base <= 0 || f >= base) return 0
    return base - f
  })()

  // ── Image upload ───────────────────────────────────────────────────────────
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
      setUserTouched(true)
      setCoverImage(urlData.publicUrl)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateStep(s: StepIdx): Record<string, string> {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!name.trim())   e.name      = 'Event name is required.'
      if (!eventType)     e.eventType = 'Pick an event type.'
    }
    if (s === 1) {
      if (!startDate.trim()) e.startDate = 'Start date is required.'
      else if (!toIsoDate(startDate)) e.startDate = 'Use DD/MM/YYYY.'
      if (endDate.trim() && !toIsoDate(endDate)) e.endDate = 'Use DD/MM/YYYY.'
      const sd = parseDDMMYYYY(startDate)
      const ed = parseDDMMYYYY(endDate)
      if (sd && ed && ed.getTime() < sd.getTime()) e.endDate = 'End date is before start date.'
      if (!/^\d{2}:\d{2}$/.test(startTime)) e.startTime = 'Pick a start time.'
      if (!/^\d{2}:\d{2}$/.test(endTime))   e.endTime   = 'Pick an end time.'
    }
    if (s === 2) {
      const capN  = capacity ? parseInt(capacity, 10) : NaN
      if (capacity && (isNaN(capN) || capN < 1 || capN > 100000)) e.capacity = 'Capacity must be 1 - 100,000.'

      if (bookingType === 'ticket') {
        const priceN = ticketPrice ? parseFloat(ticketPrice) : NaN
        if (ticketPrice && (isNaN(priceN) || priceN < 0))     e.ticketPrice = 'Price must be 0 or more.'
        const discN = discount ? parseFloat(discount) : NaN
        if (discount && (isNaN(discN) || discN < 0 || discN > 100)) e.discount = 'Discount must be 0 - 100.'
      }
    }
    return e
  }

  function next() {
    const e = validateStep(step)
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setStep(s => Math.min(3, s + 1) as StepIdx)
  }
  function back() {
    setErrors({})
    if (step === 0) { router.back(); return }
    setStep(s => Math.max(0, s - 1) as StepIdx)
  }
  function goTo(s: StepIdx) {
    if (s <= step) { setErrors({}); setStep(s); return }
    // Forward only after validating intermediate steps
    for (let i = step; i < s; i++) {
      const e = validateStep(i as StepIdx)
      if (Object.keys(e).length > 0) { setErrors(e); setStep(i as StepIdx); return }
    }
    setErrors({})
    setStep(s)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(status: 'draft' | 'published') {
    // Final validation across all steps
    const all = { ...validateStep(0), ...validateStep(1), ...validateStep(2) }
    if (Object.keys(all).length > 0) {
      setErrors(all)
      const firstErrorStep: StepIdx =
        all.name || all.eventType ? 0 :
        all.startDate || all.endDate || all.startTime || all.endTime ? 1 : 2
      setStep(firstErrorStep)
      Alert.alert('Please fix errors', 'Some fields need your attention before saving.')
      return
    }

    if (!profile?.club_id) { Alert.alert('Error', 'No club associated with your account.'); return }

    setSaving(true)
    try {
      const isReservation = bookingType === 'reservation'
      const base  = isReservation ? 0 : (parseFloat(ticketPrice) || 0)
      const disc  = isReservation ? 0 : (parseFloat(discount) || 0)
      const final = !isReservation && base > 0
        ? parseFloat((parseFloat(computedFinal) || (base - (base * disc) / 100)).toFixed(2))
        : 0

      const startIso = composeIsoDateTime(startDate, startTime)
      const endIso   = endDate ? composeIsoDateTime(endDate, endTime || startTime) : null

      if (!startIso) {
        setSaving(false)
        Alert.alert('Validation', 'Start date or time is invalid.')
        return
      }

      const { error } = await supabase.from('events').insert({
        club_id:             profile.club_id,
        event_name:          name.trim(),
        event_type:          eventType,
        event_description:   description.trim() || null,
        special_guests:      specialGuests.trim() || null,
        event_starting_date: startIso,
        event_ending_date:   endIso,
        event_hours:         (startTime && endTime) ? `${startTime} – ${endTime}` : null,
        event_capacity:      capacity ? parseInt(capacity, 10) : null,
        ticket_price:        isReservation ? null : (base || null),
        ticket_discount:     isReservation ? null : (disc || null),
        final_ticket_price:  isReservation ? null : (final || null),
        reservation_only:    isReservation,
        event_image:         coverImage,
        is_featured:         false,
        featured_request_status: 'none',
        event_status:        status,
        created_by:          profile.id ?? null,
      })

      if (error) throw error

      Alert.alert(
        status === 'published' ? 'Event Published!' : 'Draft Saved',
        status === 'published' ? 'Your event is now live.' : 'Your event has been saved as a draft.',
        [{ text: 'OK', onPress: () => replaceManagerRoute(router, MANAGER_EVENTS) }],
      )
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save event.')
    } finally {
      setSaving(false)
    }
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function ErrorText({ id }: { id: string }) {
    if (!errors[id]) return null
    return <Text style={s.errorText}>{errors[id]}</Text>
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={back} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Create Event</Text>
        <Text style={s.pageSubtitle}>Step {step + 1} of {STEPS.length} - {STEPS[step]}</Text>

        {/* Stepper */}
        <View style={s.stepper}>
          {STEPS.map((label, i) => {
            const active   = i === step
            const done     = i < step
            return (
              <TouchableOpacity key={label} style={{ flex: 1, alignItems: 'center' }} onPress={() => goTo(i as StepIdx)} activeOpacity={0.85}>
                <View style={[s.stepDot, active && s.stepDotActive, done && s.stepDotDone]}>
                  {done
                    ? <Ionicons name="checkmark" size={14} color="#fff" />
                    : <Text style={[s.stepDotText, active && { color: '#fff' }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, (active || done) && s.stepLabelActive]} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        {/* Defaults banner */}
        {defaultsBannerVisible && step === 0 && (
          <View style={s.defaultsBanner}>
            <Ionicons name="sparkles-outline" size={16} color={COLORS.purple} />
            <Text style={s.defaultsBannerText}>Pre-filled from your last event.</Text>
            <TouchableOpacity onPress={() => setDefaultsBannerVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 0: Basics ───────────────────────────────────────────────── */}
        {step === 0 && (
          <>
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

            <SectionLabel>Event Information</SectionLabel>

            <FieldLabel>Event Name *</FieldLabel>
            <TextInput
              style={[s.input, errors.name && s.inputError]}
              value={name}
              onChangeText={touch(setName)}
              placeholder="e.g. Saturday Night Fever"
              placeholderTextColor={COLORS.mutedDark}
            />
            <ErrorText id="name" />

            <FieldLabel>Event Type *</FieldLabel>
            <View style={[s.pillRow, errors.eventType && s.pillRowError]}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.pill, eventType === t && s.pillActive]}
                  onPress={() => { setUserTouched(true); setEventType(t) }}
                >
                  <Text style={[s.pillText, eventType === t && s.pillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ErrorText id="eventType" />

            <FieldLabel>Description</FieldLabel>
            <TextInput
              style={[s.input, s.textarea]}
              value={description}
              onChangeText={touch(setDescription)}
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
              onChangeText={touch(setSpecialGuests)}
              placeholder="DJ John, Artist Name…"
              placeholderTextColor={COLORS.mutedDark}
            />
          </>
        )}

        {/* ── STEP 1: Schedule ────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <SectionLabel>Date</SectionLabel>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Start Date *</FieldLabel>
                <TouchableOpacity style={[s.dateBtn, errors.startDate && s.inputError]} onPress={() => setShowStartDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={startDate ? COLORS.white : COLORS.mutedDark} />
                  <Text style={[s.dateBtnText, !startDate && s.datePlaceholder]}>
                    {startDate || 'DD/MM/YYYY'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>End Date</FieldLabel>
                <TouchableOpacity style={[s.dateBtn, errors.endDate && s.inputError]} onPress={() => setShowEndDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={16} color={endDate ? COLORS.white : COLORS.mutedDark} />
                  <Text style={[s.dateBtnText, !endDate && s.datePlaceholder]}>
                    {endDate || 'DD/MM/YYYY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <ErrorText id="startDate" />
            <ErrorText id="endDate" />

            <SectionLabel>Time</SectionLabel>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Start Time</FieldLabel>
                <TouchableOpacity style={[s.dateBtn, errors.startTime && s.inputError]} onPress={() => setShowStartTimePicker(true)}>
                  <Ionicons name="time-outline" size={16} color={COLORS.white} />
                  <Text style={s.dateBtnText}>{startTime}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel>End Time</FieldLabel>
                <TouchableOpacity style={[s.dateBtn, errors.endTime && s.inputError]} onPress={() => setShowEndTimePicker(true)}>
                  <Ionicons name="time-outline" size={16} color={COLORS.white} />
                  <Text style={s.dateBtnText}>{endTime}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ErrorText id="startTime" />
            <ErrorText id="endTime" />

            <SectionLabel>Booking Model</SectionLabel>
            <View style={s.choiceRow}>
              <TouchableOpacity
                style={[s.choiceCard, bookingType === 'ticket' && s.choiceCardActive]}
                onPress={() => { setUserTouched(true); setBookingType('ticket') }}
                activeOpacity={0.85}
              >
                <Ionicons name="ticket-outline" size={22} color={bookingType === 'ticket' ? COLORS.purple : COLORS.muted} />
                <Text style={[s.choiceTitle, bookingType === 'ticket' && s.choiceTitleActive]}>Ticketed</Text>
                <Text style={s.choiceSub}>Guests pay per ticket. QR code per attendee.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.choiceCard, bookingType === 'reservation' && s.choiceCardActive]}
                onPress={() => { setUserTouched(true); setBookingType('reservation') }}
                activeOpacity={0.85}
              >
                <Ionicons name="restaurant-outline" size={22} color={bookingType === 'reservation' ? COLORS.purple : COLORS.muted} />
                <Text style={[s.choiceTitle, bookingType === 'reservation' && s.choiceTitleActive]}>Reservation</Text>
                <Text style={s.choiceSub}>Free table reservations, paid in venue.</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2: Pricing ─────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <SectionLabel>{bookingType === 'ticket' ? 'Tickets & Capacity' : 'Capacity'}</SectionLabel>

            {bookingType === 'ticket' ? (
              <>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Capacity</FieldLabel>
                    <TextInput
                      style={[s.input, errors.capacity && s.inputError]}
                      value={capacity}
                      onChangeText={touch(setCapacity)}
                      placeholder="500"
                      placeholderTextColor={COLORS.mutedDark}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Ticket Price (€)</FieldLabel>
                    <TextInput
                      style={[s.input, errors.ticketPrice && s.inputError]}
                      value={ticketPrice}
                      onChangeText={touch(setTicketPrice)}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.mutedDark}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <ErrorText id="capacity" />
                <ErrorText id="ticketPrice" />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Discount (%)</FieldLabel>
                    <TextInput
                      style={[s.input, errors.discount && s.inputError]}
                      value={discount}
                      onChangeText={onChangeDiscount}
                      placeholder="0"
                      placeholderTextColor={COLORS.mutedDark}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Final Price (€)</FieldLabel>
                    <TextInput
                      style={s.input}
                      value={finalPriceInput}
                      onChangeText={onChangeFinal}
                      placeholder={computedFinal || '–'}
                      placeholderTextColor={COLORS.mutedDark}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <ErrorText id="discount" />

                {savedAmount > 0 && (
                  <Text style={s.savesText}>
                    Saves €{savedAmount.toFixed(2)} per ticket.
                  </Text>
                )}
              </>
            ) : (
              <>
                <FieldLabel>Capacity</FieldLabel>
                <TextInput
                  style={[s.input, errors.capacity && s.inputError]}
                  value={capacity}
                  onChangeText={touch(setCapacity)}
                  placeholder="500"
                  placeholderTextColor={COLORS.mutedDark}
                  keyboardType="numeric"
                />
                <ErrorText id="capacity" />
                <View style={s.reserveNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.green} />
                  <Text style={s.reserveNoticeText}>Guests will reserve a table for free; payment is handled at the venue.</Text>
                </View>
              </>
            )}

            <SectionLabel>Featured placement</SectionLabel>
            <View style={s.featureInfoBox}>
              <Ionicons name="star-outline" size={18} color={COLORS.cta} />
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Request after publishing</Text>
                <Text style={s.toggleSublabel}>Featured placement is paid and reviewed by PartyOn admin from Event Management.</Text>
              </View>
            </View>
          </>
        )}

        {/* ── STEP 3: Review ─────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <SectionLabel>Review</SectionLabel>

            {coverImage && (
              <View style={s.reviewImageWrap}>
                <Image source={{ uri: coverImage }} style={s.reviewImage} contentFit="cover" />
              </View>
            )}

            <SummaryCard title={name || '(no name)'} sub={eventType || 'No type'}>
              {description ? <Text style={s.summaryBody}>{description}</Text> : null}
              {specialGuests ? <Text style={s.summaryMeta}>Special guests: {specialGuests}</Text> : null}
            </SummaryCard>

            <SummaryCard title="Schedule" sub={startDate ? `${startDate} • ${startTime} – ${endTime}` : 'No date'}>
              {endDate ? <Text style={s.summaryMeta}>Ends: {endDate}</Text> : null}
              <Text style={s.summaryMeta}>
                {bookingType === 'ticket' ? 'Ticketed event' : 'Reservation-only event'}
              </Text>
            </SummaryCard>

            <SummaryCard
              title={bookingType === 'ticket' ? 'Pricing' : 'Capacity'}
              sub={
                bookingType === 'ticket'
                  ? `€${computedFinal || '0.00'} per ticket${capacity ? ` • cap ${capacity}` : ''}`
                  : (capacity ? `Capacity ${capacity}` : 'No capacity set')
              }
            >
              {bookingType === 'ticket' && ticketPrice ? (
                <Text style={s.summaryMeta}>
                  Base €{parseFloat(ticketPrice).toFixed(2)}{discount && parseFloat(discount) > 0 ? ` • ${discount}% off` : ''}
                </Text>
              ) : null}
              <Text style={[s.summaryMeta, { color: COLORS.cta }]}>Featured placement can be requested after publishing.</Text>
            </SummaryCard>
          </>
        )}

        {/* ── Footer actions ──────────────────────────────────────────────── */}
        {step < 3 ? (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.draftBtn} onPress={back}>
              <Ionicons name="chevron-back" size={16} color={COLORS.white} />
              <Text style={s.draftBtnText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.publishBtn} onPress={next}>
              <Text style={s.publishBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
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
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      <DatePickerModal
        visible={showStartDatePicker}
        value={startDate}
        label="Select Start Date"
        onClose={() => setShowStartDatePicker(false)}
        onSelect={d => { setUserTouched(true); setStartDate(d); setShowStartDatePicker(false) }}
      />
      <DatePickerModal
        visible={showEndDatePicker}
        value={endDate}
        label="Select End Date"
        onClose={() => setShowEndDatePicker(false)}
        onSelect={d => { setUserTouched(true); setEndDate(d); setShowEndDatePicker(false) }}
      />
      <TimePickerModal
        visible={showStartTimePicker}
        value={startTime}
        label="Select Start Time"
        onClose={() => setShowStartTimePicker(false)}
        onSelect={t => { setUserTouched(true); setStartTime(t) }}
      />
      <TimePickerModal
        visible={showEndTimePicker}
        value={endTime}
        label="Select End Time"
        onClose={() => setShowEndTimePicker(false)}
        onSelect={t => { setUserTouched(true); setEndTime(t) }}
      />
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

function SummaryCard({
  title, sub, children,
}: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <View style={sc.card}>
      <Text style={sc.title}>{title}</Text>
      <Text style={sc.sub}>{sub}</Text>
      {children}
    </View>
  )
}
const sc = StyleSheet.create({
  card:  { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md, gap: 4 },
  title: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  sub:   { color: COLORS.muted, fontSize: FONT.sm },
})

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },

  header:  { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:     { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.md },

  stepper:     { flexDirection: 'row', marginBottom: SPACING.sm, gap: 4 },
  stepDot:     { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepDotActive:{ backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  stepDotDone: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  stepDotText: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '700' },
  stepLabel:   { color: COLORS.mutedDark, fontSize: 11, fontWeight: '500' },
  stepLabelActive: { color: COLORS.white, fontWeight: '700' },

  progressTrack: { height: 3, backgroundColor: COLORS.bgCard, borderRadius: 2, marginBottom: SPACING.md, overflow: 'hidden' },
  progressFill:  { height: 3, backgroundColor: COLORS.purple, borderRadius: 2 },

  defaultsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.purple + '14', borderWidth: 1, borderColor: COLORS.purple + '44',
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  defaultsBannerText: { color: COLORS.purple, fontSize: FONT.sm, flex: 1, fontWeight: '500' },

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
  inputError: { borderColor: COLORS.red },
  textarea:   { minHeight: 100, paddingTop: SPACING.sm + 4 },
  errorText:  { color: COLORS.red, fontSize: 12, marginTop: -SPACING.sm, marginBottom: SPACING.md },

  row2: { flexDirection: 'row', gap: SPACING.sm },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4, marginBottom: SPACING.md,
  },
  dateBtnText:    { color: COLORS.white, fontSize: FONT.base, flex: 1 },
  datePlaceholder:{ color: COLORS.mutedDark },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  pillRowError: { borderRadius: RADIUS.sm },
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
  featureInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cta + '44',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
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

  savesText: { color: COLORS.green, fontSize: 12, marginTop: -SPACING.sm, marginBottom: SPACING.md },

  reviewImageWrap: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md, height: 160 },
  reviewImage:     { width: '100%', height: '100%' },

  summaryBody: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 4, lineHeight: 18 },
  summaryMeta: { color: COLORS.mutedDark, fontSize: 12, marginTop: 4 },
})
