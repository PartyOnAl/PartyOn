import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Share, Linking, Alert, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import type { Club, Event } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9', '#f59e0b', '#10b981']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ClubDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [club, setClub] = useState<Club | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([
      supabase.from('clubs').select('*').eq('club_id', id).single(),
      supabase.from('events').select('*')
        .eq('club_id', id)
        .eq('event_status', 'published')
        .order('event_starting_date', { ascending: true })
        .limit(5),
    ]).then(([clubRes, evRes]) => {
      setClub(clubRes.data as Club)
      setEvents((evRes.data as Event[]) ?? [])
      setLoading(false)
    })
  }, [id])

  async function handleShare() {
    try {
      await Share.share({ message: `Check out ${club?.club_name} on PartyON!` })
    } catch {}
  }

  function handleCall() {
    if (!club?.club_phone_number) return
    Linking.openURL(`tel:${club.club_phone_number}`)
  }

  function handleEmail() {
    if (!club?.club_email_id) return
    Linking.openURL(`mailto:${club.club_email_id}`)
  }

  function handleMaps() {
    if (!club?.club_address) return
    const q = encodeURIComponent(club.club_address)
    // Try native Maps app first, fall back to Google Maps in browser
    const nativeUrl = Platform.select({
      ios: `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
    })
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${q}`
    if (nativeUrl) {
      Linking.canOpenURL(nativeUrl).then((supported) => {
        Linking.openURL(supported ? nativeUrl : webUrl)
      })
    } else {
      Linking.openURL(webUrl)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!club) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="location-outline" size={56} color={COLORS.mutedDark} />
        <Text style={styles.notFoundText}>Club not found.</Text>
        <TouchableOpacity style={styles.backBtnSolid} onPress={() => router.back()}>
          <Text style={styles.backBtnSolidText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const accent = fallbackColor(club.club_id)
  const hasDescription = !!club.club_description
  const longDesc = hasDescription && club.club_description!.length > 220

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Floating nav buttons over hero */}
      <View style={styles.floatingNav}>
        <TouchableOpacity style={styles.floatBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero image */}
        {club.club_image ? (
          <Image source={{ uri: club.club_image }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, { backgroundColor: accent }]}>
            <Ionicons name="musical-notes" size={56} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        {/* Dark gradient scrim over hero bottom */}
        <View style={styles.heroScrim} />

        {/* Club name block overlaid on image */}
        <View style={styles.nameBlock}>
          {club.reservation_only && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>FREE RESERVATION</Text>
            </View>
          )}
          <Text style={styles.clubName}>{club.club_name}</Text>
          {club.club_address && (
            <TouchableOpacity style={styles.addressRow} onPress={handleMaps} activeOpacity={0.75}>
              <Ionicons name="location" size={14} color={COLORS.cta} />
              <Text style={styles.addressText}>{club.club_address}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content card */}
        <View style={styles.contentCard}>

          {/* Quick contact row */}
          <View style={styles.contactRow}>
            {club.club_phone_number && (
              <TouchableOpacity style={styles.contactBtn} onPress={handleCall} activeOpacity={0.8}>
                <View style={styles.contactIcon}>
                  <Ionicons name="call" size={18} color={COLORS.purple} />
                </View>
                <Text style={styles.contactLabel}>Call</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{club.club_phone_number}</Text>
              </TouchableOpacity>
            )}
            {club.club_email_id && (
              <TouchableOpacity style={styles.contactBtn} onPress={handleEmail} activeOpacity={0.8}>
                <View style={styles.contactIcon}>
                  <Ionicons name="mail" size={18} color={COLORS.purple} />
                </View>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{club.club_email_id}</Text>
              </TouchableOpacity>
            )}
            {club.club_address && (
              <TouchableOpacity style={styles.contactBtn} onPress={handleMaps} activeOpacity={0.8}>
                <View style={styles.contactIcon}>
                  <Ionicons name="navigate" size={18} color={COLORS.purple} />
                </View>
                <Text style={styles.contactLabel}>Maps</Text>
                <Text style={styles.contactValue} numberOfLines={1}>Get directions</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* About / Description */}
          {hasDescription && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text
                style={styles.description}
                numberOfLines={descExpanded ? undefined : 4}
              >
                {club.club_description}
              </Text>
              {longDesc && (
                <TouchableOpacity onPress={() => setDescExpanded((v) => !v)}>
                  <Text style={styles.readMore}>
                    {descExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Info chips */}
          <View style={styles.infoChips}>
            <View style={styles.infoChip}>
              <Ionicons name="people-outline" size={18} color={COLORS.purple} />
              <Text style={styles.infoChipLabel}>Admission</Text>
              <Text style={styles.infoChipValue}>
                {club.reservation_only ? 'Free Reservation' : 'Ticketed'}
              </Text>
            </View>
            <View style={styles.infoChipDivider} />
            <View style={styles.infoChip}>
              <Ionicons name="star-outline" size={18} color={COLORS.purple} />
              <Text style={styles.infoChipLabel}>Status</Text>
              <Text style={styles.infoChipValue} numberOfLines={1}>
                {club.club_status === 'approved' ? 'Active' : club.club_status}
              </Text>
            </View>
            <View style={styles.infoChipDivider} />
            <View style={styles.infoChip}>
              <Ionicons name="location-outline" size={18} color={COLORS.purple} />
              <Text style={styles.infoChipLabel}>Venue</Text>
              <Text style={styles.infoChipValue}>Nightclub</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Upcoming events */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {events.length === 0 ? (
              <View style={styles.noEvents}>
                <Ionicons name="calendar-outline" size={28} color={COLORS.mutedDark} />
                <Text style={styles.noEventsText}>No upcoming events scheduled</Text>
              </View>
            ) : (
              <View style={styles.eventList}>
                {events.map((ev) => (
                  <TouchableOpacity
                    key={ev.event_id}
                    style={styles.eventRow}
                    onPress={() => router.push(`/event/${ev.event_id}`)}
                    activeOpacity={0.75}
                  >
                    {ev.event_image ? (
                      <Image source={{ uri: ev.event_image }} style={styles.eventThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.eventThumb, { backgroundColor: fallbackColor(ev.event_id) }]} />
                    )}
                    <View style={styles.eventRowBody}>
                      <Text style={styles.eventRowName} numberOfLines={1}>{ev.event_name}</Text>
                      <View style={styles.eventRowMeta}>
                        <Ionicons name="calendar-outline" size={11} color={COLORS.muted} />
                        <Text style={styles.eventRowDate}>{formatDate(ev.event_starting_date)}</Text>
                        {ev.final_ticket_price != null && !club.reservation_only && (
                          <>
                            <View style={styles.dot} />
                            <Text style={styles.eventRowPrice}>€{Number(ev.final_ticket_price).toFixed(0)}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        {club.reservation_only ? (
          <View style={styles.bottomInner}>
            <View>
              <Text style={styles.bottomLabel}>Free Reservation</Text>
              <Text style={styles.bottomSub}>No payment required</Text>
            </View>
            <TouchableOpacity
              style={styles.ctaBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/search' as any)}
            >
              <Text style={styles.ctaBtnText}>Browse Events</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaBtnFull]}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: club.club_name } })}
          >
            <Ionicons name="search" size={17} color={COLORS.ctaText} />
            <Text style={styles.ctaBtnText}>View Events</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  notFoundText: { color: COLORS.muted, fontSize: FONT.md },
  backBtnSolid: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  backBtnSolidText: { color: '#fff', fontWeight: '700' },

  // Floating nav
  floatingNav: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  floatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero
  hero: {
    width: '100%',
    height: 280,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScrim: {
    position: 'absolute',
    top: 160, left: 0, right: 0, height: 120,
    // simulate gradient: transparent → dark
    backgroundColor: 'transparent',
  },

  // Name block overlaid at bottom of hero
  nameBlock: {
    marginTop: -SPACING.xl,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    zIndex: 5,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,166,35,0.2)',
    borderWidth: 1,
    borderColor: COLORS.cta,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.xs,
  },
  typeBadgeText: {
    color: COLORS.cta,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clubName: {
    color: COLORS.white,
    fontSize: FONT.xxl,
    fontWeight: '900',
    marginBottom: SPACING.xs,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addressText: {
    color: COLORS.muted,
    fontSize: FONT.sm,
    flex: 1,
  },

  // Content card
  contentCard: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },

  // Contact row
  contactRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  contactBtn: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  contactLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },

  // Section
  section: { marginBottom: SPACING.md },
  sectionTitle: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  description: {
    color: COLORS.muted,
    fontSize: FONT.base,
    lineHeight: FONT.base * 1.65,
  },
  readMore: {
    color: COLORS.purple,
    fontSize: FONT.sm,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },

  // Info chips
  infoChips: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  infoChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: 4,
  },
  infoChipDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  infoChipLabel: {
    color: COLORS.mutedDark,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoChipValue: {
    color: COLORS.white,
    fontSize: FONT.sm,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Events list
  noEvents: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  noEventsText: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
  },
  eventList: { gap: SPACING.xs },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  eventThumb: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgInput, flexShrink: 0,
  },
  eventRowBody: { flex: 1 },
  eventRowName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  eventRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  eventRowDate: { color: COLORS.muted, fontSize: 12 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.mutedDark },
  eventRowPrice: { color: COLORS.cta, fontSize: 12, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  bottomInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  bottomSub: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  ctaBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  ctaBtnFull: { width: '100%', justifyContent: 'center' },
  ctaBtnText: {
    color: COLORS.ctaText,
    fontWeight: '800',
    fontSize: FONT.base,
  },
})
