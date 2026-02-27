import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const isExpoGo = Constants.appOwnership === 'expo'

async function getNotificationsModule() {
  return await import('expo-notifications')
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (isExpoGo) {
    console.log('Push notifications are not supported in Expo Go (SDK 53+). Use a development build.')
    return null
  }

  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices')
    return null
  }

  const Notifications = await getNotificationsModule()

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      // Expo SDK 54 NotificationBehavior fields
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied')
    return null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'VeloChat',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
    })
    await Notifications.setNotificationChannelAsync('rides', {
      name: 'Ride Updates',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#3B82F6',
    })
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId ?? 'YOUR_EAS_PROJECT_ID',
  })

  return tokenData.data
}

export async function saveFcmToken(userId: string, token: string) {
  await supabase
    .from('profiles')
    .update({ fcm_token: token })
    .eq('id', userId)
}

export async function sendPushNotification({
  recipientIds,
  title,
  body,
  data,
}: {
  recipientIds: string[]
  title: string
  body: string
  data?: Record<string, string>
}) {
  await supabase.functions.invoke('send-notification', {
    body: { recipientIds, title, body, data },
  })
}

export function setupNotificationListeners(
  onReceive: (notification: any) => void,
  onResponse: (response: any) => void
) {
  if (isExpoGo) {
    return () => {}
  }

  let cleanup = () => {}

  getNotificationsModule().then((Notifications) => {
    const receiveSubscription = Notifications.addNotificationReceivedListener(onReceive)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse)
    cleanup = () => {
      receiveSubscription.remove()
      responseSubscription.remove()
    }
  })

  return () => cleanup()
}
