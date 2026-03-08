import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import { supabase, Profile } from '../lib/supabase'
import { initOneSignal, setOneSignalUserId, clearOneSignalUserId } from '../lib/onesignal'
import { getAvatarColor } from '../lib/theme'

// Reconnect after background: both iOS and Android suspend/close connections when app is backgrounded.
// When returning from background, re-read the cached session (fast) and bump appResumeKey so data hooks refetch.
// startAutoRefresh() handles actual token refresh in the background.
const RESUME_SESSION_DELAY_MS = 500

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** Increments when app returns from background; use in deps to re-subscribe realtime */
  appResumeKey: number
  requestLoginOtp: (email: string) => Promise<{ error: Error | null }>
  requestSignUpOtp: (email: string, name: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null; userId?: string }>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ appResumeKey: 0 } as AuthContextType)

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
  created_at: new Date().toISOString(),
}

const USE_MOCK_USER = false

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(USE_MOCK_USER ? MOCK_USER : null)
  const [profile, setProfile] = useState<Profile | null>(USE_MOCK_USER ? MOCK_PROFILE : null)
  const [loading, setLoading] = useState(USE_MOCK_USER ? false : true)
  const [appResumeKey, setAppResumeKey] = useState(0)
  const prevStateRef = useRef<AppStateStatus>('active')
  const mountedRef = useRef(true)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (USE_MOCK_USER) return
    mountedRef.current = true

    initOneSignal()
    const timeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false)
    }, 5000)

    if (AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh()
    }

    const syncSession = async (nextSession: Session | null) => {
      if (!mountedRef.current) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        setOneSignalUserId(nextSession.user.id)
        await fetchProfile(nextSession.user.id)
        return
      }

      clearOneSignalUserId()
      setProfile(null)
      setLoading(false)
    }

    const bootstrapSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        await syncSession(data.session ?? null)
      } catch {
        if (!mountedRef.current) return
        clearOneSignalUserId()
        setSession(null)
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }

    void bootstrapSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        await syncSession(nextSession)
      }
    )

    // Official Supabase React Native pattern: stop auto-refresh in background, restart on foreground.
    // When returning from background, read cached session (fast) and bump appResumeKey so data hooks refetch.
    // startAutoRefresh() handles actual token refresh in the background automatically.
    const appSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const prev = prevStateRef.current
      prevStateRef.current = state
      if (state === 'active') {
        supabase.auth.startAutoRefresh()
        const becameActive = prev === 'background' || prev === 'inactive'
        if (becameActive) {
          if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
          resumeTimeoutRef.current = setTimeout(async () => {
            resumeTimeoutRef.current = null
            if (!mountedRef.current) return
            try {
              const { data } = await supabase.auth.getSession()
              if (!mountedRef.current) return
              if (data.session?.user) {
                setSession(data.session)
                setUser(data.session.user)
                setOneSignalUserId(data.session.user.id)
              }
              // After a long background (30+ min), the access token may be expired.
              // getSession() returns the cached (possibly expired) token; check and
              // refresh once before bumping appResumeKey so data hooks get a valid token.
              const expiry = data.session?.expires_at // unix seconds
              const nowSec = Math.floor(Date.now() / 1000)
              const isExpired = !expiry || expiry <= nowSec + 30 // 30 s buffer
              if (isExpired && data.session) {
                try {
                  const { data: refreshed } = await supabase.auth.refreshSession()
                  if (refreshed.session && mountedRef.current) {
                    setSession(refreshed.session)
                    setUser(refreshed.session.user)
                  }
                } catch {
                  // refresh failed — continue; hooks will retry or show stale data
                }
              }
            } catch {
              // getSession from cache shouldn't fail, but if it does just continue
            }
            if (mountedRef.current) setAppResumeKey(k => k + 1)
          }, RESUME_SESSION_DELAY_MS)
          return
        }
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })

    return () => {
      mountedRef.current = false
      clearTimeout(timeout)
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
        resumeTimeoutRef.current = null
      }
      supabase.auth.stopAutoRefresh()
      subscription.unsubscribe()
      appSub.remove()
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
    if (error) return { error, userId: undefined }
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
    return { error: null, userId: data?.user?.id }
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

  async function refreshProfile(userId?: string) {
    const id = userId ?? user?.id
    if (id) await fetchProfile(id)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, appResumeKey, requestLoginOtp, requestSignUpOtp, verifyOtp, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
