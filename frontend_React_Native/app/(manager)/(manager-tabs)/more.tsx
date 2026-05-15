import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { usePlatformSettings } from '@/lib/platformSettings'
import { supabase } from '@/lib/supabase'

const menuItems = [
  { label: 'Promotions',    icon: 'pricetag-outline',   route: '/(manager)/promotions' },
  { label: 'Analytics',     icon: 'bar-chart-outline',  route: '/(manager)/analytics' },
  { label: 'Add Staff',      icon: 'people-outline',     route: '/(manager)/staff'    },
  { label: 'Disputes',      icon: 'warning-outline',    route: '/(manager)/disputes' },
  { label: 'Settings',      icon: 'settings-outline',   route: '/(manager)/settings' },
] satisfies { label: string; icon: string; route: string | null }[]

type SubInfo = {
  subscription_type: string
  subscription_due_date: string | null
  club_name: string | null
  club_address: string | null
  club_email_id: string | null
  club_phone_number: string | null
  avatar_url?: string | null
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
}

function formatDate(d: string | null) {
  if (!d) return '–'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MoreScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { settings } = usePlatformSettings()

  const [sub, setSub] = useState<SubInfo | null>(null)
  const [renewing, setRenewing] = useState(false)

  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null)
  const [freshName, setFreshName]     = useState<string>('')
  const [freshEmail, setFreshEmail]   = useState<string>('')
  const [freshPhone, setFreshPhone]   = useState<string>('')

  const fetchSub = useCallback(async () => {
    if (!profile?.club_id || !profile?.id) return
    const [clubRes, profileRes] = await Promise.all([
      supabase
        .from('clubs')
        .select('subscription_type, subscription_due_date, club_name, club_address, club_email_id, club_phone_number')
        .eq('club_id', profile.club_id)
        .single(),
      supabase
        .from('profiles')
        .select('name, surname, email, phone_number')
        .eq('id', profile.id)
        .single(),
    ])
    if (clubRes.data) setSub(clubRes.data as SubInfo)
    if (profileRes.data) {
      const p = profileRes.data as any
      setFreshName([p.name, p.surname].filter(Boolean).join(' ') || '')
      setFreshEmail(p.email ?? '')
      setFreshPhone(p.phone_number ?? '')
    }
    // avatar_url fetched separately — column may not exist yet
    const { data: av } = await supabase
      .from('profiles').select('avatar_url').eq('id', profile.id).single()
    if (av) setAvatarUrl((av as any).avatar_url ?? null)
  }, [profile?.club_id, profile?.id])

  useFocusEffect(useCallback(() => { fetchSub() }, [fetchSub]))

  async function handleRenew() {
    if (!profile?.club_id || !sub) return
    const feeLabel = sub.subscription_type === 'annual'
      ? `€${settings.annual_club_fee.toFixed(0)}/year`
      : `€${settings.monthly_club_fee.toFixed(0)}/month`

    Alert.alert(
      'Renew Subscription',
      `Renew your ${sub.subscription_type} plan for ${feeLabel}? This will extend your subscription by 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: async () => {
            setRenewing(true)
            const current = sub.subscription_due_date ? new Date(sub.subscription_due_date) : new Date()
            const base = current < new Date() ? new Date() : current
            base.setDate(base.getDate() + 30)

            const { error } = await supabase
              .from('clubs')
              .update({ subscription_due_date: base.toISOString() })
              .eq('club_id', profile.club_id!)

            setRenewing(false)
            if (error) {
              Alert.alert('Error', 'Could not renew subscription. Please try again.')
            } else {
              await fetchSub()
              Alert.alert('Renewed', 'Your subscription has been extended by 30 days.')
            }
          },
        },
      ],
    )
  }

  const days = getDaysUntilDue(sub?.subscription_due_date ?? null)
  const isOverdue = days !== null && days <= 0
  const isDueSoon = days !== null && days > 0 && days <= 14

  const subStatusColor = isOverdue ? COLORS.red
    : isDueSoon ? (days <= 7 ? '#f97316' : '#eab308')
    : COLORS.green

  const subStatusLabel = isOverdue ? 'Overdue'
    : isDueSoon ? `Due in ${days} day${days !== 1 ? 's' : ''}`
    : days !== null ? 'Active'
    : 'Active'

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.appName}>PartyOn</Text>
          <Text style={s.managerLabel}>Manager Portal</Text>
        </View>

        <Text style={s.pageTitle}>Account & Settings</Text>
        <Text style={s.pageSubtitle}>Manage your club subscription and options</Text>

        {/* Subscription card */}
        <View style={s.subCard}>
          <View style={s.subCardTop}>
            <View style={s.iconWrap}>
              <Ionicons name="card-outline" size={18} color={COLORS.muted} />
            </View>
            <View style={[s.statusPill, { backgroundColor: subStatusColor + '22' }]}>
              <View style={[s.statusDot, { backgroundColor: subStatusColor }]} />
              <Text style={[s.statusPillText, { color: subStatusColor }]}>{subStatusLabel}</Text>
            </View>
          </View>

          <Text style={s.subPlanName}>
            {sub ? `${sub.subscription_type.charAt(0).toUpperCase() + sub.subscription_type.slice(1)} Plan` : '–'}
          </Text>
          <Text style={s.subPlanLabel}>Club Subscription</Text>

          <View style={s.subDivider} />

          <View style={s.subRow}>
            <Text style={s.subRowLabel}>Due date</Text>
            <Text style={s.subRowValue}>{formatDate(sub?.subscription_due_date ?? null)}</Text>
          </View>
          <View style={s.subRow}>
            <Text style={s.subRowLabel}>
              {sub?.subscription_type === 'annual' ? 'Annual fee' : 'Monthly fee'}
            </Text>
            <Text style={s.subRowValue}>
              €{(sub?.subscription_type === 'annual'
                ? settings.annual_club_fee
                : settings.monthly_club_fee
              ).toFixed(0)}
            </Text>
          </View>

          {(isOverdue || isDueSoon) && (
            <TouchableOpacity
              style={[s.renewBtn, { backgroundColor: subStatusColor }]}
              onPress={handleRenew}
              disabled={renewing}
              activeOpacity={0.85}
            >
              {renewing
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color="#fff" />
                    <Text style={s.renewBtnText}>Renew Now</Text>
                  </>
                )
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Manager account / profile card */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <TouchableOpacity
          style={s.profileCard}
          onPress={() => router.push('/(manager)/manager-profile')}
          activeOpacity={0.75}
        >
          <View style={s.profileAvatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.profileAvatar} />
            ) : (
              <View style={s.profileAvatarFallback}>
                <Text style={s.profileAvatarText}>
                  {(freshName || profile?.name || freshEmail || 'M')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{freshName || 'Manager'}</Text>
            <Text style={s.profileEmail} numberOfLines={1}>{freshEmail || profile?.email || '–'}</Text>
            <View style={s.rolePill}>
              <Ionicons name="shield-checkmark-outline" size={10} color={COLORS.purple} />
              <Text style={s.rolePillText}>Club Manager</Text>
            </View>
          </View>
          <View style={s.profileEditHint}>
            <Ionicons name="pencil-outline" size={13} color={COLORS.purple} />
            <Text style={s.profileEditHintText}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* Club info */}
        {sub && (
          <>
            <Text style={s.sectionLabel}>CLUB</Text>
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <View style={s.infoIconWrap}>
                  <Ionicons name="business-outline" size={15} color={COLORS.mutedDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>Club name</Text>
                  <Text style={s.infoValue}>{sub.club_name ?? '–'}</Text>
                </View>
              </View>
              {sub.club_address ? (
                <>
                  <View style={s.divider} />
                  <View style={s.infoRow}>
                    <View style={s.infoIconWrap}>
                      <Ionicons name="location-outline" size={15} color={COLORS.mutedDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>Address</Text>
                      <Text style={s.infoValue}>{sub.club_address}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              {sub.club_email_id ? (
                <>
                  <View style={s.divider} />
                  <View style={s.infoRow}>
                    <View style={s.infoIconWrap}>
                      <Ionicons name="mail-outline" size={15} color={COLORS.mutedDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>Club email</Text>
                      <Text style={s.infoValue}>{sub.club_email_id}</Text>
                    </View>
                  </View>
                </>
              ) : null}
              {sub.club_phone_number ? (
                <>
                  <View style={s.divider} />
                  <View style={s.infoRow}>
                    <View style={s.infoIconWrap}>
                      <Ionicons name="call-outline" size={15} color={COLORS.mutedDark} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.infoLabel}>Club phone</Text>
                      <Text style={s.infoValue}>{sub.club_phone_number}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </>
        )}

        {/* Billing / payment method */}
        <Text style={s.sectionLabel}>BILLING</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="card-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Payment method</Text>
              <Text style={s.infoValue}>Managed by PartyOn</Text>
              <Text style={s.infoSub}>Contact support to update card details</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="person-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Account holder</Text>
              <Text style={s.infoValue}>{freshName || '–'}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="mail-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Billing email</Text>
              <Text style={s.infoValue}>{freshEmail || profile?.email || '–'}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="repeat-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Billing cycle</Text>
              <Text style={s.infoValue}>
                {sub?.subscription_type === 'annual' ? 'Annual' : 'Monthly'}
                {' · '}€{(sub?.subscription_type === 'annual'
                  ? settings.annual_club_fee
                  : settings.monthly_club_fee
                ).toFixed(0)} / {sub?.subscription_type === 'annual' ? 'year' : 'month'}
              </Text>
            </View>
          </View>
        </View>

        {/* Support */}
        <Text style={s.sectionLabel}>SUPPORT</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="headset-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>PartyOn support</Text>
              <Text style={s.infoValue}>support@partyon.com</Text>
              <Text style={s.infoSub}>For billing, account or technical issues</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <View style={s.infoIconWrap}>
              <Ionicons name="document-text-outline" size={15} color={COLORS.mutedDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Club ID</Text>
              <Text style={[s.infoValue, { fontFamily: 'monospace', fontSize: 12 }]}>
                {profile?.club_id ?? '–'}
              </Text>
              <Text style={s.infoSub}>Reference this when contacting support</Text>
            </View>
          </View>
        </View>

        {/* More Options */}
        <Text style={s.sectionLabel}>MORE OPTIONS</Text>
        <View style={s.menuCard}>
          {menuItems.map((item, i) => (
            <View key={item.label}>
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => item.route && router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={s.menuLeft}>
                  <Ionicons name={item.icon as any} size={18} color={COLORS.muted} />
                  <Text style={s.menuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
              </TouchableOpacity>
              {i < menuItems.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  header: { marginTop: SPACING.md, marginBottom: SPACING.md },
  appName: { color: COLORS.white, fontSize: FONT.md, fontWeight: '900', letterSpacing: -0.5 },
  managerLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '600', marginTop: 1 },
  pageTitle: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.md },

  subCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  subCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  iconWrap: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard2, alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  subPlanName: { color: COLORS.white, fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subPlanLabel: { color: COLORS.mutedDark, fontSize: FONT.sm },

  subDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  subRowLabel: { color: COLORS.mutedDark, fontSize: FONT.base },
  subRowValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '600' },

  renewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4, marginTop: SPACING.md,
  },
  renewBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },

  sectionLabel: { color: COLORS.mutedDark, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: SPACING.sm, marginTop: SPACING.sm },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  profileAvatarWrap: { flexShrink: 0 },
  profileAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: COLORS.purple },
  profileAvatarFallback: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: COLORS.purpleDark, borderWidth: 2, borderColor: COLORS.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  profileName:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: 2 },
  profileEmail: { color: COLORS.mutedDark, fontSize: 12, marginBottom: 5 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.purpleDark + '44',
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  rolePillText: { color: COLORS.purple, fontSize: 10, fontWeight: '600' },
  profileEditHint: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.purpleDark + '22',
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  profileEditHintText: { color: COLORS.purple, fontSize: 12, fontWeight: '600' },

  infoCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  infoIconWrap: {
    width: 30, height: 30, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgCard2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  infoLabel: { color: COLORS.mutedDark, fontSize: 11, marginBottom: 3 },
  infoValue: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  infoSub:   { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },
  menuCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  menuRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md + 2 },
  menuLeft:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  menuLabel: { color: COLORS.white, fontSize: FONT.base, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border },
})
