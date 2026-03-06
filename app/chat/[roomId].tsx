import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  Keyboard, Pressable, Modal, Animated, ActivityIndicator, Image,
  Dimensions,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { useMessages } from '../../src/hooks/useData'
import { supabase, ChatRoom, Message } from '../../src/lib/supabase'

type ChatRoomWithClub = ChatRoom & {
  club?: { id: string; name: string; avatar_url?: string | null; avatar_initials?: string; color?: string } | null
}
type ChatAvatarStackItem = { initials: string; color?: string; uri?: string | null }
import { Avatar, AvatarStack } from '../../src/components/ui'
import { RouteMap } from '../../src/components/RouteMap'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { fmtMessageTime, fmtTime } from '../../src/lib/utils'
import { ChevronLeft, MoreVertical, Pencil, Trash2, MessageCircle, Send, Paperclip, X } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'

// On iOS, custom fonts (e.g. Inter) don't include emoji; use system font so emoji render.
const iosEmojiFont = Platform.OS === 'ios' ? { fontFamily: 'System' as const } : {}

const QUICK_REPLIES_RIDE = [
  { label: '✅ I\'m In!', text: 'I\'m in!' },
  { label: '❌ I\'m Out', text: 'I\'m out, can\'t make it.' },
  { label: '🔥 Let\'s ride!', text: 'Let\'s ride! 🔥' },
  { label: '⏱ Running late', text: 'Running a few minutes late!' },
  { label: '📍 Meet point?', text: 'Where are we meeting up?' },
]

const QUICK_REPLIES_GENERAL = [
  { label: '👋 Hey!', text: 'Hey everyone!' },
  { label: '🚴 Anyone riding?', text: 'Anyone riding this weekend?' },
  { label: '🔥 Let\'s go!', text: 'Let\'s go! 🔥' },
  { label: '📍 Where?', text: 'Where are we meeting?' },
]

export default function ChatScreen() {
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string | string[] }>()
  const rawRoomId = typeof roomIdParam === 'string' ? roomIdParam : roomIdParam?.[0]
  const roomId = typeof rawRoomId === 'string' && rawRoomId.trim() ? rawRoomId.trim() : undefined
  const { user, profile, loading: authLoading } = useAuth()

  // Invalid or missing roomId (e.g. from old notification with lost payload) → go back
  useEffect(() => {
    if (!authLoading && !roomId) {
      router.back()
    }
  }, [authLoading, roomId])
  const { messages, loading, sendMessage, sendImage } = useMessages(roomId ?? '')
  const [room, setRoom] = useState<ChatRoomWithClub | null>(null)
  const [headerTitle, setHeaderTitle] = useState('...')
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [rideRoute, setRideRoute] = useState<{ polyline: string; distanceKm?: number; elevationGainM?: number; name?: string } | null>(null)
  const [rideDetail, setRideDetail] = useState<{ time?: string; location?: string; date?: string } | null>(null)
  const [rideInAvatars, setRideInAvatars] = useState<ChatAvatarStackItem[]>([])
  const listRef = useRef<FlatList | null>(null)
  const inputRef = useRef<TextInput | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const hasInitialScrolledRef = useRef(false)
  const isNearBottomRef = useRef(true)
  const lastMarkAsReadRef = useRef(0)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true),
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false),
    )
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // Reset initial-scroll flag when entering a different room so we scroll to bottom on enter
  useEffect(() => {
    hasInitialScrolledRef.current = false
  }, [roomId])

  const loadRoom = useCallback(async () => {
    if (!roomId || !user) return

    // RPC upserts participant and sets last_read_at = now(), is_active = true (not blocked by RLS)
    await supabase.rpc('set_chat_participant_active', { p_room_id: roomId, p_active: true })

    if (!room) setHeaderTitle('...')

    const { data, error } = await supabase
      .from('chat_rooms')
      .select('*, participants:chat_participants(user_id, profile:profiles(id,name,avatar_initials,avatar_color,avatar_url)), club:clubs(id, name, avatar_url, avatar_initials, color)')
      .eq('id', roomId)
      .maybeSingle()

    if (error || !data) {
      console.error('Failed to load room:', error?.message ?? 'Room not found')
      Alert.alert(
        'Ride no longer available',
        'This ride or chat room is no longer available.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
      return
    }

    if (data.expiry && new Date(data.expiry).getTime() <= Date.now()) {
      await supabase.rpc('delete_expired_chat_rooms')
      Alert.alert(
        'Chat expired',
        'This chat has expired and has been removed.',
        [{ text: 'OK', onPress: () => router.back() }],
      )
      return
    }

    setRoom(data)
    if (data?.title) setHeaderTitle(data.title)

    // For ride chats, pull route + keep title in sync with ride title + time/location for message body
    if (data?.ride_id) {
      const { data: ride } = await supabase
        .from('rides')
        .select('route_polyline, route_distance_km, route_elevation_m, route_name, title, time, location, date, rsvps:ride_rsvps(status, profile:profiles(id, name, avatar_initials, avatar_color, avatar_url))')
        .eq('id', data.ride_id)
        .single()

      if (ride?.route_polyline) {
        setRideRoute({
          polyline: ride.route_polyline,
          distanceKm: ride.route_distance_km,
          elevationGainM: ride.route_elevation_m,
          name: ride.route_name,
        })
      }
      if (ride?.title) {
        setHeaderTitle(ride.title)
      }
      setRideDetail({
        time: ride?.time,
        location: ride?.location,
        date: ride?.date,
      })
      const inItems =
        (ride?.rsvps ?? [])
          .filter((r: any) => r.status === 'in')
          .map((r: any) => ({
            initials: r.profile?.avatar_initials ?? '?',
            color: r.profile?.avatar_color,
            uri: r.profile?.avatar_url,
          }))
      setRideInAvatars(inItems)
    } else {
      setRideDetail(null)
      setRideInAvatars([])
    }
  }, [roomId, user])

  const refetchRideRsvps = useCallback(async (rideId: string) => {
    const { data } = await supabase
      .from('ride_rsvps')
      .select('status, profile:profiles(id, name, avatar_initials, avatar_color, avatar_url)')
      .eq('ride_id', rideId)
    const inItems = (data ?? [])
      .filter((r: any) => r.status === 'in')
      .map((r: any) => ({
        initials: r.profile?.avatar_initials ?? '?',
        color: r.profile?.avatar_color,
        uri: r.profile?.avatar_url,
      }))
    setRideInAvatars(inItems)
  }, [])

  // Realtime: when anyone (including self) changes RSVP for this ride, refresh message-body avatars
  useEffect(() => {
    const rideId = room?.ride_id
    if (!rideId) return
    const channel = supabase
      .channel(`chat-ride-rsvps:${rideId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ride_rsvps',
        filter: `ride_id=eq.${rideId}`,
      }, () => refetchRideRsvps(rideId))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.ride_id, refetchRideRsvps])

  const markAsRead = useCallback(async () => {
    if (!roomId) return
    await supabase.rpc('set_chat_participant_last_read', { p_room_id: roomId })
  }, [roomId])

  useFocusEffect(
    useCallback(() => {
      loadRoom()
      return () => {
        // Mark the user as no longer viewing so they receive push notifications again
        if (roomId && user) {
          supabase.rpc('set_chat_participant_active', { p_room_id: roomId, p_active: false }).then(() => {})
        }
      }
    }, [loadRoom, roomId, user]),
  )

  // When opened from an old notification, auth may not be ready yet; load room once user becomes available
  useEffect(() => {
    if (roomId && user && !room && !authLoading) {
      loadRoom()
    }
  }, [roomId, user, room, authLoading, loadRoom])

  const isOwner = room?.created_by === user?.id
  const isRide = room?.type === 'ride'
  const quickReplies = isRide ? QUICK_REPLIES_RIDE : QUICK_REPLIES_GENERAL

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const handleQuickReply = async (text: string) => {
    if (!text.trim()) return
    const trimmed = text.trim()
    await sendMessage(trimmed)
    // When user taps "I'm In!", "Let's ride!", or "I'm Out" in a ride chat, update ride_rsvps so it reflects on the ride card and message-body avatars
    if (isRide && room?.ride_id && user?.id) {
      if (trimmed === "I'm in!" || trimmed === "Let's ride! 🔥") {
        await supabase.from('ride_rsvps').upsert(
          { ride_id: room.ride_id, user_id: user.id, status: 'in' },
          { onConflict: 'ride_id,user_id' }
        )
      } else if (trimmed === "I'm out, can't make it.") {
        await supabase.from('ride_rsvps').upsert(
          { ride_id: room.ride_id, user_id: user.id, status: 'out' },
          { onConflict: 'ride_id,user_id' }
        )
      }
      // Refresh RSVP avatars in message body so they update immediately
      refetchRideRsvps(room.ride_id)
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    inputRef.current?.blur()
  }

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to attach images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    setUploading(true)
    try {
      await sendImage(result.assets[0].uri)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } finally {
      setUploading(false)
    }
  }

  // When keyboard opens, scroll to bottom so latest messages are visible
  useEffect(() => {
    if (keyboardOpen) {
      const id = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true })
      }, 150)
      return () => clearTimeout(id)
    }
  }, [keyboardOpen])

  const handleEdit = () => {
    setMenuOpen(false)
    router.push(`/edit-chat/${roomId}`)
  }

  const handleDelete = () => {
    setMenuOpen(false)
    Alert.alert(
      'Delete Chat Room',
      `Delete "${room?.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            if (room?.ride_id) {
              await supabase.rpc('delete_ride', { p_ride_id: room.ride_id })
            } else {
              await supabase.from('chat_rooms').delete().eq('id', roomId)
            }
            router.replace('/(tabs)/chats')
          },
        },
      ]
    )
  }

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isMe = msg.sender_id === user?.id
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <Avatar
            initials={msg.sender?.avatar_initials ?? '?'}
            color={msg.sender?.avatar_color}
            uri={msg.sender?.avatar_url}
            size="sm"
          />
        )}
        <View style={[styles.msgBubbleWrap, isMe && styles.msgBubbleWrapMe]}>
          <Text style={styles.msgSender}>{isMe ? 'You' : (msg.sender?.name ?? 'Unknown')}</Text>
          {msg.image_url ? (
            <Pressable
              style={[styles.msgImageBubble, isMe ? styles.msgImageBubbleMe : styles.msgImageBubbleThem]}
              onPress={() => setFullScreenImageUri(msg.image_url ?? null)}
            >
              <Image source={{ uri: msg.image_url }} style={styles.msgImage} resizeMode="cover" />
            </Pressable>
          ) : (
            <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
              <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem, iosEmojiFont]}>
                {msg.text}
              </Text>
            </View>
          )}
          <Text style={styles.msgTime}>{fmtMessageTime(msg.created_at)}</Text>
        </View>
      </View>
    )
  }

  // Block entry while auth state is still resolving, or if we have no room id
  if (authLoading || !roomId) {
    return (
      <SafeAreaView style={styles.spinnerWrap} edges={['top']}>
        <ActivityIndicator size="large" color={colors.blue500} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Modal
        visible={!!fullScreenImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImageUri(null)}
      >
        <Pressable style={styles.fullScreenImageOverlay} onPress={() => setFullScreenImageUri(null)}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => {}}>
            <Image
              source={{ uri: fullScreenImageUri ?? '' }}
              style={[styles.fullScreenImage, { width: screenWidth, height: screenHeight }]}
              resizeMode="contain"
            />
          </Pressable>
          <TouchableOpacity
            style={[styles.fullScreenCloseBtn, { top: insets.top + 8 }]}
            onPress={() => setFullScreenImageUri(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={28} color={colors.white} />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.uploadingText}>Uploading…</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {room?.club && (
            <Avatar
              initials={room.club.avatar_initials ?? (room.club.name?.slice(0, 2).toUpperCase() ?? 'CL')}
              size="sm"
              color={room.club.color}
              uri={room.club.avatar_url}
            />
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
            {isRide && (
              <Text style={styles.headerRiderCount} numberOfLines={1}>
                {rideInAvatars.length} {rideInAvatars.length === 1 ? 'rider' : 'riders'} going
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {isOwner && (
            <View style={styles.menuWrap}>
              <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={styles.menuBtn}>
                <MoreVertical size={20} color={colors.slate400} />
              </TouchableOpacity>
              {menuOpen && (
                <View style={styles.dropdown}>
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleEdit}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pencil size={14} color={colors.slate700} />
                      <Text style={styles.dropdownText}>Edit {isRide ? 'Ride' : 'Chat Room'}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleDelete}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Trash2 size={14} color={colors.red600} />
                      <Text style={[styles.dropdownText, styles.dropdownDanger]}>Delete</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {menuOpen && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          onPress={() => setMenuOpen(false)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.body}>
          <MessageList
            messages={messages}
            loading={loading}
            roomTitle={room?.title ?? headerTitle}
            roomExpiry={room?.expiry ?? null}
            rideRoute={rideRoute}
            rideDetail={rideDetail}
            rideInAvatars={rideInAvatars}
            isRide={isRide}
            listRef={listRef}
            renderMessage={renderMessage}
            keyboardOpen={keyboardOpen}
            isNearBottomRef={isNearBottomRef}
            hasInitialScrolledRef={hasInitialScrolledRef}
            onMarkAsRead={markAsRead}
            lastMarkAsReadRef={lastMarkAsReadRef}
          />
          <ChatComposer
            quickReplies={quickReplies}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onQuickReply={handleQuickReply}
            onPickImage={handlePickImage}
            inputRef={inputRef}
            keyboardOpen={keyboardOpen}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const MARK_AS_READ_THROTTLE_MS = 2000

function ChatExpiryText({ expiry }: { expiry: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiry).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(`${h}h ${m}m`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [expiry])
  return <Text style={styles.expiryNoticeText}>{remaining}</Text>
}

type MessageListProps = {
  messages: Message[]
  loading: boolean
  roomTitle?: string
  roomExpiry: string | null
  rideRoute: { polyline: string; distanceKm?: number; elevationGainM?: number; name?: string } | null
  rideDetail: { time?: string; location?: string; date?: string } | null
  rideInAvatars: ChatAvatarStackItem[]
  isRide: boolean
  listRef: React.RefObject<FlatList | null>
  renderMessage: ({ item }: { item: Message }) => React.ReactElement
  keyboardOpen: boolean
  isNearBottomRef: React.MutableRefObject<boolean>
  hasInitialScrolledRef: React.MutableRefObject<boolean>
  onMarkAsRead?: () => void
  lastMarkAsReadRef?: React.MutableRefObject<number>
}

function MessageList({ messages, loading, roomTitle, roomExpiry, rideRoute, rideDetail, rideInAvatars, isRide, listRef, renderMessage, keyboardOpen, isNearBottomRef, hasInitialScrolledRef, onMarkAsRead, lastMarkAsReadRef }: MessageListProps) {
  const hasMeta = rideDetail?.date || rideDetail?.time || rideDetail?.location
  const metaParts: string[] = []
  if (rideDetail?.date) metaParts.push(rideDetail.date)
  if (rideDetail?.time) metaParts.push(fmtTime(rideDetail.time))
  if (rideDetail?.location) metaParts.push(rideDetail.location)
  const rideBodyBlock = isRide && roomTitle ? (
    <View style={styles.rideMessageBody}>
      <Text style={styles.rideMessageBodyTitle} numberOfLines={2}>{roomTitle}</Text>
      {hasMeta ? (
        <Text style={styles.rideMessageBodyMetaText} numberOfLines={1}>{metaParts.join(' · ')}</Text>
      ) : null}
    </View>
  ) : null
  const rideRsvpBlock = isRide && rideInAvatars.length > 0 ? (
    <View style={styles.rideMessageRsvps}>
      <AvatarStack avatars={rideInAvatars} max={6} />
    </View>
  ) : null

  return (
    <FlatList
      ref={listRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={m => m.id}
      style={styles.messageList}
      contentContainerStyle={[
        styles.messageContent,
        { paddingBottom: keyboardOpen ? 20 : 20 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScroll={(e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
        const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
        const nearBottom = distanceFromBottom < 150
        isNearBottomRef.current = nearBottom
        if (nearBottom && onMarkAsRead && lastMarkAsReadRef) {
          const now = Date.now()
          if (now - lastMarkAsReadRef.current > MARK_AS_READ_THROTTLE_MS) {
            lastMarkAsReadRef.current = now
            onMarkAsRead()
          }
        }
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (messages.length === 0) return
        // On enter, scroll to latest message; with many messages FlatList reports size
        // before all items are laid out, so run scrollToEnd several times with delays
        if (!hasInitialScrolledRef.current) {
          hasInitialScrolledRef.current = true
          const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: false })
          scrollToEnd()
          setTimeout(scrollToEnd, 100)
          setTimeout(scrollToEnd, 300)
          setTimeout(scrollToEnd, 600)
          setTimeout(scrollToEnd, 1000)
          return
        }
        if (isNearBottomRef.current) {
          listRef.current?.scrollToEnd({ animated: true })
        }
      }}
      ListHeaderComponent={
        <View>
          {roomExpiry ? (
            <View style={styles.expiryNotice}>
              <Text style={styles.expiryNoticeText}>This ride chat will be removed in </Text>
              <ChatExpiryText expiry={roomExpiry} />
            </View>
          ) : null}
          {rideBodyBlock}
          {rideRsvpBlock}
          {rideRoute && (
            <RouteMap
              polyline={rideRoute.polyline}
              distanceKm={rideRoute.distanceKm}
              elevationGainM={rideRoute.elevationGainM}
              routeName={rideRoute.name}
              size="chat"
              style={styles.chatRouteMap}
            />
          )}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.emptyMessages}>
            {!isRide && roomTitle ? (
              <Text style={styles.emptyMessagesTitle} numberOfLines={2}>{roomTitle}</Text>
            ) : null}
            <MessageCircle size={36} color={colors.slate300} />
            <Text style={styles.emptyMessagesLabel}>No messages yet — say something!</Text>
          </View>
        ) : null
      }
    />
  )
}

type ChatComposerProps = {
  quickReplies: { label: string; text: string }[]
  input: string
  setInput: (val: string) => void
  onSend: () => void
  onQuickReply: (text: string) => Promise<void>
  onPickImage: () => void
  inputRef: React.RefObject<TextInput | null>
  keyboardOpen: boolean
}

function ChatComposer({
  quickReplies,
  input,
  setInput,
  onSend,
  onQuickReply,
  onPickImage,
  inputRef,
  keyboardOpen,
}: ChatComposerProps) {
  return (
    <View style={styles.composer}>
      <View style={styles.quickReplies}>
        <FlatList
          horizontal
          data={quickReplies}
          keyExtractor={q => q.label}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quickReply}
              onPress={() => { onQuickReply(item.text) }}
            >
              <Text style={[styles.quickReplyText, iosEmojiFont]}>{item.label}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
        />
      </View>

      <View style={[styles.inputRow, { paddingBottom: keyboardOpen ? 16 : 24 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={onPickImage}>
          <Paperclip size={20} color={colors.slate500} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={[styles.input, iosEmojiFont]}
            placeholder="Say something..."
            placeholderTextColor={colors.slate400}
            selectionColor={colors.slate800}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSend}
            returnKeyType="send"
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!input.trim()}
        >
          <Send size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kav: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
    backgroundColor: colors.white,
    zIndex: 100, elevation: 0,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitleWrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.slate900 },
  headerRiderCount: { fontSize: fontSize.sm, color: colors.slate500, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  menuWrap: { position: 'relative' },
  menuBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dropdown: {
    position: 'absolute', right: 0, top: 36,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
    ...shadow.lg, zIndex: 99, minWidth: 170,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13 },
  dropdownText: { fontSize: fontSize.base, color: colors.slate700 },
  dropdownDanger: { color: colors.red600 },
  dropdownDivider: { height: 1, backgroundColor: colors.slate100 },

  body: { flex: 1 },

  // Messages
  messageList: { flex: 1, backgroundColor: colors.slate50 },
  messageContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  expiryNotice: {
    alignSelf: 'center',
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  expiryNoticeText: { fontSize: fontSize.xs, color: colors.slate400 },
  chatRouteMap: { marginHorizontal: spacing.lg, marginBottom: 12, borderRadius: 12 },
  rideMessageBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: 4,
  },
  rideMessageRsvps: {
    alignItems: 'center',
    marginBottom: 8,
  },
  rideMessageBodyTitle: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.slate800,
    textAlign: 'center',
  },
  rideMessageBodyMetaText: {
    fontSize: fontSize.md,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyMessages: { alignItems: 'center', paddingVertical: 4, gap: 8 },
  emptyMessagesTitle: {
    fontSize: 24,
    fontWeight: fontWeight.semibold,
    color: colors.slate700,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: 16,
  },
  emptyMessagesLabel: { fontSize: fontSize.sm, color: colors.slate400 },

  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubbleWrap: { maxWidth: '75%', gap: 3 },
  msgBubbleWrapMe: { alignItems: 'flex-end' },
  msgSender: { fontSize: fontSize.sm, color: colors.slate500, paddingLeft: 4 },
  msgBubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
  },
  msgBubbleMe: {
    backgroundColor: colors.blue500,
    borderBottomRightRadius: 4,
  },
  msgBubbleThem: {
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: fontSize.base, lineHeight: 20 },
  msgTextMe: { color: colors.white },
  msgTextThem: { color: colors.slate800 },
  msgTime: { fontSize: 11, color: colors.slate400, paddingHorizontal: 4 },

  // Quick replies
  composer: {
    borderTopWidth: 1, borderTopColor: colors.slate100,
    backgroundColor: colors.white,
  },
  quickReplies: {
    paddingVertical: 10,
  },
  quickReply: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.slate100, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.white,
  },
  quickReplyText: { fontSize: fontSize.xs, color: colors.slate600 },

  // Image messages
  msgImageBubble: {
    width: 220,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
  },
  msgImageBubbleMe: {
    borderBottomRightRadius: 4,
  },
  msgImageBubbleThem: {
    borderBottomLeftRadius: 4,
  },
  msgImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },

  // Full-screen image popup
  fullScreenImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },

  // Input
  attachBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.slate100,
    borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 3,
    minHeight: 50,
    maxHeight: 96,
  },
  input: {
    fontSize: fontSize.base,
    color: colors.slate800,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.blue500, alignItems: 'center', justifyContent: 'center',
    ...shadow.blue,
  },
  sendBtnDisabled: {
    backgroundColor: colors.blue200,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
})
