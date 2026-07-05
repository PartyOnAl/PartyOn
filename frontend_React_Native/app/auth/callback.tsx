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
import { useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase'
import { COLORS, FONT } from '@/lib/theme'
import { navigateAfterAuth } from '@/lib/navigateAfterAuth'
import { getStaffHomeHref, isVenueStaffRole } from '@/lib/staffRoutes'

WebBrowser.maybeCompleteAuthSession()

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams()

  useEffect(() => {
    async function handle() {
      // Tokens may arrive as query params or hash (URL already parsed by Expo Linking)
      const accessToken = (params.access_token as string) ?? null
      const refreshToken = (params.refresh_token as string) ?? null

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }

      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single()
        if (prof?.role === 'admin') {
          navigateAfterAuth('/(admin)/(admin-tabs)/dashboard')
          return
        }
        if (prof?.role === 'manager') {
          navigateAfterAuth('/(manager)/(manager-tabs)/dashboard')
          return
        }
        if (prof && isVenueStaffRole(prof.role)) {
          navigateAfterAuth(getStaffHomeHref(prof.role))
          return
        }
      }

      navigateAfterAuth('/(tabs)')
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
