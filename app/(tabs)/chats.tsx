import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable,
  RefreshControl, AppState, Alert, Modal, ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { refetchAndNotifyTabUnread } from '../../src/lib/tabUnreadStore'
import { useRides, useChatRooms } from '../../src/hooks/useData'
import { Avatar, AvatarStack, CountdownBadge, EmptyState, Pill, Card } from '../../src/components/ui'
import { RouteMap } from '../../src/components/RouteMap'
import { supabase, Ride, ChatRoom } from '../../src/lib/supabase'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { fmtTime } from '../../src/lib/utils'
import { Bike, Calendar, Clock, Zap, MapPin, Check, X, MessageCircle, ChevronRight, Plus, Hash, MoreVertical, Pencil, Trash2 } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { registerForPushNotifications, saveFcmToken } from '../../src/lib/notifications'

export default function ChatsScreen() {
  const { user, profile } = useAuth()
  const { rides, loading: ridesLoading, refetch: refetchRides, refetchSilent: refetchRidesSilent } = useRides()
  const { rooms, loading: roomsLoading, refetch: refetchRooms, refetchSilent: refetchRoomsSilent } = useChatRooms()
  const [sub, setSub] = useState<'rides' | 'general'>('rides')
  const [refreshing, setRefreshing] = useState(false)
  const scrollRef = React.useRef<ScrollView | null>(null)

  // Trigger native push permission prompt once after install, after home screen mounts
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const run = async () => {
      try {
        const key = 'velochat_push_permission_requested_v1'
        const already = await AsyncStorage.getItem(key)
        if (already === 'yes' || cancelled) return
        const token = await registerForPushNotifications()
        await AsyncStorage.setItem(key, 'yes')
        if (token && !cancelled) {
          await saveFcmToken(user.id, token)
        }
      } catch (e) {
        console.warn('Push registration failed:', e)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // When app returns from background: refresh tab badge only (no feed remount to avoid breaking state)
  useEffect(() => {
    if (!user?.id) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      timeoutId = setTimeout(() => {
        timeoutId = null
        refetchAndNotifyTabUnread(user.id)
      }, 2000)
    })
    return () => {
      sub.remove()
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [user?.id])

  // Whenever the Chats tab/screen gains focus (including after returning from a chat room),
  // refresh rides + rooms and the tab bar unread dot.
  useFocusEffect(
    useCallback(() => {
      let isActive = true
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      let pollId: ReturnType<typeof setInterval> | null = null
      const POLL_MS = 15000 // Fallback: refresh list every 15s when realtime doesn't fire (e.g. iOS)
      const run = async () => {
        await Promise.all([refetchRides(), refetchRooms()])
        if (isActive && scrollRef.current) {
          scrollRef.current.scrollTo({ y: 0, animated: true })
        }
        if (user?.id) {
          refetchAndNotifyTabUnread(user.id)
          timeoutId = setTimeout(() => refetchAndNotifyTabUnread(user.id), 500)
        }
      }
      run()
      pollId = setInterval(() => {
        refetchRides()
        refetchRooms()
        if (user?.id) refetchAndNotifyTabUnread(user.id)
      }, POLL_MS)
      return () => {
        isActive = false
        if (timeoutId != null) clearTimeout(timeoutId)
        if (pollId != null) clearInterval(pollId)
      }
    }, [refetchRides, refetchRooms, user?.id]),
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([refetchRides(), refetchRooms()])
    setRefreshing(false)
  }

  const initialLoading = (ridesLoading || roomsLoading) && rides.length === 0 && rooms.length === 0

  return (
    <LinearGradient
      colors={['#E8ECF1', '#F1F5F9', '#F8FAFC']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            <Text style={{ color: colors.blue500 }}>Velo</Text>Chat
          </Text>
        </View>
      </View>

      {/* Feed */}
      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={[styles.feedContent, initialLoading && styles.feedContentLoading]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue500} />}
      >
        {initialLoading
          ? <View style={[styles.spinnerWrap, { minHeight: 280 }]}><ActivityIndicator size="large" color={colors.blue500} /></View>
          : rides.length === 0
            ? <EmptyState icon={<Bike size={36} color={colors.slate400} />} text="No rides posted yet" />
            : rides.map(ride => (
              <RideCard
                key={ride.id}
                ride={ride}
                onRideDeleted={refetchRides}
                disableChatNavigation={initialLoading}
              />
            ))}
        {!initialLoading && <View style={{ height: 24 }} />}
      </ScrollView>

      {/* Floating Post button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={1}
        onPress={() => router.push('/new-ride')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Plus size={18} color={colors.white} />
          <Text style={styles.postBtnText}>Post Ride</Text>
        </View>
      </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── Ride Card ────────────────────────────────────────────────

export function RideCard({ ride, onRideDeleted, disableChatNavigation }: { ride: Ride; onRideDeleted?: () => void; disableChatNavigation?: boolean }) {
  const { user, profile } = useAuth()
  const [localRsvps, setLocalRsvps] = useState(ride.rsvps ?? [])
  const [openingChat, setOpeningChat] = useState(false)
  React.useEffect(() => {
    setLocalRsvps(ride.rsvps ?? [])
  }, [ride.rsvps])
  const myRsvp = localRsvps.find(r => r.user_id === user?.id)
  const inCount = localRsvps.filter(r => r.status === 'in').length
  const outCount = localRsvps.filter(r => r.status === 'out').length
  const isIn = myRsvp?.status === 'in'
  const isOut = myRsvp?.status === 'out'
  const inAvatarItems = localRsvps
    .filter(r => r.status === 'in')
    .map(r => ({
      initials: r.profile?.avatar_initials ?? '?',
      color: r.profile?.avatar_color,
      uri: r.profile?.avatar_url,
    }))
  const unreadCount = ride.chat_room?.unread_count ?? 0

  // Keep local RSVPs in sync when ride data (including avatar colours) refreshes
  React.useEffect(() => {
    setLocalRsvps(ride.rsvps ?? [])
  }, [ride.rsvps])
  const [showRsvpDrawer, setShowRsvpDrawer] = useState(false)
  const [rideMenuOpen, setRideMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuBtnRef = useRef<View | null>(null)

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setMenuPos({ top: y + h + 4, right: 16 })
      setRideMenuOpen(true)
    })
  }
  const inRsvps = localRsvps.filter(r => r.status === 'in')

  // Realtime subscription for this ride's RSVPs so other riders'
  // "I'm In / I'm Out" changes appear without manual refresh.
  React.useEffect(() => {
    if (!ride.id) return

    const channel = supabase
      .channel(`ride-rsvps:${ride.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ride_rsvps',
        filter: `ride_id=eq.${ride.id}`,
      }, async () => {
        const { data } = await supabase
          .from('ride_rsvps')
          .select('*, profile:profiles(id, name, avatar_initials, avatar_color, avatar_url)')
          .eq('ride_id', ride.id)
        setLocalRsvps(data ?? [])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ride.id])

  const handleOpenChat = async () => {
    if (disableChatNavigation) {
      Alert.alert('Loading', 'Please wait until the app has finished loading before opening ride chats.')
      return
    }
    if (openingChat) return
    setOpeningChat(true)
    try {
      await _openChat()
    } finally {
      setOpeningChat(false)
    }
  }

  const _openChat = async () => {
    // If we already have the chat room (e.g. from list), navigate immediately so we don't block on slow network after resume
    if (ride.chat_room?.id) {
      router.push(`/chat/${ride.chat_room.id}`)
      return
    }

    const OPEN_CHAT_TIMEOUT_MS = 8000
    const timeoutPromise = new Promise<{ latestRide: { chat_expiry: string } | null; roomId: string | null }>((_, rej) =>
      setTimeout(() => rej(new Error('timeout')), OPEN_CHAT_TIMEOUT_MS)
    )

    const fetchLatest = async () => {
      const { data: latestRide } = await supabase
        .from('rides')
        .select('id, chat_expiry')
        .eq('id', ride.id)
        .maybeSingle()
      if (!latestRide) return { latestRide: null, roomId: null }
      const now = new Date().toISOString()
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('ride_id', ride.id)
        .eq('type', 'ride')
        .gt('expiry', now)
        .maybeSingle()
      return { latestRide, roomId: room?.id ?? null }
    }

    let latestRide: { chat_expiry: string } | null = null
    let roomId: string | null = null
    try {
      const result = await Promise.race([fetchLatest(), timeoutPromise])
      latestRide = result.latestRide
      roomId = result.roomId
    } catch (e) {
      if (e instanceof Error && e.message === 'timeout') {
        Alert.alert('Connection slow', 'Please try again or pull to refresh the list.')
      }
      return
    }

    if (roomId) {
      router.push(`/chat/${roomId}`)
      return
    }

    if (!latestRide) {
      Alert.alert('Ride no longer available', 'This ride has been removed.')
      return
    }

    // If no chat room exists yet and you're the organiser, create it on demand
    if (user && ride.organizer_id === user.id) {
      try {
        const { data: room, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            title: ride.title,
            type: 'ride',
            ride_id: ride.id,
            club_id: ride.club_id ?? null,
            created_by: user.id,
            expiry: latestRide.chat_expiry,
          })
          .select()
          .single()

        if (createError || !room) {
          console.error('Failed to create ride chat room:', createError?.message)
          Alert.alert('Ride chat unavailable', 'Unable to create a chat for this ride.')
          return
        }

        const participantIds = new Set<string>()
        participantIds.add(user.id)
        ;(ride.rsvps ?? []).forEach(r => {
          if (r.user_id) participantIds.add(r.user_id)
        })
        if (ride.club_id) {
          const { data: clubMembers } = await supabase
            .from('club_members')
            .select('user_id')
            .eq('club_id', ride.club_id)
          ;(clubMembers ?? []).forEach(m => {
            if (m.user_id) participantIds.add(m.user_id)
          })
        }
        const participantsPayload = Array.from(participantIds).map(id => ({
          room_id: room.id,
          user_id: id,
        }))
        if (participantsPayload.length > 0) {
          await supabase.from('chat_participants').insert(participantsPayload)
        }
        router.push(`/chat/${room.id}`)
        return
      } catch (e) {
        console.error('Unexpected error creating ride chat room:', e)
        Alert.alert('Ride chat unavailable', 'Unable to create a chat for this ride.')
        return
      }
    }

    Alert.alert('Ride chat unavailable', 'This ride does not have an active chat room.')
  }

  const handleRsvp = async (status: 'in' | 'out') => {
    if (!user) return
    const newStatus = myRsvp?.status === status ? null : status
    const prevRsvps = [...localRsvps]

    setLocalRsvps(prev => {
      const without = prev.filter(r => r.user_id !== user.id)
      if (!newStatus) return without
      return [...without, {
        user_id: user.id,
        status: newStatus,
        profile: {
          id: user.id,
          name: profile?.name ?? user.user_metadata?.name,
          avatar_initials: profile?.avatar_initials ?? user.user_metadata?.avatar_initials ?? '?',
          avatar_color: profile?.avatar_color ?? user.user_metadata?.avatar_color ?? '#3B82F6',
          avatar_url: profile?.avatar_url,
        },
      } as any]
    })

    try {
      if (newStatus) {
        const { error } = await supabase.from('ride_rsvps').upsert(
          { ride_id: ride.id, user_id: user.id, status: newStatus },
          { onConflict: 'ride_id,user_id' }
        )
        if (error) throw error
        // Add user to ride chat participants so they receive push notifications
        const { data: chatRoom } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('ride_id', ride.id)
          .maybeSingle()
        if (chatRoom?.id) {
          await supabase.from('chat_participants').upsert(
            { room_id: chatRoom.id, user_id: user.id },
            { onConflict: 'room_id,user_id' }
          )
        }
      } else {
        const { error } = await supabase.from('ride_rsvps').delete()
          .eq('ride_id', ride.id).eq('user_id', user.id)
        if (error) throw error
      }
    } catch {
      setLocalRsvps(prevRsvps)
      Alert.alert('Error', 'Failed to update RSVP. Please try again.')
    }
  }

  return (
    <Card style={styles.rideCard}>
      {/* Top row */}
      <View style={styles.rideTop}>
        <View style={styles.rideTitleArea}>
          <Text style={styles.rideTitle}>{ride.title}</Text>
          <View style={styles.rideMeta}>
            {ride.date && <View style={styles.metaChipRow}><Calendar size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.date}</Text></View>}
            <View style={styles.metaChipRow}><Clock size={11} color={colors.slate400} /><Text style={styles.metaChip}>{fmtTime(ride.time)}</Text></View>
            {ride.distance && <View style={styles.metaChipRow}><Zap size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.distance}</Text></View>}
            {ride.location && <View style={styles.metaChipRow}><MapPin size={11} color={colors.slate400} /><Text style={styles.metaChip}>{ride.location}</Text></View>}
          </View>
        </View>
        {(ride.organizer_id === user?.id) && (
          <View style={styles.rideMenuWrap}>
            <View ref={menuBtnRef} collapsable={false}>
              <TouchableOpacity onPress={() => rideMenuOpen ? setRideMenuOpen(false) : openMenu()} style={styles.rideEditChatBtn} activeOpacity={0.7}>
                <MoreVertical size={20} color={colors.slate400} />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
        onPress={handleOpenChat}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MessageCircle size={14} color={colors.slate600} />
          <Text style={styles.chatBtnText}>Ride Chat</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color={colors.slate300} />
        </View>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.rideFooter}>
        {ride.organizer && (
          <View style={styles.organizerRow}>
            <Avatar
              initials={ride.organizer.avatar_initials}
              color={ride.organizer.avatar_color}
              uri={ride.organizer.avatar_url}
              size="sm"
            />
            <Text style={styles.organizerName}>{ride.organizer_id === user?.id ? 'You' : ride.organizer?.name}</Text>
          </View>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowRsvpDrawer(true)}
        >
          {/* Show up to 10 riders, rest collapsed into +X avatar */}
          <AvatarStack avatars={inAvatarItems} max={10} />
        </TouchableOpacity>
      </View>

      <Modal visible={rideMenuOpen} transparent animationType="none" onRequestClose={() => setRideMenuOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setRideMenuOpen(false)}>
          <View style={[styles.rideDropdown, { position: 'absolute', top: menuPos.top, right: menuPos.right }]}>
            <TouchableOpacity
              style={styles.rideDropdownItem}
              onPress={() => {
                setRideMenuOpen(false)
                if (ride.chat_room) {
                  router.push(`/edit-chat/${ride.chat_room.id}`)
                }
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pencil size={14} color={colors.slate700} />
                <Text style={styles.rideDropdownText}>Edit ride</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.rideDropdownDivider} />
            <TouchableOpacity
              style={styles.rideDropdownItem}
              onPress={() => {
                setRideMenuOpen(false)
                Alert.alert('Delete Ride', `Delete "${ride.title}"? This cannot be undone.`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await supabase.rpc('delete_ride', { p_ride_id: ride.id })
                      onRideDeleted?.()
                    },
                  },
                ])
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={14} color={colors.red600} />
                <Text style={[styles.rideDropdownText, styles.rideDropdownDanger]}>Delete</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* RSVPs drawer */}
      <Modal
        visible={showRsvpDrawer}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRsvpDrawer(false)}
      >
        <SafeAreaView style={styles.rsvpDrawerContainer} edges={['top']}>
          <View style={styles.rsvpDrawerHandle} />
          <View style={styles.rsvpDrawerHeader}>
            <Text style={styles.rsvpDrawerTitle}>Riders ({inRsvps.length})</Text>
            <TouchableOpacity onPress={() => setShowRsvpDrawer(false)} style={styles.rsvpDrawerClose}>
              <Text style={styles.rsvpDrawerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.rsvpDrawerContent}>
            {inRsvps.length === 0 && (
              <Text style={styles.rsvpDrawerEmpty}>No RSVPs yet.</Text>
            )}
            {inRsvps.map(r => (
              <View key={r.user_id} style={styles.rsvpDrawerRow}>
                <Avatar
                  initials={r.profile?.avatar_initials ?? '?'}
                  color={r.profile?.avatar_color}
                  uri={r.profile?.avatar_url}
                  size="sm"
                />
                <View style={styles.rsvpDrawerInfo}>
                  <Text style={styles.rsvpDrawerName}>{r.user_id === user?.id ? 'You' : (r.profile?.name ?? 'Unknown rider')}</Text>
                </View>
                <View style={[
                  styles.rsvpDrawerStatus,
                  r.status === 'in' ? styles.rsvpDrawerStatusIn : styles.rsvpDrawerStatusOut,
                ]}
                >
                  <Text style={styles.rsvpDrawerStatusText}>
                    {r.status === 'in' ? "I'm In" : "I'm Out"}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Card>
  )
}

// ─── Chat Room Card ───────────────────────────────────────────

function ChatRoomCard({ room }: { room: ChatRoom }) {
  const { user } = useAuth()
  const participantInitials = (room.participants ?? []).map(p => p.avatar_initials)
  const lastSenderName = room.last_message
    ? (room.last_message.sender_id === user?.id ? 'You' : room.last_message.sender?.name?.split(' ')[0])
    : null

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
      {room.last_message && lastSenderName && (
        <View style={styles.lastMessage}>
          <Text style={styles.lastMessageText} numberOfLines={1}>
            <Text style={{ fontWeight: fontWeight.semibold }}>
              {lastSenderName}:
            </Text>{' '}
            {room.last_message.text}
          </Text>
        </View>
      )}
      <View style={styles.chatRoomFooter}>
        <AvatarStack initials={participantInitials} max={6} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {room.unread_count && room.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {room.unread_count > 9 ? '9+' : room.unread_count}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color={colors.slate300} />
        </View>
      </View>
    </Card>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: 'transparent',
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

  feed: { flex: 1, backgroundColor: 'transparent' },
  feedContent: { padding: spacing.lg, gap: 12 },
  feedContentLoading: { flexGrow: 1 },

  // Ride card
  rideCard: { padding: spacing.lg, gap: 12 },
  rideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rideTitleArea: { flex: 1, minWidth: 0 },
  rideMenuWrap: { position: 'relative' },
  rideEditChatBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  rideDropdown: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
    ...shadow.lg, minWidth: 170,
  },
  rideDropdownItem: { paddingHorizontal: 16, paddingVertical: 13 },
  rideDropdownText: { fontSize: fontSize.base, color: colors.slate700 },
  rideDropdownDanger: { color: colors.red600 },
  rideDropdownDivider: { height: 1, backgroundColor: colors.slate100 },
  rideTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.slate900 },
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
  chatRoomTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.slate900 },
  chatRoomDesc: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 1 },
  lastMessage: {
    backgroundColor: colors.slate50, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.slate100,
  },
  lastMessageText: { fontSize: fontSize.xs, color: colors.slate500 },
  chatRoomFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgCount: { fontSize: fontSize.xs, color: colors.slate400 },

  // Floating action button
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg + 4,
    paddingHorizontal: 18,
    height: 45,
    borderRadius: radius.xl,
    backgroundColor: colors.blue600, // slightly darker on press handled via ripple/opacity
    alignItems: 'center',
    justifyContent: 'center',
    // Soft neutral shadow so the pill feels like it's floating
    ...shadow.lg,
  },
  postBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  // RSVP drawer
  rsvpDrawerContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  rsvpDrawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate200,
    alignSelf: 'center',
    marginTop: 10,
  },
  rsvpDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  rsvpDrawerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.slate900,
  },
  rsvpDrawerClose: {
    position: 'absolute',
    right: spacing.lg,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rsvpDrawerCloseText: {
    fontSize: fontSize.sm,
    color: colors.blue500,
    fontWeight: fontWeight.semibold,
  },
  rsvpDrawerContent: {
    padding: spacing.lg,
    
    gap: 10,
  },
  rsvpDrawerEmpty: {
    fontSize: fontSize.sm,
    color: colors.slate400,
    
  },
  rsvpDrawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    
    gap: 10,
    paddingVertical: 8,
  },
  rsvpDrawerInfo: {
    flex: 1,
    
    
  },
  rsvpDrawerName: {
    fontSize: fontSize.base,
    color: colors.slate900,
    fontWeight: fontWeight.semibold,
  },
  rsvpDrawerStatus: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rsvpDrawerStatusIn: {
    backgroundColor: colors.blue100,
  },
  rsvpDrawerStatusOut: {
    backgroundColor: colors.slate100,
  },
  rsvpDrawerStatusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.slate700,
  },
})
