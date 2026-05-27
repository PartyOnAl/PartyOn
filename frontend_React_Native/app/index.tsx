import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/AuthContext'
import { View, ActivityIndicator } from 'react-native'
import { COLORS } from '@/lib/theme'

export default function Index() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  if (!user) return <Redirect href="/(auth)/welcome" />

  if (profile?.role === 'admin') return <Redirect href="/(admin)/(admin-tabs)/dashboard" />

  if (profile?.role === 'manager') return <Redirect href="/(manager)/(manager-tabs)/dashboard" />

  if (profile?.role === 'host' || profile?.role === 'staff') return <Redirect href="/(staff)" />

  return <Redirect href="/(tabs)" />
}
