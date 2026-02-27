import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'
import { registerForPushNotifications, saveFcmToken } from '../lib/notifications'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, name: string, handle: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
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
  user_metadata: { name: 'Test Rider', handle: '@testrider', avatar_initials: 'TR' },
  created_at: new Date().toISOString(),
} as User

const MOCK_PROFILE: Profile = {
  id: 'mock-user-001',
  name: 'Test Rider',
  handle: '@testrider',
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

    const timeout = setTimeout(() => setLoading(false), 10000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
          const token = await registerForPushNotifications()
          if (token) await saveFcmToken(session.user.id, token)
        } else {
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

  async function signUp(email: string, password: string, name: string, handle: string) {
    const avatarInitials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, handle: handle.startsWith('@') ? handle : `@${handle}`, avatar_initials: avatarInitials },
      },
    })
    return { error }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (data) setProfile(data)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
