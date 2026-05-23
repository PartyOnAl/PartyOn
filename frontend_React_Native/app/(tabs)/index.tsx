import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Club, Event, Promotion } from '@/lib/types'

const BG = '#0d0d0d'
const CARD = '#1a1a1a'
const BORDER = '#2a2a2a'
const PURPLE = '#7c3aed'
const WHITE = '#ffffff'
const MUTED = '#888888'
const MUTED_DARK = '#555555'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const PAGE_PAD = 14
const FEATURED_WIDTH = SCREEN_WIDTH - PAGE_PAD * 2
const CLUB_GAP = 10
const CLUB_WIDTH = (SCREEN_WIDTH - PAGE_PAD * 2 - CLUB_GAP) / 2

type ClubWithEvents = Club & {
  events?: Pick<Event, 'event_id' | 'event_starting_date' | 'event_status'>[]
  music_type?: string | null
  rating?: number | null
  average_rating?: number | null
}

const HEADER_COLORS = ['#6d28d9', '#0f766e', '#be185d', '#b45309', '#2563eb', '#7c2d12']
const FEATURED_BADGES = ["Manager's Pick", 'VIP Exclusive', 'Hot Deal', 'Weekend Pick']

function stableColor(id: string | null | undefined) {
  const key = id || 'partyon'
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return HEADER_COLORS[h % HEADER_COLORS.length]
}

function formatDateTime(iso: string | null | undefined, hours?: string | null) {
  if (!iso) return 'Date TBA'
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = hours || date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return 'Date TBA'
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatShortTime(iso: string | null | undefined, hours?: string | null) {
  if (hours) return hours
  if (!iso) return 'Time TBA'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function priceLabel(event: Event) {
  const price = event.final_ticket_price ?? event.ticket_price
  if (price == null) return 'Reservation'
  if (Number(price) === 0) return 'Free'
  return `€${Number(price).toFixed(0)}`
}

function venueName(event: Event) {
  return event.clubs?.club_name || event.clubs?.club_address || 'PartyOn venue'
}

function genreLabel(event: Event) {
  return event.event_type || 'Live Music'
}

function promoBadge(promo: Promotion) {
  if (promo.discount_value != null) return `${promo.discount_value}% OFF`
  const category = (promo.category || '').toLowerCase()
  if (category.includes('vip')) return 'VIP'
  if (category.includes('free')) return 'FREE'
  return 'PROMO'
}

function promoDescription(promo: Promotion) {
  return promo.description || promo.category || 'Special offer for this event'
}

function clubTagline(club: ClubWithEvents) {
  return club.club_description || 'A lively night above the city'
}

function upcomingEventCount(club: ClubWithEvents) {
  const now = Date.now()
  return (club.events || []).filter(event => {
    if (event.event_status !== 'published' || !event.event_starting_date) return false
    return new Date(event.event_starting_date).getTime() >= now
  }).length
}

function ratingText(club: ClubWithEvents) {
  const rating = club.rating ?? club.average_rating
  return typeof rating === 'number' && Number.isFinite(rating) ? rating.toFixed(1) : 'New'
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
          <Text style={s.seeAll}>See all &gt;</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={s.emptyCard}>
      <Text style={s.emptyText}>{label}</Text>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const featuredRef = useRef<FlatList<Event>>(null)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [clubs, setClubs] = useState<ClubWithEvents[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let active = true
      const nowIso = new Date().toISOString()
      const today = nowIso.split('T')[0]

      setLoading(true)
      Promise.all([
        supabase
          .from('events')
          .select('*, clubs(*)')
          .eq('event_status', 'published')
          .gte('event_starting_date', nowIso)
          .order('event_starting_date', { ascending: true })
          .limit(12),
        supabase
          .from('events')
          .select('*, clubs(*)')
          .eq('event_status', 'published')
          .eq('is_featured', true)
          .eq('featured_request_status', 'approved')
          .gte('event_starting_date', nowIso)
          .order('event_starting_date', { ascending: true })
          .limit(6),
        supabase
          .from('promotions')
          .select('*, clubs(*)')
          .in('status', ['active', 'approved'])
          .or(`valid_until.is.null,valid_until.gte.${today}`)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('clubs')
          .select('*, events(event_id,event_starting_date,event_status)')
          .eq('club_status', 'approved')
          .limit(10),
      ]).then(([eventRes, featuredRes, promoRes, clubRes]) => {
        if (!active) return
        const upcoming = ((eventRes.data as Event[]) || []).sort(
          (a, b) => new Date(a.event_starting_date).getTime() - new Date(b.event_starting_date).getTime(),
        )
        const pinned = ((featuredRes.data as Event[]) || []).sort(
          (a, b) => new Date(a.event_starting_date).getTime() - new Date(b.event_starting_date).getTime(),
        )

        setEvents(upcoming)
        setFeaturedEvents(pinned)
        setPromotions((promoRes.data as Promotion[]) || [])
        setClubs((clubRes.data as ClubWithEvents[]) || [])
        setFeaturedIndex(0)
        setLoading(false)
        if (pinned.length > 0) featuredRef.current?.scrollToOffset({ offset: 0, animated: false })
      }).catch(() => {
        if (!active) return
        setEvents([])
        setFeaturedEvents([])
        setPromotions([])
        setClubs([])
        setLoading(false)
      })

      return () => { active = false }
    }, []),
  )

  const visibleEvents = events.slice(0, 4)
  const visiblePromotions = promotions.slice(0, 4)
  const visibleClubs = clubs.slice(0, 6)

  function handleFeaturedScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(e.nativeEvent.contentOffset.x / (FEATURED_WIDTH + 10))
    setFeaturedIndex(Math.max(0, Math.min(page, featuredEvents.length - 1)))
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.brand}>
          Party<Text style={s.brandAccent}>On</Text>
        </Text>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/promotions')} activeOpacity={0.78}>
            <Ionicons name="pricetag-outline" size={18} color={WHITE} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerIcon} onPress={() => router.push('/clubs-map')} activeOpacity={0.78}>
            <Ionicons name="location-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={PURPLE} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.section}>
            <SectionHeader title="Featured Promotions" onSeeAll={() => router.push('/all-events')} />
            {featuredEvents.length === 0 ? (
              <EmptyState label="No featured promotions yet" />
            ) : (
              <>
                <FlatList
                  ref={featuredRef}
                  horizontal
                  data={featuredEvents}
                  keyExtractor={item => item.event_id}
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={FEATURED_WIDTH + 10}
                  decelerationRate="fast"
                  contentContainerStyle={s.featuredList}
                  onScroll={handleFeaturedScroll}
                  scrollEventThrottle={16}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={s.featuredCard}
                      activeOpacity={0.86}
                      onPress={() => router.push(`/event/${item.event_id}`)}
                    >
                      {item.event_image ? (
                        <Image source={{ uri: item.event_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: stableColor(item.event_id) }]} />
                      )}
                      <View style={s.featuredOverlay} />
                      <View style={s.featuredBadge}>
                        <Text style={s.featuredBadgeText}>{FEATURED_BADGES[index % FEATURED_BADGES.length]}</Text>
                      </View>
                      <View style={s.featuredBody}>
                        <Text style={s.featuredTitle} numberOfLines={2}>{item.event_name}</Text>
                        <Text style={s.featuredMeta} numberOfLines={1}>{venueName(item)}</Text>
                        <Text style={s.featuredMeta}>{formatDateTime(item.event_starting_date, item.event_hours)}</Text>
                        <Text style={s.featuredPrice}>{priceLabel(item)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
                <View style={s.dots}>
                  {featuredEvents.map((item, index) => (
                    <View
                      key={item.event_id}
                      style={[s.dot, index === featuredIndex && s.dotActive]}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={s.section}>
            <SectionHeader title="Upcoming Events" onSeeAll={() => router.push('/all-events')} />
            {visibleEvents.length === 0 ? (
              <EmptyState label="No upcoming events yet" />
            ) : (
              <View style={s.eventList}>
                {visibleEvents.map(event => (
                  <TouchableOpacity
                    key={event.event_id}
                    style={s.eventRow}
                    activeOpacity={0.82}
                    onPress={() => router.push(`/event/${event.event_id}`)}
                  >
                    {event.event_image ? (
                      <Image source={{ uri: event.event_image }} style={s.eventThumb} resizeMode="cover" />
                    ) : (
                      <View style={[s.eventThumb, { backgroundColor: stableColor(event.event_id) }]}>
                        <Ionicons name="musical-notes" size={24} color={WHITE} />
                      </View>
                    )}
                    <View style={s.eventInfo}>
                      <Text style={s.eventName} numberOfLines={1}>{event.event_name}</Text>
                      <View style={s.infoRow}>
                        <Ionicons name="location-outline" size={14} color={PURPLE} />
                        <Text style={s.infoText} numberOfLines={1}>{venueName(event)}</Text>
                      </View>
                      <View style={s.infoRow}>
                        <Ionicons name="musical-notes-outline" size={14} color={PURPLE} />
                        <Text style={s.infoText} numberOfLines={1}>{genreLabel(event)}</Text>
                      </View>
                      <View style={s.infoRow}>
                        <Ionicons name="calendar-outline" size={14} color={PURPLE} />
                        <Text style={s.infoText} numberOfLines={1}>{formatShortDate(event.event_starting_date)}</Text>
                        <Ionicons name="time-outline" size={14} color={PURPLE} />
                        <Text style={s.infoText} numberOfLines={1}>{formatShortTime(event.event_starting_date, event.event_hours)}</Text>
                      </View>
                    </View>
                    <View style={s.eventPricePill}>
                      <Ionicons name="ticket-outline" size={12} color={PURPLE} />
                      <Text style={s.eventPriceText}>{priceLabel(event)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={MUTED_DARK} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.seeAllEventsBtn} onPress={() => router.push('/all-events')} activeOpacity={0.82}>
                  <Text style={s.seeAllEventsText}>See all events -&gt;</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={s.section}>
            <SectionHeader title="Promotions" onSeeAll={() => router.push('/promotions')} />
            {visiblePromotions.length === 0 ? (
              <EmptyState label="No promotions available" />
            ) : (
              <View style={s.promoList}>
                {visiblePromotions.map(promo => (
                  <TouchableOpacity
                    key={promo.promotion_id}
                    style={s.promoRow}
                    activeOpacity={0.82}
                    onPress={() => router.push(`/promotion/${promo.promotion_id}`)}
                  >
                    {promo.image_url ? (
                      <Image source={{ uri: promo.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: stableColor(promo.promotion_id) }]} />
                    )}
                    <View style={s.promoImageOverlay} />
                    <View style={s.discountBadge}>
                      <Text style={s.discountText}>{promoBadge(promo)}</Text>
                    </View>
                    <View style={s.promoInfo}>
                      <Text style={s.promoTitle} numberOfLines={1}>{promo.title}</Text>
                      <Text style={s.promoDesc} numberOfLines={1}>{promoDescription(promo)}</Text>
                      <View style={s.promoVenueRow}>
                        <Ionicons name="location-outline" size={11} color={PURPLE} />
                        <Text style={s.promoVenue} numberOfLines={1}>{promo.clubs?.club_name || 'PartyOn venue'}</Text>
                      </View>
                    </View>
                    <View style={s.chevronCircle}>
                      <Ionicons name="chevron-forward" size={16} color={WHITE} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={s.section}>
            <SectionHeader title="All Clubs" onSeeAll={() => router.push('/top-clubs')} />
            {visibleClubs.length === 0 ? (
              <EmptyState label="No clubs available" />
            ) : (
              <View style={s.clubGrid}>
                {visibleClubs.map(club => {
                  const count = upcomingEventCount(club)
                  return (
                    <TouchableOpacity
                      key={club.club_id}
                      style={s.clubCard}
                      activeOpacity={0.84}
                      onPress={() => router.push(`/club/${club.club_id}`)}
                    >
                      <View style={[s.clubImageArea, { backgroundColor: stableColor(club.club_id) }]}>
                        {club.club_image ? (
                          <Image source={{ uri: club.club_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <Ionicons name="disc-outline" size={28} color={WHITE} />
                        )}
                        <View style={s.clubImageOverlay} />
                        <View style={s.clubCountPill}>
                          <Text style={s.clubCountText}>{count}/10</Text>
                        </View>
                        <View style={s.clubOverlayContent}>
                          <Text style={s.clubName} numberOfLines={1}>{club.club_name}</Text>
                          <Text style={s.clubTagline} numberOfLines={1}>{clubTagline(club)}</Text>
                          <View style={s.clubFooter}>
                            <View style={s.ratingRow}>
                              <Ionicons name="star" size={11} color={WHITE} />
                              <Text style={s.ratingText}>{ratingText(club)}</Text>
                            </View>
                            <View style={s.viewBtn}>
                              <Text style={s.viewBtnText}>View</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { color: WHITE, fontSize: 25, fontWeight: '900' },
  brandAccent: { color: PURPLE },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.75)',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 34 },
  section: { marginTop: 14 },
  sectionHeader: {
    paddingHorizontal: PAGE_PAD,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: WHITE, fontSize: 16, fontWeight: '900', letterSpacing: 0 },
  seeAll: { color: PURPLE, fontSize: 11, fontWeight: '800' },
  emptyCard: {
    marginHorizontal: PAGE_PAD,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  featuredList: { paddingHorizontal: PAGE_PAD, gap: 10 },
  featuredCard: {
    width: FEATURED_WIDTH,
    height: 238,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.65)',
    marginRight: 10,
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: PURPLE,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  featuredBadgeText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  featuredBody: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  featuredTitle: { color: WHITE, fontSize: 23, fontWeight: '900', marginBottom: 6 },
  featuredMeta: { color: '#d4d4d8', fontSize: 13, fontWeight: '700', marginTop: 3 },
  featuredPrice: { color: WHITE, fontSize: 14, fontWeight: '900', marginTop: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3f3f46' },
  dotActive: { width: 14, backgroundColor: PURPLE },
  eventList: { paddingHorizontal: PAGE_PAD, gap: 6 },
  eventRow: {
    minHeight: 96,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: BORDER,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventThumb: { width: 92, height: 78, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { color: WHITE, fontSize: 14, fontWeight: '900', marginBottom: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  infoText: { color: MUTED, fontSize: 10, fontWeight: '700', flex: 1 },
  eventPricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.65)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 92,
  },
  eventPriceText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  seeAllEventsBtn: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  seeAllEventsText: { color: WHITE, fontSize: 12, fontWeight: '900' },
  promoList: { paddingHorizontal: PAGE_PAD, gap: 8 },
  promoRow: {
    minHeight: 88,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingRight: 8,
    gap: 10,
    overflow: 'hidden',
  },
  promoImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.54)' },
  discountBadge: {
    minWidth: 58,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: PURPLE,
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  discountText: { color: WHITE, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  promoInfo: { flex: 1, minWidth: 0 },
  promoTitle: { color: WHITE, fontSize: 13, fontWeight: '900' },
  promoDesc: { color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginTop: 2 },
  promoVenueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  promoVenue: { color: MUTED, fontSize: 11, fontWeight: '700', flex: 1 },
  chevronCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  clubGrid: {
    paddingHorizontal: PAGE_PAD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: CLUB_GAP,
    rowGap: 8,
  },
  clubCard: {
    width: CLUB_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  clubImageArea: {
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clubImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  clubCountPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  clubCountText: { color: WHITE, fontSize: 9, fontWeight: '900' },
  clubOverlayContent: {
    position: 'absolute',
    left: 10,
    right: 8,
    bottom: 8,
  },
  clubName: { color: WHITE, fontSize: 13, fontWeight: '900' },
  clubTagline: { color: '#d4d4d8', fontSize: 10, fontWeight: '700', marginTop: 2 },
  clubFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    gap: 6,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  viewBtn: {
    backgroundColor: PURPLE,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewBtnText: { color: WHITE, fontSize: 10, fontWeight: '900' },
})
