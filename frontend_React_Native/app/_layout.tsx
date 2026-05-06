import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '@/lib/AuthContext'

export const unstable_settings = {
  anchor: '(tabs)',
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0f' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
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
    </AuthProvider>
  )
}
