// supabase/functions/send-notification/index.ts
// Sends push notifications via OneSignal REST API.
// Deploy with: supabase functions deploy send-notification --no-verify-jwt
// Secrets needed (set in Dashboard → Edge Functions → Secrets):
//   PUSH_TRIGGER_SECRET  – any strong random string (same value stored in vault as 'push_trigger_secret')
//   ONESIGNAL_APP_ID     – from OneSignal dashboard
//   ONESIGNAL_REST_API_KEY – from OneSignal dashboard (REST API Key)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_TRIGGER_SECRET = (Deno.env.get('PUSH_TRIGGER_SECRET') ?? '').trim()
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') ?? ''
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY') ?? ''
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
      },
    })
  }

  try {
    const triggerSecret = (req.headers.get('x-trigger-secret') ?? '').trim()

    if (!PUSH_TRIGGER_SECRET) {
      return new Response(
        JSON.stringify({
          error: 'PUSH_TRIGGER_SECRET not configured',
          hint: 'Add PUSH_TRIGGER_SECRET in Edge Function secrets (Dashboard → Edge Functions → send-notification → Secrets).',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (triggerSecret !== PUSH_TRIGGER_SECRET) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          hint: 'x-trigger-secret header must match PUSH_TRIGGER_SECRET. Store the same value in vault as push_trigger_secret and in Edge Function secrets as PUSH_TRIGGER_SECRET.',
          debug: {
            receivedLen: triggerSecret.length,
            expectedLen: PUSH_TRIGGER_SECRET.length,
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { recipientIds, title, body, data } = await req.json()
    if (!recipientIds?.length || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    }

    if (recipientIds.length > 100) {
      return new Response(JSON.stringify({ error: 'Too many recipients (max 100)' }), { status: 400 })
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'OneSignal not configured',
          hint: 'Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in Edge Function secrets.',
        }),
        { status: 500 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: recipientIds,
      channel_for_external_user_ids: 'push',
      contents: { en: body },
      headings: { en: title },
      data: data ?? {},
    }

    const oneSignalRes = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const oneSignalResult = await oneSignalRes.json().catch(() => ({}))
    const sent = oneSignalResult?.recipients ?? 0

    if (!oneSignalRes.ok) {
      return new Response(
        JSON.stringify({
          error: 'OneSignal API error',
          status: oneSignalRes.status,
          onesignal: oneSignalResult,
          payload_recipient_ids: recipientIds,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await supabase.from('notifications').insert(
      recipientIds.map((uid: string) => ({
        user_id: uid,
        type: data?.type ?? 'general',
        title,
        body,
        data: data ?? {},
      }))
    )

    return new Response(
      JSON.stringify({ sent, onesignal: oneSignalResult }),
      { status: 200 }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
