# Debug: Ride chat push not received

You don’t set **headers or message content** in the OneSignal dashboard. The app sends **title** and **body** from the backend when a message is inserted. Use this checklist to find why the other device isn’t getting the notification.

---

## 1. Confirm the trigger runs (Supabase)

When someone sends a message, the DB trigger should call the Edge Function.

- **Supabase Dashboard** → **Edge Functions** → **send-notification** → **Logs**.
- Send a message from one account in a ride chat.
- Check if a **new log entry** appears for that time.  
  - **No new log** → trigger isn’t calling the function (see step 4).  
  - **New log** → note the response body and status (step 2).

---

## 2. Inspect the Edge Function response

In the same **Logs** tab, open the latest **send-notification** invocation and look at the **response**:

- **200 + `sent: 1` (or more)** → function and OneSignal accepted the request. If the device still doesn’t get a notification, see step 5.
- **502 + `OneSignal API error`** → response body will include `onesignal` (e.g. `errors: ["..."]`). Fix the issue (e.g. wrong key, wrong app id, or invalid payload).
- **500 + `OneSignal not configured`** → set **Edge Function secrets**: `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY`.
- **401** → trigger isn’t sending a valid service role key. See **“Fixing 401”** below, then ensure the **vault secret** is set (step 3).

---

## Fixing 401 (key mismatch)

If the Edge Function returns **401**, the key sent by the trigger doesn’t match the project’s service role key.

1. **Re-set the vault key**
   - In **Dashboard** → **Project Settings** → **API**, copy the **service_role** key (Reveal → Copy). Paste into a plain editor and remove any trailing space or newline.
   - Open **`supabase/scripts/setup_push_vault_secret.sql`**, replace `YOUR_SERVICE_ROLE_KEY_HERE` with that exact string, then run the script in **SQL Editor**.

2. **Ensure the trigger trims the key**
   - Run **`supabase/scripts/fix_trigger_trim_vault_key.sql`** in SQL Editor (same as migration 011; ensures the key read from vault is trimmed).

3. **Redeploy the Edge Function**
   - `supabase functions deploy send-notification`

4. **See the 401 debug body (optional)**
   - pg_net doesn’t return response bodies, so to see why the key fails, call the function with the same key from your machine:
   ```bash
   curl -s -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification' \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"recipientIds":["SOME_UUID"],"title":"Test","body":"Test","data":{}}'
   ```
   - Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` (and `SOME_UUID` if you want a real test). If the response is 401 with `lengthsMatch: false` and **envKeyLen is much smaller than receivedLen** (e.g. 41 vs 219), the Edge Function is using a **wrong/short** key: remove any **Edge Function secret** named `SUPABASE_SERVICE_ROLE_KEY` in Dashboard → Edge Functions → send-notification → Secrets. The platform injects the real key automatically; a custom secret overrides it and causes this mismatch. Delete that secret, redeploy the function, then try again.

---

## 3. Vault secret (trigger auth)

The trigger needs the **Supabase service role key** in Vault so it can authenticate to the Edge Function.

- Run **`supabase/scripts/setup_push_vault_secret.sql`** in the **SQL Editor**, with your real service role key in place of `YOUR_SERVICE_ROLE_KEY_HERE`.
- If the secret already exists, you don’t need to create it again.

---

## 4. Trigger and migration

- **Migration 011** must be applied so the trigger exists and sends the right payload (including `apikey` header).
- In **SQL Editor** run:
  ```sql
  select tgname from pg_trigger where tgname = 'on_new_message_send_notification';
  ```
  One row should be returned. If not, run the migration that creates this trigger.

- **pg_net** must be enabled so the trigger can make HTTP requests:
  ```sql
  create extension if not exists pg_net with schema extensions;
  ```

---

## 5. Recipients and external IDs

- **Chat participants**  
  Only users in **chat_participants** for that room get notifications (and the sender is excluded).  
  Both accounts must have joined the ride chat (e.g. opened the ride and the chat) so they’re in `chat_participants`.

- **OneSignal external ID**  
  The trigger sends **Supabase user IDs** (UUIDs) as `recipientIds`. In the app we call `OneSignal.login(supabaseUserId)`, so the **External User ID** in OneSignal must be that same UUID.

- In **OneSignal** → **Audience** → **All Users**, each subscriber should show an **External User ID** equal to the Supabase user id for that account. If they match, targeting is correct.

---

## 6. Redeploy and test

After changing Edge Function code or secrets:

```bash
supabase functions deploy send-notification
```

Then send a message again and check **Edge Function logs** and the other device.

---

---

## 7. Still no notification? (trigger not calling function)

If **no new log** appears when you send a message, the trigger either isn’t firing or pg_net isn’t reaching the Edge Function. Do this in order:

### A. Confirm the function works when called from the DB

1. Open **`supabase/scripts/test_send_notification_manual.sql`**.
2. Replace `YOUR_RECIPIENT_USER_UUID` with **your** Supabase user ID (from Auth or from OneSignal “External User ID”).
3. Run the script in **SQL Editor**.
4. Wait 10–20 seconds, then run **`supabase/scripts/check_pg_net_responses.sql`** (use the Option A query; if it errors, try Option B).
5. Check the result:
   - **status_code 200** and you received a push on your device → function and OneSignal are fine; the problem is the **trigger** or **recipients**.
   - **status_code 401** → vault key wrong or not sent; re-run **setup_push_vault_secret.sql** with the correct service role key.
   - **status_code 502** or body with “OneSignal API error” → fix Edge Function secrets (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY).

### B. See if the trigger is calling the function when you send a message

1. Send **one message** in a ride chat from the app.
2. Wait **10–20 seconds**.
3. Run **`check_pg_net_responses.sql`** in SQL Editor.
4. If there are **no new rows** (or none in the last minute) → the trigger is not calling the function. Common causes:
   - Vault secret missing or wrong name → run **setup_push_vault_secret.sql** again.
   - Trigger not created → run migration **011_push_notifications_ride_chat.sql** (the part that creates the trigger).

### C. Confirm both users are in the chat room

1. Run **`supabase/scripts/check_chat_participants.sql`** in SQL Editor.
2. Find the room for your test ride. **Both** users (sender and recipient) must appear in `participant_user_ids` for that room.
3. If the recipient is missing, have them **open the ride** and **tap “Ride Chat”** so they’re added to `chat_participants`; then try again.

---

**Summary:** You do **not** set headers or message content in the OneSignal UI. Title and body come from the backend. Use the **manual test** and **check_pg_net_responses** to see if the DB can call the function and if the trigger runs when you send a message; use **check_chat_participants** to ensure both users are in the room.
