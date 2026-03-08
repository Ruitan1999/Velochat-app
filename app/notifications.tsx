import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, fontSize, fontWeight, radius } from '../src/lib/theme'
import { useChatRooms } from '../src/hooks/useData'
import { fmtMessageTime } from '../src/lib/utils'
import { ChevronLeft, Bell, Bike, MessageCircle, Users } from 'lucide-react-native'

type NotificationItem = {
  id: string
  type: 'ride' | 'chat' | 'friend'
  title: string
  body: string
  time: string
  read: boolean
}

const iconMap = {
  ride: Bike,
  chat: MessageCircle,
  friend: Users,
}

const colorMap = {
  ride: colors.blue500,
  chat: colors.cyan500,
  friend: colors.violet500,
}

export default function NotificationsScreen() {
  const { rooms } = useChatRooms()

  const notifications = (rooms ?? [])
    .filter(r => (r.unread_count ?? 0) > 0)
    .map<NotificationItem>(room => ({
      id: room.id,
      type: room.type === 'ride' ? 'ride' : 'chat',
      title: room.title,
      body: room.last_message?.text ??
        ((room.unread_count ?? 0) === 1 ? '1 new message' : `${room.unread_count} new messages`),
      time: room.last_message?.created_at
        ? fmtMessageTime(room.last_message.created_at)
        : fmtMessageTime(room.created_at),
      read: false,
    }))
    .sort((a, b) => (a.time < b.time ? 1 : -1)) // rough sort; times are strings from fmtMessageTime

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const Icon = iconMap[item.type]
    const iconColor = colorMap[item.type]
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifUnread]}
        activeOpacity={0.85}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={[styles.notifIcon, { backgroundColor: iconColor + '18' }]}>
          <Icon size={18} color={iconColor} />
        </View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle}>{item.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{item.time}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={n => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={40} color={colors.slate300} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>You&apos;ll see ride invites, messages, and friend requests here</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  list: { padding: spacing.lg, gap: 8 },

  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.lg, backgroundColor: colors.white,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200,
  },
  notifUnread: { backgroundColor: colors.blue50, borderColor: colors.blue200 },
  notifIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.slate900 },
  notifBody: { fontSize: fontSize.xs, color: colors.slate500 },
  notifTime: { fontSize: 10, color: colors.slate400, marginTop: 2 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue500,
  },

  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate400 },
  emptyBody: { fontSize: fontSize.sm, color: colors.slate400, textAlign: 'center', paddingHorizontal: 40 },
})
