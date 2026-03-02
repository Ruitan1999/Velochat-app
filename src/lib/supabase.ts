import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

// ─── Replace these with your Supabase project values ──────────
// Dashboard → Settings → API
const SUPABASE_URL = 'https://hvwkcukmynnogoktyspl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2d2tjdWtteW5ub2dva3R5c3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzg1MDAsImV4cCI6MjA4NzcxNDUwMH0.mqAl7I8R__Xqr4azr4HexTOeNMF2vaB5kypipqr_j8M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ─── TypeScript Types ─────────────────────────────────────────

export type Profile = {
  id: string
  name: string
  avatar_initials: string
  avatar_color: string
  avatar_url?: string
  fcm_token?: string
  visibility?: 'public' | 'private'
  created_at: string
}

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
  // joined
  requester?: Profile
  addressee?: Profile
}

export type Club = {
  id: string
  name: string
  avatar_initials: string
  avatar_url?: string
  color: string
  description?: string
  visibility?: 'public' | 'private'
  admin_id: string
  member_count: number
  created_at: string
  // joined
  members?: ClubMember[]
  is_member?: boolean
  is_admin?: boolean
}

export type ClubMember = {
  club_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profile?: Profile
}

export type Ride = {
  id: string
  title: string
  date: string
  time: string
  distance?: string
  location?: string
  organizer_id: string
  club_id?: string
  invite_type: 'club' | 'riders'
  chat_expiry: string
  created_at: string
  // optional route details (from uploaded route files)
  route_polyline?: string
  route_distance_km?: number
  route_elevation_m?: number
  route_name?: string
  // joined
  organizer?: Profile
  rsvps?: RideRsvp[]
  chat_room?: ChatRoom
}

export type RideRsvp = {
  ride_id: string
  user_id: string
  status: 'in' | 'out'
  created_at: string
  profile?: Profile
}

export type ChatRoom = {
  id: string
  title: string
  description?: string
  type: 'ride' | 'general'
  ride_id?: string
  club_id?: string
  created_by: string
  expiry: string
  created_at: string
  // joined
  last_message?: Message
  unread_count?: number
  participants?: Profile[]
}

export type Message = {
  id: string
  room_id: string
  sender_id: string
  text: string
  image_url?: string
  created_at: string
  // joined
  sender?: Profile
}

export type Notification = {
  id: string
  user_id: string
  type: 'new_message' | 'ride_invite' | 'friend_request' | 'rsvp'
  title: string
  body?: string
  data?: Record<string, unknown>
  read: boolean
  created_at: string
}
