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

// ── Promotion row (list style matching screenshot) ────────────────────────────
function PromoRow({ promo, onPress }: { promo: Promotion; onPress: () => void }) {
  const badge = badgeLabel(promo)
  const club = promo.clubs as any

  return (
    <TouchableOpacity style={pr.row} onPress={onPress} activeOpacity={0.75}>
      {/* Thumbnail */}
      <View style={pr.thumbWrap}>
        {promo.image_url ? (
          <Image source={{ uri: promo.image_url }} style={pr.thumb} resizeMode="cover" />
        ) : (
          <View style={[pr.thumb, { backgroundColor: fallbackColor(promo.promotion_id) }]}>
            <Ionicons name="pricetag" size={22} color="rgba(255,255,255,0.35)" />
          </View>
        )}
        {badge && (
          <View style={pr.badge}>
            <Text style={pr.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={pr.body}>
        <Text style={pr.title} numberOfLines={1}>{promo.title}</Text>
        {promo.description && (
          <Text style={pr.desc} numberOfLines={2}>{promo.description}</Text>
        )}
        {club?.club_name && (
          <View style={pr.meta}>
            <Ionicons name="location-outline" size={11} color={COLORS.mutedDark} />
            <Text style={pr.metaText} numberOfLines={1}>{club.club_name}</Text>
          </View>
        )}
      </View>

      {/* Bookmark */}
      <Ionicons name="bookmark-outline" size={18} color={COLORS.mutedDark} style={pr.bookmark} />
    </TouchableOpacity>
  )
}

const pr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  thumbWrap: { position: 'relative', flexShrink: 0 },
  thumb: {
    width: 72, height: 72,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(245,166,35,0.92)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  body: { flex: 1, gap: 4 },
  title: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  desc: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: FONT.sm * 1.4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.mutedDark, fontSize: 12, flex: 1 },
  bookmark: { flexShrink: 0 },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const carouselRef = useRef<FlatList>(null)
  const isJumping = useRef(false)

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        supabase.from('events').select('*, clubs(*)').eq('event_status', 'published')
          .order('event_starting_date', { ascending: true }).limit(10),
        supabase.from('clubs').select('*').eq('club_status', 'approved').limit(8),
        supabase.from('promotions')
          .select('*, clubs(club_name, club_id)')
          .in('status', ['active', 'approved'])
          .order('created_at', { ascending: false })
          .limit(5),
      ]).then(([evRes, clRes, prRes]) => {
        setEvents((evRes.data as Event[]) ?? [])
        setClubs((clRes.data as Club[]) ?? [])
        setPromos((prRes.data as Promotion[]) ?? [])
        setLoading(false)
      })
    }, []),
  )

  const greeting = 'Turn the'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
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
        {/* This Week — horizontal card scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.purple} style={{ marginVertical: SPACING.xl }} />
          ) : events.length === 0 ? (
            <Text style={styles.empty}>No upcoming events yet.</Text>
          ) : (
            <FlatList
              ref={carouselRef}
              horizontal
              // Triple the data: [copy1, original, copy2] — start in the middle
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
                // Start in the middle copy so both directions have room to scroll
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
                const midStart = itemW * total        // start of middle copy
                const midEnd   = itemW * total * 2   // start of last copy

                if (offset < midStart) {
                  // Scrolled back into first copy → teleport to same position in middle
                  isJumping.current = true
                  carouselRef.current?.scrollToOffset({ offset: offset + total * itemW, animated: false })
                  setTimeout(() => { isJumping.current = false }, 50)
                } else if (offset >= midEnd) {
                  // Scrolled forward into last copy → teleport to same position in middle
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

        {/* Top Clubs — horizontal strip */}
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
                <TouchableOpacity
                  key={club.club_id}
                  style={styles.clubCard}
                  onPress={() => router.push(`/club/${club.club_id}`)}
                  activeOpacity={0.85}
                >
                  {club.club_image ? (
                    <Image source={{ uri: club.club_image }} style={styles.clubCardImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.clubCardImage, { backgroundColor: fallbackColor(club.club_id) }]} />
                  )}
                  {club.reservation_only && (
                    <View style={styles.clubBadge}>
                      <Text style={styles.clubBadgeText}>Free</Text>
                    </View>
                  )}
                  <Text style={styles.clubName} numberOfLines={1}>{club.club_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Promotions — vertical list rows */}
        {!loading && promos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Promotions</Text>
              <TouchableOpacity onPress={() => router.push('/promotions')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.promoList}>
              {promos.map((p, i) => (
                <View key={p.promotion_id}>
                  <PromoRow promo={p} onPress={() => router.push('/promotions')} />
                  {i < promos.length - 1 && <View style={styles.promoSeparator} />}
                </View>
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
  empty: { color: COLORS.muted, fontSize: FONT.sm, paddingHorizontal: SPACING.md },

  // Event cards (unchanged)
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
    paddingTop: SPACING.md,
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

  // Club strip (unchanged)
  clubCard: { width: 110, borderRadius: RADIUS.md, overflow: 'hidden' },
  clubCardImage: {
    width: 110, height: 90,
    borderRadius: RADIUS.md, marginBottom: 6, backgroundColor: COLORS.bgCard,
  },
  clubBadge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: COLORS.cta, borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  clubBadgeText: { color: COLORS.ctaText, fontSize: 9, fontWeight: '800' },
  clubName: {
    color: COLORS.white, fontSize: FONT.sm, fontWeight: '600',
    textAlign: 'center', paddingHorizontal: 4,
  },

  // Promotions list card
  promoList: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  promoSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.md + 72 + SPACING.sm, // skip thumbnail
  },
})
