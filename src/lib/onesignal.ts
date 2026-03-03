/**
 * OneSignal push notifications for ride chat messages.
 * Uses external user IDs (Supabase user IDs) so the backend can target users.
 * Safely no-ops when the native OneSignal module is not available (e.g. Expo Go, web).
 */

import { Platform } from 'react-native'
import { router } from 'expo-router'
import type { NotificationClickEvent } from 'react-native-onesignal'

let OneSignal: typeof import('react-native-onesignal').OneSignal | null = null
try {
  // Dynamic require so that web / Expo Go don't crash if the native module isn't present
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    OneSignal = require('react-native-onesignal').OneSignal
  }
} catch {
  // native module not available (e.g. web, Expo Go, or build without OneSignal)
}

const ONESIGNAL_APP_ID =
  Constants.expoConfig?.extra?.onesignalAppId ?? 'YOUR_ONESIGNAL_APP_ID'

let initialized = false

export function initOneSignal() {
  if (!OneSignal || initialized || !ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    return
  }
  OneSignal.initialize(ONESIGNAL_APP_ID)
  initialized = true
}

export function setOneSignalUserId(userId: string) {
  if (!OneSignal || !initialized) return
  OneSignal.login(userId)
}

export function clearOneSignalUserId() {
  if (!OneSignal || !initialized) return
  OneSignal.logout()
}

export function setupOneSignalNotificationClick(): (() => void) | undefined {
  if (!OneSignal) return undefined

  const navigateFromNotification = (data: Record<string, string> | undefined) => {
    if (!data?.roomId && !data?.rideId) return
    setTimeout(() => {
      if (data.roomId) router.push(`/chat/${data.roomId}` as any)
      else if (data.rideId) router.push(`/ride/${data.rideId}` as any)
    }, 300)
  }

  const handler = (event: NotificationClickEvent) => {
    const data = (event.notification?.additionalData ?? {}) as Record<string, string>
    navigateFromNotification(data)
  }

  OneSignal.Notifications.addEventListener('click', handler)
  return () => {
    OneSignal!.Notifications.removeEventListener('click', handler)
  }
}
