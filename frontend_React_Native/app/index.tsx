import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/AuthContext'
import { View, ActivityIndicator } from 'react-native'
import { COLORS } from '@/lib/theme'

export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.purple} size="large" />
      </View>
    )
  }

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/welcome" />
}
