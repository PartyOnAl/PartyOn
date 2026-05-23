import { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, RefreshControl, Alert, TextInput, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import type { Profile } from '@/lib/types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrapper}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  )
}

const sec = StyleSheet.create({
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

function EditField({
  label, value, onChange, placeholder, keyboardType, isLast,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'phone-pad' | 'email-address'
  isLast?: boolean
}) {
  return (
    <View style={[ef.row, !isLast && ef.border]}>
      <Text style={ef.label}>{label}</Text>
      <TextInput
        style={ef.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={COLORS.mutedDark}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  )
}

const ef = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    fontWeight: '600',
    width: 90,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '500',
    textAlign: 'right',
  },
})

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[info.row, !isLast && info.border]}>
      <Text style={info.label}>{label}</Text>
      <Text style={info.value} numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
  )
}

const info = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    fontWeight: '600',
    width: 92,
    flexShrink: 0,
  },
  value: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    fontWeight: '500',
    textAlign: 'right',
  },
})

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const params = useLocalSearchParams<{ edit?: string }>()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(params.edit === '1')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ name: '', surname: '', username: '', phone_number: '', avatar_url: '' })

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (p) {
      setProfile(p as Profile)
      setForm({
        name: p.name ?? '',
        surname: p.surname ?? '',
        username: p.username ?? '',
        phone_number: (p as any).phone_number ?? '',
        avatar_url: (p as any).avatar_url ?? '',
      })
    }
    setLoading(false)
  }, [user?.id])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name.trim() || null,
        surname: form.surname.trim() || null,
        username: form.username.trim() || null,
        phone_number: form.phone_number.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setProfile(prev => prev ? { ...prev, ...form } : prev)
    setEditing(false)
  }

  function cancelEdit() {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        surname: profile.surname ?? '',
        username: (profile as any).username ?? '',
        phone_number: (profile as any).phone_number ?? '',
        avatar_url: profile.avatar_url ?? '',
      })
    }
    setEditing(false)
  }

  async function handlePickPhoto() {
    if (!user?.id) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg'
      const fileName = `user-${user.id}-${Date.now()}.${ext}`
      const response = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const url = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (updateError) throw updateError

      setForm(f => ({ ...f, avatar_url: url }))
      setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo.')
    } finally {
      setUploading(false)
    }
  }

  function handleDeleteAccount() {
    if (!user) return
    Alert.alert(
      'Delete account',
      'This will permanently delete your PartyOn account and profile data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const { error } = await supabase.rpc('delete_current_user_account')
            if (error) {
              setDeleting(false)
              Alert.alert('Could not delete account', error.message)
              return
            }
            await signOut()
            router.replace('/(auth)/welcome')
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }, s.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  const displayName = [form.name, form.surname].filter(Boolean).join(' ') || user?.email || 'User'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.push('/(tabs)/account')} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <TouchableOpacity
          style={s.editBtn}
          onPress={editing ? cancelEdit : () => setEditing(true)}
          hitSlop={8}
        >
          <Ionicons
            name={editing ? 'close-outline' : 'pencil-outline'}
            size={19}
            color={editing ? COLORS.mutedDark : COLORS.purple}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.purple} />}
      >
        <View style={s.heroBand}>
          <View style={s.avatarWrap}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={s.avatarImg} />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.cameraBtn}
              onPress={handlePickPhoto}
              disabled={uploading}
              activeOpacity={0.8}
            >
              {uploading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Ionicons name="camera" size={14} color={COLORS.white} />
              }
            </TouchableOpacity>
          </View>

          {editing ? (
            <Text style={s.editingHint}>Editing profile</Text>
          ) : (
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{displayName}</Text>
              {form.username ? <Text style={s.heroUsername}>@{form.username}</Text> : null}
              <Text style={s.heroEmail}>{user?.email}</Text>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.lg }} />

        {editing ? (
          <View style={{ marginBottom: SPACING.md }}>
            <Section title="EDIT PROFILE">
              <EditField label="First name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <EditField label="Last name" value={form.surname} onChange={v => setForm(f => ({ ...f, surname: v }))} />
              <EditField label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="@username" />
              <EditField
                label="Phone"
                value={form.phone_number}
                onChange={v => setForm(f => ({ ...f, phone_number: v }))}
                keyboardType="phone-pad"
                isLast
              />
            </Section>

            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <>
                    <Ionicons name="checkmark" size={17} color={COLORS.white} />
                    <Text style={s.saveBtnText}>Save changes</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <Section title="ACCOUNT INFO">
            <InfoRow label="First name" value={profile?.name ?? ''} />
            <InfoRow label="Last name" value={profile?.surname ?? ''} />
            <InfoRow label="Username" value={(profile as any)?.username ?? ''} />
            <InfoRow label="Phone" value={(profile as any)?.phone_number ?? ''} />
            <InfoRow label="Email" value={user?.email ?? profile?.email ?? ''} isLast />
          </Section>
        )}

        <View style={{ height: SPACING.sm }} />

        <Section title="ACCOUNT ACTIONS">
          <TouchableOpacity
            style={s.dangerRow}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.75}
          >
            <View style={s.dangerIcon}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.dangerTitle}>{deleting ? 'Deleting account...' : 'Delete account'}</Text>
              <Text style={s.dangerSub}>Permanently remove your account and profile data</Text>
            </View>
            {deleting
              ? <ActivityIndicator color={COLORS.red} size="small" />
              : <Ionicons name="chevron-forward" size={15} color={COLORS.mutedDark} />
            }
          </TouchableOpacity>
        </Section>
      </ScrollView>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: { flex: 1, fontSize: FONT.lg, fontWeight: '700', color: COLORS.white },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBand: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  avatarWrap: { position: 'relative', width: 84, height: 84 },
  avatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: COLORS.purple,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 3,
    borderColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 28, fontWeight: '800' },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.purpleDark,
    borderWidth: 2,
    borderColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: { alignItems: 'center', gap: 3 },
  heroName: { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  heroUsername: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  heroEmail: { color: COLORS.mutedDark, fontSize: FONT.sm },
  editingHint: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: 4 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    height: 50,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
  },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dangerTitle: { color: COLORS.red, fontSize: FONT.base, fontWeight: '600' },
  dangerSub: { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
})
