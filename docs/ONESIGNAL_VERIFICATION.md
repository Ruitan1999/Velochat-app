# OneSignal setup verification checklist

Verified that the switch from Supabase/Expo push to OneSignal is wired correctly in code. Use this list to confirm your environment and deployment.

---

## ✅ Code (all correct)

### App – client

| Item | Status | Location |
|------|--------|----------|
| OneSignal SDK | ✅ | `react-native-onesignal`, `onesignal-expo-plugin` in package.json |
| OneSignal plugin | ✅ | `app.json` → `plugins`: `["onesignal-expo-plugin", {"mode":"development"}]` |
| App ID in config | ✅ | `app.json` → `extra.onesignalAppId`: `da56aaa9-83c2-4ac3-8219-00a97740f710` |
| Init on app load | ✅ | `AuthContext.tsx`: `initOneSignal()` in provider `useEffect` |
| Set user ID on sign-in | ✅ | `AuthContext.tsx`: `setOneSignalUserId(session.user.id)` when `session?.user` |
| Clear user ID on sign-out | ✅ | `AuthContext.tsx`: `clearOneSignalUserId()` when session null and in `signOut()` |
| Notification click → deep link | ✅ | `_layout.tsx`: `setupOneSignalNotificationClick()` in `AuthGate`; `onesignal.ts` routes `roomId` → `/chat/[roomId]`, `rideId` → `/ride/[rideId]` |

### Backend – Supabase

| Item | Status | Location |
|------|--------|----------|
| Edge Function uses OneSignal API | ✅ | `send-notification/index.ts`: `include_external_user_ids: recipientIds`, `contents`, `headings`, `data` |
| Expects same trigger payload | ✅ | Function expects `recipientIds`, `title`, `body`, `data` (unchanged) |
| DB trigger unchanged | ✅ | `011_push_notifications_ride_chat.sql`: still POSTs to `send-notification` with `recipientIds`, `title`, `body`, `data: { roomId, type }` |
| In-app notifications table | ✅ | Function still inserts into `notifications` for in-app feed |

### Removed / unused

| Item | Status |
|------|--------|
| Expo push registration in auth | ✅ | No `registerForPushNotifications` or `saveFcmToken` in `AuthContext` |
| Token in DB for push | ✅ | OneSignal uses external user ID only; `profiles.fcm_token` not used for sending |

---

## ⚠️ You must confirm (environment / deployment)

1. **Edge Function secrets** (Supabase Dashboard → Edge Functions → send-notification → Secrets):
   - `ONESIGNAL_APP_ID` = `da56aaa9-83c2-4ac3-8219-00a97740f710`
   - `ONESIGNAL_REST_API_KEY` = your OneSignal REST API key (Dashboard → Settings → Keys & IDs)

2. **Edge Function deployed**  
   Run: `supabase functions deploy send-notification`

3. **Vault secret** (so DB trigger can call the function):  
   Run `supabase/scripts/setup_push_vault_secret.sql` in SQL Editor with your **Supabase service role key** (if not already done).

4. **Migration 011 applied**  
   So the trigger uses the updated payload and `apikey` header. If you ran it when adding OneSignal, you’re good.

5. **Build**  
   Use a **development or preview build** (not Expo Go). OneSignal does not work in Expo Go.

---

## End-to-end flow

1. User signs in → `OneSignal.login(supabaseUserId)` links device to that user in OneSignal.
2. Someone sends a message in a ride chat → DB trigger runs → POST to `send-notification` with `recipientIds` (all chat participants except sender).
3. Edge Function → OneSignal API with `include_external_user_ids: recipientIds` → OneSignal delivers to all devices for those user IDs.
4. User taps notification → OneSignal click event → app routes to `/chat/[roomId]` (or `/ride/[rideId]` if you add that in `data`).

---

**Summary:** All app and backend code for the Supabase → OneSignal change is in place and consistent. To finish setup, set the two Edge Function secrets, deploy the function, ensure the vault secret and migration 011 are applied, and test on a dev/preview build.
