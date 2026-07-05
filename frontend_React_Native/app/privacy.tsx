import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

const STORAGE_KEY = 'partyon:privacy-prefs:v1'

type PrivacyPrefs = {
  profileVisible: boolean
  shareLocation: boolean
  shareAnalytics: boolean
  personalizedAds: boolean
  marketingEmails: boolean
}

const DEFAULTS: PrivacyPrefs = {
  profileVisible: true,
  shareLocation: true,
  shareAnalytics: true,
  personalizedAds: false,
  marketingEmails: false,
}

type ToggleRow = {
  key: keyof PrivacyPrefs
  icon: keyof typeof Ionicons.glyphMap
  label: string
  subtitle: string
}

export default function PrivacyScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY
        const raw = await AsyncStorage.getItem(key)
        if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) })
      } catch {
        // ignore – fall back to defaults
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  async function update<K extends keyof PrivacyPrefs>(k: K, v: PrivacyPrefs[K]) {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    try {
      const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY
      await AsyncStorage.setItem(key, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function confirmClearActivity() {
    Alert.alert(
      'Clear activity data?',
      'This removes your locally cached searches and view history. Your account data is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys()
              const toRemove = keys.filter(k =>
                k.startsWith('partyon:recent') ||
                k.startsWith('partyon:history') ||
                k.startsWith('partyon:search'),
              )
              if (toRemove.length) await AsyncStorage.multiRemove(toRemove)
              Alert.alert('Done', 'Local activity data cleared.')
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not clear data.')
            }
          },
        },
      ],
    )
  }

  const account: ToggleRow[] = [
    {
      key: 'profileVisible',
      icon: 'eye-outline',
      label: 'Public profile',
      subtitle: 'Allow others to see your display name and avatar',
    },
    {
      key: 'shareLocation',
      icon: 'location-outline',
      label: 'Share location',
      subtitle: 'Use your location to recommend nearby clubs and events',
    },
  ]

  const data: ToggleRow[] = [
    {
      key: 'shareAnalytics',
      icon: 'analytics-outline',
      label: 'Usage analytics',
      subtitle: 'Help improve PartyOn with anonymous usage data',
    },
    {
      key: 'personalizedAds',
      icon: 'pricetag-outline',
      label: 'Personalized promotions',
      subtitle: 'Show promotions tailored to your activity',
    },
    {
      key: 'marketingEmails',
      icon: 'mail-outline',
      label: 'Marketing emails',
      subtitle: 'Receive occasional newsletters and offers by email',
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
        <Text style={s.headerTitle}>Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View style={s.intro}>
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.purple} />
          <Text style={s.introText}>
            Control how your information is used. Changes save automatically.
          </Text>
        </View>

        <Group title="ACCOUNT">
          {account.map((r, i) => (
            <Row
              key={r.key}
              row={r}
              value={prefs[r.key]}
              onChange={v => update(r.key, v)}
              isLast={i === account.length - 1}
            />
          ))}
        </Group>

        <Group title="DATA & ADS">
          {data.map((r, i) => (
            <Row
              key={r.key}
              row={r}
              value={prefs[r.key]}
              onChange={v => update(r.key, v)}
              isLast={i === data.length - 1}
            />
          ))}
        </Group>

        <Group title="YOUR DATA">
          <TouchableOpacity style={s.actionRow} onPress={confirmClearActivity} activeOpacity={0.65}>
            <View style={s.iconWrap}>
              <Ionicons name="trash-outline" size={18} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionLabel}>Clear local activity</Text>
              <Text style={s.actionSubtitle}>Remove cached searches and history on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
          </TouchableOpacity>
        </Group>

        <Text style={s.footnote}>
          PartyOn never sells your personal data. Account deletion is available from the Settings screen.
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
  row, value, onChange, isLast,
}: {
  row: ToggleRow
  value: boolean
  onChange: (v: boolean) => void
  isLast: boolean
}) {
  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={s.iconWrap}>
        <Ionicons name={row.icon} size={18} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{row.label}</Text>
        <Text style={s.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#3a3a3c', true: COLORS.purpleDark }}
        thumbColor={value ? COLORS.purple : '#f4f3f4'}
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

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  actionLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  actionSubtitle: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },

  footnote: {
    color: COLORS.mutedDark,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    lineHeight: 17,
  },
})
