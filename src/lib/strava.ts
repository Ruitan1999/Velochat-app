import * as WebBrowser from 'expo-web-browser'
import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'

// ─── Strava App Credentials ───────────────────────────────────────────────────
// 1. Go to https://www.strava.com/settings/api
// 2. Create an application
// 3. Set Authorization Callback Domain to: velochat.app (or your domain)
// 4. Paste your Client ID and Secret below

const STRAVA_CLIENT_ID = 'YOUR_STRAVA_CLIENT_ID'
const STRAVA_CLIENT_SECRET = 'YOUR_STRAVA_CLIENT_SECRET'
const STRAVA_REDIRECT_URI = 'velochat://strava-callback'
const STRAVA_SCOPE = 'read,activity:read,profile:read_all'

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_API_BASE = 'https://www.strava.com/api/v3'

export type StravaTokens = {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
    profile: string
  }
}

export type StravaRoute = {
  id: number
  name: string
  description?: string
  distance: number        // metres
  elevation_gain: number  // metres
  type: number            // 1 = ride, 2 = run
  sub_type: number        // 1 = road, 2 = mountain bike, 3 = cx, 4 = trail, 5 = mixed
  map: {
    summary_polyline: string
    polyline?: string
  }
  starred: boolean
  created_at: string
  estimated_moving_time: number // seconds
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

export async function connectStrava(): Promise<{ success: boolean; error?: string }> {
  const state = Math.random().toString(36).substring(7)

  const authUrl =
    `${STRAVA_AUTH_URL}?client_id=${STRAVA_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${STRAVA_SCOPE}` +
    `&state=${state}`

  // Open Strava in browser
  const result = await WebBrowser.openAuthSessionAsync(authUrl, STRAVA_REDIRECT_URI)

  if (result.type !== 'success') {
    return { success: false, error: 'Browser session cancelled' }
  }

  // Parse code from redirect URL
  const url = new URL(result.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')

  if (!code || returnedState !== state) {
    return { success: false, error: 'Invalid OAuth response' }
  }

  // Exchange code for tokens
  const tokenRes = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return { success: false, error: 'Token exchange failed' }
  }

  const tokens: StravaTokens = await tokenRes.json()

  // Store tokens securely on device
  await SecureStore.setItemAsync('strava_tokens', JSON.stringify(tokens))

  // Save strava_athlete_id to Supabase profile for reference
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({
      strava_athlete_id: tokens.athlete.id,
      strava_connected: true,
    }).eq('id', user.id)
  }

  return { success: true }
}

export async function disconnectStrava() {
  await SecureStore.deleteItemAsync('strava_tokens')
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({
      strava_athlete_id: null,
      strava_connected: false,
    }).eq('id', user.id)
  }
}

export async function isStravaConnected(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync('strava_tokens')
  return !!stored
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function getValidTokens(): Promise<StravaTokens | null> {
  const stored = await SecureStore.getItemAsync('strava_tokens')
  if (!stored) return null

  const tokens: StravaTokens = JSON.parse(stored)

  // Refresh if expired (with 5 min buffer)
  if (tokens.expires_at < Date.now() / 1000 + 300) {
    const refreshRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshRes.ok) {
      await SecureStore.deleteItemAsync('strava_tokens')
      return null
    }

    const refreshed = await refreshRes.json()
    const updated = { ...tokens, ...refreshed }
    await SecureStore.setItemAsync('strava_tokens', JSON.stringify(updated))
    return updated
  }

  return tokens
}

// ─── Fetch saved routes from Strava ──────────────────────────────────────────

export async function fetchStravaRoutes(page = 1): Promise<StravaRoute[]> {
  const tokens = await getValidTokens()
  if (!tokens) throw new Error('Not connected to Strava')

  const res = await fetch(
    `${STRAVA_API_BASE}/athletes/${tokens.athlete.id}/routes?per_page=30&page=${page}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (!res.ok) throw new Error('Failed to fetch Strava routes')
  return res.json()
}

// ─── Fetch full polyline for a specific route ─────────────────────────────────

export async function fetchStravaRoutePolyline(routeId: number): Promise<string | null> {
  const tokens = await getValidTokens()
  if (!tokens) return null

  const res = await fetch(
    `${STRAVA_API_BASE}/routes/${routeId}`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (!res.ok) return null
  const route: StravaRoute = await res.json()
  return route.map?.polyline ?? route.map?.summary_polyline ?? null
}

// ─── Export route as GPX from Strava ─────────────────────────────────────────

export async function exportStravaRouteGPX(routeId: number): Promise<string | null> {
  const tokens = await getValidTokens()
  if (!tokens) return null

  const res = await fetch(
    `${STRAVA_API_BASE}/routes/${routeId}/export_gpx`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (!res.ok) return null
  return res.text()
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatStravaDistance(metres: number): string {
  return `${(metres / 1000).toFixed(1)}km`
}

export function formatStravaElevation(metres: number): string {
  return `↑${Math.round(metres)}m`
}

export function formatStravaTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function getStravaRouteType(type: number, subType: number): string {
  if (type === 2) return 'Run'
  const bikeTypes: Record<number, string> = { 1: 'Road', 2: 'MTB', 3: 'CX', 4: 'Trail', 5: 'Mixed' }
  return bikeTypes[subType] ?? 'Ride'
}
