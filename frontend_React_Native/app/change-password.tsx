import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChangePassword() {
    const email = user?.email
    if (!email) {
      Alert.alert('Unable to change password', 'Your account email could not be found.')
      return
    }
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Missing password', 'Please fill in your current password, new password, and confirmation.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Your new password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same new password.')
      return
    }
    if (currentPassword === newPassword) {
      Alert.alert('Choose a new password', 'Your new password must be different from your current password.')
      return
    }

    setSaving(true)
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (verifyError) {
      setSaving(false)
      Alert.alert('Current password is incorrect', 'Please check your current password and try again.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      Alert.alert('Could not change password', error.message)
      return
    }

    Alert.alert('Password changed', 'Your password has been updated successfully.', [
      { text: 'Done', onPress: () => router.back() },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Change password</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View style={s.iconCircle}>
          <Ionicons name="key-outline" size={28} color={COLORS.purple} />
        </View>
        <Text style={s.title}>Update your password</Text>
        <Text style={s.subtitle}>Enter your current password first so we can verify it is really you.</Text>

        <View style={s.card}>
          <PasswordInput
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            isLast
          />
        </View>

        <Text style={s.hint}>Use at least 8 characters. You will keep your current session after changing it.</Text>

        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleChangePassword}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={COLORS.white} />
              <Text style={s.saveText}>Update password</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function PasswordInput({
  label, value, onChange, autoComplete, isLast,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'current-password' | 'new-password'
  isLast?: boolean
}) {
  return (
    <View style={[s.inputRow, !isLast && s.inputBorder]}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={COLORS.mutedDark}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'current-password' ? 'password' : 'newPassword'}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
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
  headerSpacer: { width: 36 },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: 48,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.purple + '18',
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { color: COLORS.white, fontSize: FONT.xl, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: COLORS.mutedDark, fontSize: FONT.sm, lineHeight: 20, marginBottom: SPACING.lg },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  inputRow: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.xs },
  inputBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  inputLabel: { color: COLORS.mutedDark, fontSize: FONT.sm, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.white,
    fontSize: FONT.base,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  hint: { color: COLORS.mutedDark, fontSize: 12, lineHeight: 17, marginTop: SPACING.md },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    height: 52,
    marginTop: SPACING.lg,
  },
  saveText: { color: COLORS.white, fontSize: FONT.base, fontWeight: '800' },
})
