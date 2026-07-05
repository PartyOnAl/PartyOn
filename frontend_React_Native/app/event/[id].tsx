import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Share, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Event, TicketType } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function EventDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null)
  const [aboutExpanded, setAboutExpanded] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([
      supabase.from('events').select('*, clubs(*)').eq('event_id', id).single(),
      supabase.from('ticket_types').select('*').eq('event_id', id).order('price', { ascending: true }),
    ]).then(([evRes, ttRes]) => {
      const ev = evRes.data as Event
      const tts = (ttRes.data as TicketType[]) ?? []
      setEvent(ev)
      setTicketTypes(tts)
      if (tts.length > 0) setSelectedTicket(tts[0])
      setLoading(false)
    })
  }, [id])

  async function handleShare() {
    try {
      await Share.share({ message: `Check out ${event?.event_name} on PartyOn!` })
    } catch {}
  }

  function handleOpenMaps() {
    const addr = event?.clubs?.club_address
    if (!addr) return
    const url = `https://maps.google.com/?q=${encodeURIComponent(addr)}`
    require('expo-web-browser').openBrowserAsync(url)
  }

  function handleBuy() {
    if (!user) { Alert.alert('Login required', 'Please log in to buy tickets.', [{ text: 'Log in', onPress: () => router.push('/(auth)/login') }, { text: 'Cancel', style: 'cancel' }]); return }
    if (!event) return
    router.push({ pathname: '/payment', params: { eventId: event.event_id, ticketTypeId: selectedTicket?.id ?? '', ticketTypeName: selectedTicket?.name ?? 'General Admission', price: String(selectedTicket?.price ?? event.final_ticket_price ?? 0), eventName: event.event_name, isReservation: 'false' } })
  }

  function handleReserve() {
    if (!user) { Alert.alert('Login required', 'Please log in to reserve a table.', [{ text: 'Log in', onPress: () => router.push('/(auth)/login') }, { text: 'Cancel', style: 'cancel' }]); return }
    if (!event) return
    router.push({ pathname: '/reserve/[id]', params: { id: event.event_id } })
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <Text style={styles.notFound}>Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const club = event.clubs
  const hasTicketOffer = ticketTypes.length > 0 || event.final_ticket_price != null || event.ticket_price != null
  const isReservationOnly = !hasTicketOffer && ((event.reservation_only ?? club?.reservation_only) ?? false)
  const lowestPrice = selectedTicket ? Number(selectedTicket.price) : Number(event.final_ticket_price ?? event.ticket_price ?? 0)

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.topBarBtn}>
          <Ionicons name="share-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero image */}
        {event.event_image ? (
          <Image source={{ uri: event.event_image }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]} />
        )}

        <View style={styles.content}>
          {/* Title & badges */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{event.event_name}</Text>
            {isReservationOnly && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Reservation Only</Text>
              </View>
            )}
          </View>

          {/* Quick info */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.purple} />
              <Text style={styles.infoText}>{formatDate(event.event_starting_date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={COLORS.purple} />
              <Text style={styles.infoText}>{event.event_hours ?? formatTime(event.event_starting_date)}</Text>
            </View>
            {club?.club_address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>{club.club_name ? `${club.club_name} — ` : ''}{club.club_address}</Text>
              </View>
            )}
            {event.event_type && (
              <View style={styles.infoRow}>
                <Ionicons name="musical-notes-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>{event.event_type}</Text>
              </View>
            )}
            {event.event_capacity && (
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>Capacity: {event.event_capacity}</Text>
              </View>
            )}
            {event.special_guests && (
              <View style={styles.infoRow}>
                <Ionicons name="star-outline" size={16} color={COLORS.purple} />
                <Text style={styles.infoText}>Special guests: {event.special_guests}</Text>
              </View>
            )}
          </View>

          {/* About */}
          {event.event_description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description} numberOfLines={aboutExpanded ? undefined : 4}>
                {event.event_description}
              </Text>
              {event.event_description.length > 200 && (
                <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)}>
                  <Text style={styles.readMore}>{aboutExpanded ? 'Show less' : 'Read more'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Ticket types */}
          {!isReservationOnly && ticketTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ticket Types</Text>
              {ticketTypes.map((tt) => {
                const available = (tt.total_quantity - (tt.sold_quantity ?? 0))
                const isSelected = selectedTicket?.id === tt.id
                return (
                  <TouchableOpacity
                    key={tt.id}
                    style={[styles.ticketTypeRow, isSelected && styles.ticketTypeRowSelected]}
                    onPress={() => setSelectedTicket(tt)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.ticketTypeLeft}>
                      <Text style={styles.ticketTypeName}>{tt.name}</Text>
                      {tt.description && <Text style={styles.ticketTypeDesc} numberOfLines={1}>{tt.description}</Text>}
                      {available <= 10 && available > 0 && (
                        <Text style={styles.ticketTypeAvail}>Only {available} left!</Text>
                      )}
                      {available === 0 && <Text style={styles.ticketTypeSoldOut}>Sold out</Text>}
                    </View>
                    <View style={styles.ticketTypeRight}>
                      <Text style={styles.ticketTypePrice}>€{Number(tt.price).toFixed(2)}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={COLORS.purple} style={{ marginTop: 4 }} />}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* Venue */}
          {club && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Venue</Text>
              <TouchableOpacity
                style={styles.venueCard}
                onPress={() => router.push(`/club/${club.club_id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.venueCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.venueName}>{club.club_name}</Text>
                    {club.club_address && <Text style={styles.venueAddress}>{club.club_address}</Text>}
                    {club.club_phone_number && (
                      <View style={styles.infoRow}>
                        <Ionicons name="call-outline" size={14} color={COLORS.muted} />
                        <Text style={styles.venueContact}>{club.club_phone_number}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.mutedDark} />
                </View>
                <TouchableOpacity style={styles.mapsBtn} onPress={handleOpenMaps}>
                  <Ionicons name="map-outline" size={16} color={COLORS.purple} />
                  <Text style={styles.mapsBtnText}>Open in Maps</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        {isReservationOnly ? (
          <>
            <View style={styles.bottomPrice}>
              <Text style={styles.bottomPriceLabel}>Free Reservation</Text>
              <Text style={styles.bottomPriceNote}>No payment required</Text>
            </View>
            <TouchableOpacity style={styles.buyBtn} onPress={handleReserve} activeOpacity={0.85}>
              <Text style={styles.buyBtnText}>Reserve Table</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.bottomPrice}>
              <Text style={styles.bottomPriceLabel}>From €{lowestPrice.toFixed(2)}</Text>
              <Text style={styles.bottomPriceNote}>No hidden fees</Text>
            </View>
            <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.85}>
              <Text style={styles.buyBtnText}>Buy Ticket</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md,
  },
  topBarBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  hero: { width: '100%', height: 260, backgroundColor: COLORS.bgCard },
  heroPlaceholder: { backgroundColor: COLORS.purpleDark },
  content: { padding: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.md, marginTop: SPACING.sm },
  title: { flex: 1, color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', lineHeight: FONT.xl * 1.2 },
  badge: { backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: COLORS.purple, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: COLORS.purple, fontSize: 11, fontWeight: '700' },
  infoBox: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText: { color: COLORS.white, fontSize: FONT.base, flex: 1 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  description: { color: COLORS.muted, fontSize: FONT.base, lineHeight: FONT.base * 1.6 },
  readMore: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: SPACING.xs },
  ticketTypeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.bgCard, marginBottom: SPACING.sm,
  },
  ticketTypeRowSelected: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.08)' },
  ticketTypeLeft: { flex: 1, marginRight: SPACING.sm },
  ticketTypeName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  ticketTypeDesc: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 2 },
  ticketTypeAvail: { color: COLORS.pink, fontSize: 11, fontWeight: '600', marginTop: 4 },
  ticketTypeSoldOut: { color: COLORS.red, fontSize: 11, fontWeight: '600', marginTop: 4 },
  ticketTypeRight: { alignItems: 'flex-end' },
  ticketTypePrice: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '700' },
  venueCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  venueCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.xs },
  venueName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: 4 },
  venueAddress: { color: COLORS.muted, fontSize: FONT.sm, marginBottom: SPACING.sm },
  venueContact: { color: COLORS.muted, fontSize: FONT.sm },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm, alignSelf: 'flex-start' },
  mapsBtnText: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, paddingTop: SPACING.sm,
  },
  bottomPrice: {},
  bottomPriceLabel: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800' },
  bottomPriceNote: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  buyBtn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.md, paddingVertical: SPACING.sm + 4, paddingHorizontal: SPACING.xl },
  buyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },
  notFound: { color: COLORS.muted, fontSize: FONT.md },
  backBtn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  backBtnText: { color: '#fff', fontWeight: '700' },
})
