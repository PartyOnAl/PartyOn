import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const CARD_IMAGE_H = 210
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

// ── Badge ─────────────────────────────────────────────────────────────────────
function badgeInfo(promo: Promotion): { label: string; bg: string; text: string } | null {
  if (promo.discount_value) return { label: `${promo.discount_value}% OFF`, bg: '#7c3aed', text: '#fff' }
  const cat = (promo.category ?? '').toLowerCase()
  if (cat.includes('free') || cat.includes('entry')) return { label: 'FREE ENTRY', bg: '#7c3aed', text: '#fff' }
  if (cat.includes('vip')) return { label: 'VIP', bg: '#7c3aed', text: '#fff' }
  if (cat.includes('bottle')) return { label: 'BOTTLE', bg: '#7c3aed', text: '#fff' }
  return null
}
const FALLBACK = ['#6366f1', '#7c3aed', '#ec4899', '#0ea5e9']
function fallbackColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return FALLBACK[h % FALLBACK.length]
}

// ── Date range type ───────────────────────────────────────────────────────────
type DateRange = { from: Date; to: Date }

// ── Date Range Calendar Modal ─────────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

// Monday-first offset: Mon=0 … Sun=6
function mondayOffset(date: Date) { return (date.getDay() + 6) % 7 }

function MonthGrid({
  year, month,
  from, to,
  onDayPress,
}: {
  year: number; month: number
  from: Date | null; to: Date | null
  onDayPress: (d: Date) => void
}) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = mondayOffset(firstDay)

  // Build rows of 7
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = sod(new Date())

  return (
    <View style={mg.month}>
      <Text style={mg.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
      {/* Day headers */}
      <View style={mg.dayHeaders}>
        {DAY_LABELS.map((d) => <Text key={d} style={mg.dayHeader}>{d}</Text>)}
      </View>
      {/* Grid rows */}
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

              // Range bar behind the circle
              const barLeft = isStart && to && !sameDay(from!, to)
              const barRight = isEnd && from && !sameDay(from!, to!)
              const barFull = !!inRange

              return (
                <TouchableOpacity
                  key={di}
                  style={mg.cell}
                  onPress={() => onDayPress(d)}
                  activeOpacity={0.75}
                >
                  {/* Range highlight bar */}
                  {(barLeft || barRight || barFull) && (
                    <View style={[
                      mg.rangeBar,
                      barLeft && mg.rangeBarLeft,
                      barRight && mg.rangeBarRight,
                    ]} />
                  )}
                  {/* Circle */}
                  <View style={[mg.circle, isSelected && mg.circleSelected]}>
                    <Text style={[
                      mg.dayText,
                      isSelected && mg.dayTextSelected,
                      isToday && !isSelected && mg.dayTextToday,
                      !!inRange && mg.dayTextInRange,
                    ]}>
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

function DateRangeModal({
  visible,
  initialRange,
  onApply,
  onClose,
}: {
  visible: boolean
  initialRange: DateRange | null
  onApply: (range: DateRange) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const now = new Date()

  const [from, setFrom] = useState<Date | null>(initialRange?.from ?? null)
  const [to, setTo] = useState<Date | null>(initialRange?.to ?? null)
  const [step, setStep] = useState<'from' | 'to'>('from')

  useEffect(() => {
    if (visible) {
      setFrom(initialRange?.from ?? null)
      setTo(initialRange?.to ?? null)
      setStep('from')
    }
  }, [visible])

  // Generate 6 months starting from current
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }, [])

  function handleDayPress(d: Date) {
    if (step === 'from') {
      setFrom(sod(d))
      setTo(null)
      setStep('to')
    } else {
      if (from && d < from) {
        // tapped before start → restart
        setFrom(sod(d))
        setTo(null)
        setStep('to')
      } else {
        setTo(eod(d))
        setStep('from') // ready to apply
      }
    }
  }

  function quickSelect(f: Date, t: Date) {
    setFrom(sod(f))
    setTo(eod(t))
    setStep('from')
  }

  const canApply = from !== null
  const rangeLabel = from
    ? formatRangeLabel(from, to)
    : step === 'from' ? 'Select start date' : 'Select end date'

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[drm.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={drm.header}>
          <Text style={drm.headerTitle}>When do you want to go out?</Text>
          <TouchableOpacity onPress={onClose} style={drm.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Quick pills */}
        <View style={drm.quickRow}>
          {[
            { label: 'Today', onPress: () => quickSelect(now, now) },
            { label: 'Tomorrow', onPress: () => { const t = addDays(now, 1); quickSelect(t, t) } },
            { label: 'This week', onPress: () => {
              const end = addDays(now, 6 - ((now.getDay() + 6) % 7))
              quickSelect(now, end)
            }},
          ].map(({ label, onPress }) => {
            const isActive = label === 'Today' && from && sameDay(from, now) && to && sameDay(to!, now)
              || label === 'Tomorrow' && from && sameDay(from, addDays(now, 1)) && to && sameDay(to!, addDays(now, 1))
            return (
              <TouchableOpacity
                key={label}
                style={[drm.quickPill, isActive && drm.quickPillActive]}
                onPress={onPress}
                activeOpacity={0.75}
              >
                <Text style={[drm.quickPillText, isActive && drm.quickPillTextActive]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Multi-month calendar */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {months.map(({ year, month }) => (
            <MonthGrid
              key={`${year}-${month}`}
              year={year}
              month={month}
              from={from}
              to={to}
              onDayPress={handleDayPress}
            />
          ))}
        </ScrollView>

        {/* Bottom bar */}
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function PromotionsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ filter?: string }>()

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>((params.filter as Filter) ?? 'all')
  const [pickedRange, setPickedRange] = useState<DateRange | null>(null)
  const [showCal, setShowCal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [promoRes, savedRes] = await Promise.all([
      supabase
        .from('promotions')
        .select('*, clubs(club_name, club_address, club_id, reservation_only)')
        .in('status', ['active', 'approved'])
        .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false }),
      user
        ? supabase.from('saved_promotions').select('promotion_id').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])
    setPromotions((promoRes.data as Promotion[]) ?? [])
    setSavedIds(new Set((savedRes.data ?? []).map((r: any) => r.promotion_id)))
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
    setPickedRange(range)
    setFilter('range')
    setShowCal(false)
  }

  const now = new Date()

  const filtered = useMemo(() => {
    switch (filter) {
      case 'saved':
        return promotions.filter((p) => savedIds.has(p.promotion_id))

      case 'tonight': {
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        return promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          return pfrom <= now && until >= now && until <= in24h
        })
      }

      case 'week': {
        const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        return promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          return pfrom <= in7d && until >= now && until <= in7d
        })
      }

      case 'range': {
        if (!pickedRange) return promotions
        return promotions.filter((p) => {
          if (!p.valid_until) return false
          const until = new Date(p.valid_until)
          const pfrom = p.valid_from ? new Date(p.valid_from) : new Date(0)
          // overlap: promo is active at any point within the picked range
          return pfrom <= pickedRange.to && until >= pickedRange.from
        })
      }

      default:
        return promotions
    }
  }, [promotions, filter, savedIds, pickedRange])

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
            color={filter === 'saved' ? COLORS.cta : COLORS.muted}
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

        {/* Pick dates pill — no nested TouchableOpacity, clear button handled separately */}
        <View style={[styles.pillDate, filter === 'range' && styles.pillActive]}>
          <TouchableOpacity
            style={styles.pillDateInner}
            onPress={() => setShowCal(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={filter === 'range' ? COLORS.white : COLORS.muted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.pillText, filter === 'range' && styles.pillTextActive]}
              numberOfLines={1}
            >
              {pillLabel}
            </Text>
          </TouchableOpacity>
          {filter === 'range' && (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              onPress={() => { setFilter('all'); setPickedRange(null) }}
            >
              <Ionicons name="close-circle" size={15} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: SPACING.xl }} />
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={filter === 'saved' ? 'bookmark-outline' : 'pricetag-outline'}
            size={52} color={COLORS.mutedDark}
          />
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
            const isExpiringSoon =
              promo.valid_until &&
              new Date(promo.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={() => router.push(`/promotion/${promo.promotion_id}`)}>
                <View style={styles.imageWrap}>
                  {promo.image_url ? (
                    <Image source={{ uri: promo.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackColor(promo.promotion_id) }]} />
                  )}
                  <View style={styles.scrimTop} />
                  <View style={styles.scrimMid} />
                  <View style={styles.scrimBot} />
                  {badge && (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
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
                  <View style={styles.overlay}>
                    <Text style={styles.promoTitle} numberOfLines={2}>{promo.title}</Text>
                    {promo.description && (
                      <Text style={styles.promoDesc} numberOfLines={2}>{promo.description}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.meta}>
                  <View style={styles.metaLeft}>
                    {promo.clubs?.club_name && (
                      <TouchableOpacity
                        style={styles.metaRow}
                        onPress={() => promo.clubs?.club_id && router.push(`/club/${promo.clubs.club_id}`)}
                      >
                        <Ionicons name="location" size={12} color={COLORS.muted} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {promo.clubs.club_name}{promo.clubs.club_address ? `, ${promo.clubs.club_address}` : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {promo.valid_until && (
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={12} color={isExpiringSoon ? COLORS.red : COLORS.muted} />
                        <Text style={[styles.metaText, isExpiringSoon && { color: COLORS.red }]}>
                          {isExpiringSoon ? '⚡ Ending soon · ' : 'Valid until '}
                          {formatShortDate(promo.valid_until)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(promo)} hitSlop={8}>
                    <Ionicons name="share-social-outline" size={17} color={COLORS.muted} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <DateRangeModal
        visible={showCal}
        initialRange={pickedRange}
        onApply={handleRangeApply}
        onClose={() => setShowCal(false)}
      />
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
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  // Range bar sits behind the circle, full height, fills horizontally
  rangeBar: {
    position: 'absolute',
    left: 0, right: 0, top: 6, bottom: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rangeBarLeft: { left: '50%', borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  rangeBarRight: { right: '50%', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  circle: {
    width: CELL_SIZE - 8, height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  circleSelected: { backgroundColor: COLORS.white },
  dayText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '500' },
  dayTextSelected: { color: '#000', fontWeight: '700' },
  dayTextToday: { color: COLORS.purple, fontWeight: '700' },
  dayTextInRange: { color: 'rgba(255,255,255,0.9)' },
  todayDot: {
    position: 'absolute', bottom: 4,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: COLORS.purple,
  },
})

// ── Date range modal styles ───────────────────────────────────────────────────
const drm = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flex: 1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
  },
  quickPill: {
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    backgroundColor: COLORS.bgCard,
  },
  quickPillActive: { backgroundColor: COLORS.white, borderColor: COLORS.white },
  quickPillText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  quickPillTextActive: { color: '#000' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
  },
  applyBtn: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md + 2, alignItems: 'center',
  },
  applyBtnDisabled: { backgroundColor: COLORS.bgCard },
  applyBtnText: { color: '#000', fontWeight: '800', fontSize: FONT.base },
})

// ── Promo list styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  savedHeaderBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border,
  },
  savedHeaderBtnActive: { borderColor: COLORS.cta, backgroundColor: 'rgba(245,166,35,0.1)' },
  filterScroll: {
    height: 42,
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
  },
  pillDate: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingRight: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    overflow: 'hidden',
  },
  pillDateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    height: 34,
  },
  pillActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  pillText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  pillTextActive: { color: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: COLORS.muted, fontSize: FONT.sm, textAlign: 'center' },
  card: { borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  imageWrap: { height: CARD_IMAGE_H, position: 'relative', overflow: 'hidden' },
  scrimTop: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: CARD_IMAGE_H * 0.9, backgroundColor: 'rgba(0,0,0,0.06)',
  },
  scrimMid: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: CARD_IMAGE_H * 0.55, backgroundColor: 'rgba(0,0,0,0.28)',
  },
  scrimBot: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: CARD_IMAGE_H * 0.32, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  badge: {
    position: 'absolute', top: SPACING.sm, left: SPACING.sm,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  bookmarkBtn: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: SPACING.md, paddingTop: SPACING.xxl,
  },
  promoTitle: {
    color: COLORS.white, fontSize: FONT.lg, fontWeight: '800', marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  promoDesc: { color: 'rgba(255,255,255,0.8)', fontSize: FONT.sm, lineHeight: FONT.sm * 1.5 },
  meta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, gap: SPACING.sm,
  },
  metaLeft: { flex: 1, gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.muted, fontSize: FONT.sm, flex: 1 },
  shareBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgInput,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
})
