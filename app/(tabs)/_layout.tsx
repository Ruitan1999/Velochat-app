import React, { useEffect, useState } from 'react'
import { Tabs, useRootNavigationState } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MessageCircle, Shield, User } from 'lucide-react-native'
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
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.75}
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

  const rootState = useRootNavigationState()
  const isNavReady = Boolean(rootState?.key)
  const [canShowTabs, setCanShowTabs] = useState(false)

  // Defer mounting Tabs by one tick so router store state (e.g. stale) is defined (avoids "stale of undefined")
  useEffect(() => {
    if (!user || !isNavReady) {
      setCanShowTabs(false)
      return
    }
    const t = setTimeout(() => setCanShowTabs(true), 0)
    return () => clearTimeout(t)
  }, [user, isNavReady])

  // Only run unread subscription after navigator is ready (avoids "stale of undefined")
  useEffect(() => {
    if (!user || !isNavReady) return
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
  }, [user, isNavReady])

  // Avoid mounting Tabs until one tick after nav is ready (router store state must be defined)
  if (!user || !isNavReady || !canShowTabs) {
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
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={User} label="Me" focused={focused} />
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
    maxWidth: '100%',
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
