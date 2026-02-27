// supabase/functions/send-notification/index.ts
// FCM HTTP V1 API — uses service account JWT, not legacy server key
// Deploy: supabase functions deploy send-notification

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-fbsvc@velochat-3a2d5.iam.gserviceaccount.com'
const PROJECT_ID = 'velochat-3a2d5'
const TOKEN_URI = 'https://oauth2.googleapis.com/token'
const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`

// Private key stored as Supabase secret: FIREBASE_PRIVATE_KEY
// Set it with: supabase secrets set FIREBASE_PRIVATE_KEY="$(cat serviceAccount.json | jq -r .private_key)"
const PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')!

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    sub: SERVICE_ACCOUNT_EMAIL,
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${header}.${payload}`

  const pemContents = PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const keyBuffer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${sigB64}`

  const res = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const { access_token } = await res.json()
  return access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { recipientIds, title, body, data } = await req.json()
    if (!recipientIds?.length || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: profiles } = await supabase
      .from('profiles').select('id, fcm_token')
      .in('id', recipientIds).not('fcm_token', 'is', null)

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    const accessToken = await getAccessToken()

    const results = await Promise.allSettled(profiles.map(p =>
      fetch(FCM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token: p.fcm_token,
            notification: { title, body },
            data: data ?? {},
            android: { priority: 'high', notification: { sound: 'default', channel_id: 'default' } },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } },
          },
        }),
      })
    ))

    const sent = results.filter(r => r.status === 'fulfilled').length

    await supabase.from('notifications').insert(
      recipientIds.map((uid: string) => ({ user_id: uid, type: data?.type ?? 'general', title, body, data: data ?? {} }))
    )

    return new Response(JSON.stringify({ sent, total: profiles.length }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
