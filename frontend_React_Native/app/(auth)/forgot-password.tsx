import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/AuthContext'
import { COLORS, FONT, RADIUS, SPACING } from '@/lib/theme'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setError(null)
    if (!email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    const err = await resetPassword(email.trim())
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      setSent(true)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Back button */}
      <TouchableOpacity style={[styles.backBtn, { marginTop: SPACING.sm }]} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={COLORS.white} />
      </TouchableOpacity>

      <View style={styles.container}>
        {sent ? (
          /* ── Success state ── */
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="mail-open-outline" size={40} color={COLORS.purple} />
            </View>
            <Text style={styles.heading}>Check your email</Text>
            <Text style={styles.successText}>
              We sent a password reset link to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
            <Text style={styles.successSub}>
              Check your inbox and tap the link to set a new password.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Input state ── */
          <>
            <View style={styles.headingArea}>
              <Text style={styles.heading}>Forgot password?</Text>
              <Text style={styles.subheading}>
                {`Enter your email and we'll send you a reset link.`}
              </Text>
            </View>

            <View style={styles.fieldWrap}>
              <Ionicons name="mail-outline" size={18} color={COLORS.mutedDark} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Email Address"
                placeholderTextColor={COLORS.mutedDark}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                selectionColor={COLORS.purple}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Send Reset Link</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelRow} onPress={() => router.back()}>
              <Text style={styles.cancelText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + SPACING.md,
  },

  headingArea: { marginBottom: SPACING.xl },
  heading: {
    color: COLORS.white,
    fontSize: FONT.xl + 2,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subheading: {
    color: COLORS.muted,
    fontSize: FONT.base,
    textAlign: 'center',
    lineHeight: FONT.base * 1.55,
  },

  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.md,
    height: 54,
    marginBottom: SPACING.sm,
  },
  fieldIcon: { marginRight: SPACING.sm },
  fieldInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: FONT.base,
    paddingVertical: 0,
  },

  error: {
    color: COLORS.red,
    fontSize: FONT.sm,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },

  primaryBtn: {
    backgroundColor: COLORS.purpleDark,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: FONT.base + 1,
    letterSpacing: 0.2,
  },

  cancelRow: { alignItems: 'center', marginTop: SPACING.lg },
  cancelText: { color: COLORS.mutedDark, fontSize: FONT.sm },

  // Success state
  successWrap: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xl },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  successText: {
    color: COLORS.muted,
    fontSize: FONT.base,
    textAlign: 'center',
    lineHeight: FONT.base * 1.6,
  },
  emailHighlight: { color: COLORS.white, fontWeight: '700' },
  successSub: {
    color: COLORS.mutedDark,
    fontSize: FONT.sm,
    textAlign: 'center',
    lineHeight: FONT.sm * 1.6,
  },
})
