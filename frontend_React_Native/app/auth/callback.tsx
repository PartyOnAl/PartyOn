/**
 * OAuth callback handler
 * Deep-link target for Supabase OAuth redirects (Google, etc.)
 * Route: frontendreactnative://auth/callback
 *
 * In most cases WebBrowser.openAuthSessionAsync intercepts the redirect
 * before this screen is ever shown. This file exists as a fallback for
 * Android deep-link scenarios where the browser does not hand back
 * control automatically.
 */
import { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT } from '@/lib/theme'

WebBrowser.maybeCompleteAuthSession()

export default function AuthCallbackScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    async function handle() {
      // Tokens may arrive as query params or hash (URL already parsed by Expo Linking)
      const accessToken = (params.access_token as string) ?? null
      const refreshToken = (params.refresh_token as string) ?? null

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }

      router.replace('/(tabs)')
    }
    handle()
  }, [])

  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.purple} size="large" />
      <Text style={styles.text}>Signing you in…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { color: COLORS.muted, fontSize: FONT.base },
})
