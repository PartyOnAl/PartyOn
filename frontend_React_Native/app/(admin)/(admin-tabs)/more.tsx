import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

type MenuSection = {
  title: string
  items: MenuItem[]
}

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap
  iconBg: string
  iconColor: string
  label: string
  sub?: string
  onPress: () => void
  badge?: string
}

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [pendingFeaturedCount, setPendingFeaturedCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      supabase
        .from('events')
        .select('event_id', { count: 'exact', head: true })
        .eq('featured_request_status', 'pending_review')
        .then(({ count }) => {
          if (active) setPendingFeaturedCount(count ?? 0)
        })
      return () => { active = false }
    }, []),
  )

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
        },
      },
    ])
  }

  const sections: MenuSection[] = [
    {
      title: 'Management',
      items: [
        {
          icon: 'gift-outline',
          iconBg: 'rgba(16,185,129,0.15)',
          iconColor: COLORS.green,
          label: 'Subscription Offers',
          sub: 'Create custom offers for club managers',
          onPress: () => router.push('/(admin)/subscription-offers'),
        },
        {
          icon: 'star-outline',
          iconBg: 'rgba(245,166,35,0.15)',
          iconColor: COLORS.cta,
          label: 'Featured Events',
          sub: pendingFeaturedCount > 0
            ? `${pendingFeaturedCount} request${pendingFeaturedCount !== 1 ? 's' : ''} waiting for approval`
            : 'Manage featured events and promotions',
          onPress: () => router.push('/(admin)/featured-events'),
          badge: pendingFeaturedCount > 0 ? String(pendingFeaturedCount) : undefined,
        },
        {
          icon: 'bar-chart-outline',
          iconBg: 'rgba(167,139,250,0.15)',
          iconColor: COLORS.purple,
          label: 'Platform Analytics',
          sub: 'Detailed platform insights',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          icon: 'settings-outline',
          iconBg: 'rgba(156,163,175,0.15)',
          iconColor: COLORS.muted,
          label: 'Settings',
          sub: 'Platform configuration',
          onPress: () => router.push('/(admin)/settings'),
        },
        {
          icon: 'notifications-outline',
          iconBg: 'rgba(99,102,241,0.15)',
          iconColor: '#818cf8',
          label: 'Push Notifications',
          sub: 'Send platform-wide announcements',
          onPress: () => {},
        },
        {
          icon: 'shield-checkmark-outline',
          iconBg: 'rgba(16,185,129,0.15)',
          iconColor: COLORS.green,
          label: 'Moderation',
          sub: 'Content and dispute management',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'log-out-outline',
          iconBg: 'rgba(239,68,68,0.15)',
          iconColor: COLORS.red,
          label: 'Sign Out',
          onPress: handleSignOut,
        },
      ],
    },
  ]

  return (
    <View style={[m.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={m.header}>
        <View>
          <Text style={m.brand}>
            <Text style={{ color: COLORS.white }}>Party</Text>
            <Text style={{ color: COLORS.purple }}>On</Text>
          </Text>
          <Text style={m.headerSub}>Platform Admin</Text>
        </View>
        <View style={m.adminBadge}>
          <Ionicons name="shield-checkmark" size={14} color={COLORS.purple} />
          <Text style={m.adminBadgeText}>Admin</Text>
        </View>
      </View>

      <Text style={m.moreLabel}>MORE OPTIONS</Text>

      {sections.map(section => (
        <View key={section.title} style={m.section}>
          <Text style={m.sectionTitle}>{section.title}</Text>
          <View style={m.card}>
            {section.items.map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={m.divider} />}
                <TouchableOpacity style={m.menuRow} onPress={item.onPress} activeOpacity={0.7}>
                  <View style={[m.menuIcon, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={m.menuLabel}>{item.label}</Text>
                    {item.sub && <Text style={m.menuSub}>{item.sub}</Text>}
                  </View>
                  {item.badge && (
                    <View style={m.badge}>
                      <Text style={m.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={m.version}>PartyOn Admin v1.0</Text>
    </View>
  )
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.md,
  },
  brand: { fontSize: FONT.xl, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  adminBadgeText: { color: COLORS.purple, fontSize: 13, fontWeight: '700' },

  moreLabel: {
    color: COLORS.mutedDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },

  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionTitle: {
    color: COLORS.mutedDark,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },
  menuSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.pill,
    minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  version: {
    color: COLORS.mutedDark,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
})
