import { Stack } from 'expo-router'

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="(admin-tabs)" />
      <Stack.Screen name="add-club" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="club-detail/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="events" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="subscriptions" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="subscription-detail/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="featured-events" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack>
  )
}
