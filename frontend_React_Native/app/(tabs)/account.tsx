import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Profile } from '@/lib/types'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

// ── Types ─────────────────────────────────────────────────────────────────────
type RowItem = {
  icon: keyof typeof Ionicons.glyphMap
  iconBg?: string
  label: string
  subtitle?: string
  onPress: () => void
  danger?: boolean
  badge?: number
}

type Section = {
  title: string
  items: RowItem[]
}

// ── Row component ─────────────────────────────────────────────────────────────
function SettingsRow({ item, isLast }: { item: RowItem; isLast: boolean }) {
  return (
    <TouchableOpacity
      style={[row.container, !isLast && row.border]}
      onPress={item.onPress}
      activeOpacity={0.65}
    >
      {/* Icon square */}
      <View style={[row.iconWrap, item.iconBg ? { backgroundColor: item.iconBg } : null]}>
        <Ionicons
          name={item.icon}
          size={18}
          color={item.danger ? COLORS.red : COLORS.white}
        />
      </View>

      {/* Label + optional subtitle */}
      <View style={row.textWrap}>
        <Text style={[row.label, item.danger && row.labelDanger]}>{item.label}</Text>
        {item.subtitle ? <Text style={row.subtitle}>{item.subtitle}</Text> : null}
      </View>

      {/* Badge */}
      {item.badge != null && item.badge > 0 && (
        <View style={row.badge}>
          <Text style={row.badgeText}>{item.badge}</Text>
        </View>
      )}

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
    </TouchableOpacity>
  )
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm + 2,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: '#1c1c1e',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  label: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  labelDanger: { color: COLORS.red },
  subtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 1 },
  badge: {
    backgroundColor: COLORS.cta, borderRadius: RADIUS.pill,
    minWidth: 20, height: 20, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: COLORS.ctaText, fontSize: 11, fontWeight: '800' },
})

// ── Section group ─────────────────────────────────────────────────────────────
function SettingsGroup({ section }: { section: Section }) {
  return (
    <View style={group.wrapper}>
      <Text style={group.title}>{section.title}</Text>
      <View style={group.card}>
        {section.items.map((item, i) => (
          <SettingsRow key={item.label} item={item} isLast={i === section.items.length - 1} />
        ))}
      </View>
    </View>
  )
}

const group = StyleSheet.create({
  wrapper: { marginBottom: SPACING.sm },
  title: {
    color: COLORS.mutedDark,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  card: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
})

// ── Main screen ───────────────────────────────────────────────────────────────
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
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/(auth)/login') },
      },
    ])
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            // TODO: implement account deletion via backend
            Alert.alert('Coming soon', 'Account deletion will be available in a future update.')
          },
        },
      ],
    )
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <View style={[s.container, { paddingTop: insets.top }, s.center]}>
        <Ionicons name="person-circle-outline" size={64} color={COLORS.mutedDark} />
        <Text style={s.notLoggedInTitle}>Not logged in</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={s.loginBtnText}>Log in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const displayName = [profile?.name, profile?.surname].filter(Boolean).join(' ') || user.email || 'User'
  const location = profile?.club_id ? 'Set location' : 'Tirana, Albania'

  const sections: Section[] = [
    {
      title: 'ACCOUNT',
      items: [
        {
          icon: 'location-outline',
          label: 'Location',
          subtitle: location,
          onPress: () => router.push('/clubs-map'),
        },
        {
          icon: 'person-outline',
          label: 'My details',
          onPress: () => router.push('/(tabs)/profile'),
        },
        {
          icon: 'lock-closed-outline',
          label: 'Privacy',
          onPress: () => {},
        },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          onPress: () => {},
        },
        {
          icon: 'card-outline',
          label: 'Payment methods',
          onPress: () => router.push('/payment-method'),
        },
      ],
    },
    {
      title: 'MY ACTIVITY',
      items: [
        {
          icon: 'ticket-outline',
          label: 'My Tickets',
          onPress: () => router.push('/(tabs)/bookings'),
        },
        {
          icon: 'bookmark-outline',
          label: 'Saved Promotions',
          onPress: () => router.push({ pathname: '/promotions', params: { filter: 'saved' } }),
          badge: savedCount,
        },
        {
          icon: 'search-outline',
          label: 'Browse Events',
          onPress: () => router.push('/all-events'),
        },
      ],
    },
    {
      title: 'APP',
      items: [
        {
          icon: 'share-social-outline',
          label: 'Share the app',
          onPress: () =>
            Share.share({ message: 'Check out PartyOn – the best way to discover events near you!' }),
        },
        {
          icon: 'star-outline',
          label: 'Rate the app',
          onPress: () => {},
        },
        {
          icon: 'chatbubble-outline',
          label: 'Give feedback',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'LEGAL',
      items: [
        {
          icon: 'document-text-outline',
          label: 'Terms and conditions',
          onPress: () => {},
        },
        {
          icon: 'help-circle-outline',
          label: 'Support',
          onPress: () => {},
        },
      ],
    },
  ]

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* User info strip */}
        <View style={s.userStrip}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.displayName}>{displayName}</Text>
            <Text style={s.email}>{user.email}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
            <Ionicons name="pencil-outline" size={18} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.md }} />

        {/* Sections */}
        {sections.map((sec) => (
          <SettingsGroup key={sec.title} section={sec} />
        ))}

        <View style={{ height: SPACING.sm }} />

        {/* Log out — standalone card */}
        <View style={s.standaloneCard}>
          <SettingsRow
            item={{
              icon: 'log-out-outline',
              iconBg: '#1c1c1e',
              label: 'Log out',
              onPress: handleSignOut,
            }}
            isLast
          />
        </View>

        <View style={{ height: SPACING.sm }} />

        {/* Delete account — standalone card, danger */}
        <View style={s.standaloneCard}>
          <SettingsRow
            item={{
              icon: 'trash-outline',
              iconBg: 'rgba(239,68,68,0.15)',
              label: 'Delete account',
              danger: true,
              onPress: handleDeleteAccount,
            }}
            isLast
          />
        </View>

        <Text style={s.version}>PartyOn v1.0</Text>
      </ScrollView>
    </View>
  )
}

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.white },

  userStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.purpleDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: FONT.lg, fontWeight: '800' },
  displayName: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  email: { color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 2 },

  standaloneCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },

  notLoggedInTitle: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  loginBtn: {
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },

  version: {
    color: COLORS.mutedDark, fontSize: FONT.sm,
    textAlign: 'center', marginTop: SPACING.lg,
  },
})
