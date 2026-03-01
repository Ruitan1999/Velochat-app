# Push notifications setup (ride chat & all chats)

VeloChat uses **OneSignal** for push notifications. See **[docs/ONESIGNAL_SETUP.md](./ONESIGNAL_SETUP.md)** for full setup.

## Quick checklist

1. **OneSignal app** – Create app at onesignal.com, configure FCM (Android) and APNs (iOS).
2. **app.json** – Set `extra.onesignalAppId` to your OneSignal App ID.
3. **Edge Function secrets** – Add `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` in Supabase Dashboard → Edge Functions → send-notification → Secrets.
4. **Vault secret** – Run `supabase/scripts/setup_push_vault_secret.sql` so the DB trigger can call the Edge Function.
5. **Deploy** – `supabase functions deploy send-notification`
6. **Build** – Use EAS build (not Expo Go) to test push.
