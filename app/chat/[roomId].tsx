import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  Keyboard, Pressable, Modal, Animated, LayoutAnimation,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { useMessages } from '../../src/hooks/useData'
import { supabase, ChatRoom, Message } from '../../src/lib/supabase'
import { Avatar } from '../../src/components/ui'
import { RouteMap } from '../../src/components/RouteMap'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { fmtMessageTime } from '../../src/lib/utils'
import { ChevronLeft, MoreVertical, Pencil, Trash2, MessageCircle, Send, Timer } from 'lucide-react-native'

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
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const { user, profile } = useAuth()
  const { messages, loading, sendMessage } = useMessages(roomId)
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [rideRoute, setRideRoute] = useState<{ polyline: string; distanceKm?: number; elevationGainM?: number; name?: string } | null>(null)
  const listRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [listHeight, setListHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    const animateTransition = () => {
      LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'))
    }

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => { animateTransition(); setKeyboardOpen(true) }
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        animateTransition()
        setKeyboardOpen(false)
        setInput('') // reset input to initial state when keyboard closes
      }
    )
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // Load room details + mark as read
  useEffect(() => {
    if (!roomId || !user) return
    supabase
      .from('chat_rooms')
      .select('*, participants:chat_participants(user_id, profile:profiles(id,name,avatar_initials,avatar_color))')
      .eq('id', roomId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Failed to load room:', error.message)
        setRoom(data)
        // Mark messages as read for current user
        supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() }).eq('room_id', roomId).eq('user_id', user.id).then(() => {})
        // If this is a ride chat, fetch the ride's route
        if (data?.ride_id) {
          supabase
            .from('rides')
            .select('route_polyline, route_distance_km, route_elevation_m, route_name')
            .eq('id', data.ride_id)
            .single()
            .then(({ data: ride }) => {
              if (ride?.route_polyline) {
                setRideRoute({
                  polyline: ride.route_polyline,
                  distanceKm: ride.route_distance_km,
                  elevationGainM: ride.route_elevation_m,
                  name: ride.route_name,
                })
              }
            })
        }
      })
  }, [roomId, user])

  // Auto-scroll is handled via onContentSizeChange + scroll position tracking

  const isOwner = room?.created_by === user?.id
  const isRide = room?.type === 'ride'
  const quickReplies = isRide ? QUICK_REPLIES_RIDE : QUICK_REPLIES_GENERAL

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    // Always snap to bottom when you send a message yourself
    setTimeout(() => scrollToBottom(), 0)
    Keyboard.dismiss()
    inputRef.current?.blur()
  }

  const handleQuickReply = async (text: string) => {
    if (!text.trim()) return
    await sendMessage(text.trim())
    Keyboard.dismiss()
    inputRef.current?.blur()
  }

  const handleContentSizeChange = (_w: number, h: number) => {
    setContentHeight(h)
    if (messages.length === 0 || !isAtBottom) return
    if (!listRef.current) return
    if (listHeight === 0) {
      listRef.current.scrollToEnd({ animated: false })
      return
    }
    const offset = Math.max(0, h - listHeight)
    listRef.current.scrollToOffset({ offset, animated: false })
  }

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const paddingToBottom = 24
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - paddingToBottom
    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom)
    }
  }

  const scrollToBottom = () => {
    if (!listRef.current) return
    if (contentHeight > 0 && listHeight > 0) {
      const offset = Math.max(0, contentHeight - listHeight)
      listRef.current.scrollToOffset({ offset, animated: true })
    } else {
      listRef.current.scrollToEnd({ animated: true })
    }
    setIsAtBottom(true)
  }

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
              await supabase.from('rides').delete().eq('id', room.ride_id)
            }
            await supabase.from('chat_rooms').delete().eq('id', roomId)
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
            size="sm"
          />
        )}
        <View style={[styles.msgBubbleWrap, isMe && styles.msgBubbleWrapMe]}>
          {!isMe && (
            <Text style={styles.msgSender}>{msg.sender?.name}</Text>
          )}
          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>
              {msg.text}
            </Text>
          </View>
          <Text style={styles.msgTime}>{fmtMessageTime(msg.created_at)}</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{room?.title ?? '...'}</Text>
        </View>
        {isOwner && (
          <View style={styles.menuWrap}>
            <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={styles.menuBtn}>
              <MoreVertical size={20} color={colors.slate400} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={styles.dropdown}>
                <TouchableOpacity style={styles.dropdownItem} onPress={handleEdit}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pencil size={14} color={colors.slate700} /><Text style={styles.dropdownText}>Edit {isRide ? 'Ride' : 'Chat Room'}</Text></View>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={handleDelete}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Trash2 size={14} color={colors.red600} /><Text style={[styles.dropdownText, styles.dropdownDanger]}>Delete</Text></View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {menuOpen && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          onPress={() => setMenuOpen(false)}
        />
      )}

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' && keyboardOpen ? 'padding' : undefined}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={m => m.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          onLayout={e => setListHeight(e.nativeEvent.layout.height)}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              <View style={styles.expiryNotice}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Timer size={12} color={colors.slate400} /><Text style={styles.expiryNoticeText}>Chat auto-deletes after 24h</Text></View>
              </View>
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
                <MessageCircle size={36} color={colors.slate300} />
                <Text style={styles.emptyMessagesLabel}>No messages yet — say something!</Text>
              </View>
            ) : null
          }
        />

        {/* Scroll-to-bottom + Quick replies */}
        {!isAtBottom && messages.length > 0 && (
          <View style={styles.scrollToBottomWrap}>
            <TouchableOpacity
              style={styles.scrollToBottomBtn}
              activeOpacity={0.85}
              onPress={scrollToBottom}
            >
              <ChevronLeft
                size={16}
                color={colors.white}
                // rotate left chevron to point down
                style={{ transform: [{ rotate: '90deg' }] }}
              />
              <Text style={styles.scrollToBottomText}>New messages</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick replies */}
        <View style={styles.quickReplies}>
          <FlatList
            horizontal
            data={quickReplies}
            keyExtractor={q => q.label}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickReply}
                onPress={() => { handleQuickReply(item.text) }}
              >
                <Text style={styles.quickReplyText}>{item.label}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.lg }}
          />
        </View>

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: 0 }]}>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Say something..."
              placeholderTextColor={colors.slate400}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Send size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
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
  headerInfo: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate900 },

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

  // Messages
  messageList: { flex: 1, backgroundColor: colors.slate50 },
  messageContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  expiryNotice: {
    alignSelf: 'center', marginBottom: 12,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.slate200,
  },
  expiryNoticeText: { fontSize: fontSize.xs, color: colors.slate400 },
  chatRouteMap: { marginHorizontal: spacing.lg, marginBottom: 12, borderRadius: 12 },
  emptyMessages: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyMessagesLabel: { fontSize: fontSize.sm, color: colors.slate400 },

  scrollToBottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 84, // just above input + quick replies
    alignItems: 'center',
  },
  scrollToBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blue500,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    ...shadow.blue,
  },
  scrollToBottomText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },

  msgRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubbleWrap: { maxWidth: '75%', gap: 3 },
  msgBubbleWrapMe: { alignItems: 'flex-end' },
  msgSender: { fontSize: fontSize.xs, color: colors.slate400, paddingLeft: 4 },
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
  msgTime: { fontSize: 10, color: colors.slate400, paddingHorizontal: 4 },

  // Quick replies
  quickReplies: {
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.slate100,
    backgroundColor: colors.white,
  },
  quickReply: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.slate100, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.slate200,
  },
  quickReplyText: { fontSize: fontSize.xs, color: colors.slate600 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
  inputWrap: {
    flex: 1, backgroundColor: colors.slate100,
    borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.xxl, paddingHorizontal: spacing.lg,
    height: 42, justifyContent: 'center', maxHeight: 42,
  },
  input: { fontSize: fontSize.base, color: colors.slate800, lineHeight: 20 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.blue500, alignItems: 'center', justifyContent: 'center',
    ...shadow.blue,
  },
  sendBtnDisabled: { backgroundColor: colors.slate200 },
})
