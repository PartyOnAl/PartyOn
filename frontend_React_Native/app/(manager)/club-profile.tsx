import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS, FONT } from '@/lib/theme'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { MANAGER_MORE, replaceManagerRoute } from '@/lib/managerNavigation'

export default function ClubProfileScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [clubId, setClubId]           = useState<string | null>(null)
  const [clubName, setClubName]       = useState('')
  const [location, setLocation]       = useState('')
  const [description, setDescription] = useState('')
  const [musicType, setMusicType]     = useState('')
  const [openingHours, setOpeningHours] = useState('')
  const [coverImage, setCoverImage]   = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.club_id) { setLoading(false); return }
    supabase
      .from('clubs')
      .select('*')
      .eq('club_id', profile.club_id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setClubId(data.club_id)
          setClubName(data.club_name ?? '')
          setLocation(data.club_address ?? '')
          setDescription(data.club_description ?? '')
          setMusicType((data as any).music_type ?? '')
          setOpeningHours((data as any).opening_hours ?? '')
          setCoverImage(data.club_image ?? null)
        }
        setLoading(false)
      })
  }, [profile?.club_id])

  // ── Image picker + Supabase Storage upload ──────────────────────────────────
  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setUploading(true)

    try {
      const ext      = asset.uri.split('.').pop() ?? 'jpg'
      const fileName = `club-${clubId ?? profile?.club_id}-${Date.now()}.${ext}`

      const response    = await fetch(asset.uri)
      const arrayBuffer = await response.arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('club-images')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('club-images')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl
      setCoverImage(publicUrl)

      // Save the URL to the clubs table immediately
      if (profile?.club_id) {
        await supabase
          .from('clubs')
          .update({ club_image: publicUrl })
          .eq('club_id', profile.club_id)
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload image.')
    } finally {
      setUploading(false)
    }
  }

  // ── Save club info ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!profile?.club_id) return
    if (!clubName.trim()) { Alert.alert('Validation', 'Club name is required.'); return }

    setSaving(true)
    const { error } = await supabase
      .from('clubs')
      .update({
        club_name:    clubName.trim(),
        club_address: location.trim(),
        club_description: description.trim(),
        music_type:   musicType.trim(),
        opening_hours: openingHours.trim(),
        updated_at:   new Date().toISOString(),
      })
      .eq('club_id', profile.club_id)
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved', 'Club profile updated successfully.')
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color={COLORS.purple} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => replaceManagerRoute(router, MANAGER_MORE)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.appName}>
              Party<Text style={{ color: COLORS.purple }}>On</Text>
            </Text>
            <Text style={s.sub}>Manager • {profile?.name ?? ''}</Text>
          </View>
        </View>

        <Text style={s.pageTitle}>Club Profile</Text>
        <Text style={s.pageSubtitle}>Manage your club&apos;s information and branding</Text>

        {/* ── Cover Image ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cover Image</Text>

          <TouchableOpacity style={s.imageBox} onPress={handlePickImage} activeOpacity={0.8}>
            {coverImage ? (
              <Image
                source={{ uri: coverImage }}
                style={s.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={s.imagePlaceholder}>
                <Ionicons name="cloud-upload-outline" size={36} color={COLORS.mutedDark} />
                <Text style={s.imagePlaceholderText}>Tap to select a cover image</Text>
              </View>
            )}
            {uploading && (
              <View style={s.uploadOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={s.uploadingText}>Uploading…</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.uploadBtn} onPress={handlePickImage} disabled={uploading}>
            <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
            <Text style={s.uploadBtnText}>{coverImage ? 'Change Image' : 'Upload Image'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Club Information ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Club Information</Text>

          <Field label="Club Name">
            <TextInput
              style={s.input}
              value={clubName}
              onChangeText={setClubName}
              placeholder="Enter club name"
              placeholderTextColor={COLORS.mutedDark}
            />
          </Field>

          <Field label="Location">
            <TextInput
              style={s.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City, Country"
              placeholderTextColor={COLORS.mutedDark}
            />
          </Field>

          <Field label="Description">
            <TextInput
              style={[s.input, s.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your venue…"
              placeholderTextColor={COLORS.mutedDark}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Field>

          <Field label="Music Type">
            <TextInput
              style={s.input}
              value={musicType}
              onChangeText={setMusicType}
              placeholder="House, Techno, Hip Hop"
              placeholderTextColor={COLORS.mutedDark}
            />
          </Field>

          <Field label="Opening Hours">
            <TextInput
              style={s.input}
              value={openingHours}
              onChangeText={setOpeningHours}
              placeholder="22:00 – 04:00"
              placeholderTextColor={COLORS.mutedDark}
            />
          </Field>
        </View>

        {/* ── Actions ── */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={() => replaceManagerRoute(router, MANAGER_MORE)}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <Ionicons name="save-outline" size={16} color="#fff" />
                  <Text style={s.saveBtnText}>Save Changes</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Tiny helper ───────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, paddingHorizontal: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  header:   { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg, gap: SPACING.sm },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
  appName:  { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
  sub:      { color: COLORS.mutedDark, fontSize: 11, marginTop: 2 },

  pageTitle:    { color: COLORS.white, fontSize: FONT.xl, fontWeight: '700', marginBottom: 4 },
  pageSubtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, marginBottom: SPACING.lg },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.white, fontSize: FONT.base, fontWeight: '700', marginBottom: SPACING.md },

  imageBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 180,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage:          { width: '100%', height: '100%' },
  imagePlaceholder:    { alignItems: 'center', gap: SPACING.sm },
  imagePlaceholderText:{ color: COLORS.mutedDark, fontSize: FONT.sm, marginTop: 4 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  uploadingText: { color: '#fff', fontSize: FONT.sm, fontWeight: '600' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, padding: SPACING.sm + 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  uploadBtnText: { color: COLORS.white, fontSize: FONT.sm, fontWeight: '500' },

  field:      { marginBottom: SPACING.md },
  fieldLabel: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '500', marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    color: COLORS.white,
    fontSize: FONT.base,
  },
  textarea: { minHeight: 100, paddingTop: SPACING.sm + 4 },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: {
    flex: 1, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { color: COLORS.muted, fontSize: FONT.base, fontWeight: '500' },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
  },
  saveBtnText: { color: '#fff', fontSize: FONT.base, fontWeight: '700' },
})
