import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Share, Linking, Alert, Dimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Promotion } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_W } = Dimensions.get('window')
const RELATED_CARD_W = SCREEN_W * 0.7

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const TERMS = [
  'Offer subject to availability, venue rules, and age restrictions. Non-transferable unless stated.',
  'The venue is responsible for fulfilment and may verify ID at entry.',
  'PartyOn is a booking platform; in-venue disputes are handled by the venue.',
  'Offer may be limited on peak nights; unused promotional value may not roll over.',
]

const FALLBACK_COLORS = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9']
function fallbackBg(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length]
}

function badgeLabel(promo: Promotion): string | null {
  if (promo.discount_value) return `${promo.discount_value}% OFF`
  const cat = (promo.category ?? '').toLowerCase()
  if (cat.includes('free') || cat.includes('entry')) return 'Free'
  if (cat.includes('vip')) return 'VIP'
  return null
}

// ── Related card ──────────────────────────────────────────────────────────────
function RelatedCard({ promo, onPress }: { promo: Promotion; onPress: () => void }) {
  const label = badgeLabel(promo)

  return (
    <TouchableOpacity style={rc.card} activeOpacity={0.88} onPress={onPress}>
      {/* Image / fallback */}
      <View style={rc.imageWrap}>
        {promo.image_url
          ? <Image source={{ uri: promo.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackBg(promo.promotion_id) }]} />
        }
        <View style={rc.imgScrim} />
        {label && (
          <View style={rc.badge}>
            <Text style={rc.badgeText}>{label}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={rc.body}>
        <Text style={rc.title} numberOfLines={2}>{promo.title}</Text>
        {promo.description && (
          <Text style={rc.desc} numberOfLines={2}>{promo.description}</Text>
        )}
        {promo.clubs?.club_name && (
          <Text style={rc.meta} numberOfLines={1}>
            {promo.clubs.club_name}{promo.clubs.club_address ? ` • ${promo.clubs.club_address}` : ''}
          </Text>
        )}
        <View style={rc.viewBtn}>
          <Text style={rc.viewBtnText}>View Offer</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PromotionDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuth()

  const [promo, setPromo] = useState<Promotion | null>(null)
  const [related, setRelated] = useState<Promotion[]>([])
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [claimedCode, setClaimedCode] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    Promise.all([
      supabase
        .from('promotions')
        .select('*, clubs(club_name, club_address, club_id)')
        .eq('promotion_id', id)
        .single(),
      user
        ? supabase.from('saved_promotions').select('promotion_id')
            .eq('user_id', user.id).eq('promotion_id', id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('promotions')
        .select('*, clubs(club_name, club_address, club_id)')
        .in('status', ['active', 'approved'])
        .neq('promotion_id', id)
        .limit(6),
      user
        ? supabase.from('claimed_promotions').select('redemption_code, status')
            .eq('user_id', user.id).eq('promotion_id', id)
            .neq('status', 'cancelled').maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([promoRes, savedRes, relatedRes, claimedRes]) => {
      setPromo(promoRes.data as Promotion)
      setIsSaved(!!savedRes.data)
      setRelated((relatedRes.data as Promotion[]) ?? [])
      setClaimedCode((claimedRes.data as any)?.redemption_code ?? null)
      setLoading(false)
    })
  }, [id, user])

  async function toggleSave() {
    if (!user) {
      Alert.alert('Login required', 'Please log in to save promotions.', [
        { text: 'Log in', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    if (!promo) return
    setSaving(true)
    if (isSaved) {
      await supabase.from('saved_promotions').delete()
        .eq('user_id', user.id).eq('promotion_id', promo.promotion_id)
      setIsSaved(false)
    } else {
      await supabase.from('saved_promotions').insert({ user_id: user.id, promotion_id: promo.promotion_id })
      setIsSaved(true)
    }
    setSaving(false)
  }

  async function handleShare() {
    if (!promo) return
    try { await Share.share({ message: `${promo.title} — Check this offer on PartyOn!` }) } catch {}
  }

  async function handleClaim() {
    if (!user) {
      Alert.alert('Login required', 'Please log in to claim this offer.', [
        { text: 'Log in', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    if (!promo) return

    if (claimedCode) {
      router.push({ pathname: '/(tabs)/bookings', params: { section: 'offers' } })
      return
    }

    setClaiming(true)
    const { data, error } = await supabase
      .from('claimed_promotions')
      .insert({ user_id: user.id, promotion_id: promo.promotion_id })
      .select('redemption_code')
      .single()
    setClaiming(false)

    if (error || !data) {
      Alert.alert(
        'Could not claim',
        error?.message ?? 'Something went wrong. Please try again.',
      )
      return
    }

    setClaimedCode(data.redemption_code as string)
    Alert.alert(
      'Offer Claimed!',
      'Your claim has been saved. Find it under Offers in Your Nights and show the code at the door to redeem.',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'View My Offers',
          onPress: () => router.push({ pathname: '/(tabs)/bookings', params: { section: 'offers' } }),
        },
      ],
    )
  }

  function handleOpenMaps() {
    const addr = promo?.clubs?.club_address
    if (!addr) return
    Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`)
  }

  // ── Loading ──
  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  // ── Not found ──
  if (!promo) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <Ionicons name="pricetag-outline" size={52} color={COLORS.mutedDark} />
        <Text style={s.notFoundTitle}>Promotion not found</Text>
        <TouchableOpacity style={s.notFoundBtn} onPress={() => router.back()}>
          <Text style={s.notFoundBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const label = badgeLabel(promo)
  const isExpiringSoon =
    !!promo.valid_until &&
    new Date(promo.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

  const whyPoints = [
    promo.discount_value
      ? `Real savings — ${promo.discount_value}% off at ${promo.clubs?.club_name ?? 'this venue'} — less than walk-up pricing when the night is busy.`
      : null,
    'Skip the guesswork — Redemption steps are clear before you arrive so door and table staff are aligned.',
    'Exclusive window — This offer gives you priority treatment over generic guest-list queues.',
  ].filter(Boolean) as string[]

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          {promo.image_url
            ? <Image source={{ uri: promo.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackBg(promo.promotion_id) }]} />
          }
          {/* dark overlay */}
          <View style={s.heroOverlay} />

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>

          <View style={s.heroActions}>
            <TouchableOpacity style={s.heroIconBtn} onPress={toggleSave} disabled={saving} hitSlop={8}>
              {saving
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={isSaved ? COLORS.purple : COLORS.white}
                  />
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.heroIconBtn} onPress={handleShare} hitSlop={8}>
              <Ionicons name="share-social-outline" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.content}>

          {/* ── Tags ── */}
          <View style={s.tagRow}>
            {label && (
              <View style={s.tagPurple}>
                <Text style={s.tagPurpleText}>{label}</Text>
              </View>
            )}
            {promo.category && (
              <View style={s.tagOutline}>
                <Text style={s.tagOutlineText}>{promo.category}</Text>
              </View>
            )}
          </View>

          {/* ── Title ── */}
          <Text style={s.title}>{promo.title}</Text>

          {/* ── Club meta ── */}
          {promo.clubs?.club_name && (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.mutedDark} />
              <Text style={s.metaText} numberOfLines={1}>
                {promo.clubs.club_name}
                {promo.clubs.club_address ? ` • ${promo.clubs.club_address}` : ''}
              </Text>
            </View>
          )}

          {/* ── Claim card ── */}
          <View style={s.priceCard}>
            {promo.discount_value && (
              <View style={s.savingsBadge}>
                <Text style={s.savingsText}>You save {promo.discount_value}% with this offer</Text>
              </View>
            )}
            {claimedCode && (
              <View style={s.claimedBanner}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                <Text style={s.claimedBannerText}>
                  Claimed · Code <Text style={s.claimedBannerCode}>{claimedCode.toUpperCase()}</Text>
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={s.claimBtn}
              onPress={handleClaim}
              activeOpacity={0.85}
              disabled={claiming}
            >
              {claimedCode ? (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(16,185,129,0.15)' }]} />
              ) : (
                <LinearGradient
                  colors={['#e040b8', '#a83cd8', '#7c3aed', '#6d28d9']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              {claiming ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={[s.claimBtnText, claimedCode ? { color: COLORS.green } : null]}>
                  {claimedCode ? 'View in Your Nights' : 'Claim Offer'}
                </Text>
              )}
            </TouchableOpacity>
            <View style={s.saveShareRow}>
              <TouchableOpacity style={s.outlineBtn} onPress={toggleSave} disabled={saving}>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={15} color={COLORS.white} />
                <Text style={s.outlineBtnText}>{isSaved ? 'Saved' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.outlineBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={15} color={COLORS.white} />
                <Text style={s.outlineBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── About This Offer ── */}
          {promo.description && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About This Offer</Text>
              <Text style={s.sectionText}>{promo.description}</Text>
            </View>
          )}

          {/* ── Why This Offer Is Worth It ── */}
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.purpleDark} />
              <Text style={s.sectionTitle}>Why This Offer Is Worth It</Text>
            </View>
            {whyPoints.map((point, i) => (
              <View key={i} style={s.bulletRow}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* ── Valid Until + Location chips ── */}
          <View style={s.chipsRow}>
            {promo.valid_until && (
              <View style={s.chip}>
                <View style={s.chipIconWrap}>
                  <Ionicons name="pricetag-outline" size={14} color={COLORS.logoPink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.chipLabel}>Valid Until</Text>
                  <Text style={[s.chipValue, isExpiringSoon && { color: COLORS.red }]}>
                    {isExpiringSoon ? '⚡ ' : ''}{formatDate(promo.valid_until)}
                  </Text>
                </View>
              </View>
            )}
            {promo.clubs?.club_address && (
              <View style={s.chip}>
                <View style={s.chipIconWrap}>
                  <Ionicons name="location-outline" size={14} color={COLORS.logoPink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.chipLabel}>Location</Text>
                  <Text style={s.chipValue} numberOfLines={2}>{promo.clubs.club_address}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Venue ── */}
          {promo.clubs && (
            <View style={s.venueCard}>
              <Text style={s.venueLabel}>Venue</Text>
              <Text style={s.venueName}>{promo.clubs.club_name}</Text>
              {promo.clubs.club_address && (
                <Text style={s.venueAddress}>{promo.clubs.club_address}</Text>
              )}
              <View style={s.mapPlaceholder}>
                <Ionicons name="location-outline" size={30} color="rgba(255,255,255,0.18)" />
              </View>
              <TouchableOpacity style={s.mapsBtn} onPress={handleOpenMaps}>
                <Ionicons name="open-outline" size={15} color={COLORS.white} />
                <Text style={s.mapsBtnText}>Open in Google Maps</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Terms & Conditions ── */}
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="shield-outline" size={16} color={COLORS.mutedDark} />
              <Text style={s.sectionTitle}>Terms & Conditions</Text>
            </View>
            {TERMS.map((term, i) => (
              <View key={i} style={s.bulletRow}>
                <View style={s.termDot} />
                <Text style={s.termText}>{term}</Text>
              </View>
            ))}
          </View>

        </View>

        {/* ── You Might Also Like ── */}
        {related.length > 0 && (
          <View style={s.relatedSection}>
            <Text style={s.relatedTitle}>You Might Also Like</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.relatedScroll}
            >
              {related.map((item) => (
                <RelatedCard
                  key={item.promotion_id}
                  promo={item}
                  onPress={() => router.push(`/promotion/${item.promotion_id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── Related card styles ───────────────────────────────────────────────────────
const rc = StyleSheet.create({
  card: {
    width: RELATED_CARD_W,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageWrap: { height: 165, position: 'relative' },
  imgScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 60,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  badge: {
    position: 'absolute',
    top: SPACING.sm, left: SPACING.sm,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: COLORS.purpleDark,
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  body: { padding: SPACING.md, gap: SPACING.xs + 2 },
  title: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800', lineHeight: FONT.base * 1.3 },
  desc: { color: 'rgba(255,255,255,0.58)', fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },
  meta: { color: COLORS.muted, fontSize: 12 },
  viewBtn: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.logoPink,
    paddingVertical: 9,
    alignItems: 'center',
  },
  viewBtnText: { color: COLORS.logoPink, fontSize: FONT.sm, fontWeight: '700' },
})

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  notFoundTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  notFoundBtn: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
  },
  notFoundBtnText: { color: COLORS.white, fontWeight: '600', fontSize: FONT.base },

  /* Hero */
  hero: { height: 300, overflow: 'hidden', position: 'relative' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backBtn: {
    position: 'absolute',
    top: SPACING.md, left: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  backBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  heroActions: {
    position: 'absolute',
    top: SPACING.md, right: SPACING.md,
    flexDirection: 'row', gap: SPACING.sm,
  },
  heroIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* Content */
  content: { padding: SPACING.md, gap: SPACING.md },

  /* Tags */
  tagRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  tagPurple: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 13, paddingVertical: 5,
    backgroundColor: COLORS.purpleDark,
  },
  tagPurpleText: { color: COLORS.white, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  tagOutline: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 13, paddingVertical: 5,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tagOutlineText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },

  /* Title / meta */
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', lineHeight: FONT.xl * 1.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },

  /* Claim card */
  priceCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md, gap: SPACING.sm,
  },
  savingsBadge: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 6,
    alignSelf: 'center',
  },
  savingsText: { color: '#4ade80', fontSize: FONT.sm, fontWeight: '700', textAlign: 'center' },
  claimedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
  },
  claimedBannerText: { color: COLORS.green, fontSize: FONT.sm, fontWeight: '700' },
  claimedBannerCode: { color: COLORS.white, fontWeight: '800', letterSpacing: 1 },
  claimBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleDark,
    overflow: 'hidden',
  },
  claimBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800', letterSpacing: 0.3, zIndex: 1 },
  saveShareRow: { flexDirection: 'row', gap: SPACING.sm },
  outlineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  outlineBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },

  /* Section */
  section: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md, gap: SPACING.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', flex: 1 },
  sectionText: { color: 'rgba(255,255,255,0.72)', fontSize: FONT.sm, lineHeight: FONT.sm * 1.65 },

  /* Why bullets */
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: {
    width: 8, height: 8, borderRadius: 4,
    marginTop: 5, flexShrink: 0,
    backgroundColor: COLORS.purpleDark,
  },
  bulletText: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: FONT.sm, lineHeight: FONT.sm * 1.55 },

  /* Terms bullets */
  termDot: {
    width: 6, height: 6, borderRadius: 3,
    marginTop: 6, flexShrink: 0,
    backgroundColor: COLORS.mutedDark,
  },
  termText: { flex: 1, color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.6 },

  /* Chips */
  chipsRow: { flexDirection: 'row', gap: SPACING.sm },
  chip: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  chipIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500', marginBottom: 2 },
  chipValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },

  /* Venue */
  venueCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md, gap: SPACING.sm,
  },
  venueLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1,
  },
  venueName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  venueAddress: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: FONT.sm * 1.4 },
  mapPlaceholder: {
    height: 120,
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.18)',
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  mapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
  },
  mapsBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },

  /* You Might Also Like */
  relatedSection: { marginTop: SPACING.xs, paddingBottom: SPACING.lg },
  relatedTitle: {
    color: COLORS.white, fontSize: FONT.lg, fontWeight: '800',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  relatedScroll: { paddingHorizontal: SPACING.md, gap: SPACING.md },
})
