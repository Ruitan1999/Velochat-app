import { Tabs, Redirect } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MessageCircle, Shield, Users } from 'lucide-react-native'
import { colors, fontWeight, fontSize } from '../../src/lib/theme'
import { useAuth } from '../../src/lib/AuthContext'

function TabIcon({ icon: Icon, label, focused }: { icon: React.ComponentType<any>; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Icon size={18} color={focused ? colors.blue500 : colors.slate400} strokeWidth={2} />
      <Text style={[styles.tabLabel, { color: focused ? colors.blue500 : colors.slate400 }]}>
        {label}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
  const { session, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate200,
          borderTopWidth: 1,
          height: 74,
          paddingBottom: 24,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MessageCircle} label="Chats" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Shield} label="Clubs" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="riders"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={Users} label="Riders" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  tabLabel: { fontSize: 10, fontWeight: fontWeight.semibold },
})
