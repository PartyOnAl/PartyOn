import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Modal, Pressable, TextInput, ActivityIndicator, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type Settings = {
  // Platform
  maintenance_mode: boolean
  new_registrations: boolean
  email_notifications: boolean
  auto_approve_events: boolean
  featured_event_billing: boolean
  // Commission
  commission_ticket: string
  commission_table: string
  // Subscriptions
  monthly_club_fee: string
  annual_club_fee: string
  featured_slot_fee: string
  trial_period_days: string
  // Tax
  vat_enabled: boolean
  vat_rate: string
  // Payouts
  payout_threshold: string
  payout_frequency: string
  // Processing
  stripe_fee_percent: string
  stripe_fee_fixed: string
  // Refunds
  refund_window_hours: string
  late_cancel_fee: string
}

const DEFAULTS: Settings = {
  maintenance_mode: false,
  new_registrations: true,
  email_notifications: true,
  auto_approve_events: false,
  featured_event_billing: true,
  commission_ticket: '15',
  commission_table: '15',
  monthly_club_fee: '299',
  annual_club_fee: '2499',
  featured_slot_fee: '500',
  trial_period_days: '30',
  vat_enabled: true,
  vat_rate: '20',
  payout_threshold: '50',
  payout_frequency: 'monthly',
  stripe_fee_percent: '1.4',
  stripe_fee_fixed: '0.25',
  refund_window_hours: '24',
  late_cancel_fee: '10',
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({
  visible, label, value, unit, hint,
  onClose, onSave,
}: {
  visible: boolean
  label: string
  value: string
  unit: string
  hint?: string
  onClose: () => void
  onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value, visible])

  function handleSave() {
    const n = parseFloat(draft)
    if (isNaN(n) || n < 0) { Alert.alert('Invalid value', 'Please enter a valid positive number.'); return }
    onSave(draft)
    onClose()
  }

  const prefixUnit = unit !== '%' && unit !== 'days' && unit !== 'hrs'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={em.overlay} onPress={onClose}>
        <Pressable style={em.box} onPress={() => {}}>
          <Text style={em.title}>Edit {label}</Text>
          {hint ? <Text style={em.hint}>{hint}</Text> : null}
          <View style={em.inputRow}>
            {prefixUnit && <Text style={em.unit}>{unit}</Text>}
            <TextInput
              style={em.input}
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              selectionColor={COLORS.purple}
              autoFocus
            />
            {!prefixUnit && <Text style={em.unit}>{unit}</Text>}
          </View>
          <View style={em.actions}>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose}>
              <Text style={em.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={em.saveBtn} onPress={handleSave}>
              <Text style={em.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Editable rate row ─────────────────────────────────────────────────────────
function RateRow({
  icon, iconBg, iconColor, label, sub, display, isSaving,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconBg: string
  iconColor: string
  label: string
  sub?: string
  display: string
  isSaving: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowLabel}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      {isSaving
        ? <ActivityIndicator size="small" color={COLORS.purple} />
        : <Text style={st.rateValue}>{display}</Text>
      }
      <Ionicons name="create-outline" size={15} color={COLORS.mutedDark} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<{
    key: keyof Settings; label: string; unit: string; hint?: string
  } | null>(null)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('platform_settings').select('key, value')
    if (data) {
      const map: Partial<Settings> = {}
      for (const row of data) {
        const k = row.key as keyof Settings
        if (k in DEFAULTS) {
          (map as any)[k] = typeof DEFAULTS[k] === 'boolean' ? row.value === 'true' : row.value
        }
      }
      setSettings({ ...DEFAULTS, ...map })
    }
    setLoading(false)
  }

  async function saveSetting(key: keyof Settings, value: boolean | string) {
    setSaving(key)
    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' })
    setSaving(null)
    if (error) { Alert.alert('Error', error.message); return }
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function toggleWithConfirm(key: keyof Settings, label: string, newVal: boolean, warning?: string) {
    Alert.alert(
      `${newVal ? 'Enable' : 'Disable'} ${label}`,
      warning ?? `Are you sure you want to ${newVal ? 'enable' : 'disable'} "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: newVal ? 'default' : 'destructive', onPress: () => saveSetting(key, newVal) },
      ],
    )
  }

  function openEdit(key: keyof Settings, label: string, unit: string, hint?: string) {
    setEditModal({ key, label, unit, hint })
  }

  async function handleExport() {
    const [clubs, users, events, reservations] = await Promise.all([
      supabase.from('clubs').select('club_id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('event_id', { count: 'exact', head: true }),
      supabase.from('reservations').select('reservation_id', { count: 'exact', head: true }),
    ])
    const lines = [
      `PartyOn Platform Export — ${new Date().toLocaleString('en-GB')}`,
      '',
      '--- Platform Stats ---',
      `Total Clubs: ${clubs.count ?? 0}`,
      `Total Users: ${users.count ?? 0}`,
      `Total Events: ${events.count ?? 0}`,
      `Total Reservations: ${reservations.count ?? 0}`,
      '',
      '--- Commission ---',
      `Ticket Commission: ${settings.commission_ticket}%`,
      `Table Commission: ${settings.commission_table}%`,
      '',
      '--- Subscriptions ---',
      `Monthly Club Fee: €${settings.monthly_club_fee}`,
      `Annual Club Fee: €${settings.annual_club_fee}`,
      `Featured Slot: €${settings.featured_slot_fee}`,
      `Trial Period: ${settings.trial_period_days} days`,
      '',
      '--- Tax ---',
      `VAT Enabled: ${settings.vat_enabled}`,
      `VAT Rate: ${settings.vat_rate}%`,
      '',
      '--- Payouts ---',
      `Payout Threshold: €${settings.payout_threshold}`,
      `Payout Frequency: ${settings.payout_frequency}`,
      '',
      '--- Processing ---',
      `Stripe Fee: ${settings.stripe_fee_percent}% + €${settings.stripe_fee_fixed}`,
      '',
      '--- Refunds ---',
      `Refund Window: ${settings.refund_window_hours} hrs`,
      `Late Cancel Fee: ${settings.late_cancel_fee}%`,
    ]
    await Share.share({ message: lines.join('\n') })
  }

  function ToggleRow({
    iconName, iconBg, iconColor, label, sub, settingKey, trackColor, warning,
  }: {
    iconName: keyof typeof Ionicons.glyphMap
    iconBg: string; iconColor: string
    label: string; sub: string
    settingKey: keyof Settings
    trackColor: string; warning?: string
  }) {
    const val = settings[settingKey] as boolean
    return (
      <View style={st.row}>
        <View style={[st.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.rowLabel}>{label}</Text>
          <Text style={st.rowSub}>{sub}</Text>
        </View>
        {saving === settingKey
          ? <ActivityIndicator size="small" color={trackColor} />
          : (
            <Switch
              value={val}
              onValueChange={v => toggleWithConfirm(settingKey, label, v, warning)}
              trackColor={{ false: COLORS.bgCard, true: trackColor }}
              thumbColor="#fff"
            />
          )
        }
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[st.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.topBar}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={st.topBarTitle}>Platform Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Platform Controls ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Platform Controls</Text>
          <View style={st.card}>
            <ToggleRow
              iconName="warning-outline" iconBg="rgba(239,68,68,0.15)" iconColor={COLORS.red}
              label="Maintenance Mode" sub="Disable the app for all users"
              settingKey="maintenance_mode" trackColor={COLORS.red}
              warning="This will lock out all users immediately."
            />
            <View style={st.divider} />
            <ToggleRow
              iconName="person-add-outline" iconBg="rgba(16,185,129,0.15)" iconColor={COLORS.green}
              label="New Registrations" sub="Allow new users to sign up"
              settingKey="new_registrations" trackColor={COLORS.green}
            />
            <View style={st.divider} />
            <ToggleRow
              iconName="checkmark-circle-outline" iconBg="rgba(167,139,250,0.15)" iconColor={COLORS.purple}
              label="Auto-approve Events" sub="Skip manual review for events"
              settingKey="auto_approve_events" trackColor={COLORS.purple}
            />
            <View style={st.divider} />
            <ToggleRow
              iconName="mail-outline" iconBg="rgba(99,102,241,0.15)" iconColor="#818cf8"
              label="Email Notifications" sub="Receive admin email alerts"
              settingKey="email_notifications" trackColor="#818cf8"
            />
          </View>
        </View>

        {/* ── Commission Rates ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Commission Rates</Text>
          <View style={st.card}>
            <RateRow
              icon="ticket-outline" iconBg="rgba(167,139,250,0.12)" iconColor={COLORS.purple}
              label="Ticket Sales" sub="Applied per ticket sold"
              display={`${settings.commission_ticket}%`}
              isSaving={saving === 'commission_ticket'}
              onPress={() => openEdit('commission_ticket', 'Ticket Commission', '%', 'Percentage taken on each ticket sale.')}
            />
            <View style={st.divider} />
            <RateRow
              icon="restaurant-outline" iconBg="rgba(167,139,250,0.12)" iconColor={COLORS.purple}
              label="Table Reservations" sub="Applied per table booking"
              display={`${settings.commission_table}%`}
              isSaving={saving === 'commission_table'}
              onPress={() => openEdit('commission_table', 'Table Commission', '%', 'Percentage taken on each table reservation.')}
            />
          </View>
          <Text style={st.sectionNote}>Commission is deducted automatically at payout.</Text>
        </View>

        {/* ── Subscriptions & Fees ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Subscriptions & Fees</Text>
          <View style={st.card}>
            <ToggleRow
              iconName="card-outline" iconBg="rgba(245,166,35,0.15)" iconColor={COLORS.cta}
              label="Featured Event Billing" sub="Charge clubs for featured slots"
              settingKey="featured_event_billing" trackColor={COLORS.cta}
            />
            <View style={st.divider} />
            <RateRow
              icon="calendar-outline" iconBg="rgba(16,185,129,0.12)" iconColor={COLORS.green}
              label="Monthly Club Fee" sub="Recurring monthly subscription"
              display={`€${settings.monthly_club_fee}`}
              isSaving={saving === 'monthly_club_fee'}
              onPress={() => openEdit('monthly_club_fee', 'Monthly Club Fee', '€', 'Charged to each club every month.')}
            />
            <View style={st.divider} />
            <RateRow
              icon="refresh-outline" iconBg="rgba(16,185,129,0.12)" iconColor={COLORS.green}
              label="Annual Club Fee" sub="Discounted yearly subscription"
              display={`€${settings.annual_club_fee}`}
              isSaving={saving === 'annual_club_fee'}
              onPress={() => openEdit('annual_club_fee', 'Annual Club Fee', '€', 'Full year subscription fee per club.')}
            />
            <View style={st.divider} />
            <RateRow
              icon="star-outline" iconBg="rgba(245,166,35,0.12)" iconColor="#f59e0b"
              label="Featured Event Slot" sub="One-time fee per featured event"
              display={`€${settings.featured_slot_fee}`}
              isSaving={saving === 'featured_slot_fee'}
              onPress={() => openEdit('featured_slot_fee', 'Featured Event Slot', '€', 'One-time charge to feature an event on the homepage.')}
            />
            <View style={st.divider} />
            <RateRow
              icon="gift-outline" iconBg="rgba(139,92,246,0.12)" iconColor={COLORS.purple}
              label="Free Trial Period" sub="Days before first charge"
              display={`${settings.trial_period_days} days`}
              isSaving={saving === 'trial_period_days'}
              onPress={() => openEdit('trial_period_days', 'Trial Period', 'days', 'How many days new clubs get for free before billing starts.')}
            />
          </View>
        </View>

        {/* ── Tax ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Tax</Text>
          <View style={st.card}>
            <ToggleRow
              iconName="receipt-outline" iconBg="rgba(245,166,35,0.15)" iconColor="#f59e0b"
              label="VAT Enabled" sub="Apply VAT to all transactions"
              settingKey="vat_enabled" trackColor="#f59e0b"
            />
            <View style={st.divider} />
            <RateRow
              icon="calculator-outline" iconBg="rgba(245,166,35,0.12)" iconColor="#f59e0b"
              label="VAT Rate" sub="Applied when VAT is enabled"
              display={`${settings.vat_rate}%`}
              isSaving={saving === 'vat_rate'}
              onPress={() => openEdit('vat_rate', 'VAT Rate', '%', 'Standard VAT rate applied to all taxable transactions.')}
            />
          </View>
          <Text style={st.sectionNote}>VAT is added on top of ticket and table prices at checkout.</Text>
        </View>

        {/* ── Payouts ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Payouts</Text>
          <View style={st.card}>
            <RateRow
              icon="wallet-outline" iconBg="rgba(16,185,129,0.12)" iconColor={COLORS.green}
              label="Minimum Payout" sub="Threshold before funds are released"
              display={`€${settings.payout_threshold}`}
              isSaving={saving === 'payout_threshold'}
              onPress={() => openEdit('payout_threshold', 'Minimum Payout', '€', 'Club balance must reach this before a payout is triggered.')}
            />
            <View style={st.divider} />
            <TouchableOpacity
              style={st.row}
              activeOpacity={0.7}
              onPress={() => Alert.alert(
                'Payout Frequency',
                'Select payout schedule',
                [
                  { text: 'Cancel', style: 'cancel' },
                  ...(['weekly', 'biweekly', 'monthly'] as const).map(f => ({
                    text: f.charAt(0).toUpperCase() + f.slice(1),
                    onPress: () => saveSetting('payout_frequency', f),
                  })),
                ],
              )}
            >
              <View style={[st.rowIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="time-outline" size={16} color={COLORS.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.rowLabel}>Payout Frequency</Text>
                <Text style={st.rowSub}>How often clubs receive payouts</Text>
              </View>
              {saving === 'payout_frequency'
                ? <ActivityIndicator size="small" color={COLORS.green} />
                : <Text style={st.rateValue}>{settings.payout_frequency.charAt(0).toUpperCase() + settings.payout_frequency.slice(1)}</Text>
              }
              <Ionicons name="chevron-expand-outline" size={15} color={COLORS.mutedDark} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Payment Processing ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Payment Processing</Text>
          <View style={st.card}>
            <RateRow
              icon="logo-euro" iconBg="rgba(99,102,241,0.12)" iconColor="#818cf8"
              label="Stripe % Fee" sub="Percentage per transaction"
              display={`${settings.stripe_fee_percent}%`}
              isSaving={saving === 'stripe_fee_percent'}
              onPress={() => openEdit('stripe_fee_percent', 'Stripe % Fee', '%', "Stripe's percentage charge per transaction.")}
            />
            <View style={st.divider} />
            <RateRow
              icon="add-circle-outline" iconBg="rgba(99,102,241,0.12)" iconColor="#818cf8"
              label="Stripe Fixed Fee" sub="Flat fee per transaction"
              display={`€${settings.stripe_fee_fixed}`}
              isSaving={saving === 'stripe_fee_fixed'}
              onPress={() => openEdit('stripe_fee_fixed', 'Stripe Fixed Fee', '€', "Stripe's fixed charge added to each transaction.")}
            />
          </View>
          <Text style={st.sectionNote}>Processing fees are passed to the platform, not the club.</Text>
        </View>

        {/* ── Refunds & Cancellations ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Refunds & Cancellations</Text>
          <View style={st.card}>
            <RateRow
              icon="return-down-back-outline" iconBg="rgba(239,68,68,0.12)" iconColor={COLORS.red}
              label="Refund Window" sub="Hours after booking to allow refund"
              display={`${settings.refund_window_hours} hrs`}
              isSaving={saving === 'refund_window_hours'}
              onPress={() => openEdit('refund_window_hours', 'Refund Window', 'hrs', 'Users can request a full refund within this window after booking.')}
            />
            <View style={st.divider} />
            <RateRow
              icon="close-circle-outline" iconBg="rgba(239,68,68,0.12)" iconColor={COLORS.red}
              label="Late Cancel Fee" sub="Charged when cancelled outside window"
              display={`${settings.late_cancel_fee}%`}
              isSaving={saving === 'late_cancel_fee'}
              onPress={() => openEdit('late_cancel_fee', 'Late Cancel Fee', '%', 'Percentage of booking value retained when a user cancels late.')}
            />
          </View>
          <Text style={st.sectionNote}>Cancellations outside the refund window incur the late cancel fee.</Text>
        </View>

        {/* ── Account ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Account</Text>
          <View style={st.card}>
            <TouchableOpacity
              style={st.row} activeOpacity={0.7}
              onPress={() => Alert.alert('Change Password', 'A password reset email will be sent to your admin email.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send Email', onPress: async () => {
                  const { data } = await supabase.auth.getUser()
                  if (data.user?.email) {
                    await supabase.auth.resetPasswordForEmail(data.user.email)
                    Alert.alert('Email sent', 'Check your inbox for the reset link.')
                  }
                }},
              ])}
            >
              <View style={[st.rowIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#818cf8" />
              </View>
              <Text style={[st.rowLabel, { flex: 1 }]}>Change Password</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View style={st.section}>
          <Text style={[st.sectionTitle, { color: COLORS.red }]}>Danger Zone</Text>
          <View style={st.card}>
            <TouchableOpacity
              style={st.dangerRow} activeOpacity={0.7}
              onPress={() => Alert.alert('Clear Platform Cache', 'Force a fresh reload for all users. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear Cache', style: 'destructive', onPress: () => Alert.alert('Done', 'Cache cleared successfully.') },
              ])}
            >
              <View style={[st.rowIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.dangerText}>Clear Platform Cache</Text>
                <Text style={st.rowSub}>Force fresh reload for all users</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
            <View style={st.divider} />
            <TouchableOpacity
              style={st.dangerRow} activeOpacity={0.7}
              onPress={() => Alert.alert('Export Platform Data', 'Share a full summary of platform stats and settings.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Export', onPress: handleExport },
              ])}
            >
              <View style={[st.rowIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Ionicons name="download-outline" size={18} color={COLORS.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.dangerText, { color: COLORS.green }]}>Export Platform Data</Text>
                <Text style={st.rowSub}>Share stats and settings as text</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {editModal && (
        <EditModal
          visible
          label={editModal.label}
          value={settings[editModal.key] as string}
          unit={editModal.unit}
          hint={editModal.hint}
          onClose={() => setEditModal(null)}
          onSave={v => saveSetting(editModal.key, v)}
        />
      )}
    </View>
  )
}

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  box: {
    width: '100%', backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  title: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  hint: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginBottom: SPACING.md },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgInput, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.lg, height: 56,
  },
  unit: { color: COLORS.purple, fontSize: FONT.lg, fontWeight: '700', marginHorizontal: 4 },
  input: { flex: 1, color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText: { color: COLORS.muted, fontWeight: '600', fontSize: FONT.base },
  saveBtn: { flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.purpleDark, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
})

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700', marginBottom: SPACING.sm },
  sectionNote: { color: COLORS.mutedDark, fontSize: 12, marginTop: SPACING.xs, paddingHorizontal: 4 },

  card: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  rowIcon: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  rowSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  rateValue: { color: COLORS.purple, fontSize: FONT.base, fontWeight: '700' },

  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  dangerText: { color: COLORS.red, fontSize: FONT.base, fontWeight: '600' },
})
