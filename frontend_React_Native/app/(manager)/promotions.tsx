import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { MANAGER_DASHBOARD, replaceManagerRoute } from '@/lib/managerNavigation'

// ── Types ─────────────────────────────────────────────────────────────────────
type PromoStatus = 'pending' | 'approved' | 'active' | 'expired'
type StatusFilter = 'all' | 'active' | 'pending' | 'expired' | 'archived'

type Promotion = {
  promotion_id:     string
  club_id:          string | null
  title:            string
  description:      string | null
  category:         string | null
  discount_value:   number | null
  original_price:   number | null
  discounted_price: number | null
  terms_conditions: string | null
  included_items:   string | null
  why_worth_it:     string | null
  valid_from:       string | null
  valid_until:      string | null
  status:           PromoStatus
  image_url:        string | null
  created_at:       string | null
  deleted_at:       string | null
}

const CATEGORIES = ['General', 'Free Entry', 'VIP', 'Bottle Service', 'Happy Hour', 'Discount']

const STATUS_META: Record<PromoStatus | 'archived', { label: string; color: string }> = {
  active:   { label: 'Active',   color: COLORS.green },
  approved: { label: 'Approved', color: COLORS.cta },
  pending:  { label: 'Pending',  color: COLORS.cta },
  expired:  { label: 'Expired',  color: COLORS.mutedDark },
  archived: { label: 'Archived', color: COLORS.mutedDark },
}

const SELECT_COLS = 'promotion_id,club_id,title,description,category,discount_value,original_price,discounted_price,terms_conditions,included_items,why_worth_it,valid_from,valid_until,status,image_url,created_at,deleted_at'

// ── Date helpers ──────────────────────────────────────────────────────────────
function displayToISO(s: string): string {
  if (!s) return ''
  const [d, m, y] = s.split('/')
  if (!d || !m || !y || y.length < 4) return ''
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function isoToDisplay(s: string | null): string {
  if (!s) return ''
  const dt = new Date(s)
  if (isNaN(dt.getTime())) return ''
  const d  = dt.getUTCDate().toString().padStart(2, '0')
  const mo = (dt.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${d}/${mo}/${dt.getUTCFullYear()}`
}

function fmtDate(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtValidityRange(from: string | null, until: string | null): string {
  if (from && until) {
    const fromDate = fmtDate(from)
    const untilDate = fmtDate(until)
    return fromDate === untilDate ? fromDate : `${fromDate} → ${untilDate}`
  }
  return fmtDate(from ?? until)
}

function parseMoney(value: string): number | null {
  const parsed = parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function calculateDiscountedPrice(original: number | null, discount: number | null): number | null {
  if (original == null || discount == null) return null
  const clampedDiscount = Math.min(100, Math.max(0, discount))
  return Math.max(0, original * (1 - clampedDiscount / 100))
}

function formatMoneyInput(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

// ── Mini inline calendar ───────────────────────────────────────────────────────
const CAL_DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseDisplay(s: string): Date | null {
  if (!s) return null
  const [d, m, y] = s.split('/')
  if (!d || !m || !y) return null
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return isNaN(dt.getTime()) ? null : dt
}

function toDisplay(dt: Date) {
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

type InlineCalendarProps = { value: string; onSelect: (d: string) => void }
function InlineCalendar({ value, onSelect }: InlineCalendarProps) {
  const today   = new Date()
  const parsed  = parseDisplay(value)
  const init    = parsed ?? today
  const [viewYear,  setViewYear]  = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())
  const [selected,  setSelected]  = useState<Date | null>(parsed)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function buildRows(): (number | null)[][] {
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const days  = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(first).fill(null)
    for (let d = 1; d <= days; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }

  function isSel(d: number | null) {
    if (!d || !selected) return false
    return selected.getDate() === d && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear
  }
  function isTdy(d: number | null) {
    if (!d) return false
    return today.getDate() === d && today.getMonth() === viewMonth && today.getFullYear() === viewYear
  }

  const rows = buildRows()

  return (
    <View style={cal.wrap}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
          <Ionicons name="chevron-back" size={16} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={cal.monthTitle}>{CAL_MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
          <Ionicons name="chevron-forward" size={16} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      {/* Day headers */}
      <View style={cal.row}>
        {CAL_DAYS.map(d => <Text key={d} style={[cal.cell, cal.weekDay]}>{d}</Text>)}
      </View>
      {/* Calendar rows — each row is a flex row of 7 equal cells */}
      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((d, ci) => {
            const sel = isSel(d); const tdy = isTdy(d)
            return (
              <TouchableOpacity
                key={ci}
                style={[cal.cell, sel && cal.cellSel, tdy && !sel && cal.cellToday]}
                onPress={() => {
                  if (!d) return
                  const dt = new Date(viewYear, viewMonth, d)
                  setSelected(dt)
                  onSelect(toDisplay(dt))
                }}
                activeOpacity={d ? 0.7 : 1}
              >
                <Text style={[cal.cellTxt, sel && cal.cellTxtSel, tdy && !sel && cal.cellTxtToday]}>
                  {d ?? ''}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const cal = StyleSheet.create({
  wrap:       { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  nav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  navBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  row:        { flexDirection: 'row' },
  weekDay:    { color: COLORS.mutedDark, fontSize: 10, fontWeight: '600' },
  cell:       { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  cellSel:    { backgroundColor: COLORS.purpleDark },
  cellToday:  { borderWidth: 1, borderColor: COLORS.purple },
  cellTxt:    { color: COLORS.muted, fontSize: 11 },
  cellTxtSel: { color: '#fff', fontWeight: '700' },
  cellTxtToday: { color: COLORS.purple, fontWeight: '700' },
})

// ── Component ─────────────────────────────────────────────────────────────────
export default function ManagerPromotionsScreen() {
  const router      = useRouter()
  const { profile } = useAuth()

  const [promotions, setPromotions]     = useState<Promotion[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Modal
  const [showModal, setShowModal]       = useState(false)
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null)
  const [saving, setSaving]             = useState(false)
  const [uploading, setUploading]       = useState(false)

  // Form state
  const [title,           setTitle]           = useState('')
  const [description,     setDescription]     = useState('')
  const [category,        setCategory]        = useState('General')
  const [discountVal,     setDiscountVal]     = useState('')
  const [originalPrice,   setOriginalPrice]   = useState('')
  const [discountedPrice, setDiscountedPrice] = useState('')
  const [termsConditions, setTermsConditions] = useState('')
  const [includedItems,   setIncludedItems]   = useState('')
  const [whyWorthIt,      setWhyWorthIt]      = useState('')
  const [validFrom,       setValidFrom]       = useState('')
  const [validUntil,      setValidUntil]      = useState('')
  const [formStatus,      setFormStatus]      = useState<'active' | 'pending'>('active')
  const [imageUrl,        setImageUrl]        = useState<string | null>(null)

  // Inline calendar toggles
  const [showFromCal,  setShowFromCal]  = useState(false)
  const [showUntilCal, setShowUntilCal] = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchPromotions = useCallback(async (silent = false) => {
    if (!profile?.club_id) { setLoading(false); setRefreshing(false); return }
    if (!silent) setLoading(true)
    const { data, error } = await supabase
      .from('promotions')
      .select(SELECT_COLS)
      .eq('club_id', profile.club_id)
      .order('created_at', { ascending: false })
    if (error) console.error('fetchPromotions error:', error.message)
    if (data) setPromotions(data as Promotion[])
    setLoading(false)
    setRefreshing(false)
  }, [profile?.club_id])

  useFocusEffect(useCallback(() => { fetchPromotions() }, [fetchPromotions]))
  const onRefresh = () => { setRefreshing(true); fetchPromotions(true) }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function resetForm() {
    setTitle(''); setDescription(''); setCategory('General'); setDiscountVal('')
    setOriginalPrice(''); setDiscountedPrice(''); setTermsConditions(''); setIncludedItems('')
    setWhyWorthIt(''); setValidFrom(''); setValidUntil('')
    setFormStatus('active'); setImageUrl(null)
    setShowFromCal(false); setShowUntilCal(false)
  }

  function openCreate() { resetForm(); setEditingPromo(null); setShowModal(true) }

  function openEdit(p: Promotion) {
    setTitle(p.title)
    setDescription(p.description ?? '')
    setCategory(p.category ?? 'General')
    setDiscountVal(p.discount_value != null ? String(p.discount_value) : '')
    setOriginalPrice(p.original_price != null ? String(p.original_price) : '')
    setDiscountedPrice(p.discounted_price != null ? String(p.discounted_price) : '')
    setTermsConditions(p.terms_conditions ?? '')
    setIncludedItems(p.included_items ?? '')
    setWhyWorthIt(p.why_worth_it ?? '')
    setValidFrom(isoToDisplay(p.valid_from))
    setValidUntil(isoToDisplay(p.valid_until))
    setFormStatus(p.status === 'active' || p.status === 'approved' ? 'active' : 'pending')
    setImageUrl(p.image_url)
    setShowFromCal(false); setShowUntilCal(false)
    setEditingPromo(p)
    setShowModal(true)
  }

  function closeModal() { resetForm(); setEditingPromo(null); setShowModal(false) }

  function onChangeOriginalPrice(value: string) {
    setOriginalPrice(value)
    const calculated = calculateDiscountedPrice(parseMoney(value), parseMoney(discountVal))
    if (calculated != null) setDiscountedPrice(formatMoneyInput(calculated))
  }

  function onChangeDiscountVal(value: string) {
    setDiscountVal(value)
    const calculated = calculateDiscountedPrice(parseMoney(originalPrice), parseMoney(value))
    if (calculated != null) setDiscountedPrice(formatMoneyInput(calculated))
  }

  // ── Image upload ──────────────────────────────────────────────────────────
  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Please allow photo library access.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setUploading(true)
    try {
      const ext      = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `promo-${profile?.club_id ?? 'x'}-${Date.now()}.${ext}`
      const response    = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()
      const { error: upErr } = await supabase.storage
        .from('club-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('club-images').getPublicUrl(fileName)
      setImageUrl(urlData.publicUrl)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const t = title.trim()
    if (!t) { Alert.alert('Validation', 'Title is required.'); return }
    if (!profile?.club_id) { Alert.alert('Error', 'No club associated with your account.'); return }
    setSaving(true)

    const originalPriceValue = parseMoney(originalPrice)
    const discountValue = parseMoney(discountVal)
    const calculatedDiscountedPrice = calculateDiscountedPrice(originalPriceValue, discountValue)
    const discountedPriceValue = parseMoney(discountedPrice) ?? calculatedDiscountedPrice

    const payload = {
      club_id:          profile.club_id,
      title:            t,
      description:      description.trim() || null,
      category,
      discount_value:   discountValue,
      original_price:   originalPriceValue,
      discounted_price: discountedPriceValue,
      terms_conditions: termsConditions.trim() || null,
      included_items:   includedItems.trim() || null,
      why_worth_it:     whyWorthIt.trim() || null,
      valid_from:       displayToISO(validFrom) || null,
      valid_until:      displayToISO(validUntil) || null,
      status:           formStatus,
      image_url:        imageUrl,
    }

    let opError: any = null
    if (editingPromo) {
      const { error } = await supabase
        .from('promotions').update(payload).eq('promotion_id', editingPromo.promotion_id)
      opError = error
    } else {
      const { error } = await supabase.from('promotions').insert(payload)
      opError = error
    }

    setSaving(false)
    if (opError) { Alert.alert('Error saving', opError.message); return }
    closeModal()
    await fetchPromotions(true)
  }

  // ── Archive (soft delete) ─────────────────────────────────────────────────
  function handleDelete(p: Promotion) {
    const isArchived = !!p.deleted_at
    if (isArchived) {
      Alert.alert('Restore Promotion', `Restore "${p.title}" so users can see and claim it again?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', onPress: async () => {
            const { error } = await supabase
              .from('promotions')
              .update({ deleted_at: null, status: 'active' })
              .eq('promotion_id', p.promotion_id)
            if (error) { Alert.alert('Error', error.message); return }
            await fetchPromotions(true)
          },
        },
      ])
      return
    }
    Alert.alert(
      'Archive Promotion',
      `Archive "${p.title}"?\n\nUsers who already claimed it can still see their code. New users won't be able to claim it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('promotions')
              .update({ deleted_at: new Date().toISOString(), status: 'expired' })
              .eq('promotion_id', p.promotion_id)
            if (error) { Alert.alert('Error archiving', error.message); return }
            await fetchPromotions(true)
          },
        },
      ],
    )
  }

  // ── Toggle active/pending ─────────────────────────────────────────────────
  async function toggleStatus(p: Promotion) {
    const next: PromoStatus = p.status === 'active' ? 'pending' : 'active'
    const { error } = await supabase
      .from('promotions').update({ status: next }).eq('promotion_id', p.promotion_id)
    if (error) { Alert.alert('Error', error.message); return }
    await fetchPromotions(true)
  }

  // ── Filtered / stats ──────────────────────────────────────────────────────
  const filtered = promotions.filter(p => {
    if (statusFilter === 'archived') return !!p.deleted_at
    if (statusFilter === 'all')      return !p.deleted_at
    if (statusFilter === 'active')   return !p.deleted_at && (p.status === 'active' || p.status === 'approved')
    if (statusFilter === 'pending')  return !p.deleted_at && p.status === 'pending'
    if (statusFilter === 'expired')  return !p.deleted_at && p.status === 'expired'
    return !p.deleted_at
  })
  const nonDeleted = promotions.filter(p => !p.deleted_at)
  const total    = nonDeleted.length
  const active   = nonDeleted.filter(p => p.status === 'active' || p.status === 'approved').length
  const pending  = nonDeleted.filter(p => p.status === 'pending').length
  const expired  = nonDeleted.filter(p => p.status === 'expired').length
  const archived = promotions.filter(p => !!p.deleted_at).length

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={COLORS.purple} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_DASHBOARD)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>Party<Text style={{ color: COLORS.purple }}>On</Text></Text>
            <Text style={s.sub}>Manager Portal</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnText}>New Promo</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.pageTitle}>Promotions</Text>
        <Text style={s.pageSubtitle}>Create and manage your club&apos;s promotions</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          {([
            [String(total),    COLORS.white,     'Total'],
            [String(active),   COLORS.green,     'Active'],
            [String(pending),  COLORS.cta,       'Pending'],
            [String(expired),  COLORS.mutedDark, 'Expired'],
            [String(archived), COLORS.mutedDark, 'Archived'],
          ] as [string, string, string][]).map(([num, color, label]) => (
            <View key={label} style={s.statItem}>
              <Text style={[s.statNum, { color }]}>{num}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.lg }}>
          <View style={[s.filterRow, { paddingRight: SPACING.md }]}>
            {(['all', 'active', 'pending', 'expired', 'archived'] as StatusFilter[]).map(key => (
              <TouchableOpacity
                key={key}
                style={[s.filterTab, statusFilter === key && s.filterTabActive]}
                onPress={() => setStatusFilter(key)}
              >
                <Text style={[s.filterText, statusFilter === key && s.filterTextActive]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="pricetag-outline" size={52} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>No {statusFilter !== 'all' ? statusFilter + ' ' : ''}promotions</Text>
            <Text style={s.emptySubtitle}>Create promotions to attract more guests to your events.</Text>
            {statusFilter === 'all' && (
              <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={s.emptyBtnText}>Create First Promotion</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map(p => {
            const expiringSoon = !p.deleted_at && p.valid_until && p.status === 'active' &&
              new Date(p.valid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

            const isArchived = !!p.deleted_at
            const effectiveStatusKey: PromoStatus | 'archived' = isArchived ? 'archived' : p.status
            const displayedDiscountedPrice = p.discounted_price ?? calculateDiscountedPrice(p.original_price, p.discount_value)

            return (
              <TouchableOpacity
                key={p.promotion_id}
                style={[s.card, isArchived && { opacity: 0.65 }]}
                onPress={() => !isArchived && openEdit(p)}
                activeOpacity={0.84}
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={s.cardImage} contentFit="cover" />
                ) : (
                  <View style={s.cardImagePlaceholder}>
                    <Ionicons name="pricetag-outline" size={32} color={COLORS.mutedDark} />
                  </View>
                )}

                <View style={s.cardBadges}>
                  {p.category && (
                    <View style={s.catBadge}>
                      <Text style={s.catBadgeText}>{p.category.toUpperCase()}</Text>
                    </View>
                  )}
                  {p.discount_value != null && (
                    <View style={[s.catBadge, { backgroundColor: COLORS.purple }]}>
                      <Text style={s.catBadgeText}>{p.discount_value}% OFF</Text>
                    </View>
                  )}
                </View>

                <View style={s.cardBody}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardTitle} numberOfLines={2}>{p.title}</Text>
                    <View style={[s.statusBadge, { backgroundColor: STATUS_META[effectiveStatusKey].color + '22' }]}>
                      <Text style={[s.statusText, { color: STATUS_META[effectiveStatusKey].color }]}>{STATUS_META[effectiveStatusKey].label}</Text>
                    </View>
                  </View>

                  {p.description ? (
                    <Text style={s.cardDesc} numberOfLines={2}>{p.description}</Text>
                  ) : null}

                  {(p.original_price != null || displayedDiscountedPrice != null) && (
                    <View style={s.priceRow}>
                      {p.original_price != null && (
                        <Text style={s.originalPrice}>€{p.original_price.toFixed(2)}</Text>
                      )}
                      {displayedDiscountedPrice != null && (
                        <Text style={s.discountedPrice}>€{displayedDiscountedPrice.toFixed(2)}</Text>
                      )}
                    </View>
                  )}

                  {p.included_items ? (
                    <View style={s.includedRow}>
                      <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.green} />
                      <Text style={s.includedText} numberOfLines={1}>{p.included_items}</Text>
                    </View>
                  ) : null}

                  {(p.valid_from || p.valid_until) ? (
                    <View style={s.dateRow}>
                      <Ionicons name="calendar-outline" size={12} color={expiringSoon ? COLORS.pink : COLORS.mutedDark} />
                      <Text style={[s.dateText, expiringSoon && { color: COLORS.pink }]}>
                        {expiringSoon ? '⚡ Ending soon · ' : ''}
                        {fmtValidityRange(p.valid_from, p.valid_until)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={s.cardActions}>
                    {!isArchived && (p.status === 'active' || p.status === 'pending') && (
                      <TouchableOpacity
                        style={[s.toggleBtn, p.status === 'active' ? s.toggleBtnOn : s.toggleBtnOff]}
                        onPress={(e) => { e.stopPropagation(); toggleStatus(p) }}
                      >
                        <Ionicons name={p.status === 'active' ? 'eye-outline' : 'eye-off-outline'} size={13} color={p.status === 'active' ? COLORS.green : COLORS.mutedDark} />
                        <Text style={[s.toggleBtnText, { color: p.status === 'active' ? COLORS.green : COLORS.mutedDark }]}>
                          {p.status === 'active' ? 'Active' : 'Paused'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View style={{ flexDirection: 'row', gap: SPACING.xs, marginLeft: 'auto' }}>
                      {!isArchived && (
                        <TouchableOpacity style={s.iconBtn} onPress={(e) => { e.stopPropagation(); openEdit(p) }}>
                          <Ionicons name="pencil-outline" size={16} color={COLORS.muted} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[s.iconBtn, isArchived ? s.iconBtnGreen : s.iconBtnRed]}
                        onPress={(e) => { e.stopPropagation(); handleDelete(p) }}
                      >
                        <Ionicons name={isArchived ? 'refresh-outline' : 'archive-outline'} size={16} color={isArchived ? COLORS.green : COLORS.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
        )}

        {filtered.length > 0 && (
          <TouchableOpacity style={s.addMoreBtn} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.purple} />
            <Text style={s.addMoreText}>Create Another Promotion</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════ Create / Edit Modal ══════════ */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={m.backdrop} activeOpacity={1} onPress={closeModal} />
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.modalHeader}>
              <Text style={m.modalTitle}>{editingPromo ? 'Edit Promotion' : 'New Promotion'}</Text>
              <TouchableOpacity onPress={closeModal} style={m.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Cover Image */}
              <Text style={m.label}>Cover Image</Text>
              <TouchableOpacity style={m.imageBox} onPress={handlePickImage} activeOpacity={0.8}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={m.imagePreview} contentFit="cover" />
                ) : (
                  <View style={m.imagePlaceholder}>
                    <Ionicons name="cloud-upload-outline" size={28} color={COLORS.mutedDark} />
                    <Text style={m.imagePlaceholderText}>Tap to upload</Text>
                  </View>
                )}
                {uploading && (
                  <View style={m.uploadOverlay}>
                    <ActivityIndicator color="#fff" />
                    <Text style={m.uploadingText}>Uploading…</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Title */}
              <Text style={m.label}>Title *</Text>
              <TextInput
                style={m.input} value={title} onChangeText={setTitle}
                placeholder="e.g. Free Entry Before Midnight"
                placeholderTextColor={COLORS.mutedDark}
              />

              {/* Description */}
              <Text style={m.label}>Description</Text>
              <TextInput
                style={[m.input, m.textarea]} value={description} onChangeText={setDescription}
                placeholder="Describe the promotion…" placeholderTextColor={COLORS.mutedDark}
                multiline numberOfLines={3} textAlignVertical="top"
              />

              {/* Why worth it */}
              <Text style={m.label}>Why It&apos;s Worth It</Text>
              <TextInput
                style={[m.input, m.textarea]} value={whyWorthIt} onChangeText={setWhyWorthIt}
                placeholder="What makes this offer special…" placeholderTextColor={COLORS.mutedDark}
                multiline numberOfLines={2} textAlignVertical="top"
              />

              {/* Category */}
              <Text style={m.label}>Category</Text>
              <View style={m.pillRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[m.pill, category === c && m.pillActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[m.pillText, category === c && m.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pricing */}
              <Text style={m.label}>Pricing</Text>
              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.subLabel}>Original Price (€)</Text>
                  <TextInput
                    style={m.input} value={originalPrice} onChangeText={onChangeOriginalPrice}
                    placeholder="e.g. 50" placeholderTextColor={COLORS.mutedDark}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.subLabel}>Promo Price (€)</Text>
                  <TextInput
                    style={m.input} value={discountedPrice} onChangeText={setDiscountedPrice}
                    placeholder="e.g. 30" placeholderTextColor={COLORS.mutedDark}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Discount % */}
              <Text style={m.label}>Discount % (optional)</Text>
              <TextInput
                style={m.input} value={discountVal} onChangeText={onChangeDiscountVal}
                placeholder="e.g. 20" placeholderTextColor={COLORS.mutedDark}
                keyboardType="decimal-pad"
              />

              {/* Included items */}
              <Text style={m.label}>What&apos;s Included</Text>
              <TextInput
                style={m.input} value={includedItems} onChangeText={setIncludedItems}
                placeholder="e.g. 1 bottle, mixers, entry" placeholderTextColor={COLORS.mutedDark}
              />

              {/* Terms */}
              <Text style={m.label}>Terms & Conditions</Text>
              <TextInput
                style={[m.input, m.textarea]} value={termsConditions} onChangeText={setTermsConditions}
                placeholder="Any conditions that apply…" placeholderTextColor={COLORS.mutedDark}
                multiline numberOfLines={2} textAlignVertical="top"
              />

              {/* Date range — inline calendars */}
              <Text style={m.label}>Valid Period</Text>
              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.subLabel}>From</Text>
                  <TouchableOpacity
                    style={m.dateBtn}
                    onPress={() => { setShowFromCal(v => !v); setShowUntilCal(false) }}
                  >
                    <Ionicons name="calendar-outline" size={15} color={validFrom ? COLORS.white : COLORS.mutedDark} />
                    <Text style={[m.dateBtnText, !validFrom && m.datePlaceholder]}>
                      {validFrom || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons name={showFromCal ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.mutedDark} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.subLabel}>Until</Text>
                  <TouchableOpacity
                    style={m.dateBtn}
                    onPress={() => { setShowUntilCal(v => !v); setShowFromCal(false) }}
                  >
                    <Ionicons name="calendar-outline" size={15} color={validUntil ? COLORS.white : COLORS.mutedDark} />
                    <Text style={[m.dateBtnText, !validUntil && m.datePlaceholder]}>
                      {validUntil || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons name={showUntilCal ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.mutedDark} />
                  </TouchableOpacity>
                </View>
              </View>

              {showFromCal && (
                <InlineCalendar
                  value={validFrom}
                  onSelect={d => { setValidFrom(d); setShowFromCal(false) }}
                />
              )}
              {showUntilCal && (
                <InlineCalendar
                  value={validUntil}
                  onSelect={d => { setValidUntil(d); setShowUntilCal(false) }}
                />
              )}

              {/* Visibility */}
              <Text style={m.label}>Visibility</Text>
              <View style={m.pillRow}>
                <TouchableOpacity
                  style={[m.pill, formStatus === 'active' && m.pillGreen]}
                  onPress={() => setFormStatus('active')}
                >
                  <Ionicons name="eye-outline" size={13} color={formStatus === 'active' ? '#fff' : COLORS.muted} />
                  <Text style={[m.pillText, formStatus === 'active' && m.pillTextActive]}>Active (Visible)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[m.pill, formStatus === 'pending' && m.pillActive]}
                  onPress={() => setFormStatus('pending')}
                >
                  <Ionicons name="eye-off-outline" size={13} color={formStatus === 'pending' ? '#fff' : COLORS.muted} />
                  <Text style={[m.pillText, formStatus === 'pending' && m.pillTextActive]}>Draft (Hidden)</Text>
                </TouchableOpacity>
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[m.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving || uploading}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={m.saveBtnText}>{editingPromo ? 'Save Changes' : 'Create Promotion'}</Text>
                    </>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:     { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:        { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 4 },
  addBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  statsRow:  { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  statItem:  { flex: 1, alignItems: 'center' },
  statNum:   { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: COLORS.mutedDark, fontSize: 10, textAlign: 'center' },

  filterRow:        { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  filterTab:        { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  filterTabActive:  { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purpleDark },
  filterText:       { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  empty:         { alignItems: 'center', paddingVertical: 56, gap: SPACING.sm },
  emptyTitle:    { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.sm },
  emptySubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 4 },
  emptyBtnText:  { color: '#fff', fontSize: FONT.base, fontWeight: '700' },

  card:               { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardImage:          { width: '100%', height: 160 },
  cardImagePlaceholder:{ width: '100%', height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard2 },
  cardBadges:         { position: 'absolute', top: SPACING.sm, left: SPACING.sm, flexDirection: 'row', gap: SPACING.xs },
  catBadge:           { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  catBadgeText:       { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardBody:     { padding: SPACING.md, gap: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardTitle:    { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', flex: 1 },
  statusBadge:  { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, flexShrink: 0 },
  statusText:   { fontSize: 11, fontWeight: '700' },
  cardDesc:     { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 18 },

  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  originalPrice:   { color: COLORS.mutedDark, fontSize: FONT.sm, textDecorationLine: 'line-through' },
  discountedPrice: { color: COLORS.green, fontSize: FONT.md, fontWeight: '700' },

  includedRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  includedText: { color: COLORS.green, fontSize: 12, flex: 1 },

  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dateText: { color: COLORS.mutedDark, fontSize: 12 },

  cardActions:  { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs },
  toggleBtn:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderWidth: 1 },
  toggleBtnOn:  { borderColor: COLORS.green + '44', backgroundColor: COLORS.green + '11' },
  toggleBtnOff: { borderColor: COLORS.border, backgroundColor: COLORS.bgCard2 },
  toggleBtnText:{ fontSize: 12, fontWeight: '600' },
  iconBtn:      { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  iconBtnRed:   { borderColor: COLORS.red + '44', backgroundColor: COLORS.red + '11' },
  iconBtnGreen: { borderColor: COLORS.green + '44', backgroundColor: COLORS.green + '11' },

  addMoreBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.purple + '66' },
  addMoreText: { color: COLORS.purple, fontSize: FONT.base, fontWeight: '600' },
})

const m = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, maxHeight: '94%',
    borderWidth: 1, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  handle:      { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle:  { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },

  label:    { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600', marginBottom: SPACING.xs },
  subLabel: { color: COLORS.mutedDark, fontSize: 11, marginBottom: SPACING.xs },

  imageBox: {
    height: 140, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, overflow: 'hidden', marginBottom: SPACING.md,
    alignItems: 'center', justifyContent: 'center',
  },
  imagePreview:         { width: '100%', height: '100%' },
  imagePlaceholder:     { alignItems: 'center', gap: SPACING.xs },
  imagePlaceholderText: { color: COLORS.mutedDark, fontSize: FONT.sm },
  uploadOverlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  uploadingText:        { color: '#fff', fontSize: FONT.sm },

  input: {
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4, color: COLORS.white, fontSize: FONT.base,
    marginBottom: SPACING.md,
  },
  textarea: { minHeight: 72, paddingTop: SPACING.sm + 4 },

  pillRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  pillActive:     { backgroundColor: COLORS.purpleDark, borderColor: COLORS.purple },
  pillGreen:      { backgroundColor: COLORS.green + 'cc', borderColor: COLORS.green },
  pillText:       { color: COLORS.muted, fontSize: FONT.sm },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  row2:    { flexDirection: 'row', gap: SPACING.sm },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, marginBottom: SPACING.xs,
  },
  dateBtnText:     { color: COLORS.white, fontSize: FONT.sm, flex: 1 },
  datePlaceholder: { color: COLORS.mutedDark },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
})
