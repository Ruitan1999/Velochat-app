import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Pressable, AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { useRides, useChatRooms } from '../../src/hooks/useData'
import { Avatar, AvatarStack, CountdownBadge, EmptyState, Pill, Card } from '../../src/components/ui'
import { RouteMap } from '../../src/components/RouteMap'
import { supabase, Ride, ChatRoom } from '../../src/lib/supabase'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { fmtTime } from '../../src/lib/utils'
import { Bike, Bell, Calendar, Clock, Zap, MapPin, Check, X, MessageCircle, ChevronRight, Plus, Hash } from 'lucide-react-native'

export default function ChatsScreen() {
  const { profile } = useAuth()
  const { rides, loading: ridesLoading, refetch: refetchRides } = useRides()
  const { rooms, loading: roomsLoading, refetch: refetchRooms } = useChatRooms()
  const [sub, setSub] = useState<'rides' | 'general'>('rides')
  const [refreshing, setRefreshing] = useState(false)
  const pathname = usePathname()
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    if (pathname.endsWith('/chats')) {
      refetchRides()
      refetchRooms()
    }
  }, [pathname])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchRides(), refetchRooms()])
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            <Text style={{ color: colors.blue500 }}>Velo</Text>Chat
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Bell size={18} color={colors.slate600} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            {profile && <Avatar initials={profile.avatar_initials} color={profile.avatar_color} size="md" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue500} />}
      >
        {rides.length === 0
          ? <EmptyState icon={<Bike size={36} color={colors.slate400} />} text="No rides posted yet" />
          : rides.map(ride => <RideCard key={ride.id} ride={ride} />)
        }
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Post button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.postBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/new-ride')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Plus size={18} color={colors.white} />
            <Text style={styles.postBtnText}>Post a Ride</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Ride Card ────────────────────────────────────────────────

export function RideCard({ ride }: { ride: Ride }) {
  const { user } = useAuth()
  const [localRsvps, setLocalRsvps] = useState(ride.rsvps ?? [])
  const myRsvp = localRsvps.find(r => r.user_id === user?.id)
  const inCount = localRsvps.filter(r => r.status === 'in').length
  const outCount = localRsvps.filter(r => r.status === 'out').length
  const isIn = myRsvp?.status === 'in'
  const isOut = myRsvp?.status === 'out'
  const inAvatars = localRsvps.filter(r => r.status === 'in').map(r => r.profile?.avatar_initials ?? '?')
  const unreadCount = ride.chat_room?.unread_count ?? 0

  const handleRsvp = async (status: 'in' | 'out') => {
    if (!user) return
    const newStatus = myRsvp?.status === status ? null : status

    setLocalRsvps(prev => {
      const without = prev.filter(r => r.user_id !== user.id)
      if (!newStatus) return without
      return [...without, { user_id: user.id, status: newStatus, profile: { avatar_initials: user.user_metadata?.avatar_initials ?? '?' } } as any]
    })

    if (newStatus) {
      await supabase.from('ride_rsvps').upsert(
        { ride_id: ride.id, user_id: user.id, status: newStatus },
        { onConflict: 'ride_id,user_id' }
      )
    } else {
      await supabase.from('ride_rsvps').delete()
        .eq('ride_id', ride.id).eq('user_id', user.id)
    }
  }

  return (
    <Card style={styles.rideCard}>
      {/* Top row */}
      <View style={styles.rideTop}>
        <View style={styles.rideTitleArea}>
          <View style={styles.rideTypeBadge}>
            <Text style={styles.rideTypeBadgeText}>Group Ride</Text>
          </View>
          <Text style={styles.rideTitle}>{ride.title}</Text>
          <View style={styles.rideMeta}>
            {ride.date && <View style={styles.metaChipRow}><Calendar size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.date}</Text></View>}
            <View style={styles.metaChipRow}><Clock size={11} color={colors.slate400} /><Text style={styles.metaChip}>{fmtTime(ride.time)}</Text></View>
            {ride.distance && <View style={styles.metaChipRow}><Zap size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.distance}</Text></View>}
            {ride.location && <View style={styles.metaChipRow}><MapPin size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.location}</Text></View>}
          </View>
        </View>
        <CountdownBadge expiry={ride.chat_expiry} />
      </View>

      {/* Route map thumbnail */}
      {ride.route_polyline && (
        <RouteMap
          polyline={ride.route_polyline}
          distanceKm={ride.route_distance_km ?? undefined}
          elevationGainM={ride.route_elevation_m ?? undefined}
          routeName={ride.route_name ?? undefined}
          size="card"
          style={{ marginHorizontal: -spacing.lg, marginTop: -4 }}
        />
      )}

      {/* RSVP buttons */}
      <View style={styles.rsvpRow}>
        <TouchableOpacity
          style={[styles.rsvpBtn, styles.rsvpBtnOutline, isIn && styles.rsvpBtnInActive]}
          onPress={() => handleRsvp('in')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <Check size={14} color={isIn ? colors.white : colors.slate400} />
            <Text style={[styles.rsvpBtnText, isIn ? styles.rsvpBtnTextActive : styles.rsvpBtnTextInactive]}>
              I'm In {inCount > 0 ? `· ${inCount}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rsvpBtn, styles.rsvpBtnOutline, isOut && styles.rsvpBtnOutActive]}
          onPress={() => handleRsvp('out')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <X size={14} color={isOut ? colors.white : colors.slate400} />
            <Text style={[styles.rsvpBtnText, isOut ? styles.rsvpBtnTextActive : styles.rsvpBtnTextInactive]}>
              I'm Out {outCount > 0 ? `· ${outCount}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Chat button */}
      <TouchableOpacity
        style={styles.chatBtn}
        activeOpacity={0.8}
        onPress={() => ride.chat_room && router.push(`/chat/${ride.chat_room.id}`)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MessageCircle size={14} color={colors.slate600} />
          <Text style={styles.chatBtnText}>Ride Chat</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {unreadCount > 0 && <View style={styles.unreadDot} />}
          <ChevronRight size={16} color={colors.slate300} />
        </View>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.rideFooter}>
        {ride.organizer && (
          <View style={styles.organizerRow}>
            <Avatar initials={ride.organizer.avatar_initials} color={ride.organizer.avatar_color} size="sm" />
            <Text style={styles.organizerName}>{ride.organizer.name}</Text>
          </View>
        )}
        <AvatarStack initials={inAvatars} max={4} />
      </View>
    </Card>
  )
}

// ─── Chat Room Card ───────────────────────────────────────────

function ChatRoomCard({ room }: { room: ChatRoom }) {
  const participantInitials = (room.participants ?? []).map(p => p.avatar_initials)

  return (
    <Card onPress={() => router.push(`/chat/${room.id}`)} style={styles.chatRoomCard}>
      <View style={styles.chatRoomTop}>
        <View style={styles.chatRoomIcon}>
          <Hash size={16} color={colors.slate500} />
        </View>
        <View style={styles.chatRoomInfo}>
          <Text style={styles.chatRoomTitle}>{room.title}</Text>
          <Text style={styles.chatRoomDesc} numberOfLines={1}>{room.description}</Text>
        </View>
        <CountdownBadge expiry={room.expiry} />
      </View>
      {room.last_message && (
        <View style={styles.lastMessage}>
          <Text style={styles.lastMessageText} numberOfLines={1}>
            <Text style={{ fontWeight: fontWeight.semibold }}>
              {room.last_message.sender?.name?.split(' ')[0]}:
            </Text>{' '}
            {room.last_message.text}
          </Text>
        </View>
      )}
      <View style={styles.chatRoomFooter}>
        <AvatarStack initials={participantInitials} max={5} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><MessageCircle size={11} color={colors.slate400} /><Text style={styles.msgCount}>{room.unread_count ?? 0}</Text></View>
      </View>
    </Card>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  logo: { fontSize: fontSize.xxxl, fontFamily: 'Inter-ExtraBold', color: colors.slate900, letterSpacing: -0.5 },
  tagline: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.slate100, borderWidth: 1, borderColor: colors.slate200,
    alignItems: 'center', justifyContent: 'center',
  },

  subTabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },

  feed: { flex: 1 },
  feedContent: { padding: spacing.lg, gap: 12 },

  // Ride card
  rideCard: { padding: spacing.lg, gap: 12 },
  rideTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rideTitleArea: { flex: 1 },
  rideTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blue100, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  rideTypeBadgeText: { fontSize: fontSize.xs, color: colors.blue700, fontWeight: fontWeight.medium },
  rideTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  rideMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip: { fontSize: fontSize.xs, color: colors.slate400 },
  metaChipRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  rsvpBtnOutline: { backgroundColor: colors.white, borderColor: colors.slate200 },
  rsvpBtnInActive: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  rsvpBtnOutActive: { backgroundColor: colors.red500, borderColor: colors.red500 },
  rsvpBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  rsvpBtnTextActive: { color: colors.white },
  rsvpBtnTextInactive: { color: colors.slate400 },

  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg,
  },
  chatBtnText: { fontSize: fontSize.sm, color: colors.slate600, fontWeight: fontWeight.semibold },
  chatBtnArrow: { fontSize: 18, color: colors.slate300 },

  rideFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100,
  },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  organizerName: { fontSize: fontSize.xs, color: colors.slate400 },

  // Chat room card
  chatRoomCard: { padding: spacing.lg, gap: 10 },
  chatRoomTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatRoomIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.slate100,
    alignItems: 'center', justifyContent: 'center',
  },
  chatRoomInfo: { flex: 1, minWidth: 0 },
  chatRoomTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate900 },
  chatRoomDesc: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 1 },
  lastMessage: {
    backgroundColor: colors.slate50, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.slate100,
  },
  lastMessageText: { fontSize: fontSize.xs, color: colors.slate500 },
  chatRoomFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgCount: { fontSize: fontSize.xs, color: colors.slate400 },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white,
  },
  postBtn: {
    backgroundColor: colors.blue500, borderRadius: radius.xl,
    paddingVertical: 14, alignItems: 'center',
    ...shadow.blue,
  },
  postBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: fontWeight.bold },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.blue500,
  },
})
