import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { PlatformSettingsProvider, usePlatformSettings } from '@/lib/platformSettings'

function AuthGuard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!user && !inAuth) {
      router.replace('/(auth)/welcome')
    }
  }, [user, loading])

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
          We'll be back shortly!
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
    <AuthProvider>
      <PlatformSettingsProvider>
        <AuthGuard />
        <StatusBar style="light" />
        <MaintenanceGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0f' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(admin)" />
            <Stack.Screen name="(manager)" />
            <Stack.Screen name="(staff)" />
            <Stack.Screen name="event/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="payment" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="payment-method" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="purchased-ticket" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="top-clubs" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="promotions" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="promotion/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="club/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="clubs-map" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          </Stack>
        </MaintenanceGate>
      </PlatformSettingsProvider>
    </AuthProvider>
  )
}
