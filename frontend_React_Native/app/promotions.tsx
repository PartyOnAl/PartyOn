import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Share, Modal, Pressable,
  ScrollView, Dimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Promotion } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const CARD_IMAGE_H = 220
const { width: SCREEN_W } = Dimensions.get('window')
const CELL_SIZE = Math.floor((SCREEN_W - SPACING.lg * 2) / 7)

// ── Date helpers ──────────────────────────────────────────────────────────────
function sod(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function eod(d: Date) { const e = sod(d); e.setHours(23, 59, 59, 999); return e }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function formatRangeLabel(from: Date | null, to: Date | null) {
  if (!from) return ''
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
  if (!to || sameDay(from, to)) return fmt(from)
  return `${fmt(from)} — ${fmt(to)}`
}
function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function formatDateBlock(iso: string | null): { dow: string; day: string; mon: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return {
    dow: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function badgeInfo(promo: Promotion): { label: string } | null {
  if (promo.discount_value) return { label: `${promo.discount_value}% OFF` }
  const cat = (promo.category ?? '').toLowerCase()
  if (cat.includes('free') || cat.includes('entry')) return { label: 'FREE ENTRY' }
  if (cat.includes('vip')) return { label: 'VIP' }
  if (cat.includes('bottle')) return { label: 'BOTTLE' }
  if (cat.includes('ladies')) return { label: 'LADIES' }
  return null
}

function calculatedDiscountedPrice(promo: Promotion): number | null {
  if (promo.discounted_price != null) return promo.discounted_price
  if (promo.original_price == null || promo.discount_value == null) return null
  const discount = Math.min(100, Math.max(0, promo.discount_value))
  return Math.max(0, promo.original_price * (1 - discount / 100))
}

const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}

// ── Included items tags ───────────────────────────────────────────────────────
function parseIncludedItems(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, 3)
}
function itemIcon(item: string): string {
  const l = item.toLowerCase()
  if (l.includes('drink') || l.includes('cocktail') || l.includes('beverage')) return 'wine-outline'
  if (l.includes('bottle')) return 'wine-outline'
  if (l.includes('dj') || l.includes('music') || l.includes('performance')) return 'musical-notes-outline'
  if (l.includes('food') || l.includes('menu') || l.includes('snack')) return 'restaurant-outline'
  if (l.includes('entry') || l.includes('ticket')) return 'ticket-outline'
  if (l.includes('vip')) return 'star-outline'
  return 'checkmark-circle-outline'
}

// ── Date range type ───────────────────────────────────────────────────────────
type DateRange = { from: Date; to: Date }

// ── Date Range Calendar Modal ─────────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

function mondayOffset(date: Date) { return (date.getDay() + 6) % 7 }

function MonthGrid({
  year, month, from, to, onDayPress,
}: {
  year: number; month: number
  from: Date | null; to: Date | null
  onDayPress: (d: Date) => void
}) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = mondayOffset(firstDay)
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  const today = sod(new Date())

  return (
    <View style={mg.month}>
      <Text style={mg.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
      <View style={mg.dayHeaders}>
        {DAY_LABELS.map((d) => <Text key={d} style={mg.dayHeader}>{d}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, ri) => {
        const row = cells.slice(ri * 7, ri * 7 + 7)
        return (
          <View key={ri} style={mg.row}>
            {row.map((day, di) => {
              if (!day) return <View key={di} style={mg.cell} />
              const d = new Date(year, month, day)
              const isStart = from && sameDay(d, from)
              const isEnd = to && sameDay(d, to)
              const inRange = from && to && d > from && d < to
              const isToday = sameDay(d, today)
              const isSelected = isStart || isEnd
              const barLeft = isStart && to && !sameDay(from!, to)
              const barRight = isEnd && from && !sameDay(from!, to!)
              const barFull = !!inRange
              return (
                <TouchableOpacity key={di} style={mg.cell} onPress={() => onDayPress(d)} activeOpacity={0.75}>
                  {(barLeft || barRight || barFull) && (
                    <View style={[mg.rangeBar, barLeft && mg.rangeBarLeft, barRight && mg.rangeBarRight]} />
                  )}
                  <View style={[mg.circle, isSelected && mg.circleSelected]}>
                    <Text style={[mg.dayText, isSelected && mg.dayTextSelected, isToday && !isSelected && mg.dayTextToday, !!inRange && mg.dayTextInRange]}>
                      {day}
                    </Text>
                  </View>
                  {isToday && !isSelected && <View style={mg.todayDot} />}
                </TouchableOpacity>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

function DateRangeModal({ visible, initialRange, onApply, onClose }: {
  visible: boolean; initialRange: DateRange | null
  onApply: (range: DateRange) => void; onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const now = new Date()
  const [from, setFrom] = useState<Date | null>(initialRange?.from ?? null)
  const [to, setTo] = useState<Date | null>(initialRange?.to ?? null)
  const [step, setStep] = useState<'from' | 'to'>('from')

  useEffect(() => {
    if (visible) { setFrom(initialRange?.from ?? null); setTo(initialRange?.to ?? null); setStep('from') }
  }, [visible])

  const months = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    }), [])

  function handleDayPress(d: Date) {
    if (step === 'from') { setFrom(sod(d)); setTo(null); setStep('to') }
    else {
      if (from && d < from) { setFrom(sod(d)); setTo(null); setStep('to') }
      else { setTo(eod(d)); setStep('from') }
    }
  }
  function quickSelect(f: Date, t: Date) { setFrom(sod(f)); setTo(eod(t)); setStep('from') }

  const canApply = from !== null
  const rangeLabel = from ? formatRangeLabel(from, to) : 'Select start date'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[drm.container, { paddingTop: insets.top }]}>
        <View style={drm.header}>
          <Text style={drm.headerTitle}>When do you want to go out?</Text>
          <TouchableOpacity onPress={onClose} style={drm.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        <View style={drm.quickRow}>
          {[
            { label: 'Today', onPress: () => quickSelect(now, now) },
            { label: 'Tomorrow', onPress: () => { const t = addDays(now, 1); quickSelect(t, t) } },
            { label: 'This week', onPress: () => { const end = addDays(now, 6 - ((now.getDay() + 6) % 7)); quickSelect(now, end) } },
          ].map(({ label, onPress }) => (
            <TouchableOpacity key={label} style={drm.quickPill} onPress={onPress} activeOpacity={0.75}>
              <Text style={drm.quickPillText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {months.map(({ year, month }) => (
            <MonthGrid key={`${year}-${month}`} year={year} month={month} from={from} to={to} onDayPress={handleDayPress} />
          ))}
        </ScrollView>
        <View style={[drm.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <TouchableOpacity
            style={[drm.applyBtn, !canApply && drm.applyBtnDisabled]}
            onPress={() => canApply && onApply({ from: from!, to: to ?? eod(from!) })}
            disabled={!canApply}
            activeOpacity={0.85}
          >
            <Text style={drm.applyBtnText}>{canApply ? rangeLabel : 'Select a date'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Filter type ───────────────────────────────────────────────────────────────
type Filter = 'all' | 'saved' | 'tonight' | 'week' | 'range'

// ── Promo with optional deleted flag ─────────────────────────────────────────
type PromoItem = Promotion & { _unavailable?: boolean }

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PromotionsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ filter?: string }>()

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [deletedSaved, setDeletedSaved] = useState<Promotion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>((params.filter as Filter) ?? 'all')
  const [pickedRange, setPickedRange] = useState<DateRange | null>(null)
  const [showCal, setShowCal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [promoRes, savedRes] = await Promise.all([
      supabase
        .from('promotions')
        .select('*, clubs(club_name, club_address, club_id)')
        .in('status', ['active', 'approved'])
        .is('deleted_at', null)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order('valid_until', { ascending: true, nullsFirst: false }),
      user
        ? supabase.from('saved_promotions').select('promotion_id').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    const ids = new Set((savedRes.data ?? []).map((r: any) => r.promotion_id))
    setPromotions((promoRes.data as Promotion[]) ?? [])
    setSavedIds(ids)

    // Fetch deleted promos that this user has saved (to show as unavailable in saved tab)
    if (user && ids.size > 0) {
      const { data: deletedData } = await supabase
        .from('promotions')
        .select('*, clubs(club_name, club_address, club_id)')
        .in('promotion_id', [...ids])
        .not('deleted_at', 'is', null)
      setDeletedSaved((deletedData as Promotion[]) ?? [])
    } else {
      setDeletedSaved([])
    }

    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  async function toggleSave(promoId: string) {
    if (!user) { router.push('/(auth)/login'); return }
    setSavingId(promoId)
    const isSaved = savedIds.has(promoId)
    if (isSaved) {
      await supabase.from('saved_promotions').delete().eq('user_id', user.id).eq('promotion_id', promoId)
      setSavedIds((prev) => { const n = new Set(prev); n.delete(promoId); return n })
    } else {
      await supabase.from('saved_promotions').insert({ user_id: user.id, promotion_id: promoId })
      setSavedIds((prev) => new Set(prev).add(promoId))
    }
    setSavingId(null)
  }

  async function handleShare(promo: Promotion) {
    try { await Share.share({ message: `${promo.title} — Check this offer on PartyON!` }) } catch {}
  }

  function handleRangeApply(range: DateRange) {
    setPickedRange(range); setFilter('range'); setShowCal(false)
  }

  const now = new Date()

  const filtered = useMemo((): PromoItem[] => {
    let base: PromoItem[]
    switch (filter) {
      case 'saved': {
        const active: PromoItem[] = promotions.filter((p) => savedIds.has(p.promotion_id))
        const unavailable: PromoItem[] = deletedSaved.map(p => ({ ...p, _unavailable: true }))
        return [...active, ...unavailable].sort((a, b) => {
          if (a._unavailable && !b._unavailable) return 1
          if (!a._unavailable && b._unavailable) return -1
          const aT = a.valid_until ? new Date(a.valid_until).getTime() : Infinity
          const bT = b.valid_until ? new Date(b.valid_until).getTime() : Infinity
          return aT - bT
        })
      }
      case 'tonight': {
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        base = promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          return pfrom <= now && until >= now && until <= in24h
        })
        break
      }
      case 'week': {
        const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        base = promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          return pfrom <= in7d && until >= now && until <= in7d
        })
        break
      }
      case 'range': {
        if (!pickedRange) { base = promotions; break }
        base = promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          return pfrom <= pickedRange.to && until >= pickedRange.from
        })
        break
      }
      default:
        base = promotions
    }
    // Sort by valid_until ascending (soonest expiring first)
    return [...base].sort((a, b) => {
      const aT = a.valid_until ? new Date(a.valid_until).getTime() : Infinity
      const bT = b.valid_until ? new Date(b.valid_until).getTime() : Infinity
      return aT - bT
    })
  }, [promotions, deletedSaved, filter, savedIds, pickedRange])

  const pillLabel = filter === 'range' && pickedRange
    ? formatRangeLabel(pickedRange.from, pickedRange.to)
    : 'Pick dates'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotions</Text>
        <TouchableOpacity
          style={[styles.savedHeaderBtn, filter === 'saved' && styles.savedHeaderBtnActive]}
          onPress={() => setFilter(filter === 'saved' ? 'all' : 'saved')}
        >
          <Ionicons
            name={filter === 'saved' ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={filter === 'saved' ? COLORS.purple : COLORS.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {([
          { key: 'all', label: 'All' },
          { key: 'tonight', label: 'Tonight' },
          { key: 'week', label: 'This week' },
        ] as { key: Filter; label: string }[]).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, filter === f.key && styles.pillActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={[styles.pillDate, filter === 'range' && styles.pillActive]}>
          <TouchableOpacity style={styles.pillDateInner} onPress={() => setShowCal(true)} activeOpacity={0.75}>
            <Ionicons name="calendar-outline" size={13} color={filter === 'range' ? COLORS.white : COLORS.muted} style={{ marginRight: 4 }} />
            <Text style={[styles.pillText, filter === 'range' && styles.pillTextActive]} numberOfLines={1}>{pillLabel}</Text>
          </TouchableOpacity>
          {filter === 'range' && (
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} onPress={() => { setFilter('all'); setPickedRange(null) }}>
              <Ionicons name="close-circle" size={15} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={filter === 'saved' ? 'bookmark-outline' : 'pricetag-outline'} size={52} color={COLORS.mutedDark} />
          <Text style={styles.emptyTitle}>
            {filter === 'saved' ? 'No saved promotions' : 'No promotions for this period'}
          </Text>
          {filter === 'saved' && (
            <Text style={styles.emptySub}>Tap the bookmark icon on any promotion to save it</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.promotion_id}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: SPACING.xxl }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          renderItem={({ item: promo }) => {
            const badge = badgeInfo(promo)
            const isSaved = savedIds.has(promo.promotion_id)
            const isSavingThis = savingId === promo.promotion_id
            const isUnavailable = !!(promo as PromoItem)._unavailable
            const isExpiringSoon = !isUnavailable && promo.valid_until &&
              new Date(promo.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
            const dateBlock = formatDateBlock(promo.valid_until)
            const includedTags = parseIncludedItems((promo as any).included_items)
            const promoPrice = calculatedDiscountedPrice(promo)

            return (
              <TouchableOpacity
                style={[styles.card, isUnavailable && styles.cardUnavailable]}
                activeOpacity={isUnavailable ? 1 : 0.88}
                onPress={() => !isUnavailable && router.push(`/promotion/${promo.promotion_id}`)}
              >
                <View style={styles.imageWrap}>
                  {promo.image_url ? (
                    <Image source={{ uri: promo.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackColor(promo.promotion_id) }]} />
                  )}
                  {isUnavailable && <View style={styles.unavailableOverlay} />}
                  <View style={styles.scrimBot} />

                  {/* Top-left: date block */}
                  {dateBlock && (
                    <View style={styles.dateBlock}>
                      <Text style={styles.dateDow}>{dateBlock.dow}</Text>
                      <Text style={styles.dateDay}>{dateBlock.day}</Text>
                      <Text style={styles.dateMon}>{dateBlock.mon}</Text>
                    </View>
                  )}

                  {/* Top-right: badge + bookmark (inline row) */}
                  <View style={styles.topRight}>
                    {isUnavailable ? (
                      <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableBadgeText}>UNAVAILABLE</Text>
                      </View>
                    ) : (
                      <View style={styles.topRightRow}>
                        {badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge.label}</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.bookmarkBtn}
                          onPress={() => toggleSave(promo.promotion_id)}
                          disabled={isSavingThis}
                          hitSlop={8}
                        >
                          {isSavingThis
                            ? <ActivityIndicator size="small" color={COLORS.purple} />
                            : <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? COLORS.purple : COLORS.white} />
                          }
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Bottom overlay */}
                  <View style={styles.overlay}>
                    <Text style={styles.promoTitle} numberOfLines={2}>{promo.title}</Text>
                    {promo.description ? (
                      <Text style={styles.promoDesc} numberOfLines={2}>{promo.description}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Meta row */}
                <View style={styles.meta}>
                  <View style={styles.metaLeft}>
                    {promo.clubs?.club_name && (
                      <TouchableOpacity
                        style={styles.metaRow}
                        onPress={() => !isUnavailable && promo.clubs?.club_id && router.push(`/club/${promo.clubs.club_id}`)}
                      >
                        <Ionicons name="location" size={12} color={COLORS.muted} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {promo.clubs.club_name}{promo.clubs.club_address ? `, ${promo.clubs.club_address}` : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isUnavailable ? (
                      <View style={styles.metaRow}>
                        <Ionicons name="ban-outline" size={12} color={COLORS.mutedDark} />
                        <Text style={[styles.metaText, { color: COLORS.mutedDark }]}>This promotion has been removed</Text>
                      </View>
                    ) : promo.valid_until ? (
                      <View style={styles.metaRow}>
                        <Ionicons name={isExpiringSoon ? 'flash' : 'time-outline'} size={12} color={isExpiringSoon ? '#f472b6' : COLORS.muted} />
                        <Text style={[styles.metaText, isExpiringSoon && { color: '#f472b6' }]}>
                          {isExpiringSoon ? 'Ending soon · ' : 'Valid until '}
                          {formatShortDate(promo.valid_until)}
                        </Text>
                      </View>
                    ) : null}

                    {!isUnavailable && (promo.original_price != null || promoPrice != null) && (
                      <View style={styles.priceRow}>
                        {promo.original_price != null && (
                          <Text style={styles.originalPrice}>€{promo.original_price.toFixed(2)}</Text>
                        )}
                        {promoPrice != null && (
                          <Text style={styles.promoPrice}>€{promoPrice.toFixed(2)}</Text>
                        )}
                      </View>
                    )}

                    {/* Included items tags */}
                    {!isUnavailable && includedTags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {includedTags.map((tag, i) => (
                          <View key={i} style={styles.tag}>
                            <Ionicons name={itemIcon(tag) as any} size={11} color={COLORS.muted} />
                            <Text style={styles.tagText} numberOfLines={1}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {!isUnavailable && (
                    <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(promo)} hitSlop={8}>
                      <Ionicons name="share-social-outline" size={17} color={COLORS.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <DateRangeModal visible={showCal} initialRange={pickedRange} onApply={handleRangeApply} onClose={() => setShowCal(false)} />
    </View>
  )
}

// ── Month grid styles ─────────────────────────────────────────────────────────
const mg = StyleSheet.create({
  month: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  monthLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.md },
  dayHeaders: { flexDirection: 'row', marginBottom: SPACING.xs },
  dayHeader: { width: CELL_SIZE, textAlign: 'center', color: COLORS.mutedDark, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  rangeBar: { position: 'absolute', left: 0, right: 0, top: 6, bottom: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  rangeBarLeft: { left: '50%' },
  rangeBarRight: { right: '50%' },
  circle: { width: CELL_SIZE - 8, height: CELL_SIZE - 8, borderRadius: (CELL_SIZE - 8) / 2, alignItems: 'center', justifyContent: 'center' },
  circleSelected: { backgroundColor: COLORS.white },
  dayText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '500' },
  dayTextSelected: { color: '#000', fontWeight: '700' },
  dayTextToday: { color: COLORS.purple, fontWeight: '700' },
  dayTextInRange: { color: 'rgba(255,255,255,0.9)' },
  todayDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.purple },
})

// ── Date range modal styles ───────────────────────────────────────────────────
const drm = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  quickPill: { borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, backgroundColor: COLORS.bgCard },
  quickPillText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  applyBtn: { backgroundColor: COLORS.white, borderRadius: RADIUS.pill, paddingVertical: SPACING.md + 2, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: COLORS.bgCard },
  applyBtnText: { color: '#000', fontWeight: '800', fontSize: FONT.base },
})

// ── Promo list styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  savedHeaderBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  savedHeaderBtnActive: { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.12)' },
  filterScroll: { height: 42, flexGrow: 0, flexShrink: 0 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md },
  pill: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, backgroundColor: COLORS.bgCard },
  pillDate: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, paddingRight: SPACING.sm, backgroundColor: COLORS.bgCard, overflow: 'hidden' },
  pillDateInner: { flexDirection: 'row', alignItems: 'center', paddingLeft: SPACING.md, paddingRight: SPACING.xs, height: 34 },
  pillActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  pillText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  pillTextActive: { color: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },

  // Card
  card: { borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  cardUnavailable: { opacity: 0.65 },
  imageWrap: { height: CARD_IMAGE_H, position: 'relative', overflow: 'hidden' },
  unavailableOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  scrimBot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_IMAGE_H * 0.32, backgroundColor: 'rgba(0,0,0,0.52)' },

  // Date block (top-left)
  dateBlock: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.sm + 2,
    paddingHorizontal: 10, paddingVertical: 8,
    alignItems: 'center', minWidth: 46,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  dateDow: { color: COLORS.purple, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  dateDay: { color: COLORS.white, fontSize: 22, fontWeight: '900', lineHeight: 26 },
  dateMon: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Top-right: badge + bookmark
  topRight: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, alignItems: 'flex-end' },
  topRightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { backgroundColor: COLORS.purple, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  unavailableBadge: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.mutedDark },
  unavailableBadgeText: { color: COLORS.mutedDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  bookmarkBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

  // Text overlay at bottom of image
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.md, paddingTop: SPACING.xxl },
  promoTitle: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  promoDesc: { color: 'rgba(255,255,255,0.75)', fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },

  // Meta row below image
  meta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, gap: SPACING.sm },
  metaLeft: { flex: 1, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  originalPrice: { color: COLORS.mutedDark, fontSize: FONT.sm, textDecorationLine: 'line-through' },
  promoPrice: { color: COLORS.green, fontSize: FONT.sm, fontWeight: '800' },
  shareBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  // Included items tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.bgInput, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  tagText: { color: COLORS.muted, fontSize: 11, maxWidth: 100 },
})
