import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, ActivityIndicator, Linking, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const STORAGE_KEY = 'partyon:notification-prefs:v1'

type NotificationPrefs = {
  pushEnabled: boolean
  eventReminders: boolean
  bookingUpdates: boolean
  promoAlerts: boolean
  disputeUpdates: boolean
  newFollowers: boolean
  marketing: boolean
  emailDigest: boolean
}

const DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  eventReminders: true,
  bookingUpdates: true,
  promoAlerts: true,
  disputeUpdates: true,
  newFollowers: false,
  marketing: false,
  emailDigest: false,
}

type ToggleRow = {
  key: keyof NotificationPrefs
  icon: keyof typeof Ionicons.glyphMap
  label: string
  subtitle: string
  dependsOnPush?: boolean
}

export default function NotificationsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY
        const raw = await AsyncStorage.getItem(key)
        if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) })
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  async function update<K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    try {
      const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY
      await AsyncStorage.setItem(key, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function openSystemSettings() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Linking.openSettings().catch(() => { /* no-op */ })
    }
  }

  const push: ToggleRow[] = [
    {
      key: 'pushEnabled',
      icon: 'phone-portrait-outline',
      label: 'Push notifications',
      subtitle: 'Master switch for all push alerts from PartyOn',
    },
  ]

  const activity: ToggleRow[] = [
    {
      key: 'eventReminders',
      icon: 'calendar-outline',
      label: 'Event reminders',
      subtitle: 'Get reminded before events you saved or booked',
      dependsOnPush: true,
    },
    {
      key: 'bookingUpdates',
      icon: 'ticket-outline',
      label: 'Booking updates',
      subtitle: 'Confirmations, changes, and refund status',
      dependsOnPush: true,
    },
    {
      key: 'disputeUpdates',
      icon: 'shield-half-outline',
      label: 'Dispute updates',
      subtitle: 'Notifications when a manager responds to a dispute',
      dependsOnPush: true,
    },
    {
      key: 'promoAlerts',
      icon: 'pricetag-outline',
      label: 'Promotion alerts',
      subtitle: 'New deals from clubs you follow or claimed',
      dependsOnPush: true,
    },
    {
      key: 'newFollowers',
      icon: 'people-outline',
      label: 'New followers',
      subtitle: 'When someone starts following your profile',
      dependsOnPush: true,
    },
  ]

  const marketing: ToggleRow[] = [
    {
      key: 'marketing',
      icon: 'megaphone-outline',
      label: 'News & announcements',
      subtitle: 'Product updates and PartyOn news',
      dependsOnPush: true,
    },
    {
      key: 'emailDigest',
      icon: 'mail-outline',
      label: 'Weekly email digest',
      subtitle: 'Top events near you, delivered every Thursday',
    },
  ]

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }, s.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View style={s.intro}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.purple} />
          <Text style={s.introText}>
            Choose what you want to hear about. Changes save automatically.
          </Text>
        </View>

        <Group title="PUSH">
          {push.map((r, i) => (
            <Row
              key={r.key}
              row={r}
              value={prefs[r.key]}
              onChange={v => update(r.key, v)}
              isLast={i === push.length - 1}
              disabled={false}
            />
          ))}
        </Group>

        <Group title="ACTIVITY">
          {activity.map((r, i) => (
            <Row
              key={r.key}
              row={r}
              value={prefs[r.key]}
              onChange={v => update(r.key, v)}
              isLast={i === activity.length - 1}
              disabled={r.dependsOnPush ? !prefs.pushEnabled : false}
            />
          ))}
        </Group>

        <Group title="MARKETING">
          {marketing.map((r, i) => (
            <Row
              key={r.key}
              row={r}
              value={prefs[r.key]}
              onChange={v => update(r.key, v)}
              isLast={i === marketing.length - 1}
              disabled={r.dependsOnPush ? !prefs.pushEnabled : false}
            />
          ))}
        </Group>

        {(Platform.OS === 'ios' || Platform.OS === 'android') && (
          <TouchableOpacity style={s.systemBtn} onPress={openSystemSettings} activeOpacity={0.8}>
            <Ionicons name="settings-outline" size={17} color={COLORS.white} />
            <Text style={s.systemBtnText}>Open system notification settings</Text>
          </TouchableOpacity>
        )}

        <Text style={s.footnote}>
          {`PartyOn respects your operating system's Do Not Disturb settings.`}
        </Text>
      </ScrollView>
    </View>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.groupWrap}>
      <Text style={s.groupTitle}>{title}</Text>
      <View style={s.groupCard}>{children}</View>
    </View>
  )
}

function Row({
  row, value, onChange, isLast, disabled,
}: {
  row: ToggleRow
  value: boolean
  onChange: (v: boolean) => void
  isLast: boolean
  disabled: boolean
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder, disabled && { opacity: 0.45 }]}>
      <View style={s.iconWrap}>
        <Ionicons name={row.icon} size={18} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{row.label}</Text>
        <Text style={s.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Switch
        value={value && !disabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#3a3a3c', true: COLORS.purpleDark }}
        thumbColor={value && !disabled ? COLORS.purple : '#f4f3f4'}
        ios_backgroundColor="#3a3a3c"
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: COLORS.white, fontSize: FONT.lg, fontWeight: '700',
  },

  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  introText: { flex: 1, color: COLORS.muted, fontSize: FONT.sm, lineHeight: 18 },

  groupWrap: { marginBottom: SPACING.sm },
  groupTitle: {
    color: COLORS.mutedDark,
    fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
  },
  groupCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: '#1c1c1e',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  rowSubtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2, paddingRight: SPACING.sm },

  systemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    height: 50,
  },
  systemBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },

  footnote: {
    color: COLORS.mutedDark,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    lineHeight: 17,
  },
})
