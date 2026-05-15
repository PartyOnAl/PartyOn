import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StatusBar,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/AuthContext'
import { usePlatformSettings } from '@/lib/platformSettings'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

// ── Shared input component ────────────────────────────────────────────────────
function InputField({
  icon, placeholder, value, onChangeText,
  secureTextEntry, keyboardType, autoCapitalize,
  autoComplete, textContentType, rightElement,
}: {
  icon: keyof typeof Ionicons.glyphMap
  placeholder: string
  value: string
  onChangeText: (t: string) => void
  secureTextEntry?: boolean
  keyboardType?: any
  autoCapitalize?: any
  autoComplete?: any
  textContentType?: any
  rightElement?: React.ReactNode
}) {
  return (
    <View style={field.wrap}>
      <Ionicons name={icon} size={18} color={COLORS.mutedDark} style={field.icon} />
      <TextInput
        style={field.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.mutedDark}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoComplete={autoComplete}
        textContentType={textContentType}
        selectionColor={COLORS.purple}
      />
      {rightElement}
    </View>
  )
}

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleG() {
  return (
    <View style={google.wrap}>
      <Text style={google.b}>G</Text>
    </View>
  )
}
const google = StyleSheet.create({
  wrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  b: { color: '#4285F4', fontSize: 13, fontWeight: '800', lineHeight: 16 },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SignupScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { signUp, signInWithGoogle } = useAuth()
  const { settings } = usePlatformSettings()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSignup() {
    setError(null)
    if (!settings.new_registrations) {
      setError('New registrations are currently disabled. Please try again later.')
      return
    }
    const parts = fullName.trim().split(' ')
    const name = parts[0] ?? ''
    const surname = parts.slice(1).join(' ') || name
    if (!name) { setError('Please enter your full name.'); return }
    if (!email.includes('@')) { setError('Please enter a valid email.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    const err = await signUp(email.trim(), password, name, surname)
    setLoading(false)
    if (err) setError(err)
    else router.replace('/(tabs)')
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const err = await signInWithGoogle()
    setGoogleLoading(false)
    if (err) setError(err)
    else router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Heading */}
        <View style={styles.headingArea}>
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>
            Turn the night <Text style={styles.subOn}>ON.</Text>
          </Text>
        </View>

        {/* Fields */}
        <View style={styles.fields}>
          <InputField
            icon="person-outline"
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <InputField
            icon="mail-outline"
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <InputField
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            textContentType="newPassword"
            rightElement={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={field.eye}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.mutedDark}
                />
              </TouchableOpacity>
            }
          />
          <InputField
            icon="shield-checkmark-outline"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            autoComplete="password-new"
            textContentType="newPassword"
            rightElement={
              <TouchableOpacity
                onPress={() => setShowConfirm((v) => !v)}
                hitSlop={10}
                style={field.eye}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={
                    confirmPassword.length > 0
                      ? confirmPassword === password
                        ? COLORS.green
                        : COLORS.red
                      : COLORS.mutedDark
                  }
                />
              </TouchableOpacity>
            }
          />

          {/* Live password match indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons
                name={confirmPassword === password ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={confirmPassword === password ? COLORS.green : COLORS.red}
              />
              <Text style={[
                styles.matchText,
                { color: confirmPassword === password ? COLORS.green : COLORS.red },
              ]}>
                {confirmPassword === password ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSignup}
            disabled={loading || googleLoading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Create account</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialBtns}>
          <TouchableOpacity
            style={styles.appleBtn}
            activeOpacity={0.85}
            disabled={loading || googleLoading}
          >
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogle}
            activeOpacity={0.85}
            disabled={loading || googleLoading}
          >
            {googleLoading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : (
                <>
                  <GoogleG />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Input styles ──────────────────────────────────────────────────────────────
const field = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.md,
    height: 54,
  },
  icon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    paddingVertical: 0,
  },
  eye: { padding: 4, marginLeft: SPACING.xs },
})

// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  container: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  headingArea: { marginTop: SPACING.xl + SPACING.md, marginBottom: SPACING.xl },
  heading: {
    color: COLORS.white,
    fontSize: FONT.xl + 2,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subheading: { color: COLORS.muted, fontSize: FONT.base, textAlign: 'center' },
  subOn: { color: COLORS.purple, fontWeight: '700' },

  fields: { gap: SPACING.sm + 2 },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchText: { fontSize: FONT.sm },

  error: { color: COLORS.red, fontSize: FONT.sm, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  primaryBtnText: {
    color: '#fff', fontWeight: '800', fontSize: FONT.base + 1, letterSpacing: 0.2,
  },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg, marginBottom: SPACING.lg },
  footerText: { color: COLORS.muted, fontSize: FONT.sm },
  footerLink: { color: COLORS.purple, fontSize: FONT.sm, fontWeight: '700' },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerLabel: { color: COLORS.mutedDark, fontSize: FONT.sm },

  socialBtns: { gap: SPACING.sm },

  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: '#fff', borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
  },
  appleBtnText: { color: '#000', fontWeight: '700', fontSize: FONT.base },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 52,
  },
  googleBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT.base },
})
