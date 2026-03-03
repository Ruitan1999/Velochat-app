import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import React from 'react'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import { router, useSegments, useRootNavigationState } from 'expo-router'
import { AuthProvider, useAuth } from '../src/lib/AuthContext'
import { initOneSignal, setupOneSignalNotificationClick } from '../src/lib/onesignal'
import { setupNotificationListeners } from '../src/lib/notifications'
import { colors } from '../src/lib/theme'

function AuthGate() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const navState = useRootNavigationState()

  useEffect(() => {
    if (loading || !navState?.key) return

    const inAuthGroup = segments[0] === '(auth)'
    const inAuthEmailOtp = inAuthGroup && segments[1] === 'otp'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup && !inAuthEmailOtp) {
      router.replace('/(tabs)/chats')
    }
  }, [session, loading, segments, navState?.key])

  // Notification click → deep link to chat (OneSignal + Expo push)
  useEffect(() => {
    // Init early so the click listener can catch killed-state taps
    initOneSignal()
    const unsubOneSignal = setupOneSignalNotificationClick()

    const unsubExpo = setupNotificationListeners(
      () => {},
      (response: any) => {
        const data = response?.notification?.request?.content?.data ?? {}
        const roomId = data?.roomId ?? data?.room_id
        if (roomId) {
          setTimeout(() => {
            router.push(`/chat/${roomId}` as any)
          }, 100)
        }
      }
    )

    // App opened from killed state by tapping notification (Expo)
    const checkLastResponse = async () => {
      try {
        const { getLastNotificationResponseAsync } = await import('expo-notifications')
        const last = await getLastNotificationResponseAsync()
        const data = last?.notification?.request?.content?.data ?? {}
        const roomId = data?.roomId ?? data?.room_id
        if (roomId) {
          setTimeout(() => router.push(`/chat/${roomId}` as any), 300)
        }
      } catch {
        // ignore
      }
    }
    checkLastResponse()

    return () => {
      unsubOneSignal?.()
      unsubExpo?.()
    }
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 }}>
        <ActivityIndicator color={colors.blue500} size="large" />
      </View>
    )
  }

  return null
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Inter-ExtraBold': Inter_800ExtraBold,
  })

  const [fontTimeoutDone, setFontTimeoutDone] = React.useState(false)

  useEffect(() => {
    if (fontsLoaded) return
    const id = setTimeout(() => setFontTimeoutDone(true), 6000)
    return () => clearTimeout(id)
  }, [fontsLoaded])

  if (!fontsLoaded && !fontTimeoutDone) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate50 }}>
        <ActivityIndicator color={colors.blue500} size="large" />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="chat/[roomId]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="ride/[rideId]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="club/[clubId]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="edit-chat/[roomId]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="notifications"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="delete-account"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
