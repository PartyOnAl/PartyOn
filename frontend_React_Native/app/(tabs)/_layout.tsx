import { Tabs } from 'expo-router'
import { Platform, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      width: 44, height: 34,
    }}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? '#7c3aed' : '#555555'}
      />
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: '#0d0d0d',
          borderTopColor: '#2a2a2a',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 28 : 6,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 84 : 58,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#555555',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon name="search-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Tickets',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'ticket' : 'ticket-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person-circle' : 'person-circle-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="tickets" options={{ href: null }} />
    </Tabs>
  )
}
