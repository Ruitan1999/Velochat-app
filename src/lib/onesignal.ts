/**
 * OneSignal push notifications for ride chat messages.
 * Uses external user IDs (Supabase user IDs) so the backend can target users.
 * Safely no-ops when the native OneSignal module is not available (e.g. Expo Go, web).
 */

import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import type { NotificationClickEvent } from 'react-native-onesignal'

// OneSignal native module is not available in Expo Go or on web — skip loading so we no-op cleanly
const isExpoGo = Constants.appOwnership === 'expo'
let OneSignal: typeof import('react-native-onesignal').OneSignal | null = null
if (!isExpoGo && (Platform.OS === 'ios' || Platform.OS === 'android')) {
  try {
    OneSignal = require('react-native-onesignal').OneSignal
  } catch {
    // native module not available
  }
}

const ONESIGNAL_APP_ID =
  Constants.expoConfig?.extra?.onesignalAppId ?? 'YOUR_ONESIGNAL_APP_ID'

let initialized = false

export function initOneSignal() {
  if (!OneSignal || initialized || !ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    return
  }
  try {
    OneSignal.initialize(ONESIGNAL_APP_ID)
    initialized = true
  } catch {
    OneSignal = null
  }
}

export function setOneSignalUserId(userId: string) {
  if (!OneSignal || !initialized) return
  try {
    OneSignal.login(userId)
  } catch {
    // native module not available (e.g. Expo Go)
  }
}

export function clearOneSignalUserId() {
  if (!OneSignal || !initialized) return
  try {
    OneSignal.logout()
  } catch {
    // native module not available
  }
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

  try {
    OneSignal.Notifications.addEventListener('click', handler)
    return () => {
      try {
        OneSignal?.Notifications.removeEventListener('click', handler)
      } catch {
        // ignore
      }
    }
  } catch {
    return undefined
  }
}
