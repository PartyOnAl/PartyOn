import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { PlatformSettingsProvider, usePlatformSettings } from '@/lib/platformSettings'
import { navigateAfterAuth } from '@/lib/navigateAfterAuth'
import { getStaffHomeHref, isVenueStaffRole } from '@/lib/staffRoutes'

/** Expo Go loads no native push APIs (SDK 53+); skipping the module avoids startup warnings. */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

function NotificationsBootstrap() {
  useEffect(() => {
    if (IS_EXPO_GO) return
    void import('@/lib/push').then(({ configureNotificationHandler }) => {
      configureNotificationHandler()
    })
  }, [])
  return null
}

function AuthGuard() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) {
      router.replace('/(auth)/welcome')
      return
    }

    // Session exists but stacks still show signup/login/welcome underneath — leave auth group entirely
    if (user && inAuth) {
      if (profile?.role === 'manager') {
        navigateAfterAuth('/(manager)/(manager-tabs)/dashboard')
      } else if (profile?.role === 'admin') {
        navigateAfterAuth('/(admin)/(admin-tabs)/dashboard')
      } else if (isVenueStaffRole(profile?.role)) {
        navigateAfterAuth(getStaffHomeHref(profile?.role))
      } else {
        navigateAfterAuth('/(tabs)')
      }
      return
    }

    if (!user || inAuth) return

    const area = segments[0]
    if (profile?.role === 'manager' && area === '(tabs)') {
      router.replace('/(manager)/(manager-tabs)/dashboard')
    } else if (profile?.role === 'admin' && area === '(tabs)') {
      router.replace('/(admin)/(admin-tabs)/dashboard')
    } else if (isVenueStaffRole(profile?.role) && area === '(tabs)') {
      router.replace(getStaffHomeHref(profile?.role))
    }
  }, [user, profile?.role, loading, segments])

  return null
}

function PushRegistrar() {
  const { profile } = useAuth()
  useEffect(() => {
    if (IS_EXPO_GO || !profile?.id) return
    void import('@/lib/push').then(({ registerForPushTokenAsync }) =>
      registerForPushTokenAsync(profile.id).catch(() => { /* silent */ }),
    )
  }, [profile?.id])
  return null
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { settings, loading: settingsLoading } = usePlatformSettings()
  const { profile, loading: authLoading } = useAuth()

  if (!settingsLoading && !authLoading && settings.maintenance_mode && profile?.role !== 'admin') {
    return (
      <View style={mg.container}>
        <Ionicons name="construct-outline" size={64} color="#9333ea" />
        <Text style={mg.title}>Under Maintenance</Text>
        <Text style={mg.subtitle}>
          PartyOn is currently undergoing scheduled maintenance.{'\n'}
          We&apos;ll be back shortly!
        </Text>
      </View>
    )
  }

  return <>{children}</>
}

const mg = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 20, marginBottom: 12 },
  subtitle: { color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 22 },
})

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PlatformSettingsProvider>
          <NotificationsBootstrap />
          <AuthGuard />
          <PushRegistrar />
          <StatusBar style="light" />
          <MaintenanceGate>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0f' } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(admin)" />
              <Stack.Screen name="(manager)" />
              <Stack.Screen name="(staff)" />
              <Stack.Screen name="guard/guard" options={{ animation: 'fade' }} />
              <Stack.Screen name="hostess" options={{ animation: 'fade' }} />
              <Stack.Screen name="event/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="reserve/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="payment" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="payment-method" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="purchased-ticket" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="top-clubs" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="promotions" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="promotion/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="club/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="clubs-map" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="privacy" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="notifications" options={{ presentation: 'card', animation: 'slide_from_right' }} />
              <Stack.Screen name="support" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            </Stack>
          </MaintenanceGate>
        </PlatformSettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
