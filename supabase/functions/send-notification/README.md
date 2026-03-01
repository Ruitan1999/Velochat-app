# send-notification

Sends push notifications via Expo Push API. Used by the app when messages are sent.

## How to test from Supabase Dashboard

1. **Redeploy the function** (if you changed code)  
   From project root: `npx supabase functions deploy send-notification`

2. **Open the function**  
   Supabase Dashboard → Edge Functions → `send-notification` → **Test**.

3. **Fix 401 Unauthorized**  
   The function requires the **service_role** key in the request:
   - Go to **Project Settings** → **API** (or **Database** → **API** in some UIs).
   - Under **Project API keys**, copy the **service_role** key (the secret one, not the anon key).
   - In the test modal, under **Headers**:
     - Remove any placeholder headers.
     - Click **Add Headers** and add:
       - **Key:** `Authorization`
       - **Value:** `Bearer` followed by a space, then paste the service_role key (e.g. `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...`). No quotes, no extra spaces.
   - Ensure the **Role** dropdown at the bottom is set to **service role** (some dashboards send this key automatically when you pick service role; if yours doesn’t, the manual header above is required).

4. **Request body**  
   Use **POST** and a JSON body like:

   ```json
   {
     "recipientIds": ["USER_UUID_HERE"],
     "title": "Test notification",
     "body": "Hello from VeloChat"
   }
   ```

   - `recipientIds`: array of profile `id`s (UUIDs) to notify. Use one user who has the app installed and has granted notification permission (so their `profiles.fcm_token` is set).
   - Optional: `"data": { "type": "chat" }` for chat-style notifications.

5. **Send**  
   Click **Send Request**. You should get **200** with something like `{ "sent": 1, "expo": { ... } }`.

   - If you get `{ "sent": 0 }` or `"No valid Expo tokens"`, that user has no `fcm_token` in `profiles` (open the app on a device, grant notifications, and send a message once so the token is saved).
   - To find a user UUID: Table Editor → `profiles` → copy an `id` that has `fcm_token` set.

## Testing from the app

Send a message in a ride chat. The app calls this function for other participants; if their device has a valid Expo push token, they receive the notification.
