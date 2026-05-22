import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert, Modal, Pressable, Platform,
  TextInput, KeyboardAvoidingView, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Club, Event, Promotion } from '@/lib/types'
import {
  subscriptionPlanLabel,
  subscriptionPriceSuffix,
} from '@/lib/subscriptions'

// ── Status helpers ────────────────────────────────────────────────────────────
const CLUB_STATUS: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: 'rgba(245,166,35,0.15)',  text: '#f59e0b',    border: 'rgba(245,166,35,0.3)'  },
  approved:  { bg: 'rgba(16,185,129,0.15)',  text: COLORS.green, border: 'rgba(16,185,129,0.3)'  },
  rejected:  { bg: 'rgba(239,68,68,0.15)',   text: COLORS.red,   border: 'rgba(239,68,68,0.3)'   },
  suspended: { bg: 'rgba(156,163,175,0.15)', text: COLORS.muted, border: 'rgba(156,163,175,0.3)' },
}

const EVENT_STATUS_COLOR: Record<string, string> = {
  published: COLORS.green,
  draft:     COLORS.mutedDark,
  cancelled: COLORS.red,
  completed: COLORS.muted,
}

const PROMO_STATUS_COLOR: Record<string, string> = {
  active:  COLORS.green,
  pending: '#f59e0b',
  approved: COLORS.green,
  expired: COLORS.mutedDark,
}

function fmt(iso: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={cd.infoRow}>
      <View style={cd.infoIcon}>
        <Ionicons name={icon} size={14} color={COLORS.purple} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cd.infoLabel}>{label}</Text>
        <Text style={cd.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

// ── Event detail sheet ────────────────────────────────────────────────────────
function EventSheet({ event, onClose }: { event: Event | null; onClose: () => void }) {
  if (!event) return null
  const sc = EVENT_STATUS_COLOR[event.event_status] ?? COLORS.muted

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={cd.overlay} onPress={onClose}>
        <Pressable style={cd.sheet} onPress={() => {}}>
          <View style={cd.sheetHandle} />
          <TouchableOpacity style={cd.sheetClose} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.muted} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
            {/* Event image */}
            {event.event_image ? (
              <Image source={{ uri: event.event_image }} style={cd.sheetImage} resizeMode="cover" />
            ) : (
              <View style={[cd.sheetImage, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="musical-notes" size={48} color={COLORS.purple} />
              </View>
            )}

            {/* Status + type badges */}
            <View style={cd.sheetBadgeRow}>
              <View style={[cd.sheetBadge, { backgroundColor: sc + '22', borderColor: sc + '55' }]}>
                <View style={[cd.sheetBadgeDot, { backgroundColor: sc }]} />
                <Text style={[cd.sheetBadgeText, { color: sc }]}>
                  {event.event_status.charAt(0).toUpperCase() + event.event_status.slice(1)}
                </Text>
              </View>
              {event.event_type ? (
                <View style={[cd.sheetBadge, { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.3)' }]}>
                  <Text style={[cd.sheetBadgeText, { color: COLORS.purple }]}>{event.event_type}</Text>
                </View>
              ) : null}
              {event.is_featured ? (
                <View style={[cd.sheetBadge, { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: 'rgba(245,166,35,0.3)' }]}>
                  <Ionicons name="star" size={11} color="#f59e0b" />
                  <Text style={[cd.sheetBadgeText, { color: '#f59e0b' }]}>Featured</Text>
                </View>
              ) : null}
            </View>

            <Text style={cd.sheetTitle}>{event.event_name}</Text>

            {/* Date / time */}
            <View style={cd.sheetMetaRow}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
              <Text style={cd.sheetMetaText}>
                {fmt(event.event_starting_date)}
                {event.event_starting_date ? ` · ${fmtTime(event.event_starting_date)}` : ''}
              </Text>
            </View>
            {event.event_ending_date ? (
              <View style={cd.sheetMetaRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.muted} />
                <Text style={cd.sheetMetaText}>Ends {fmt(event.event_ending_date)} · {fmtTime(event.event_ending_date)}</Text>
              </View>
            ) : null}

            {/* Stats row */}
            <View style={cd.sheetStats}>
              {event.final_ticket_price != null ? (
                <View style={cd.sheetStat}>
                  <Text style={cd.sheetStatVal}>€{event.final_ticket_price.toFixed(2)}</Text>
                  <Text style={cd.sheetStatLabel}>Ticket Price</Text>
                </View>
              ) : null}
              {event.event_capacity != null ? (
                <View style={[cd.sheetStat, event.final_ticket_price != null && cd.sheetStatBorder]}>
                  <Text style={cd.sheetStatVal}>{event.event_capacity}</Text>
                  <Text style={cd.sheetStatLabel}>Capacity</Text>
                </View>
              ) : null}
              {event.event_hours ? (
                <View style={[cd.sheetStat, (event.final_ticket_price != null || event.event_capacity != null) && cd.sheetStatBorder]}>
                  <Text style={cd.sheetStatVal}>{event.event_hours}</Text>
                  <Text style={cd.sheetStatLabel}>Hours</Text>
                </View>
              ) : null}
            </View>

            {/* Description */}
            {event.event_description ? (
              <View style={cd.sheetBlock}>
                <Text style={cd.sheetBlockTitle}>Description</Text>
                <Text style={cd.sheetBlockBody}>{event.event_description}</Text>
              </View>
            ) : null}

            {/* Special guests */}
            {event.special_guests ? (
              <View style={cd.sheetBlock}>
                <Text style={cd.sheetBlockTitle}>Special Guests</Text>
                <View style={cd.sheetMetaRow}>
                  <Ionicons name="people-outline" size={14} color={COLORS.purple} />
                  <Text style={[cd.sheetMetaText, { color: COLORS.white }]}>{event.special_guests}</Text>
                </View>
              </View>
            ) : null}

            {/* Discount info */}
            {event.ticket_discount != null && event.ticket_discount > 0 ? (
              <View style={cd.sheetBlock}>
                <Text style={cd.sheetBlockTitle}>Discount</Text>
                <View style={cd.sheetMetaRow}>
                  <Ionicons name="pricetag-outline" size={14} color={COLORS.green} />
                  <Text style={[cd.sheetMetaText, { color: COLORS.green }]}>
                    {event.ticket_discount}% off · Original €{event.ticket_price?.toFixed(2) ?? '–'}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [club, setClub]           = useState<Club | null>(null)
  const [events, setEvents]       = useState<Event[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [manager, setManager] = useState<{ name: string; email: string | null } | null>(null)
  const [subscriptionPrice, setSubscriptionPrice] = useState<number | null>(null)
  const [defaultMonthly, setDefaultMonthly] = useState(70)
  const [defaultThreeMonth, setDefaultThreeMonth] = useState(200)
  const [showPriceModal, setShowPriceModal] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (id) loadClub()
      // loadClub is intentionally re-created with the latest local state helpers.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  async function loadClub() {
    setLoading(true)
    const [clubRes, eventsRes, promoRes, settingsRes] = await Promise.all([
      supabase.from('clubs').select('*').eq('club_id', id).single(),
      supabase.from('events').select('*').eq('club_id', id).gte('event_starting_date', new Date().toISOString()).order('event_starting_date', { ascending: true }),
      supabase.from('promotions').select('*').eq('club_id', id).order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('key, value').in('key', ['monthly_club_fee', 'three_month_club_fee', 'annual_club_fee']),
    ])
    const c = clubRes.data as any
    setClub(c as Club)
    setEvents((eventsRes.data as Event[]) ?? [])
    setPromotions((promoRes.data as Promotion[]) ?? [])
    setSubscriptionPrice(c?.subscription_price !== null && c?.subscription_price !== undefined ? Number(c.subscription_price) : null)
    const settingsMap: Record<string, string> = {}
    ;(settingsRes.data ?? []).forEach((row: any) => { settingsMap[row.key] = row.value })
    if (settingsMap.monthly_club_fee) setDefaultMonthly(Number(settingsMap.monthly_club_fee))
    if (settingsMap.three_month_club_fee || settingsMap.annual_club_fee) {
      setDefaultThreeMonth(Number(settingsMap.three_month_club_fee ?? settingsMap.annual_club_fee))
    }

    if (c?.manager_id) {
      const { data: m } = await supabase
        .from('profiles')
        .select('name, surname, email')
        .eq('id', c.manager_id)
        .single()
      if (m) {
        setManager({
          name: [m.name, m.surname].filter(Boolean).join(' ') || m.email || '—',
          email: m.email ?? null,
        })
      } else {
        setManager(null)
      }
    } else {
      setManager(null)
    }
    setLoading(false)
  }

  function openSubscriptionFees() {
    if (!club?.club_id) return
    router.push(`/(admin)/subscription-detail/${club.club_id}` as any)
  }

  async function savePrice() {
    const v = parseFloat(priceInput.replace(',', '.'))
    if (isNaN(v) || v < 0) { Alert.alert('Invalid price', 'Please enter a valid number.'); return }
    setSavingPrice(true)
    const { error } = await supabase.from('clubs').update({ subscription_price: v }).eq('club_id', id)
    setSavingPrice(false)
    if (error) { Alert.alert('Error', error.message); return }
    setSubscriptionPrice(v)
    setShowPriceModal(false)
  }

  async function clearPrice() {
    setSavingPrice(true)
    const { error } = await supabase.from('clubs').update({ subscription_price: null }).eq('club_id', id)
    setSavingPrice(false)
    if (error) { Alert.alert('Error', error.message); return }
    setSubscriptionPrice(null)
    setShowPriceModal(false)
  }

  async function openMail(to: string, subject?: string, body?: string) {
    const params: string[] = []
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
    if (body) params.push(`body=${encodeURIComponent(body)}`)
    const url = `mailto:${to}${params.length ? `?${params.join('&')}` : ''}`
    const ok = await Linking.canOpenURL(url)
    if (!ok) { Alert.alert('No mail app', 'No email app is configured on this device.'); return }
    Linking.openURL(url)
  }

  async function openCall(phone: string) {
    const url = `tel:${phone.replace(/\s/g, '')}`
    const ok = await Linking.canOpenURL(url)
    if (!ok) { Alert.alert('Cannot place call', 'This device cannot place phone calls.'); return }
    Linking.openURL(url)
  }

  function sendPaymentReminder() {
    if (!club || !manager?.email) {
      Alert.alert('No email', 'This manager has no email on file.')
      return
    }
    const days = club.subscription_due_date
      ? Math.ceil((new Date(club.subscription_due_date).getTime() - Date.now()) / 86400000)
      : null
    const overdueText = days !== null && days <= 0
      ? `${Math.abs(days)} days overdue`
      : days !== null
        ? `due in ${days} days`
        : 'pending'
    const price = subscriptionPrice ?? (subscriptionPlanLabel(club.subscription_type) === '3-Month' ? defaultThreeMonth : defaultMonthly)
    const subject = `Subscription payment reminder — ${club.club_name}`
    const body =
`Hi ${manager.name?.split(' ')[0] ?? 'there'},

This is a reminder that the ${subscriptionPlanLabel(club.subscription_type).toLowerCase()} subscription for ${club.club_name} (€${price.toFixed(0)}) is currently ${overdueText}.

Please settle the payment to keep your venue active on PartyOn.

Thanks,
PartyOn Admin`
    openMail(manager.email, subject, body)
  }


  async function updateStatus(status: 'approved' | 'rejected' | 'suspended') {
    const labels = { approved: 'Approve', rejected: 'Reject', suspended: 'Suspend' }
    Alert.alert(
      `${labels[status]} Club`,
      `Are you sure you want to ${labels[status].toLowerCase()} "${club?.club_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: labels[status],
          style: status === 'approved' ? 'default' : 'destructive',
          onPress: async () => {
            setActing(true)
            await supabase.from('clubs').update({ club_status: status }).eq('club_id', id)
            await loadClub()
            setActing(false)
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={[cd.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!club) {
    return (
      <View style={[cd.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: COLORS.muted }}>Club not found</Text>
      </View>
    )
  }

  const statusStyle = CLUB_STATUS[club.club_status] ?? CLUB_STATUS.pending

  return (
    <View style={[cd.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={cd.topBar}>
        <TouchableOpacity style={cd.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={cd.topBarTitle} numberOfLines={1}>Club Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover */}
        <View style={cd.coverWrap}>
          {club.club_image ? (
            <Image source={{ uri: club.club_image }} style={cd.cover} resizeMode="cover" />
          ) : (
            <View style={[cd.cover, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business" size={64} color={COLORS.purple} />
            </View>
          )}
          <View style={cd.coverOverlay} />
          <View style={cd.coverBottom}>
            <Text style={cd.clubName}>{club.club_name}</Text>
            <View style={[cd.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
              <View style={[cd.statusDot, { backgroundColor: statusStyle.text }]} />
              <Text style={[cd.statusPillText, { color: statusStyle.text }]}>
                {club.club_status.charAt(0).toUpperCase() + club.club_status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={cd.quickStats}>
          <TouchableOpacity style={cd.quickStat} activeOpacity={0.82} onPress={() => events[0] && setSelectedEvent(events[0])}>
            <Text style={cd.quickStatVal}>{events.length}</Text>
            <Text style={cd.quickStatLabel}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cd.quickStat, cd.quickStatBorder]}
            activeOpacity={0.82}
            onPress={() => promotions[0] && Alert.alert(promotions[0].title, promotions[0].description ?? 'Promotion details')}
          >
            <Text style={cd.quickStatVal}>{promotions.length}</Text>
            <Text style={cd.quickStatLabel}>Promotions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cd.quickStat, cd.quickStatBorder]}
            activeOpacity={0.82}
            onPress={() => events.find(e => e.event_status === 'published') && setSelectedEvent(events.find(e => e.event_status === 'published')!)}
          >
            <Text style={cd.quickStatVal}>
              {events.filter(e => e.event_status === 'published').length}
            </Text>
            <Text style={cd.quickStatLabel}>Published</Text>
          </TouchableOpacity>
        </View>

        {/* Club Info */}
        <View style={cd.section}>
          <Text style={cd.sectionTitle}>Club Information</Text>
          <View style={cd.card}>
            {club.club_address && <InfoRow icon="location-outline" label="Address" value={club.club_address} />}
            {club.club_email_id && (
              <>
                <View style={cd.rowDivider} />
                <InfoRow icon="mail-outline" label="Email" value={club.club_email_id} />
              </>
            )}
            {club.club_phone_number && (
              <>
                <View style={cd.rowDivider} />
                <InfoRow icon="call-outline" label="Phone" value={club.club_phone_number} />
              </>
            )}
            {club.created_at && (
              <>
                <View style={cd.rowDivider} />
                <InfoRow
                  icon="time-outline"
                  label="Submitted"
                  value={new Date(club.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
              </>
            )}
          </View>
        </View>

        {/* Description */}
        {club.club_description ? (
          <View style={cd.section}>
            <Text style={cd.sectionTitle}>Description</Text>
            <View style={cd.card}>
              <Text style={cd.descText}>{club.club_description}</Text>
            </View>
          </View>
        ) : null}

        {/* Manager + Subscription */}
        {(() => {
          const paid = !!club.subscription_due_date && new Date(club.subscription_due_date).getTime() >= Date.now()
          const days = club.subscription_due_date
            ? Math.ceil((new Date(club.subscription_due_date).getTime() - Date.now()) / 86400000)
            : null
          const price = subscriptionPrice ?? (subscriptionPlanLabel(club.subscription_type) === '3-Month' ? defaultThreeMonth : defaultMonthly)
          const isOverride = subscriptionPrice !== null

          return (
            <View style={cd.section}>
              <Text style={cd.sectionTitle}>Manager & Subscription</Text>
              <View style={cd.card}>
                {/* Manager row */}
                <View style={cd.infoRow}>
                  <View style={cd.infoIcon}>
                    <Ionicons name="person-outline" size={14} color={COLORS.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cd.infoLabel}>Manager</Text>
                    <Text style={cd.infoValue}>{manager?.name ?? 'No manager assigned'}</Text>
                    {manager?.email ? <Text style={cd.subInfo}>{manager.email}</Text> : null}
                  </View>
                </View>

                <View style={cd.rowDivider} />

                {/* Subscription summary */}
                <View style={cd.subStatusRow}>
                  <View style={[
                    cd.subStatusPill,
                    {
                      backgroundColor: paid ? COLORS.green + '22'
                        : club.subscription_due_date ? COLORS.red + '22'
                        : COLORS.mutedDark + '22',
                      borderColor: paid ? COLORS.green
                        : club.subscription_due_date ? COLORS.red
                        : COLORS.mutedDark,
                    },
                  ]}>
                    <View style={[cd.subStatusDot, {
                      backgroundColor: paid ? COLORS.green
                        : club.subscription_due_date ? COLORS.red
                        : COLORS.mutedDark,
                    }]} />
                    <Text style={[cd.subStatusText, {
                      color: paid ? COLORS.green
                        : club.subscription_due_date ? COLORS.red
                        : COLORS.mutedDark,
                    }]}>
                      {paid ? 'Paid' : club.subscription_due_date ? 'Overdue' : 'Unset'}
                    </Text>
                  </View>
                  {days !== null && (
                    <Text style={[cd.subDays, {
                      color: days <= 0 ? COLORS.red : days <= 7 ? COLORS.cta : COLORS.mutedDark,
                    }]}>
                      {days <= 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
                    </Text>
                  )}
                </View>

                <View style={cd.subDetailGrid}>
                  <View style={cd.subDetailItem}>
                    <Text style={cd.subDetailLabel}>Plan</Text>
                    <Text style={cd.subDetailValue}>
                      {subscriptionPlanLabel(club.subscription_type)}
                    </Text>
                  </View>
                  <View style={[cd.subDetailItem, cd.subDetailBorder]}>
                    <Text style={cd.subDetailLabel}>Price</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={cd.subDetailValue}>€{price.toFixed(0)}</Text>
                      {isOverride && (
                        <View style={cd.overrideBadge}>
                          <Text style={cd.overrideText}>Custom</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[cd.subDetailItem, cd.subDetailBorder]}>
                    <Text style={cd.subDetailLabel}>Due</Text>
                    <Text style={cd.subDetailValue}>{fmt(club.subscription_due_date)}</Text>
                  </View>
                </View>

                {/* Subscription actions */}
                <View style={cd.subActions}>
                  <TouchableOpacity style={[cd.subPayBtn, { flex: 1 }]} onPress={openSubscriptionFees}>
                    <Ionicons name="settings-outline" size={14} color="#fff" />
                    <Text style={cd.subPayBtnText}>Manage Subscription & Fees</Text>
                  </TouchableOpacity>
                </View>

                {/* Payment reminder — surfaces when overdue */}
                {!paid && club.subscription_due_date && manager?.email && (
                  <TouchableOpacity style={cd.reminderBtn} onPress={sendPaymentReminder}>
                    <Ionicons name="alert-circle-outline" size={15} color={COLORS.cta} />
                    <Text style={cd.reminderBtnText}>Send Payment Reminder</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.cta} />
                  </TouchableOpacity>
                )}

                {/* Communication */}
                {(manager?.email || club.club_phone_number) && (
                  <View style={cd.commsRow}>
                    {manager?.email && (
                      <TouchableOpacity
                        style={cd.commBtn}
                        onPress={() => openMail(
                          manager.email!,
                          `Regarding ${club.club_name}`,
                          `Hi ${manager.name?.split(' ')[0] ?? 'there'},\n\n`,
                        )}
                      >
                        <Ionicons name="mail-outline" size={14} color={COLORS.muted} />
                        <Text style={cd.commBtnText}>Email Manager</Text>
                      </TouchableOpacity>
                    )}
                    {club.club_phone_number && (
                      <TouchableOpacity style={cd.commBtn} onPress={() => openCall(club.club_phone_number!)}>
                        <Ionicons name="call-outline" size={14} color={COLORS.muted} />
                        <Text style={cd.commBtnText}>Call</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })()}

        {/* Events */}
        <View style={cd.section}>
          <View style={cd.sectionHeader}>
            <Text style={cd.sectionTitle}>Upcoming Events ({events.length})</Text>
            {events.length > 0 && (
              <Text style={cd.sectionHint}>Tap to view details</Text>
            )}
          </View>
          {events.length === 0 ? (
            <View style={cd.emptyBox}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.mutedDark} />
              <Text style={cd.emptyText}>No upcoming events</Text>
            </View>
          ) : (
            <View style={cd.card}>
              {events.map((ev, i) => {
                const sc = EVENT_STATUS_COLOR[ev.event_status] ?? COLORS.muted
                return (
                  <View key={ev.event_id}>
                    {i > 0 && <View style={cd.rowDivider} />}
                    <TouchableOpacity style={cd.eventRow} onPress={() => setSelectedEvent(ev)} activeOpacity={0.75}>
                      {/* Thumbnail */}
                      {ev.event_image ? (
                        <Image source={{ uri: ev.event_image }} style={cd.eventThumb} resizeMode="cover" />
                      ) : (
                        <View style={[cd.eventThumb, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="musical-notes" size={16} color={COLORS.purple} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={cd.eventName} numberOfLines={1}>{ev.event_name}</Text>
                        <Text style={cd.eventDate}>
                          {fmt(ev.event_starting_date)}
                          {ev.final_ticket_price != null ? ` · €${ev.final_ticket_price.toFixed(2)}` : ''}
                        </Text>
                        {ev.event_description ? (
                          <Text style={cd.eventDesc} numberOfLines={1}>{ev.event_description}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={[cd.eventStatusPill, { backgroundColor: sc + '22' }]}>
                          <Text style={[cd.eventStatusText, { color: sc }]}>{ev.event_status}</Text>
                        </View>
                        {ev.is_featured ? (
                          <Ionicons name="star" size={13} color="#f59e0b" />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Promotions */}
        <View style={cd.section}>
          <Text style={cd.sectionTitle}>Promotions ({promotions.length})</Text>
          {promotions.length === 0 ? (
            <View style={cd.emptyBox}>
              <Ionicons name="pricetag-outline" size={32} color={COLORS.mutedDark} />
              <Text style={cd.emptyText}>No promotions</Text>
            </View>
          ) : (
            <View style={{ gap: SPACING.sm }}>
              {promotions.map(p => {
                const pc = PROMO_STATUS_COLOR[p.status] ?? COLORS.muted
                return (
                  <TouchableOpacity
                    key={p.promotion_id}
                    style={cd.promoCard}
                    activeOpacity={0.84}
                    onPress={() => Alert.alert(p.title, p.description ?? 'Promotion details')}
                  >
                    <View style={cd.promoTop}>
                      {p.image_url ? (
                        <Image source={{ uri: p.image_url }} style={cd.promoImg} resizeMode="cover" />
                      ) : (
                        <View style={[cd.promoImg, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="pricetag" size={18} color={COLORS.purple} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={cd.promoTitle} numberOfLines={1}>{p.title}</Text>
                          <View style={[cd.promoBadge, { backgroundColor: pc + '22', borderColor: pc + '55' }]}>
                            <Text style={[cd.promoBadgeText, { color: pc }]}>{p.status}</Text>
                          </View>
                        </View>
                        {p.category ? (
                          <Text style={cd.promoCategory}>{p.category}</Text>
                        ) : null}
                        {p.discount_value != null ? (
                          <Text style={cd.promoDiscount}>{p.discount_value}% discount</Text>
                        ) : null}
                      </View>
                    </View>

                    {p.description ? (
                      <Text style={cd.promoDesc}>{p.description}</Text>
                    ) : null}

                    {(p.valid_from || p.valid_until) ? (
                      <View style={cd.promoValidity}>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.mutedDark} />
                        <Text style={cd.promoValidityText}>
                          {p.valid_from ? `From ${fmt(p.valid_from)}` : ''}
                          {p.valid_from && p.valid_until ? ' · ' : ''}
                          {p.valid_until ? `Until ${fmt(p.valid_until)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action bar */}
      {club.club_status === 'pending' && (
        <View style={[cd.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={cd.rejectBtn} onPress={() => updateStatus('rejected')} disabled={acting}>
            {acting ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Ionicons name="close" size={18} color="#fff" /><Text style={cd.btnText}>Reject</Text></>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={cd.approveBtn} onPress={() => updateStatus('approved')} disabled={acting}>
            {acting ? <ActivityIndicator size="small" color="#fff" /> : (
              <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={cd.btnText}>Approve</Text></>
            )}
          </TouchableOpacity>
        </View>
      )}
      {club.club_status === 'approved' && (
        <View style={[cd.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={[cd.rejectBtn, { flex: 1 }]} onPress={() => updateStatus('suspended')} disabled={acting}>
            <Ionicons name="ban-outline" size={18} color="#fff" />
            <Text style={cd.btnText}>Suspend Club</Text>
          </TouchableOpacity>
        </View>
      )}
      {club.club_status === 'suspended' && (
        <View style={[cd.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={[cd.approveBtn, { flex: 1 }]} onPress={() => updateStatus('approved')} disabled={acting}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={cd.btnText}>Reinstate Club</Text>
          </TouchableOpacity>
        </View>
      )}

      <EventSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {/* Edit Price Modal */}
      <Modal visible={showPriceModal} animationType="slide" transparent onRequestClose={() => setShowPriceModal(false)}>
        <KeyboardAvoidingView style={cd.priceOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={cd.priceBackdrop} onPress={() => setShowPriceModal(false)} />
          <View style={cd.priceSheet}>
            <View style={cd.sheetHandle} />
            <View style={cd.priceHeader}>
              <Text style={cd.priceTitle}>Set Subscription Price</Text>
              <TouchableOpacity onPress={() => setShowPriceModal(false)} style={cd.sheetClose}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <Text style={cd.priceClub}>{club.club_name}</Text>
            <Text style={cd.priceSubText}>
              {subscriptionPlanLabel(club.subscription_type)} subscription
            </Text>

            <Text style={cd.priceLabel}>Price (EUR)</Text>
            <View style={cd.priceInputWrap}>
              <Text style={cd.priceCurrency}>€</Text>
              <TextInput
                style={cd.priceInput}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder={String(subscriptionPlanLabel(club.subscription_type) === '3-Month' ? defaultThreeMonth : defaultMonthly)}
                placeholderTextColor={COLORS.mutedDark}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            <Text style={cd.priceHint}>
              Platform default is €{subscriptionPlanLabel(club.subscription_type) === '3-Month' ? defaultThreeMonth : defaultMonthly}/{subscriptionPriceSuffix(club.subscription_type)}. Reset to use the default.
            </Text>

            <TouchableOpacity style={cd.priceSaveBtn} onPress={savePrice} disabled={savingPrice}>
              {savingPrice
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={cd.priceSaveBtnText}>Save Price</Text>
                  </>
                )
              }
            </TouchableOpacity>
            {subscriptionPrice !== null && (
              <TouchableOpacity style={cd.priceClearBtn} onPress={clearPrice} disabled={savingPrice}>
                <Text style={cd.priceClearBtnText}>Reset to platform default</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 24 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const cd = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  topBarTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flex: 1, textAlign: 'center' },

  coverWrap: { position: 'relative', height: 220, marginBottom: SPACING.sm },
  cover: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  coverBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md, gap: 8 },
  clubName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  statusPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 13, fontWeight: '700' },

  quickStats: {
    flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  quickStat: { flex: 1, padding: SPACING.md, alignItems: 'center' },
  quickStatBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  quickStatVal: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  quickStatLabel: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  sectionHint: { color: COLORS.mutedDark, fontSize: 11, marginBottom: SPACING.sm },

  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  rowDivider: { height: 1, backgroundColor: COLORS.border },

  infoRow: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, alignItems: 'flex-start' },
  infoIcon: { width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoLabel: { color: COLORS.mutedDark, fontSize: 12, marginBottom: 2 },
  infoValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },

  descText: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.6, padding: SPACING.md },

  emptyBox: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xl, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  emptyText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  // Event rows
  eventRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  eventThumb: { width: 52, height: 52, borderRadius: RADIUS.md, flexShrink: 0 },
  eventName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  eventDate: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  eventDesc: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  eventStatusPill: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  eventStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Promotion cards
  promoCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm,
  },
  promoTop: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  promoImg: { width: 48, height: 48, borderRadius: RADIUS.md, flexShrink: 0 },
  promoTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', flex: 1 },
  promoCategory: { color: COLORS.purple, fontSize: 12, marginTop: 2, fontWeight: '600' },
  promoDiscount: { color: COLORS.green, fontSize: 12, marginTop: 2, fontWeight: '700' },
  promoBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  promoBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  promoDesc: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },
  promoValidity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoValidityText: { color: COLORS.mutedDark, fontSize: 12 },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md,
    backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.green, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.red, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4 },
  btnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  // Event detail sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl + 4, borderTopRightRadius: RADIUS.xl + 4,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + (Platform.OS === 'ios' ? 24 : 8),
    maxHeight: '90%', borderTopWidth: 1, borderColor: COLORS.border,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  sheetClose: { position: 'absolute', top: SPACING.md, right: SPACING.md, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center' },
  sheetImage: { width: '100%', height: 180, borderRadius: RADIUS.lg, marginBottom: SPACING.md },
  sheetBadgeRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', marginBottom: SPACING.sm },
  sheetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  sheetBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  sheetBadgeText: { fontSize: 12, fontWeight: '700' },
  sheetTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900', marginBottom: SPACING.sm },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sheetMetaText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  sheetStats: {
    flexDirection: 'row', backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    marginVertical: SPACING.md, overflow: 'hidden',
  },
  sheetStat: { flex: 1, padding: SPACING.md, alignItems: 'center' },
  sheetStatBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.border },
  sheetStatVal: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  sheetStatLabel: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  sheetBlock: { marginBottom: SPACING.md },
  sheetBlockTitle: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700', marginBottom: SPACING.xs },
  sheetBlockBody: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.6 },

  // Subscription section
  subInfo: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  subStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, paddingBottom: SPACING.sm },
  subStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  subStatusDot: { width: 6, height: 6, borderRadius: 3 },
  subStatusText: { fontSize: 12, fontWeight: '700' },
  subDays: { fontSize: 12, fontWeight: '600' },
  subDetailGrid: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.xs, marginHorizontal: SPACING.xs },
  subDetailItem: { flex: 1, alignItems: 'flex-start', paddingHorizontal: SPACING.xs },
  subDetailBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.border, paddingLeft: SPACING.sm },
  subDetailLabel: { color: COLORS.mutedDark, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  subDetailValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  overrideBadge: { backgroundColor: COLORS.purple + '22', borderRadius: RADIUS.sm, paddingHorizontal: 5, paddingVertical: 1 },
  overrideText: { color: COLORS.purple, fontSize: 9, fontWeight: '700' },
  subActions: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, paddingTop: 0 },
  subEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2, borderWidth: 1, borderColor: COLORS.purple + '44' },
  subEditBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  subPayBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.green, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2 },
  subPayBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  reminderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.cta + '15', borderWidth: 1, borderColor: COLORS.cta + '55',
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  reminderBtnText: { flex: 1, color: COLORS.cta, fontSize: FONT.sm, fontWeight: '700' },
  commsRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    paddingTop: 0,
  },
  commBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 2,
  },
  commBtnText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },

  // Price modal
  priceOverlay: { flex: 1, justifyContent: 'flex-end' },
  priceBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  priceSheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderColor: COLORS.border },
  priceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  priceTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  priceClub: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  priceSubText: { color: COLORS.mutedDark, fontSize: 12, marginBottom: SPACING.md },
  priceLabel: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md },
  priceCurrency: { color: COLORS.muted, fontSize: FONT.lg, fontWeight: '700', marginRight: SPACING.xs },
  priceInput: { flex: 1, color: COLORS.white, fontSize: FONT.lg, fontWeight: '700', paddingVertical: SPACING.md },
  priceHint: { color: COLORS.mutedDark, fontSize: 11, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  priceSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.purple, borderRadius: RADIUS.md, paddingVertical: SPACING.md },
  priceSaveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
  priceClearBtn: { paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.xs },
  priceClearBtnText: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },
})
