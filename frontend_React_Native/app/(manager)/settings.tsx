import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { MANAGER_MORE, replaceManagerRoute } from '@/lib/managerNavigation'

type SettingRow = {
  label: string
  sublabel: string
  icon: string
  onPress?: () => void
  toggle?: boolean
}

export default function SettingsScreen() {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  // Notification toggles
  const [notifEnabled, setNotifEnabled]       = useState(true)
  const [newReservations, setNewReservations] = useState(true)
  const [staffRequests, setStaffRequests]     = useState(true)
  const [eventReminders, setEventReminders]   = useState(false)

  // Change password state
  const [showPwSection, setShowPwSection] = useState(false)
  const [currentPw, setCurrentPw]         = useState('')
  const [newPw, setNewPw]                 = useState('')
  const [confirmPw, setConfirmPw]         = useState('')
  const [pwLoading, setPwLoading]         = useState(false)

  async function handleChangePassword() {
    if (!newPw || !confirmPw) { Alert.alert('Error', 'Please fill all fields.'); return }
    if (newPw !== confirmPw)  { Alert.alert('Error', 'New passwords do not match.'); return }
    if (newPw.length < 6)     { Alert.alert('Error', 'Password must be at least 6 characters.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Success', 'Password updated successfully.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setShowPwSection(false)
    }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/welcome') } },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_MORE)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Settings</Text>
        <Text style={s.pageSubtitle}>Manage your club preferences and account</Text>

        {/* Notifications */}
        <SectionCard icon="notifications-outline" title="Notifications" subtitle="Manage notification preferences">
          <ToggleRow label="Notifications"   value={notifEnabled}    onChange={setNotifEnabled} />
          <View style={s.rowDivider} />
          <ToggleRow label="New Reservations" sublabel="Get notified of new bookings" value={newReservations} onChange={setNewReservations} />
          <View style={s.rowDivider} />
          <ToggleRow label="Staff Requests"   sublabel="Approve requests from staff"  value={staffRequests}  onChange={setStaffRequests} />
          <View style={s.rowDivider} />
          <ToggleRow label="Event Reminders"  sublabel="Upcoming event notifications"  value={eventReminders} onChange={setEventReminders} />
        </SectionCard>

        {/* Security */}
        <SectionCard icon="lock-closed-outline" title="Security" subtitle="Password and authentication">
          <TouchableOpacity style={s.linkRow} onPress={() => setShowPwSection(v => !v)} activeOpacity={0.7}>
            <Text style={s.linkRowText}>Change Password</Text>
            <Ionicons name={showPwSection ? 'chevron-up' : 'chevron-forward'} size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>

          {showPwSection && (
            <View style={s.pwForm}>
              <PwInput placeholder="Current password" value={currentPw} onChange={setCurrentPw} />
              <PwInput placeholder="New password"     value={newPw}     onChange={setNewPw} />
              <PwInput placeholder="Confirm new password" value={confirmPw} onChange={setConfirmPw} />
              <TouchableOpacity style={s.pwSaveBtn} onPress={handleChangePassword} disabled={pwLoading}>
                {pwLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.pwSaveBtnText}>Update Password</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <View style={s.rowDivider} />
          <TouchableOpacity style={s.linkRow} activeOpacity={0.7}>
            <Text style={s.linkRowText}>Two-Factor Authentication</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </SectionCard>

        {/* Venue Settings */}
        <SectionCard icon="business-outline" title="Venue Settings" subtitle="Edit club profile & branding">
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(manager)/club-profile')} activeOpacity={0.7}>
            <Text style={s.linkRowText}>Club Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </SectionCard>

        {/* Team Access */}
        <SectionCard icon="people-outline" title="Team Access" subtitle="Manage team members and permissions">
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(manager)/staff')} activeOpacity={0.7}>
            <Text style={s.linkRowText}>Manage Team Members</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </SectionCard>

        {/* Billing */}
        <SectionCard icon="card-outline" title="Billing" subtitle="Manage subscription and payments">
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(manager)/billing-history')} activeOpacity={0.7}>
            <Text style={s.linkRowText}>View Billing History</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
          <View style={s.rowDivider} />
          <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(manager)/payment-methods')} activeOpacity={0.7}>
            <Text style={s.linkRowText}>Update Payment Method</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </SectionCard>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <View style={sc.wrap}>
      <View style={sc.header}>
        <View style={sc.iconWrap}>
          <Ionicons name={icon as any} size={18} color={COLORS.muted} />
        </View>
        <View>
          <Text style={sc.title}>{title}</Text>
          <Text style={sc.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={sc.body}>{children}</View>
    </View>
  )
}

const sc = StyleSheet.create({
  wrap: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconWrap: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  title: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  subtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  body: {},
})

function ToggleRow({ label, sublabel, value, onChange }: { label: string; sublabel?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={tr.row}>
      <View style={{ flex: 1 }}>
        <Text style={tr.label}>{label}</Text>
        {sublabel ? <Text style={tr.sublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: COLORS.border, true: COLORS.purpleDark }}
        thumbColor={value ? COLORS.purple : COLORS.muted}
      />
    </View>
  )
}

const tr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4 },
  label: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '500' },
  sublabel: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
})

function PwInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <View style={pi.wrap}>
      <TextInput
        style={pi.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.mutedDark}
        secureTextEntry={!show}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={() => setShow(v => !v)} style={pi.eye}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={16} color={COLORS.mutedDark} />
      </TouchableOpacity>
    </View>
  )
}

const pi = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm, height: 46 },
  input: { flex: 1, color: COLORS.white, fontSize: FONT.sm },
  eye: { padding: 4 },
})

// ── Screen-level styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '900' },
  sub: { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  pageTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  rowDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  linkRowText: { color: COLORS.white, fontSize: FONT.sm + 1, fontWeight: '500' },

  pwForm: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  pwSaveBtn: { backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm + 4, alignItems: 'center', marginTop: 4 },
  pwSaveBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.red + '15', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.red + '40', marginTop: SPACING.sm },
  logoutText: { color: COLORS.red, fontSize: FONT.base, fontWeight: '700' },
})
