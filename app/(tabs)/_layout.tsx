import React, { useEffect, useState } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MessageCircle, Shield, Users } from 'lucide-react-native'
import { colors, fontWeight, fontSize } from '../../src/lib/theme'
import { useAuth } from '../../src/lib/AuthContext'
import { supabase } from '../../src/lib/supabase'
import {
  getTabUnread,
  setTabUnread,
  subscribeTabUnread,
} from '../../src/lib/tabUnreadStore'

function TabIcon({
  icon: Icon,
  label,
  focused,
  showDot,
}: {
  icon: React.ComponentType<any>
  label: string
  focused: boolean
  showDot?: boolean
}) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Icon size={18} color={focused ? colors.blue500 : colors.slate400} strokeWidth={2} />
        {showDot && (
          <View style={styles.tabDot} />
        )}
      </View>
      <Text
        style={[styles.tabLabel, { color: focused ? colors.blue500 : colors.slate400 }]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
  const { user } = useAuth()
  const [hasUnreadChats, setHasUnreadChats] = useState(() => getTabUnread())

  useEffect(() => {
    return subscribeTabUnread(() => setHasUnreadChats(getTabUnread()))
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      const { data, error } = await supabase.rpc('get_unread_counts', { p_user_id: user.id })
      if (error || cancelled) return
      const anyUnread = (data ?? []).some((row: { unread_count: number }) => (row.unread_count ?? 0) > 0)
      setTabUnread(anyUnread)
    }
    run()
    const channel = supabase
      .channel(`tab-unreads:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => run())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, () => run())
      .subscribe()
    return () => {
      cancelled = true
      channel?.unsubscribe()
    }
  }, [user])

  // Avoid mounting Tabs before auth has resolved (prevents "stale of undefined" in navigator refs)
  if (!user) {
    return null
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          flex: 1,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.slate200,
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 24,
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={MessageCircle} label="Chats" focused={focused} showDot={!!hasUnreadChats} />
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
  tabItem: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  tabDot: {
    position: 'absolute',
    top: -4,
    right: -8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.blue500,
  },
})
