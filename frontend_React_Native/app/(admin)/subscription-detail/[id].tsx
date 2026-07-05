import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import DatePickerModal from '@/components/DatePickerModal'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { usePlatformSettings } from '@/lib/platformSettings'
import {
  subscriptionPeriodDays,
  subscriptionPlanLabel,
  subscriptionPrice,
  subscriptionPriceSuffix,
  type SubscriptionPlanType,
} from '@/lib/subscriptions'
import { dbDateToDdMmYyyy, ddMmYyyyToIsoDate } from '@/lib/eventDates'

type ClubFee = {
  club_id: string
  club_name: string
  subscription_type: string | null
  subscription_due_date: string | null
  subscription_price: number | null
  commission_ticket_rate: number | null
  commission_table_rate: number | null
}

function money(value: number, maximumFractionDigits = 0) {
  return `€${value.toLocaleString(undefined, { maximumFractionDigits })}`
}

export default function AdminSubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { settings } = usePlatformSettings()

  const [club, setClub] = useState<ClubFee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const [plan, setPlan] = useState<SubscriptionPlanType>('monthly')
  const [price, setPrice] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [ticketRate, setTicketRate] = useState('')
  const [tableRate, setTableRate] = useState('')

  useFocusEffect(
    useCallback(() => {
      loadClub()
      // loadClub reads latest platform settings and local setters on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  async function loadClub() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clubs')
      .select('club_id, club_name, subscription_type, subscription_due_date, subscription_price, commission_ticket_rate, commission_table_rate')
      .eq('club_id', id)
      .single()

    if (error) {
      Alert.alert('Could not load subscription', error.message)
      setLoading(false)
      return
    }

    const row = data as ClubFee
    const nextPlan = subscriptionPlanLabel(row.subscription_type) === '3-Month' ? 'three_monthly' : 'monthly'
    setClub(row)
    setPlan(nextPlan)
    setPrice(String(row.subscription_price ?? subscriptionPrice(settings, nextPlan)))
    setDueDate(dbDateToDdMmYyyy(row.subscription_due_date))
    setTicketRate(String(row.commission_ticket_rate ?? settings.commission_ticket))
    setTableRate(String(row.commission_table_rate ?? settings.commission_table))
    setLoading(false)
  }

  async function saveFees() {
    if (!club) return
    const parsedPrice = parseFloat(price.replace(',', '.'))
    const parsedTicket = parseFloat(ticketRate.replace(',', '.'))
    const parsedTable = parseFloat(tableRate.replace(',', '.'))
    const dueIso = dueDate ? ddMmYyyyToIsoDate(dueDate) : null

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { Alert.alert('Invalid price', 'Enter a valid subscription price.'); return }
    if (!Number.isFinite(parsedTicket) || parsedTicket < 0) { Alert.alert('Invalid ticket commission', 'Enter a valid ticket commission percentage.'); return }
    if (!Number.isFinite(parsedTable) || parsedTable < 0) { Alert.alert('Invalid table commission', 'Enter a valid table commission percentage.'); return }
    if (dueDate && !dueIso) { Alert.alert('Invalid due date', 'Choose a valid due date.'); return }

    setSaving(true)
    const { error } = await supabase
      .from('clubs')
      .update({
        subscription_type: plan,
        subscription_price: parsedPrice,
        subscription_due_date: dueIso ? new Date(`${dueIso}T12:00:00`).toISOString() : null,
        commission_ticket_rate: parsedTicket,
        commission_table_rate: parsedTable,
      })
      .eq('club_id', club.club_id)
    setSaving(false)

    if (error) { Alert.alert('Could not save', error.message); return }
    Alert.alert('Saved', 'Subscription and fees were updated.')
    loadClub()
  }

  async function resetDefaults() {
    if (!club) return
    Alert.alert(
      'Reset defaults',
      'Reset subscription price and commission fees to platform defaults for this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clubs')
              .update({ subscription_price: null, commission_ticket_rate: null, commission_table_rate: null })
              .eq('club_id', club.club_id)
            if (error) Alert.alert('Could not reset', error.message)
            else loadClub()
          },
        },
      ],
    )
  }

  async function markPaid() {
    if (!club) return
    const days = subscriptionPeriodDays(plan)
    const current = club.subscription_due_date ? new Date(club.subscription_due_date) : new Date()
    const base = current.getTime() < Date.now() ? new Date() : current
    base.setDate(base.getDate() + days)
    const { error } = await supabase
      .from('clubs')
      .update({ subscription_due_date: base.toISOString() })
      .eq('club_id', club.club_id)
    if (error) Alert.alert('Could not mark paid', error.message)
    else loadClub()
  }

  const platformDefault = subscriptionPrice(settings, plan)
  const monthlyValue = plan === 'three_monthly'
    ? (parseFloat(price.replace(',', '.')) || 0) / 3
    : parseFloat(price.replace(',', '.')) || 0

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Subscription Fees</Text>
          <Text style={s.subtitle}>{club?.club_name ?? 'Club setup'}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.summary}>
            <Info label="Current price" value={`${money(parseFloat(price.replace(',', '.')) || 0, 2)} / ${subscriptionPriceSuffix(plan)}`} />
            <Info label="Monthly value" value={money(monthlyValue, 2)} />
            <Info label="Platform default" value={money(platformDefault, 2)} />
            <Info label="Due date" value={dueDate || 'Unset'} />
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Subscription</Text>
            <Text style={s.fieldLabel}>Subscription plan</Text>
            <View style={s.planRow}>
              {(['monthly', 'three_monthly'] as const).map(item => (
                <TouchableOpacity
                  key={item}
                  style={[s.planChoice, plan === item && s.planChoiceActive]}
                  onPress={() => {
                    setPlan(item)
                    setPrice(String(subscriptionPrice(settings, item)))
                  }}
                >
                  <Text style={[s.planText, plan === item && s.planTextActive]}>
                    {item === 'monthly' ? 'Monthly' : '3-Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Subscription price" value={price} onChangeText={setPrice} suffix="EUR" />
            <TouchableOpacity style={s.dateField} onPress={() => setDatePickerOpen(true)}>
              <View>
                <Text style={s.fieldLabel}>Subscription due date</Text>
                <Text style={s.dateValue}>{dueDate || 'Select due date'}</Text>
              </View>
              <Ionicons name="calendar-outline" size={18} color={COLORS.purple} />
            </TouchableOpacity>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Commission Fees</Text>
            <Field label="Ticket commission" value={ticketRate} onChangeText={setTicketRate} suffix="%" />
            <Field label="Table commission" value={tableRate} onChangeText={setTableRate} suffix="%" />
            <Text style={s.helpText}>
              Platform defaults are {settings.commission_ticket}% for tickets and {settings.commission_table}% for tables. These values personalize fees only for this club.
            </Text>
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={saveFees} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark" size={18} color={COLORS.white} />}
            <Text style={s.saveText}>Save Personalized Fees</Text>
          </TouchableOpacity>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.secondaryBtn} onPress={markPaid}>
              <Ionicons name="checkmark-circle-outline" size={15} color={COLORS.green} />
              <Text style={[s.secondaryText, { color: COLORS.green }]}>Mark paid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={resetDefaults}>
              <Ionicons name="refresh-outline" size={15} color={COLORS.red} />
              <Text style={[s.secondaryText, { color: COLORS.red }]}>Reset defaults</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <DatePickerModal
        visible={datePickerOpen}
        value={dueDate}
        label="Subscription due date"
        onClose={() => setDatePickerOpen(false)}
        onSelect={(value) => {
          setDueDate(value)
          setDatePickerOpen(false)
        }}
      />
    </View>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoCard}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function Field({
  label,
  value,
  onChangeText,
  suffix,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  suffix: string
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={COLORS.mutedDark}
        />
        <Text style={s.inputSuffix}>{suffix}</Text>
      </View>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  infoCard: {
    width: '47.5%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  infoLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '700' },
  infoValue: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '900', marginTop: 3 },
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '900' },
  fieldLabel: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '800' },
  planRow: { flexDirection: 'row', gap: SPACING.sm },
  planChoice: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planChoiceActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  planText: { color: COLORS.muted, fontSize: FONT.sm, fontWeight: '900' },
  planTextActive: { color: COLORS.white },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
  },
  input: { flex: 1, minHeight: 44, color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  inputSuffix: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '900' },
  dateField: {
    minHeight: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '900', marginTop: 4 },
  helpText: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17 },
  saveBtn: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: { fontSize: FONT.sm, fontWeight: '900' },
})
