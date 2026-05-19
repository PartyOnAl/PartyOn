import { Stack } from 'expo-router'

export default function ManagerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(manager-tabs)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="staff" />
      <Stack.Screen name="disputes" />
      <Stack.Screen name="club-profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="create-event"  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="edit-event"    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="promotions"    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="billing-history"  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="payment-methods"  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="inbox"            options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
