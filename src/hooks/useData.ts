import { useEffect, useState, useCallback, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { supabase, Ride, ChatRoom, Message, Club, Profile, Friendship } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// After resume (iOS & Android), network/realtime can be cut; timeouts and delayed refetch help reconnect
const FETCH_TIMEOUT_MS = 25000
const RESUME_TIMEOUT_RETRY_DELAY_MS = 4000

type DataFetchOpts = { silent?: boolean; retryAfterTimeout?: boolean }

// ─── useRides ─────────────────────────────────────────────────
// Fetches rides visible to the current user (their clubs + invited)

export function useRides() {
  const { user, appResumeKey } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<(opts?: DataFetchOpts) => void>(() => {})
  const isResumingRef = useRef(false)
  const fetchInFlightRef = useRef(false)

  const fetch = useCallback(async (opts?: DataFetchOpts) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (fetchInFlightRef.current && opts?.silent) return
    if (!opts?.silent) setLoading(true)
    fetchInFlightRef.current = true
    const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), FETCH_TIMEOUT_MS))
    const doFetch = async (): Promise<Ride[]> => {
      const { data: memberships } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
      const clubIds = (memberships ?? []).map((m: { club_id: string }) => m.club_id)
      const ridesQuery = supabase
        .from('rides')
        .select(`
          *,
          organizer:profiles!organizer_id(id, name, avatar_initials, avatar_color, avatar_url),
          rsvps:ride_rsvps(*, profile:profiles!user_id(id, name, avatar_initials, avatar_color, avatar_url)),
          chat_rooms(*)
        `)
      const { data, error } = clubIds.length > 0
        ? await ridesQuery.or(`organizer_id.eq.${user.id},club_id.in.(${clubIds.join(',')})`).order('created_at', { ascending: false })
        : await ridesQuery.eq('organizer_id', user.id).order('created_at', { ascending: false })
      if (error) console.warn('Failed to load rides:', error.message)
      const now = Date.now()
      const filtered = (data ?? []).filter((r: any) => {
        const inClub = r.club_id && clubIds.includes(r.club_id)
        const isOrganizer = r.organizer_id === user.id
        const invitedByRsvp = (r.rsvps ?? []).some((rv: any) => rv.user_id === user.id)
        if (!(isOrganizer || inClub || invitedByRsvp)) return false
        if (r.chat_expiry != null && new Date(r.chat_expiry).getTime() <= now) return false
        try {
          if (!r.date || !r.time) return true
          const rideDateTime = new Date(`${r.date}T${r.time}`)
          if (Number.isNaN(rideDateTime.getTime())) return true
          return now < rideDateTime.getTime() + 24 * 60 * 60 * 1000
        } catch (_) {
          return true
        }
      })
      const { data: unreadData } = await supabase.rpc('get_unread_counts', { p_user_id: user.id })
      const unreadByRoom = new Map<string, number>()
      ;(unreadData ?? []).forEach((row: { room_id: string; unread_count: number }) => {
        unreadByRoom.set(row.room_id, Number(row.unread_count) || 0)
      })
      return filtered.map((r: any) => {
        const rawRoom = r.chat_rooms?.[0] ?? null
        const expired = rawRoom?.expiry && new Date(rawRoom.expiry).getTime() <= now
        const chatRoom = rawRoom && !expired ? rawRoom : null
        const unread = chatRoom ? (unreadByRoom.get(chatRoom.id) ?? 0) : 0
        return {
          ...r,
          chat_room: chatRoom ? { ...chatRoom, unread_count: unread } : null,
          chat_rooms: undefined,
        }
      })
    }
    try {
      const result = await Promise.race([doFetch(), timeoutPromise])
      setRides(result)
    } catch (e) {
      if (e instanceof Error && e.message === 'timeout') {
        console.warn('Rides fetch timed out (e.g. after app resume)')
        // Retry once after a delay so network/session can recover
        if (opts?.silent && !opts?.retryAfterTimeout) {
          setTimeout(() => fetchRef.current?.({ silent: true, retryAfterTimeout: true }), RESUME_TIMEOUT_RETRY_DELAY_MS)
        }
      } else {
        console.warn('useRides fetch error:', e)
      }
    } finally {
      fetchInFlightRef.current = false
      setLoading(false)
    }
  }, [user])

  fetchRef.current = fetch
  useEffect(() => { fetch() }, [fetch])

  // Refetch when app returns from background and session has been refreshed (appResumeKey increments after getSession).
  useEffect(() => {
    if (appResumeKey === 0 || !user) return
    isResumingRef.current = true
    fetchRef.current?.({ silent: true })
    const t = setTimeout(() => {
      isResumingRef.current = false
    }, 3000)
    return () => clearTimeout(t)
  }, [appResumeKey, user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`rides-updates-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ride_rsvps',
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const refetchSilent = useCallback(() => fetch({ silent: true }), [fetch])
  return { rides, loading, refetch: fetch, refetchSilent, setRides }
}

// ─── useChatRooms ─────────────────────────────────────────────

export function useChatRooms() {
  const { user, appResumeKey } = useAuth()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const fetchRef = useRef<(opts?: DataFetchOpts) => void>(() => {})
  const isResumingRef = useRef(false)
  const fetchInFlightRef = useRef(false)

  const fetch = useCallback(async (opts?: DataFetchOpts) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (fetchInFlightRef.current && opts?.silent) return
    if (!opts?.silent) setLoading(true)
    fetchInFlightRef.current = true
    const timeoutPromise = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('timeout')), FETCH_TIMEOUT_MS)
    )
    const doFetch = async (): Promise<ChatRoom[]> => {
      void Promise.resolve(supabase.rpc('delete_expired_chat_rooms')).catch(() => {})
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          participants:chat_participants(user_id, profile:profiles(id, name, avatar_initials, avatar_color, avatar_url))
        `)
        .eq('type', 'general')
        .gt('expiry', nowIso)
        .order('created_at', { ascending: false })
      const myRooms = (data ?? []).filter((r: ChatRoom & { participants: { user_id: string }[] }) =>
        r.participants?.some((p: { user_id: string }) => p.user_id === user.id)
      )
      const { data: unreadData } = await supabase.rpc('get_unread_counts', { p_user_id: user.id })
      const unreadByRoom = new Map<string, number>()
      ;(unreadData ?? []).forEach((row: { room_id: string; unread_count: number }) => {
        unreadByRoom.set(row.room_id, Number(row.unread_count) || 0)
      })
      return myRooms.map((r: any) => ({
        ...r,
        unread_count: unreadByRoom.get(r.id) ?? 0,
      }))
    }
    try {
      const result = await Promise.race([doFetch(), timeoutPromise])
      setRooms(result)
    } catch (e) {
      if (e instanceof Error && e.message === 'timeout') {
        console.warn('Chat rooms fetch timed out (e.g. after app resume)')
        if (opts?.silent && !opts?.retryAfterTimeout) {
          setTimeout(() => fetchRef.current?.({ silent: true, retryAfterTimeout: true }), RESUME_TIMEOUT_RETRY_DELAY_MS)
        }
      } else {
        console.warn('useChatRooms fetch error:', e)
      }
    } finally {
      fetchInFlightRef.current = false
      setLoading(false)
    }
  }, [user])

  fetchRef.current = fetch
  useEffect(() => { fetch() }, [fetch])

  // Refetch when app returns from background and session has been refreshed (appResumeKey increments after getSession).
  useEffect(() => {
    if (appResumeKey === 0 || !user) return
    isResumingRef.current = true
    fetchRef.current?.({ silent: true })
    const t = setTimeout(() => {
      isResumingRef.current = false
    }, 3000)
    return () => clearTimeout(t)
  }, [appResumeKey, user])

  // Realtime: new messages, new rooms, or added as participant → refetch list
  // Use ref so callback always runs latest fetch (avoids stale closure, e.g. on iOS)
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_rooms',
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`,
      }, () => { if (!isResumingRef.current) fetchRef.current?.() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const refetchSilent = useCallback(() => fetch({ silent: true }), [fetch])
  return { rooms, loading, refetch: fetch, refetchSilent, setRooms }
}

// ─── useMessages ──────────────────────────────────────────────
// Fetches messages for a room + subscribes to realtime updates.
// Refetches when screen gains focus and when app returns to foreground so data stays fresh after backgrounding.

export function useMessages(roomId: string) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color, avatar_url)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.warn('useMessages fetch failed:', error.message)
      setLoading(false)
      return
    }
    setMessages((data ?? []).reverse())
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      setMessages([])
      return
    }

    fetchMessages()

    // Realtime subscription (new channel per roomId; cleanup on unmount or roomId change)
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const newId = payload.new.id
        const { data: msg } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color, avatar_url)')
          .eq('id', newId)
          .single()
        if (msg) setMessages(prev => prev.some(m => m.id === newId) ? prev : [...prev, msg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, fetchMessages])

  // When app returns to foreground, refetch messages so we recover from disconnected realtime
  useEffect(() => {
    if (!roomId) return
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') fetchMessages()
    })
    return () => sub.remove()
  }, [roomId, fetchMessages])

  const sendMessage = async (text: string): Promise<{ roomDeleted?: boolean } | void> => {
    if (!user || !text.trim()) return

    const optimistic: Message = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      room_id: roomId,
      sender_id: user.id,
      text: text.trim(),
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.user_metadata?.name ?? 'You',
        avatar_initials: user.user_metadata?.avatar_initials ?? '?',
        avatar_color: user.user_metadata?.avatar_color ?? '#3B82F6',
      },
    } as Message

    setMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase.from('messages').insert({
      room_id: roomId,
      sender_id: user.id,
      text: text.trim(),
    }).select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color, avatar_url)').single()

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      // Foreign key violation means the room no longer exists
      if (error.code === '23503' || /not present in table.*chat_rooms/i.test(error.message)) {
        return { roomDeleted: true }
      }
      console.error('sendMessage failed:', error.message, error.details, error.hint)
      return
    }

    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
  }

  const sendImage = async (uri: string) => {
    if (!user) return

    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const fileName = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const response = await fetch(uri)
    const blob = await response.blob()
    const arrayBuffer = await new Response(blob).arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(fileName, arrayBuffer, {
        contentType: blob.type || `image/${ext}`,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload failed:', uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl

    const optimistic: Message = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      room_id: roomId,
      sender_id: user.id,
      text: '',
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        name: user.user_metadata?.name ?? 'You',
        avatar_initials: user.user_metadata?.avatar_initials ?? '?',
        avatar_color: user.user_metadata?.avatar_color ?? '#3B82F6',
      },
    } as Message

    setMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase.from('messages').insert({
      room_id: roomId,
      sender_id: user.id,
      text: '',
      image_url: imageUrl,
    }).select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color, avatar_url)').single()

    if (error) {
      console.error('sendImage message failed:', error.message)
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      return
    }

    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
  }

  return { messages, loading, refetch: fetchMessages, sendMessage, sendImage }
}

// ─── useClubs ─────────────────────────────────────────────────

export function useClubs() {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('clubs')
        .select(`
          *,
          members:club_members(user_id, role, profile:profiles(id, name, avatar_initials, avatar_color, avatar_url))
        `)
        .order('name')

      const enriched = (data ?? []).map((c: Club & { members: { user_id: string; role: string }[] }) => ({
        ...c,
        is_member: c.members?.some((m: { user_id: string }) => m.user_id === user.id),
        is_admin: c.admin_id === user.id,
      }))
      setClubs(enriched)
    } catch (e) {
      console.warn('useClubs fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createClub = async (data: {
    name: string; avatar_initials: string; color: string; description: string; visibility?: 'public' | 'private'; avatarImageUri?: string
  }) => {
    if (!user) return { error: null, club: null }
    const { avatarImageUri: _uri, ...insertData } = data
    const { data: club, error } = await supabase
      .from('clubs')
      .insert({ ...insertData, visibility: insertData.visibility ?? 'private', admin_id: user.id })
      .select()
      .single()

    if (club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'admin' })
      fetch()
    }
    return { error, club: club ?? null }
  }

  return { clubs, loading, refetch: fetch, createClub, setClubs }
}

// ─── useRiders ────────────────────────────────────────────────

export function useRiders() {
  const { user } = useAuth()
  const [riders, setRiders] = useState<Profile[]>([])
  const [friends, setFriends] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: profiles }, { data: friendships }] = await Promise.all([
      supabase.from('profiles').select('*').neq('id', user.id).order('name'),
      supabase.from('friendships').select('*, requester:profiles!requester_id(id,name,avatar_initials,avatar_color,avatar_url), addressee:profiles!addressee_id(id,name,avatar_initials,avatar_color,avatar_url)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted'),
    ])

    setRiders(profiles ?? [])
    setFriends(friendships ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const addFriend = async (addresseeId: string) => {
    await supabase.from('friendships').insert({
      requester_id: user?.id,
      addressee_id: addresseeId,
      status: 'accepted', // simplified: direct add, no pending flow
    })
    fetch()
  }

  const removeFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    fetch()
  }

  const isFriend = (riderId: string) =>
    friends.some(f => f.requester_id === riderId || f.addressee_id === riderId)

  const getFriendshipId = (riderId: string) =>
    friends.find(f => f.requester_id === riderId || f.addressee_id === riderId)?.id

  return { riders, friends, loading, refetch: fetch, addFriend, removeFriend, isFriend, getFriendshipId }
}

// ─── useRsvp ─────────────────────────────────────────────────

export function useRsvp(rideId: string) {
  const { user } = useAuth()

  const setRsvp = async (status: 'in' | 'out' | null) => {
    if (!user) return

    if (status === null) {
      await supabase.from('ride_rsvps').delete()
        .eq('ride_id', rideId).eq('user_id', user.id)
    } else {
      await supabase.from('ride_rsvps').upsert({
        ride_id: rideId,
        user_id: user.id,
        status,
      }, { onConflict: 'ride_id,user_id' })
    }
  }

  return { setRsvp }
}

// ─── useExtendChat ────────────────────────────────────────────

export function useExtendChat() {
  const extendRoom = async (roomId: string) => {
    const { data: room } = await supabase
      .from('chat_rooms').select('expiry').eq('id', roomId).single()
    if (!room) return

    const newExpiry = new Date(new Date(room.expiry).getTime() + 24 * 3600000).toISOString()
    await supabase.from('chat_rooms').update({ expiry: newExpiry }).eq('id', roomId)
  }

  const extendRide = async (rideId: string) => {
    const { data: ride } = await supabase
      .from('rides').select('chat_expiry').eq('id', rideId).single()
    if (!ride) return

    const newExpiry = new Date(new Date(ride.chat_expiry).getTime() + 24 * 3600000).toISOString()
    await supabase.from('rides').update({ chat_expiry: newExpiry }).eq('id', rideId)
  }

  return { extendRoom, extendRide }
}
