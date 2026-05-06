import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Profile } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type MenuItem = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean; badge?: number }

export default function AccountScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data as Profile))
      supabase.from('saved_promotions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        .then(({ count }) => setSavedCount(count ?? 0))
    }, [user]),
  )

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login') },
      },
    ])
  }

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.center]}>
        <Ionicons name="person-circle-outline" size={64} color={COLORS.mutedDark} />
        <Text style={styles.notLoggedInTitle}>Not logged in</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.btnText}>Log in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const menuItems: MenuItem[] = [
    { icon: 'ticket-outline', label: 'My Tickets', onPress: () => router.push('/(tabs)/bookings') },
    { icon: 'bookmark-outline', label: 'Saved Promotions', onPress: () => router.push({ pathname: '/promotions', params: { filter: 'saved' } }), badge: savedCount },
    { icon: 'search-outline', label: 'Browse Events', onPress: () => router.push('/(tabs)/search') },
    { icon: 'location-outline', label: 'Top Clubs', onPress: () => router.push('/top-clubs') },
    { icon: 'pricetag-outline', label: 'Promotions', onPress: () => router.push('/promotions') },
    { icon: 'log-out-outline', label: 'Sign out', onPress: handleSignOut, danger: true },
  ]

  const displayName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || user.email || 'User'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar & name */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Menu */}
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={item.danger ? COLORS.red : COLORS.purple} />
              <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>{item.label}</Text>
              {item.badge != null && item.badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{item.badge}</Text>
                </View>
              )}
              {!item.danger && <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.version}>PartyOn v1.0</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  profileSection: { alignItems: 'center', padding: SPACING.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.purpleDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  avatarText: { color: '#fff', fontSize: FONT.xxl, fontWeight: '800' },
  displayName: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  email: { color: COLORS.muted, fontSize: FONT.sm, marginTop: 4 },
  menuCard: {
    marginHorizontal: SPACING.md, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLabel: { flex: 1, color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  menuLabelDanger: { color: COLORS.red },
  notLoggedInTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  btn: { backgroundColor: COLORS.purple, borderRadius: RADIUS.sm, paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.xl },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
  menuBadge: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.pill,
    minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 2,
  },
  menuBadgeText: { color: COLORS.ctaText, fontSize: 11, fontWeight: '800' },
  version: { color: COLORS.mutedDark, fontSize: FONT.sm, textAlign: 'center', marginTop: SPACING.xl },
})
