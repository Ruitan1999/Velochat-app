import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'
import { initOneSignal, setOneSignalUserId, clearOneSignalUserId } from '../lib/onesignal'
import { getAvatarColor } from '../lib/theme'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  requestLoginOtp: (email: string) => Promise<{ error: Error | null }>
  requestSignUpOtp: (email: string, name: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

// TEMP: mock user for testing without auth
const MOCK_USER: User = {
  id: 'mock-user-001',
  email: 'rider@velochat.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { name: 'Test Rider', avatar_initials: 'TR' },
  created_at: new Date().toISOString(),
} as User

const MOCK_PROFILE: Profile = {
  id: 'mock-user-001',
  name: 'Test Rider',
  avatar_initials: 'TR',
  avatar_color: '#3B82F6',
  bio: 'Mock user for testing',
  created_at: new Date().toISOString(),
}

const USE_MOCK_USER = false

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(USE_MOCK_USER ? MOCK_USER : null)
  const [profile, setProfile] = useState<Profile | null>(USE_MOCK_USER ? MOCK_PROFILE : null)
  const [loading, setLoading] = useState(USE_MOCK_USER ? false : true)

  useEffect(() => {
    if (USE_MOCK_USER) return

    initOneSignal()
    const timeout = setTimeout(() => setLoading(false), 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
          setOneSignalUserId(session.user.id)
        } else {
          clearOneSignalUserId()
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) {
        setProfile(data)
      }
    } catch {
      // Profile fetch failed — continue without profile
    } finally {
      setLoading(false)
    }
  }

  async function requestLoginOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    })
    return { error: error ?? null }
  }

  async function requestSignUpOtp(email: string, name: string) {
    const avatarInitials = name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    const avatarColor = getAvatarColor(avatarInitials)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        data: { name: name.trim(), avatar_initials: avatarInitials, avatar_color: avatarColor },
        shouldCreateUser: true,
      },
    })
    return { error: error ?? null }
  }

  async function verifyOtp(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    })
    if (error) return { error }
    // Ensure profile has name from sign-up metadata (trigger may not set it)
    if (data?.user) {
      const meta = data.user.user_metadata
      const name = meta?.name as string | undefined
      if (name) {
        const initials = (meta?.avatar_initials as string) ?? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        const color = (meta?.avatar_color as string) ?? getAvatarColor(initials)
        await supabase.from('profiles').update({ name, avatar_initials: initials, avatar_color: color }).eq('id', data.user.id)
      }
    }
    return { error: null }
  }

  async function signOut() {
    clearOneSignalUserId()
    await supabase.auth.signOut()
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (data) setProfile(data)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, requestLoginOtp, requestSignUpOtp, verifyOtp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
