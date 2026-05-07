import { useCallback, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Image, Dimensions, ActivityIndicator,
} from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Event, Club } from '@/lib/types'
import type { Promotion } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = SCREEN_WIDTH - SPACING.lg * 2
const CARD_HEIGHT = 240
const CLUB_CARD_W = 120
const CLUB_IMG_H = 100

const FALLBACK_COLORS = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function badgeLabel(promo: Promotion): string | null {
  if (promo.discount_value) return `${promo.discount_value}% OFF`
  const cat = (promo.category ?? '').toLowerCase()
  if (cat.includes('free') || cat.includes('entry')) return 'FREE ENTRY'
  if (cat.includes('vip')) return 'VIP'
  if (cat.includes('bottle')) return 'BOTTLE SERVICE'
  return null
}

// ── Week range helpers ────────────────────────────────────────────────────────
function thisWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return {
    start: now.toISOString(),           // not before right now
    end: weekEnd.toISOString(),
  }
}

// ── Club gallery carousel card ────────────────────────────────────────────────
type ClubWithEvents = Club & { events?: { event_image: string | null }[] }

function ClubGalleryCard({ club, onPress }: { club: ClubWithEvents; onPress: () => void }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  // Build photo list: club image first, then unique event images
  const photos: string[] = []
  if (club.club_image) photos.push(club.club_image)
  for (const ev of club.events ?? []) {
    if (ev.event_image && !photos.includes(ev.event_image)) photos.push(ev.event_image)
  }
  if (photos.length === 0) photos.push('') // placeholder

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CLUB_CARD_W)
    setActiveIdx(Math.max(0, Math.min(idx, photos.length - 1)))
  }

  return (
    <TouchableOpacity style={clubStyles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Gallery */}
      <View style={clubStyles.galleryWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ width: CLUB_CARD_W, height: CLUB_IMG_H }}
        >
          {photos.map((uri, i) =>
            uri ? (
              <Image
                key={i}
                source={{ uri }}
                style={{ width: CLUB_CARD_W, height: CLUB_IMG_H }}
                resizeMode="cover"
              />
            ) : (
              <View
                key={i}
                style={[{ width: CLUB_CARD_W, height: CLUB_IMG_H }, { backgroundColor: fallbackColor(club.club_id) }]}
              />
            )
          )}
        </ScrollView>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <View style={clubStyles.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[clubStyles.dot, i === activeIdx && clubStyles.dotActive]} />
            ))}
          </View>
        )}

        {/* Photo count */}
        {photos.length > 1 && (
          <View style={clubStyles.counter}>
            <Text style={clubStyles.counterText}>{activeIdx + 1}/{photos.length}</Text>
          </View>
        )}
      </View>

      <Text style={clubStyles.name} numberOfLines={1}>{club.club_name}</Text>
    </TouchableOpacity>
  )
}

const clubStyles = StyleSheet.create({
  card: { width: CLUB_CARD_W, borderRadius: RADIUS.md, overflow: 'hidden' },
  galleryWrap: { width: CLUB_CARD_W, height: CLUB_IMG_H, position: 'relative' },
  dots: {
    position: 'absolute', bottom: 5, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 3,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 10 },
  counter: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 8,
  },
  counterText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  name: {
    color: COLORS.white, fontSize: FONT.sm, fontWeight: '600',
    textAlign: 'center', paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2,
    backgroundColor: COLORS.bgCard,
  },
})

// ── Promotion card (individually clickable, standalone style) ─────────────────
function PromoCard({ promo, onPress }: { promo: Promotion; onPress: () => void }) {
  const badge = badgeLabel(promo)
  const club = promo.clubs as any

  return (
    <TouchableOpacity style={promoCardStyles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Thumbnail */}
      <View style={promoCardStyles.thumbWrap}>
        {promo.image_url ? (
          <Image source={{ uri: promo.image_url }} style={promoCardStyles.thumb} resizeMode="cover" />
        ) : (
          <View style={[promoCardStyles.thumb, { backgroundColor: fallbackColor(promo.promotion_id) }]}>
            <Ionicons name="pricetag" size={20} color="rgba(255,255,255,0.35)" />
          </View>
        )}
        {badge && (
          <View style={promoCardStyles.badge}>
            <Text style={promoCardStyles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={promoCardStyles.body}>
        <Text style={promoCardStyles.title} numberOfLines={1}>{promo.title}</Text>
        {promo.description && (
          <Text style={promoCardStyles.desc} numberOfLines={2}>{promo.description}</Text>
        )}
        {club?.club_name && (
          <View style={promoCardStyles.meta}>
            <Ionicons name="location-outline" size={11} color={COLORS.mutedDark} />
            <Text style={promoCardStyles.metaText} numberOfLines={1}>{club.club_name}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} style={{ flexShrink: 0 }} />
    </TouchableOpacity>
  )
}

const promoCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm + 2,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  thumbWrap: { position: 'relative', flexShrink: 0 },
  thumb: {
    width: 68, height: 68,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard2,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(245,166,35,0.92)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  body: { flex: 1, gap: 3 },
  title: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  desc: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: FONT.sm * 1.4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [clubs, setClubs] = useState<ClubWithEvents[]>([])
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const carouselRef = useRef<FlatList>(null)
  const isJumping = useRef(false)

  useFocusEffect(
    useCallback(() => {
      const { start, end } = thisWeekRange()
      const today = new Date().toISOString().split('T')[0]

      Promise.all([
        // Only events happening this week, starting from now (no past events)
        supabase.from('events').select('*, clubs(*)')
          .eq('event_status', 'published')
          .gte('event_starting_date', start)
          .lte('event_starting_date', end)
          .order('event_starting_date', { ascending: true })
          .limit(10),

        // Clubs with their event images for the gallery carousel
        supabase.from('clubs').select('*, events(event_image)')
          .eq('club_status', 'approved')
          .limit(8),

        // Only active promotions that haven't expired yet
        supabase.from('promotions')
          .select('*, clubs(club_name, club_id)')
          .in('status', ['active', 'approved'])
          .gte('valid_until', today)
          .order('created_at', { ascending: false })
          .limit(5),
      ]).then(([evRes, clRes, prRes]) => {
        setEvents((evRes.data as Event[]) ?? [])
        setClubs((clRes.data as ClubWithEvents[]) ?? [])
        setPromos((prRes.data as Promotion[]) ?? [])
        setLoading(false)
      })
    }, []),
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Turn the</Text>
          <Text style={styles.headerTitle}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/promotions')}>
            <Ionicons name="pricetag-outline" size={22} color={COLORS.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/clubs-map')}>
            <Ionicons name="location-outline" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── This Week ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            {/* Goes to dedicated all-events page, not search */}
            <TouchableOpacity onPress={() => router.push('/all-events')}>
              <Text style={styles.seeAll}>See All Events</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.purple} style={{ marginVertical: SPACING.xl }} />
          ) : events.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🎭</Text>
              <Text style={styles.emptyText}>No events this week</Text>
              <TouchableOpacity onPress={() => router.push('/all-events')}>
                <Text style={styles.emptyLink}>Browse upcoming events →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={carouselRef}
              horizontal
              data={events.length > 0 ? [...events, ...events, ...events] : events}
              keyExtractor={(e, i) => `${e.event_id}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.md }}
              snapToInterval={CARD_WIDTH + SPACING.md}
              decelerationRate="fast"
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + SPACING.md,
                offset: (CARD_WIDTH + SPACING.md) * index,
                index,
              })}
              onLayout={() => {
                if (events.length > 0) {
                  const itemW = CARD_WIDTH + SPACING.md
                  carouselRef.current?.scrollToOffset({
                    offset: itemW * events.length,
                    animated: false,
                  })
                }
              }}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (isJumping.current || events.length === 0) return
                const itemW = CARD_WIDTH + SPACING.md
                const offset = e.nativeEvent.contentOffset.x
                const total = events.length
                const midStart = itemW * total
                const midEnd   = itemW * total * 2
                if (offset < midStart) {
                  isJumping.current = true
                  carouselRef.current?.scrollToOffset({ offset: offset + total * itemW, animated: false })
                  setTimeout(() => { isJumping.current = false }, 50)
                } else if (offset >= midEnd) {
                  isJumping.current = true
                  carouselRef.current?.scrollToOffset({ offset: offset - total * itemW, animated: false })
                  setTimeout(() => { isJumping.current = false }, 50)
                }
              }}
              renderItem={({ item: ev }) => (
                <TouchableOpacity
                  style={styles.eventCard}
                  onPress={() => router.push(`/event/${ev.event_id}`)}
                  activeOpacity={0.88}
                >
                  {ev.event_image ? (
                    <Image source={{ uri: ev.event_image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackColor(ev.event_id) }]} />
                  )}
                  <View style={styles.cardScrim} />
                  <View style={styles.cardBody}>
                    {ev.clubs?.reservation_only && (
                      <View style={styles.reserveBadge}>
                        <Text style={styles.reserveBadgeText}>Reservation Only</Text>
                      </View>
                    )}
                    <Text style={styles.cardTitle} numberOfLines={2}>{ev.event_name}</Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.cardMetaText}>{formatDate(ev.event_starting_date)}</Text>
                      {ev.clubs?.club_address && (
                        <>
                          <View style={styles.metaDot} />
                          <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                          <Text style={styles.cardMetaText} numberOfLines={1}>{ev.clubs.club_address}</Text>
                        </>
                      )}
                    </View>
                    {ev.final_ticket_price != null && !ev.clubs?.reservation_only && (
                      <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>€{Number(ev.final_ticket_price).toFixed(0)}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* ── Top Clubs with gallery carousel ── */}
        {!loading && clubs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Clubs</Text>
              <TouchableOpacity onPress={() => router.push('/top-clubs')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: SPACING.sm }}
            >
              {clubs.map((club) => (
                <ClubGalleryCard
                  key={club.club_id}
                  club={club}
                  onPress={() => router.push(`/club/${club.club_id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Promotions — individual cards, each separately clickable ── */}
        {!loading && promos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Promotions</Text>
              <TouchableOpacity onPress={() => router.push('/promotions')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.promoCards}>
              {promos.map((p) => (
                <PromoCard
                  key={p.promotion_id}
                  promo={p}
                  onPress={() => router.push(`/promotion/${p.promotion_id}`)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: SPACING.xl + 20 }} />
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  greeting: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '500' },
  headerTitle: { fontSize: FONT.xl + 2, fontWeight: '900', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: FONT.md, fontWeight: '700', color: COLORS.white },
  seeAll: { fontSize: FONT.sm, color: COLORS.purple, fontWeight: '600' },

  // Empty state for This Week
  emptyBox: {
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: { fontSize: FONT.sm, color: COLORS.muted, fontWeight: '500' },
  emptyLink: { fontSize: FONT.sm, color: COLORS.purple, fontWeight: '600', marginTop: 4 },

  // Event cards
  eventCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginRight: SPACING.md,
    backgroundColor: COLORS.bgCard,
  },
  cardScrim: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardBody: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: SPACING.md,
  },
  reserveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderWidth: 1, borderColor: COLORS.purple,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    marginBottom: SPACING.xs,
  },
  reserveBadgeText: { color: COLORS.purple, fontSize: 10, fontWeight: '700' },
  cardTitle: {
    color: COLORS.white, fontSize: FONT.md, fontWeight: '800', marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 12, flex: 1,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  priceTag: {
    alignSelf: 'flex-start', marginTop: SPACING.xs,
    backgroundColor: COLORS.cta, borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2, paddingVertical: 3,
  },
  priceTagText: { color: COLORS.ctaText, fontSize: 12, fontWeight: '800' },

  // Promotions — individual cards, not a grouped box
  promoCards: {
    paddingHorizontal: SPACING.md,
  },
})
