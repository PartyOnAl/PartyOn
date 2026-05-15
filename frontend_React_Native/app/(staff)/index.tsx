import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'

const ROLE_LABEL: Record<string, string> = { host: 'Hostess', staff: 'Bodyguard' }
const ROLE_ICON:  Record<string, string> = { host: 'person-outline', staff: 'shield-outline' }
const ROLE_COLOR: Record<string, string> = { host: COLORS.purple, staff: COLORS.cta }

export default function StaffHome() {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const role      = profile?.role ?? 'staff'
  const roleLabel = ROLE_LABEL[role] ?? role
  const roleIcon  = ROLE_ICON[role]  ?? 'person-outline'
  const roleColor = ROLE_COLOR[role] ?? COLORS.purple
  const fullName  = [profile?.name, profile?.surname].filter(Boolean).join(' ') || profile?.email || '—'
  const initials  = ((profile?.name?.[0] ?? '') + (profile?.surname?.[0] ?? '')).toUpperCase() || '?'

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/welcome') },
      },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.appName}>PartyOn</Text>
          <Text style={s.portalLabel}>Staff Portal</Text>
        </View>

        {/* Avatar + name card */}
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: roleColor + '33' }]}>
            <Text style={[s.avatarText, { color: roleColor }]}>{initials}</Text>
          </View>
          <Text style={s.name}>{fullName}</Text>
          <View style={[s.roleBadge, { backgroundColor: roleColor + '22' }]}>
            <Ionicons name={roleIcon as any} size={14} color={roleColor} />
            <Text style={[s.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </View>

        {/* Info box */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.cta} />
          <Text style={s.infoText}>
            You are logged in as <Text style={{ color: COLORS.white, fontWeight: '700' }}>{roleLabel}</Text>.
            Your manager will assign tasks and access through the PartyOn platform.
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xl },

  header:      { marginBottom: SPACING.xl * 2 },
  appName:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '800' },
  portalLabel: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  profileCard: { alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl },
  avatar:      { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 34, fontWeight: '800' },
  name:        { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700' },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2 },
  roleText:    { fontSize: FONT.base, fontWeight: '700' },

  infoCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  infoText:  { color: COLORS.muted, fontSize: FONT.sm, flex: 1, lineHeight: 20 },

  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.red + '15', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.red + '40' },
  signOutText: { color: COLORS.red, fontSize: FONT.base, fontWeight: '700' },
})
