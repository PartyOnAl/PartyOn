import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'

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

function storageKey(clubId: string | null | undefined) {
  return `partyon:club-payment-methods:${clubId ?? 'unknown'}`
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
function newId() {
  return `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default function PaymentMethodsScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [cards, setCards]     = useState<SavedCard[]>([])

  // Add-card form state
  const [showForm, setShowForm]   = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry]       = useState('')
  const [cvc, setCvc]             = useState('')
  const [holder, setHolder]       = useState('')
  const [makeDefault, setMakeDefault] = useState(false)

  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await AsyncStorage.getItem(storageKey(profile?.club_id))
      const parsed: SavedCard[] = raw ? JSON.parse(raw) : []
      setCards(Array.isArray(parsed) ? parsed : [])
    } catch {
      setCards([])
    } finally {
      setLoading(false)
    }
  }, [profile?.club_id])

  useEffect(() => { loadCards() }, [loadCards])

  async function persist(next: SavedCard[]) {
    setCards(next)
    await AsyncStorage.setItem(storageKey(profile?.club_id), JSON.stringify(next))
  }

  function resetForm() {
    setCardNumber(''); setExpiry(''); setCvc(''); setHolder(''); setMakeDefault(false)
  }

  async function handleSaveCard() {
    const digits = cardNumber.replace(/\s/g, '')
    if (digits.length < 13) { Alert.alert('Invalid card', 'Please enter a valid card number.'); return }
    const expDigits = expiry.replace(/\D/g, '')
    if (expDigits.length < 4) { Alert.alert('Invalid expiry', 'Please enter expiry as MM / YY.'); return }
    const mm = expDigits.slice(0, 2)
    const yy = expDigits.slice(2, 4)
    if (Number(mm) < 1 || Number(mm) > 12) { Alert.alert('Invalid expiry', 'Month must be between 01 and 12.'); return }
    if (cvc.length < 3) { Alert.alert('Invalid CVC', 'Please enter a valid CVC.'); return }
    if (!holder.trim()) { Alert.alert('Name required', 'Please enter the name on the card.'); return }

    setSaving(true)
    try {
      const card: SavedCard = {
        id: newId(),
        brand: detectBrand(digits),
        last4: digits.slice(-4),
        exp_month: mm,
        exp_year: yy,
        holder_name: holder.trim(),
        is_default: makeDefault || cards.length === 0,
      }
      // If new card is default, unset others
      const cleared = card.is_default
        ? cards.map(c => ({ ...c, is_default: false }))
        : cards
      await persist([...cleared, card])
      resetForm()
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetDefault(id: string) {
    const next = cards.map(c => ({ ...c, is_default: c.id === id }))
    await persist(next)
  }

  async function handleRemove(id: string) {
    const target = cards.find(c => c.id === id)
    if (!target) return
    const wasDefault = target.is_default
    let next = cards.filter(c => c.id !== id)
    if (wasDefault && next.length > 0) {
      next = next.map((c, idx) => ({ ...c, is_default: idx === 0 }))
    }
    await persist(next)
  }

  function openCardMenu(card: SavedCard) {
    Alert.alert(
      `${brandLabel(card.brand)} •••• ${card.last4}`,
      `Exp ${card.exp_month}/${card.exp_year} · ${card.holder_name}`,
      [
        ...(card.is_default ? [] : [{ text: 'Set as default', onPress: () => handleSetDefault(card.id) }]),
        {
          text: 'Remove',
          style: 'destructive' as const,
          onPress: () => {
            Alert.alert('Remove card', `Remove •••• ${card.last4}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => handleRemove(card.id) },
            ])
          },
        },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  const brandIcon = (b: CardBrand): keyof typeof Ionicons.glyphMap => 'card'

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>PartyOn</Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Payment Methods</Text>
        <Text style={s.pageSubtitle}>Cards used to pay your club subscription</Text>

        {/* Cards list */}
        {cards.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="card-outline" size={36} color={COLORS.mutedDark} />
            <Text style={s.emptyTitle}>No payment methods yet</Text>
            <Text style={s.emptyText}>
              Add a card to keep your subscription active without interruptions.
            </Text>
          </View>
        ) : (
          <View style={s.listCard}>
            {cards.map((card, idx) => (
              <View key={card.id}>
                {idx > 0 && <View style={s.rowDivider} />}
                <TouchableOpacity style={s.cardRow} onPress={() => openCardMenu(card)} activeOpacity={0.7}>
                  <View style={s.cardLeft}>
                    <View style={s.cardIcon}>
                      <Ionicons name={brandIcon(card.brand)} size={18} color={COLORS.purple} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.cardTitleRow}>
                        <Text style={s.cardBrand}>{brandLabel(card.brand)} •••• {card.last4}</Text>
                        {card.is_default && (
                          <View style={s.defaultBadge}>
                            <Text style={s.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.cardMeta}>Exp {card.exp_month}/{card.exp_year} · {card.holder_name}</Text>
                    </View>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.mutedDark} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add new card */}
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setShowForm(v => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name={showForm ? 'remove-circle-outline' : 'add-circle-outline'} size={18} color={COLORS.white} />
          <Text style={s.addBtnText}>{showForm ? 'Cancel' : 'Add new card'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={s.formCard}>
            <View style={s.secureRow}>
              <Ionicons name="lock-closed" size={14} color={COLORS.green} />
              <Text style={s.secureText}>Card details are encrypted. Only the last 4 digits are stored on this device.</Text>
            </View>

            <Field label="Card Number">
              <TextInput
                style={s.input}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={COLORS.mutedDark}
                value={cardNumber}
                onChangeText={v => setCardNumber(formatCardNumber(v))}
                keyboardType="number-pad"
                maxLength={23}
              />
            </Field>

            <View style={s.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field label="Expiry">
                  <TextInput
                    style={s.input}
                    placeholder="MM / YY"
                    placeholderTextColor={COLORS.mutedDark}
                    value={expiry}
                    onChangeText={v => setExpiry(formatExpiry(v))}
                    keyboardType="number-pad"
                    maxLength={7}
                  />
                </Field>
              </View>
              <View style={{ width: SPACING.sm }} />
              <View style={{ flex: 1 }}>
                <Field label="CVC">
                  <TextInput
                    style={s.input}
                    placeholder="123"
                    placeholderTextColor={COLORS.mutedDark}
                    value={cvc}
                    onChangeText={v => setCvc(v.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </Field>
              </View>
            </View>

            <Field label="Name on Card">
              <TextInput
                style={s.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.mutedDark}
                value={holder}
                onChangeText={setHolder}
                autoCapitalize="words"
              />
            </Field>

            <View style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Set as default</Text>
                <Text style={s.toggleSub}>Use this card for future subscription charges</Text>
              </View>
              <Switch
                value={makeDefault}
                onValueChange={setMakeDefault}
                trackColor={{ false: COLORS.border, true: COLORS.purpleDark }}
                thumbColor={makeDefault ? COLORS.purple : COLORS.muted}
              />
            </View>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveCard}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="save-outline" size={16} color="#fff" />
                    <Text style={s.saveBtnText}>Save Card</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  header:   { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:      { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  listCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  cardIcon: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.purple + '1f',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardBrand: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '700' },
  cardMeta:  { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.green + '22' },
  defaultBadgeText: { color: COLORS.green, fontSize: 10, fontWeight: '700' },

  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginTop: SPACING.xs },
  emptyText:  { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', lineHeight: 20 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  addBtnText: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '600' },

  formCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  secureText: { color: COLORS.green, fontSize: FONT.sm, flex: 1 },

  field:      { marginBottom: SPACING.md },
  fieldLabel: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    color: COLORS.white,
    fontSize: FONT.base,
  },
  fieldRow: { flexDirection: 'row' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  toggleLabel: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '500' },
  toggleSub:   { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    marginTop: SPACING.xs,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
})
