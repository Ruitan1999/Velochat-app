import { useEffect, useState, useCallback } from 'react'
import { supabase, Ride, ChatRoom, Message, Club, Profile, Friendship } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─── useRides ─────────────────────────────────────────────────
// Fetches rides visible to the current user (their clubs + invited)

export function useRides() {
  const { user } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Get user's club IDs
    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)

    const clubIds = (memberships ?? []).map((m: { club_id: string }) => m.club_id)

    // Fetch rides for those clubs or organized by user
    const { data } = await supabase
      .from('rides')
      .select(`
        *,
        organizer:profiles!organizer_id(id, name, handle, avatar_initials, avatar_color),
        rsvps:ride_rsvps(*, profile:profiles(id, name, avatar_initials, avatar_color)),
        chat_rooms(*)
      `)
      .or(`organizer_id.eq.${user.id},club_id.in.(${clubIds.join(',')})`)
      .gt('chat_expiry', new Date().toISOString())
      .order('created_at', { ascending: false })

    const filtered = (data ?? []).filter((r: any) => {
      const inClub = r.club_id && clubIds.includes(r.club_id)
      const isOrganizer = r.organizer_id === user.id
      const invitedByRsvp = (r.rsvps ?? []).some((rv: any) => rv.user_id === user.id)
      return isOrganizer || inClub || invitedByRsvp
    })

    // Fetch unread counts per room for current user (messages from others after last_read_at)
    const { data: unreadData } = await supabase.rpc('get_unread_counts', { p_user_id: user.id })
    const unreadByRoom = new Map<string, number>()
    ;(unreadData ?? []).forEach((row: { room_id: string; unread_count: number }) => {
      unreadByRoom.set(row.room_id, Number(row.unread_count) || 0)
    })

    const rides = filtered.map((r: any) => {
      const chatRoom = r.chat_rooms?.[0] ?? null
      const unread = chatRoom ? (unreadByRoom.get(chatRoom.id) ?? 0) : 0
      return {
        ...r,
        chat_room: chatRoom ? { ...chatRoom, unread_count: unread } : null,
        chat_rooms: undefined,
      }
    })
    setRides(rides)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('rides-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ride_rsvps',
      }, () => fetch())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => fetch())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetch])

  return { rides, loading, refetch: fetch, setRides }
}

// ─── useChatRooms ─────────────────────────────────────────────

export function useChatRooms() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        participants:chat_participants(user_id, profile:profiles(id, name, avatar_initials, avatar_color))
      `)
      .eq('type', 'general')
      .order('created_at', { ascending: false })

    // Filter to rooms user is a participant of
    const myRooms = (data ?? []).filter((r: ChatRoom & { participants: { user_id: string }[] }) =>
      r.participants?.some((p: { user_id: string }) => p.user_id === user.id)
    )
    setRooms(myRooms)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  return { rooms, loading, refetch: fetch, setRooms }
}

// ─── useMessages ──────────────────────────────────────────────
// Fetches messages for a room + subscribes to realtime updates

export function useMessages(roomId: string) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roomId) return

    // Initial fetch
    supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const newId = payload.new.id
        // Skip if we already have this message (from optimistic insert)
        setMessages(prev => {
          if (prev.some(m => m.id === newId)) return prev
          return prev // will be replaced below
        })
        const { data: msg } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color)')
          .eq('id', newId)
          .single()
        if (msg) setMessages(prev => prev.some(m => m.id === newId) ? prev : [...prev, msg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  const sendMessage = async (text: string) => {
    if (!user || !text.trim()) return

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
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
    }).select('*, sender:profiles!sender_id(id, name, avatar_initials, avatar_color)').single()

    if (error) {
      console.error('sendMessage failed:', error.message, error.details, error.hint)
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      return
    }

    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
  }

  return { messages, loading, sendMessage }
}

// ─── useClubs ─────────────────────────────────────────────────

export function useClubs() {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('clubs')
      .select(`
        *,
        members:club_members(user_id, role, profile:profiles(id, name, handle, avatar_initials, avatar_color))
      `)
      .order('name')

    const enriched = (data ?? []).map((c: Club & { members: { user_id: string; role: string }[] }) => ({
      ...c,
      is_member: c.members?.some((m: { user_id: string }) => m.user_id === user.id),
      is_admin: c.admin_id === user.id,
    }))
    setClubs(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const createClub = async (data: {
    name: string, handle: string, avatar_initials: string, color: string, description: string
  }) => {
    if (!user) return
    const { data: club, error } = await supabase
      .from('clubs')
      .insert({ ...data, admin_id: user.id })
      .select()
      .single()

    if (club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'admin' })
      fetch()
    }
    return { error }
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
      supabase.from('friendships').select('*, requester:profiles!requester_id(id,name,avatar_initials,avatar_color), addressee:profiles!addressee_id(id,name,avatar_initials,avatar_color)')
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
