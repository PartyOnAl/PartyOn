import { useMemo, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { usePlatformSettings } from '@/lib/platformSettings'
import { subscriptionPrice, subscriptionPriceSuffix, type SubscriptionPlanType } from '@/lib/subscriptions'

export default function AdminAddClubScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { settings } = usePlatformSettings()

  const [clubName, setClubName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [image, setImage] = useState('')
  const [description, setDescription] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [plan, setPlan] = useState<SubscriptionPlanType>('monthly')
  const [reservationOnly, setReservationOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  const planPrice = useMemo(() => subscriptionPrice(settings, plan), [settings, plan])

  async function createClub() {
    const name = clubName.trim()
    const managerLookup = managerEmail.trim().toLowerCase()

    if (!name) {
      Alert.alert('Club name required', 'Add the club name before saving.')
      return
    }

    setSaving(true)
    try {
      let managerId: string | null = null

      if (managerLookup) {
        const { data: manager, error: managerError } = await supabase
          .from('profiles')
          .select('id, club_id')
          .ilike('email', managerLookup)
          .maybeSingle()

        if (managerError) throw managerError
        if (!manager) {
          Alert.alert('Manager not found', 'No profile exists with that manager email.')
          return
        }
        if (manager.club_id) {
          Alert.alert('Manager already assigned', 'This manager already has a club. One manager can only be connected to one club.')
          return
        }

        const { data: existingClub, error: existingError } = await supabase
          .from('clubs')
          .select('club_id')
          .eq('manager_id', manager.id)
          .maybeSingle()

        if (existingError) throw existingError
        if (existingClub) {
          Alert.alert('Manager already assigned', 'This manager is already listed as the manager of another club.')
          return
        }

        managerId = manager.id
      }

      const { data: created, error: clubError } = await supabase
        .from('clubs')
        .insert({
          club_name: name,
          club_address: address.trim() || null,
          club_email_id: email.trim() || null,
          club_phone_number: phone.trim() || null,
          club_image: image.trim() || null,
          club_description: description.trim() || null,
          club_status: 'approved',
          manager_id: managerId,
          reservation_only: reservationOnly,
          subscription_type: plan,
          subscription_price: null,
          commission_ticket_rate: settings.commission_ticket,
          commission_table_rate: settings.commission_table,
        })
        .select('club_id')
        .single()

      if (clubError) throw clubError

      if (managerId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'manager', club_id: created.club_id })
          .eq('id', managerId)

        if (profileError) {
          Alert.alert('Club created', `The club was created, but the manager profile could not be linked: ${profileError.message}`)
          router.replace(`/(admin)/club-detail/${created.club_id}`)
          return
        }
      }

      Alert.alert('Club created', `${name} has been added.`, [
        { text: 'View club', onPress: () => router.replace(`/(admin)/club-detail/${created.club_id}`) },
      ])
    } catch (err: any) {
      Alert.alert('Could not create club', err?.message ?? 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Add Club</Text>
          <Text style={s.subtitle}>Create a club and optionally assign its manager</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Club Details</Text>
          <Field label="Club name" value={clubName} onChangeText={setClubName} placeholder="Coffee Time" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, city" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="club@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+355..." keyboardType="phone-pad" />
          <Field label="Cover image URL" value={image} onChangeText={setImage} placeholder="https://..." autoCapitalize="none" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Short club description" multiline />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Manager</Text>
          <Field
            label="Manager email"
            value={managerEmail}
            onChangeText={setManagerEmail}
            placeholder="manager@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={s.helpText}>Leave empty to create the club without a manager. If filled, the profile must exist and must not already own a club.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Setup</Text>
          <View style={s.optionRow}>
            {(['monthly', 'three_monthly'] as const).map(item => (
              <TouchableOpacity key={item} style={[s.choice, plan === item && s.choiceActive]} onPress={() => setPlan(item)}>
                <Text style={[s.choiceText, plan === item && s.choiceTextActive]}>
                  {item === 'monthly' ? 'Monthly' : '3-Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Subscription price</Text>
            <Text style={s.priceValue}>€{planPrice.toFixed(0)} / {subscriptionPriceSuffix(plan)}</Text>
          </View>
          <TouchableOpacity style={s.toggleRow} onPress={() => setReservationOnly(v => !v)}>
            <Ionicons name={reservationOnly ? 'checkbox' : 'square-outline'} size={20} color={reservationOnly ? COLORS.purple : COLORS.mutedDark} />
            <Text style={s.toggleText}>Reservation-only venue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
        <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={createClub} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark" size={18} color={COLORS.white} />}
          <Text style={s.saveText}>{saving ? 'Creating...' : 'Create Club'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  multiline?: boolean
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.mutedDark}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 120 },
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800', marginBottom: 2 },
  field: { gap: 6 },
  fieldLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    color: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT.base,
  },
  inputMultiline: { minHeight: 92, textAlignVertical: 'top' },
  helpText: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17 },
  optionRow: { flexDirection: 'row', gap: SPACING.sm },
  choice: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  choiceActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  choiceText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '700' },
  choiceTextActive: { color: COLORS.white },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
  },
  priceLabel: { color: COLORS.mutedDark, fontSize: FONT.sm },
  priceValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 2 },
  toggleText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
})
