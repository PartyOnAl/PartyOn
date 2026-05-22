import { useCallback, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, TextInput, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'
import { MANAGER_MORE, replaceManagerRoute } from '@/lib/managerNavigation'

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
    color: COLORS.mutedDark, fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
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
  label, value, onChange, placeholder, keyboardType, editable = true, isLast,
}: {
  label: string; value: string; onChange?: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'phone-pad' | 'email-address'
  editable?: boolean; isLast?: boolean
}) {
  return (
    <View style={[ef.row, !isLast && ef.border]}>
      <Text style={ef.label}>{label}</Text>
      <TextInput
        style={[ef.input, !editable && { color: COLORS.mutedDark }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={COLORS.mutedDark}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        autoCapitalize={keyboardType === 'phone-pad' || keyboardType === 'email-address' ? 'none' : 'words'}
        editable={editable}
      />
    </View>
  )
}
const ef = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: SPACING.md, gap: SPACING.sm,
  },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  label: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600', width: 90, flexShrink: 0 },
  input: { flex: 1, color: COLORS.white, fontSize: FONT.base, fontWeight: '500', textAlign: 'right' },
})

export default function ManagerProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, profile: authProfile } = useAuth()

  const [form, setForm] = useState({
    name: '', surname: '', username: '', phone_number: '', email: '', avatar_url: '',
  })
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)

  async function load() {
    if (!user) return
    // Select only columns guaranteed to exist; avatar_url fetched separately
    const { data, error } = await supabase
      .from('profiles')
      .select('name, surname, username, phone_number, email')
      .eq('id', user.id)
      .single()
    if (error) { console.warn('load profile error', error.message) }
    if (data) {
      setForm(f => ({
        ...f,
        name:         (data as any).name ?? '',
        surname:      (data as any).surname ?? '',
        username:     (data as any).username ?? '',
        phone_number: (data as any).phone_number ?? '',
        email:        (data as any).email ?? user.email ?? '',
      }))
    }
    // Try to load avatar_url separately so a missing column doesn't break profile load
    const { data: avatarData } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
    if (avatarData) setForm(f => ({ ...f, avatar_url: (avatarData as any).avatar_url ?? '' }))
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { setLoading(true); load() }, [user]))

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const asset    = result.assets[0]
      const ext      = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `manager-${user?.id}-${Date.now()}.${ext}`

      const response    = await fetch(asset.uri)
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
        .eq('id', user!.id)

      if (updateError) throw updateError

      setForm(f => ({ ...f, avatar_url: url }))
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo.')
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        name:         form.name.trim() || null,
        surname:      form.surname.trim() || null,
        username:     form.username.trim() || null,
        phone_number: form.phone_number.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    await load()
    setEditing(false)
    Alert.alert('Saved', 'Your profile has been updated.')
  }

  function cancelEdit() { setEditing(false); load() }

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }, s.center]}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  const displayName = [form.name, form.surname].filter(Boolean).join(' ') || user?.email || 'Manager'
  const initial     = displayName.charAt(0).toUpperCase()

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => replaceManagerRoute(router, MANAGER_MORE)} hitSlop={8}>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Avatar band */}
        <View style={s.heroBand}>
          <View style={s.avatarWrap}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
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
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="camera" size={14} color="#fff" />
              }
            </TouchableOpacity>
          </View>

          {editing ? (
            <Text style={s.editingHint}>Editing profile</Text>
          ) : (
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{displayName}</Text>
              {form.username ? <Text style={s.heroUsername}>@{form.username}</Text> : null}
              <Text style={s.heroEmail}>{form.email || user?.email}</Text>
              <View style={s.rolePill}>
                <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.purple} />
                <Text style={s.rolePillText}>Club Manager</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: SPACING.lg }} />

        {/* Edit form */}
        {editing && (
          <View style={{ marginBottom: SPACING.md }}>
            <Section title="EDIT PROFILE">
              <EditField
                label="First name"
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
              />
              <EditField
                label="Last name"
                value={form.surname}
                onChange={v => setForm(f => ({ ...f, surname: v }))}
              />
              <EditField
                label="Username"
                value={form.username}
                onChange={v => setForm(f => ({ ...f, username: v }))}
                placeholder="@username"
              />
              <EditField
                label="Phone"
                value={form.phone_number}
                onChange={v => setForm(f => ({ ...f, phone_number: v }))}
                keyboardType="phone-pad"
              />
              <EditField
                label="Email"
                value={form.email || user?.email || ''}
                editable={false}
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
        )}

        {/* Info (read mode) */}
        {!editing && (
          <Section title="ACCOUNT INFO">
            <View style={[ef.row, ef.border]}>
              <Text style={ef.label}>Email</Text>
              <Text style={[ef.input, { color: COLORS.muted }]}>{form.email || user?.email || '–'}</Text>
            </View>
            <View style={[ef.row, ef.border]}>
              <Text style={ef.label}>Phone</Text>
              <Text style={[ef.input, { color: form.phone_number ? COLORS.white : COLORS.mutedDark }]}>
                {form.phone_number || 'Not set'}
              </Text>
            </View>
            <View style={ef.row}>
              <Text style={ef.label}>Username</Text>
              <Text style={[ef.input, { color: form.username ? COLORS.white : COLORS.mutedDark }]}>
                {form.username ? `@${form.username}` : 'Not set'}
              </Text>
            </View>
          </Section>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  headerTitle: { flex: 1, fontSize: FONT.lg, fontWeight: '700', color: COLORS.white },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },

  heroBand: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.md, gap: SPACING.sm },

  avatarWrap:     { position: 'relative', width: 84, height: 84 },
  avatarImg:      { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: COLORS.purple },
  avatarFallback: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.purpleDark, borderWidth: 3, borderColor: COLORS.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontSize: 30, fontWeight: '800' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.purple,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },

  heroInfo:     { alignItems: 'center', gap: 3 },
  heroName:     { color: COLORS.white, fontSize: FONT.lg, fontWeight: '700' },
  heroUsername: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600' },
  heroEmail:    { color: COLORS.mutedDark, fontSize: FONT.sm },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: COLORS.purpleDark + '44',
    borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3,
  },
  rolePillText: { color: COLORS.purple, fontSize: 11, fontWeight: '600' },
  editingHint:  { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '600', marginTop: 4 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs + 2,
    marginHorizontal: SPACING.md, marginTop: SPACING.sm,
    backgroundColor: COLORS.purpleDark, borderRadius: RADIUS.lg, height: 50,
  },
  saveBtnText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700' },
})
