import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { getStaffHomeHref } from '@/lib/staffRoutes'

export default function StaffHome() {
  const router = useRouter()
  const { profile, loading, signOut } = useAuth()

  const home = getStaffHomeHref(profile?.role)

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (home !== '/(staff)') {
    return <Redirect href={home} />
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/welcome')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Staff portal</Text>
        <Text style={s.sub}>
          Your account does not have a host or door role assigned yet. Open a desk below or ask your manager to update your role.
        </Text>

        <TouchableOpacity
          style={s.primaryBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/guard/guard')}
        >
          <Ionicons name="shield-outline" size={20} color={COLORS.ctaText} />
          <Text style={s.primaryBtnText}>Guard console</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/hostess')}
        >
          <Ionicons name="person-outline" size={20} color={COLORS.purple} />
          <Text style={s.secondaryBtnText}>Hostess desk</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.xl },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: SPACING.sm },
  sub: { color: COLORS.muted, fontSize: FONT.sm, lineHeight: 20, marginBottom: SPACING.xl },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  primaryBtnText: { color: COLORS.ctaText, fontSize: FONT.base, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.purple, fontSize: FONT.base, fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.red + '15',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.red + '40',
  },
  signOutText: { color: COLORS.red, fontSize: FONT.base, fontWeight: '700' },
})
