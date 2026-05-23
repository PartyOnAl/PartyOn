import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'card'

type SavedCard = {
  id: string
  brand: CardBrand
  last4: string
  exp_month: string
  exp_year: string
  holder_name: string
  is_default: boolean
}

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}

function detectBrand(num: string): CardBrand {
  const d = num.replace(/\D/g, '')
  if (/^4/.test(d)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard'
  if (/^3[47]/.test(d)) return 'amex'
  return 'card'
}

function brandLabel(b: CardBrand) {
  return b === 'visa' ? 'Visa'
    : b === 'mastercard' ? 'Mastercard'
    : b === 'amex' ? 'Amex'
    : 'Card'
}

function brandIcon(_: CardBrand): keyof typeof Ionicons.glyphMap {
  return 'card'
}

export default function PaymentMethodScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const params = useLocalSearchParams<{
    eventId?: string; eventName?: string; ticketTypeId?: string
    ticketTypeName?: string; quantity?: string; total?: string; isReservation?: string
    attendees?: string
  }>()

  const isCheckout = Boolean(params.eventId)
  const isReservation = params.isReservation === 'true'
  const total = Number(params.total ?? 0)

  const [cards, setCards] = useState<SavedCard[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [holderName, setHolderName] = useState('')
  const [makeDefault, setMakeDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const loadCards = useCallback(async () => {
    if (!user?.id) return
    setLoadingCards(true)
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id,brand,last4,exp_month,exp_year,holder_name,is_default')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setLoadingCards(false)
    if (error) {
      Alert.alert('Could not load cards', error.message)
      return
    }
    const loaded = (data ?? []) as SavedCard[]
    setCards(loaded)
    if (isCheckout) {
      const def = loaded.find(c => c.is_default) ?? loaded[0] ?? null
      setSelectedCardId(def?.id ?? null)
      setShowForm(loaded.length === 0)
    }
  }, [user?.id, isCheckout])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  function resetForm() {
    setCardNumber('')
    setExpiry('')
    setHolderName('')
    setMakeDefault(false)
  }

  function validateCardFields() {
    const digits = cardNumber.replace(/\D/g, '')
    const expDigits = expiry.replace(/\D/g, '')
    const month = expDigits.slice(0, 2)
    const year = expDigits.slice(2, 4)

    if (digits.length < 13) { Alert.alert('Invalid card', 'Please enter a valid card number.'); return null }
    if (expDigits.length < 4 || Number(month) < 1 || Number(month) > 12) {
      Alert.alert('Invalid expiry', 'Please enter expiry as MM / YY.')
      return null
    }
    if (!holderName.trim()) { Alert.alert('Name required', 'Please enter the name on the card.'); return null }

    return {
      brand: detectBrand(digits),
      last4: digits.slice(-4),
      exp_month: month,
      exp_year: year,
      holder_name: holderName.trim(),
    }
  }

  async function saveCard() {
    if (!user?.id) return
    const card = validateCardFields()
    if (!card) return

    setSaving(true)
    try {
      if (makeDefault || cards.length === 0) {
        await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id)
      }

      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        ...card,
        is_default: makeDefault || cards.length === 0,
      })
      if (error) throw error

      resetForm()
      setShowForm(false)
      await loadCards()
    } catch (e: any) {
      Alert.alert('Could not save card', e?.message ?? 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function setDefaultCard(cardId: string) {
    if (!user?.id) return
    const { error: clearError } = await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id)
    if (clearError) { Alert.alert('Error', clearError.message); return }
    const { error } = await supabase.from('payment_methods').update({ is_default: true }).eq('id', cardId).eq('user_id', user.id)
    if (error) { Alert.alert('Error', error.message); return }
    await loadCards()
  }

  function removeCard(card: SavedCard) {
    Alert.alert('Remove card', `Remove ${brandLabel(card.brand)} ending in ${card.last4}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (!user?.id) return
          const { error } = await supabase.from('payment_methods').delete().eq('id', card.id).eq('user_id', user.id)
          if (error) { Alert.alert('Error', error.message); return }
          await loadCards()
        },
      },
    ])
  }

  function openCardMenu(card: SavedCard) {
    Alert.alert(
      `${brandLabel(card.brand)} ending in ${card.last4}`,
      `Exp ${card.exp_month}/${card.exp_year} · ${card.holder_name}`,
      [
        ...(card.is_default ? [] : [{ text: 'Set as default', onPress: () => setDefaultCard(card.id) }]),
        { text: 'Remove', style: 'destructive' as const, onPress: () => removeCard(card) },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  async function handleCheckout() {
    if (!isReservation && total > 0 && !selectedCardId && !validateCardFields()) return

    setCheckoutLoading(true)
    try {
      const nrPeople = Number(params.quantity ?? 1)
      let assignedTableId: string | null = null

      if (isReservation && params.eventId) {
        const { data: eventRow } = await supabase
          .from('events').select('club_id').eq('event_id', params.eventId).single()

        if (eventRow?.club_id) {
          const { data: taken } = await supabase
            .from('reservations')
            .select('table_id')
            .eq('event_id', params.eventId)
            .neq('status', 'cancelled')
            .not('table_id', 'is', null)
          const takenIds = (taken ?? []).map((r: any) => r.table_id).filter(Boolean)

          const { data: candidates } = await supabase
            .from('tables')
            .select('id, seating_capacity')
            .eq('club_id', eventRow.club_id)
            .gte('seating_capacity', nrPeople)
            .order('seating_capacity', { ascending: true })
            .limit(20)

          const available = (candidates ?? []).filter((t: any) => !takenIds.includes(t.id))
          if (available.length > 0) assignedTableId = available[0].id
        }
      }

      const { data: res, error: resErr } = await supabase.from('reservations').insert({
        user_id: user?.id,
        event_id: params.eventId,
        ticket_type_id: params.ticketTypeId || null,
        table_id: assignedTableId,
        type: isReservation ? 'table' : 'ticket',
        status: 'confirmed',
        nr_of_people: nrPeople,
      }).select().single()

      if (resErr) throw resErr

      if (!isReservation && total > 0) {
        await supabase.from('payments').insert({
          reservation_id: res.reservation_id,
          user_id: user?.id,
          amount: total,
          status: 'completed',
        })
      }

      if (!isReservation) {
        let names: string[] = []
        try { names = JSON.parse(params.attendees ?? '[]') } catch {}
        if (names.length === 0) names = ['Me']
        while (names.length < nrPeople) names.push(`Guest ${names.length + 1}`)
        names = names.slice(0, nrPeople)
        await supabase.from('attendees').insert(names.map(n => ({ reservation_id: res.reservation_id, name: n || 'Guest' })))
      }

      router.replace({
        pathname: '/purchased-ticket',
        params: {
          reservationId: res.reservation_id,
          qrCode: res.qr_code,
          eventName: params.eventName,
          ticketTypeName: params.ticketTypeName,
          quantity: params.quantity,
          total: params.total,
          isReservation: params.isReservation,
        },
      })
    } catch (e: any) {
      Alert.alert('Could not complete booking', e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  function renderCardForm() {
    return (
      <View style={styles.card}>
        <View style={styles.secureRow}>
          <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.green} />
          <Text style={styles.secureText}>Only card brand, last 4 digits, expiry, and name are saved. Full card numbers and CVC are never stored.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Card number</Text>
          <TextInput
            style={styles.input}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor={COLORS.mutedDark}
            value={cardNumber}
            onChangeText={(v) => setCardNumber(formatCardNumber(v))}
            keyboardType="number-pad"
            maxLength={23}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Expiry</Text>
            <TextInput
              style={styles.input}
              placeholder="MM / YY"
              placeholderTextColor={COLORS.mutedDark}
              value={expiry}
              onChangeText={(v) => setExpiry(formatExpiry(v))}
              keyboardType="number-pad"
              maxLength={7}
            />
          </View>
          <View style={[styles.field, styles.flex, { marginLeft: SPACING.sm }]}>
            <Text style={styles.label}>Name on card</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={COLORS.mutedDark}
              value={holderName}
              onChangeText={setHolderName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {!isCheckout ? (
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Default card</Text>
              <Text style={styles.toggleSub}>Use this for future bookings when payment is available.</Text>
            </View>
            <Switch value={makeDefault} onValueChange={setMakeDefault} thumbColor={makeDefault ? COLORS.purple : COLORS.mutedDark} />
          </View>
        ) : null}

        {!isCheckout ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={saveCard} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save card details</Text>}
          </TouchableOpacity>
        ) : null}
      </View>
    )
  }

  if (!isCheckout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {loadingCards ? (
            <View style={styles.center}><ActivityIndicator color={COLORS.purple} /></View>
          ) : cards.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="card-outline" size={34} color={COLORS.mutedDark} />
              <Text style={styles.emptyTitle}>No saved cards</Text>
              <Text style={styles.emptySub}>Add card details here so your payment method is ready when checkout supports secure processing.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {cards.map((card, idx) => (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.savedRow, idx < cards.length - 1 && styles.savedBorder]}
                  onPress={() => openCardMenu(card)}
                  activeOpacity={0.75}
                >
                  <View style={styles.savedIcon}>
                    <Ionicons name={brandIcon(card.brand)} size={18} color={COLORS.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.savedTitleRow}>
                      <Text style={styles.savedTitle}>{brandLabel(card.brand)} ending in {card.last4}</Text>
                      {card.is_default ? <Text style={styles.defaultBadge}>Default</Text> : null}
                    </View>
                    <Text style={styles.savedMeta}>Exp {card.exp_month}/{card.exp_year} · {card.holder_name}</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.mutedDark} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetForm()
              setShowForm(v => !v)
            }}
            activeOpacity={0.8}
          >
            <Ionicons name={showForm ? 'close-outline' : 'add-outline'} size={18} color={COLORS.purple} />
            <Text style={styles.addBtnText}>{showForm ? 'Cancel' : 'Add card details'}</Text>
          </TouchableOpacity>

          {showForm ? renderCardForm() : null}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isReservation ? 'Confirm Reservation' : 'Card Details'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>
          <Text style={styles.summaryEvent} numberOfLines={2}>{params.eventName}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{params.ticketTypeName}</Text>
            <Text style={styles.summaryValue}>x{params.quantity}</Text>
          </View>
          {!isReservation ? (
            <>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>EUR {total.toFixed(2)}</Text>
              </View>
            </>
          ) : (
            <View style={[styles.summaryRow, { marginTop: SPACING.xs }]}>
              <Text style={styles.summaryLabel}>Reservation</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>No payment required</Text>
            </View>
          )}
        </View>

        {!isReservation ? (
          loadingCards ? (
            <View style={styles.cardLoadingRow}>
              <ActivityIndicator color={COLORS.purple} size="small" />
              <Text style={styles.cardLoadingText}>Loading saved cards…</Text>
            </View>
          ) : (
            <>
              {cards.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.savedCardsLabel}>Saved cards</Text>
                  {cards.map((c, idx) => {
                    const isSelected = selectedCardId === c.id
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.savedRow,
                          idx < cards.length - 1 && styles.savedBorder,
                          isSelected && styles.savedRowSelected,
                        ]}
                        onPress={() => { setSelectedCardId(c.id); setShowForm(false) }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.savedIcon, isSelected && styles.savedIconSelected]}>
                          <Ionicons name="card" size={18} color={isSelected ? COLORS.white : COLORS.purple} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.savedTitleRow}>
                            <Text style={styles.savedTitle}>{brandLabel(c.brand)} ···· {c.last4}</Text>
                            {c.is_default && <Text style={styles.defaultBadge}>Default</Text>}
                          </View>
                          <Text style={styles.savedMeta}>Exp {c.exp_month}/{c.exp_year} · {c.holder_name}</Text>
                        </View>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}

              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { setShowForm(v => !v); if (!showForm) setSelectedCardId(null) }}
                activeOpacity={0.8}
              >
                <Ionicons name={showForm ? 'close-outline' : 'add-outline'} size={18} color={COLORS.purple} />
                <Text style={styles.addBtnText}>{showForm ? 'Cancel' : 'Use a different card'}</Text>
              </TouchableOpacity>

              {showForm && renderCardForm()}
            </>
          )
        ) : (
          <View style={styles.freeNotice}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
            <Text style={styles.freeNoticeText}>This venue accepts free table reservations. Confirm to complete your booking.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleCheckout} disabled={checkoutLoading} activeOpacity={0.85}>
          {checkoutLoading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Text style={styles.primaryBtnText}>{isReservation ? 'Confirm reservation' : 'Confirm purchase'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  flex: { flex: 1 },
  summaryCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  summaryTitle: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  summaryEvent: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, gap: SPACING.md },
  summaryLabel: { color: COLORS.muted, fontSize: FONT.base, flex: 1 },
  summaryValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalLabel: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  totalValue: { color: COLORS.purple, fontSize: FONT.md, fontWeight: '800' },
  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  secureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: SPACING.md },
  secureText: { color: COLORS.green, fontSize: FONT.sm, lineHeight: 18, flex: 1 },
  field: { marginBottom: SPACING.md },
  fieldRow: { flexDirection: 'row' },
  label: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.bgInput, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, color: COLORS.white, fontSize: FONT.base },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  toggleTitle: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '700' },
  toggleSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2, lineHeight: 16 },
  emptyCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: SPACING.sm },
  emptyTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  emptySub: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },
  savedCardsLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  savedRowSelected: { backgroundColor: 'rgba(167,139,250,0.06)', marginHorizontal: -SPACING.md, paddingHorizontal: SPACING.md, borderRadius: RADIUS.sm },
  savedBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  savedIcon: { width: 38, height: 38, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgInput, alignItems: 'center', justifyContent: 'center' },
  savedIconSelected: { backgroundColor: COLORS.purple },
  savedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  savedTitle: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '700' },
  savedMeta: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  defaultBadge: { color: COLORS.green, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.green + '18' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: COLORS.purple },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.purple },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.purple + '40', backgroundColor: COLORS.purple + '10', padding: SPACING.md, marginBottom: SPACING.md },
  addBtnText: { color: COLORS.purple, fontSize: FONT.base, fontWeight: '800' },
  cardLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.lg },
  cardLoadingText: { color: COLORS.muted, fontSize: FONT.sm },
  freeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  freeNoticeText: { color: COLORS.green, fontSize: FONT.base, flex: 1, lineHeight: FONT.base * 1.5 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, paddingTop: SPACING.sm },
  primaryBtn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.md, padding: SPACING.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT.base },
})
