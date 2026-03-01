/**
 * OneSignal push notifications for ride chat messages.
 * Uses external user IDs (Supabase user IDs) so the backend can target users.
 */

import Constants from 'expo-constants'
import { OneSignal, type NotificationClickEvent } from 'react-native-onesignal'
import { router } from 'expo-router'

const ONESIGNAL_APP_ID =
  Constants.expoConfig?.extra?.onesignalAppId ?? 'YOUR_ONESIGNAL_APP_ID'

let initialized = false

export function initOneSignal() {
  if (initialized || !ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
    return
  }
  OneSignal.initialize(ONESIGNAL_APP_ID)
  initialized = true
}

export function setOneSignalUserId(userId: string) {
  if (!initialized) return
  OneSignal.login(userId)
}

export function clearOneSignalUserId() {
  if (!initialized) return
  OneSignal.logout()
}

export function setupOneSignalNotificationClick() {
  const navigateFromNotification = (data: Record<string, string> | undefined) => {
    if (!data?.roomId && !data?.rideId) return
    // Delay ensures the navigation stack is mounted (background or killed start)
    setTimeout(() => {
      if (data.roomId) router.push(`/chat/${data.roomId}` as any)
      else if (data.rideId) router.push(`/ride/${data.rideId}` as any)
    }, 300)
  }

  const handler = (event: NotificationClickEvent) => {
    const data = (event.notification?.additionalData ?? {}) as Record<string, string>
    navigateFromNotification(data)
  }

  // Register listener immediately (no initialized guard) so it catches taps
  // even when the app is opened from killed state before login completes.
  OneSignal.Notifications.addEventListener('click', handler)
  return () => {
    OneSignal.Notifications.removeEventListener('click', handler)
  }
}
